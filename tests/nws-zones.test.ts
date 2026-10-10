import { getNwsZoneBoundaries, NWS_ZONE_LIMITS, validNwsZoneUrl } from "../src/services/nwsZones";
import type { AlertGeometry, GeoPosition } from "../src/domain/types";

const zone = (id = "TXZ345", type = "forecast") => `https://api.weather.gov/zones/${type}/${id}`;
const outer: GeoPosition[] = [[-100, 29], [-98, 29], [-98, 31], [-100, 31], [-100, 29]];
const hole: GeoPosition[] = [[-99.8, 29.2], [-99.8, 29.8], [-99.2, 29.8], [-99.2, 29.2], [-99.8, 29.2]];
const polygon: AlertGeometry = { type: "Polygon", coordinates: [outer, hole] };

function feature(url: string, geometry: AlertGeometry = polygon, properties: Record<string, unknown> = {}) {
  const segments = url.split("/");
  const zoneType = segments[segments.length - 2];
  return {
    type: "Feature", id: url, geometry,
    properties: {
      "@id": url, id: segments[segments.length - 1],
      type: zoneType === "forecast" ? "public" : zoneType,
      name: "Official administrative zone", ...properties,
    },
  };
}

function response(url: string, data: unknown = feature(url), options: { status?: number; headers?: Record<string, string>; text?: string } = {}) {
  const status = options.status ?? 200;
  const headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    url, status, ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: jest.fn(async () => options.text ?? JSON.stringify(data)),
  } as unknown as Response;
}

let clock = Date.parse("2026-10-10T20:00:00Z");
let fetchMock: jest.SpyInstance;
beforeEach(() => {
  // The loader deliberately exposes no cache mutation API. Advance beyond its
  // documented RAM lifetime to isolate each test through the public API.
  clock += NWS_ZONE_LIMITS.cacheAgeMs + 1;
  jest.useFakeTimers({ now: clock });
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => response(String(url)));
});
afterEach(() => { jest.useRealTimers(); });

describe("explicit NWS zone boundaries", () => {
  test("only accepts exact HTTPS official endpoints without query, fragment, or redirects", async () => {
    for (const url of [zone(), zone("TXC199", "county"), zone("TXZ345", "fire")]) expect(validNwsZoneUrl(url)).toBe(true);
    const invalid = ["http://api.weather.gov/zones/forecast/TXZ345", `${zone()}?x=1`, `${zone()}#x`,
      "https://api.weather.gov.evil.test/zones/forecast/TXZ345", "https://api.weather.gov:443/zones/forecast/TXZ345",
      "https://api.weather.gov/zones/forecast/txz345", "https://api.weather.gov/zones/marine/AMZ350"];
    for (const url of invalid) expect(validNwsZoneUrl(url)).toBe(false);
    const result = await getNwsZoneBoundaries(invalid);
    expect(result).toMatchObject({ requested: invalid.length, failed: invalid.length, loaded: 0, notLoaded: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("preserves exact Polygon holes and MultiPolygon parts, accepting public forecast identity", async () => {
    const multi: AlertGeometry = { type: "MultiPolygon", coordinates: [[outer, hole], [outer]] };
    fetchMock.mockImplementation(async (url) => response(String(url), feature(String(url), String(url).includes("county") ? multi : polygon)));
    const result = await getNwsZoneBoundaries([zone(), zone("TXC199", "county"), zone()]);
    expect(result).toMatchObject({ requested: 2, loaded: 2, failed: 0, notLoaded: 0 });
    expect(result.boundaries[0]).toMatchObject({ url: zone(), id: "TXZ345", zoneType: "forecast", cached: false, geometry: polygon });
    expect(result.boundaries[1].geometry).toEqual(multi);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Accept: "application/geo+json" } });
  });

  test.each([
    ["Feature id", (value: ReturnType<typeof feature>) => ({ ...value, id: zone("TXZ346") })],
    ["properties id", (value: ReturnType<typeof feature>) => ({ ...value, properties: { ...value.properties, id: "TXZ346" } })],
    ["properties URL", (value: ReturnType<typeof feature>) => ({ ...value, properties: { ...value.properties, "@id": zone("TXZ346") } })],
    ["zone type", (value: ReturnType<typeof feature>) => ({ ...value, properties: { ...value.properties, type: "county" } })],
  ])("rejects a mismatching %s instead of rendering another zone", async (_label, change) => {
    fetchMock.mockResolvedValue(response(zone(), change(feature(zone()))));
    const result = await getNwsZoneBoundaries([zone()]);
    expect(result).toMatchObject({ loaded: 0, failed: 1 });
    expect(result.failures[0].error.kind).toBe("invalid-response");
  });

  test("rejects a redirected response identity", async () => {
    fetchMock.mockResolvedValue(response(zone("TXZ346")));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 0, failed: 1 });
  });

  test("downloads sequentially and caps each explicit request at four distinct zones", async () => {
    let complete!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { complete = resolve; }));
    const urls = Array.from({ length: 6 }, (_, index) => zone(`TXZ${300 + index}`));
    const pending = getNwsZoneBoundaries(urls);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    complete(response(urls[0]));
    const result = await pending;
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(urls.slice(0, 4));
    expect(result).toMatchObject({ requested: 6, loaded: 4, failed: 0, notLoaded: 2, notLoadedUrls: urls.slice(4) });
  });

  test("retains usable partial results when an ordinary HTTP failure occurs", async () => {
    fetchMock.mockImplementation(async (url) => response(String(url), undefined, { status: String(url) === zone() ? 404 : 200 }));
    const result = await getNwsZoneBoundaries([zone(), zone("TXZ346")]);
    expect(result).toMatchObject({ requested: 2, loaded: 1, failed: 1, notLoaded: 0 });
    expect(result.failures[0].error).toMatchObject({ kind: "http", status: 404 });
  });

  test("honors Retry-After without retrying or fetching remaining uncached zones", async () => {
    fetchMock.mockResolvedValueOnce(response(zone(), undefined, { status: 429, headers: { "Retry-After": "90" } }));
    const first = await getNwsZoneBoundaries([zone(), zone("TXZ346")]);
    expect(first).toMatchObject({ loaded: 0, failed: 1, notLoaded: 1, retryAfterMs: 90_000 });
    expect(first.failures[0].error).toMatchObject({ status: 429, retryAfterMs: 90_000 });
    expect(await getNwsZoneBoundaries([zone("TXZ347")])).toMatchObject({ notLoaded: 1, retryAfterMs: 90_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 90_000);
    expect(await getNwsZoneBoundaries([zone("TXZ347")])).toMatchObject({ loaded: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("uses a 30-second minimum pause when HTTP429 has no Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(response(zone(), undefined, { status: 429 }));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ retryAfterMs: 30_000, failed: 1 });
  });

  test("a service Retry-After also pauses503 lookups while verified RAM copies remain usable", async () => {
    await getNwsZoneBoundaries([zone()]);
    fetchMock.mockResolvedValueOnce(response(zone("TXZ346"), undefined, { status: 503, headers: { "Retry-After": "120" } }));
    const result = await getNwsZoneBoundaries([zone("TXZ346"), zone(), zone("TXZ347")]);
    expect(result).toMatchObject({ loaded: 1, failed: 1, notLoaded: 1, retryAfterMs: 120_000 });
    expect(result.boundaries[0].cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not fetch an already-cancelled request", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(getNwsZoneBoundaries([zone()], controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("cancellation reaches fetch and never returns partial areas", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = getNwsZoneBoundaries([zone(), zone("TXZ346")], controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("times out an unresponsive zone after 12 seconds", async () => {
    fetchMock.mockImplementation((_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = getNwsZoneBoundaries([zone()]);
    await jest.advanceTimersByTimeAsync(12_000);
    const result = await pending;
    expect(result.failures[0].error.kind).toBe("timeout");
    expect(result.loaded).toBe(0);
  });

  test("a cancelled response body is never entered into the RAM cache", async () => {
    const controller = new AbortController();
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    fetchMock.mockImplementationOnce(async (url, options) => {
      const reply = response(String(url));
      reply.text = jest.fn(() => new Promise<string>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("body aborted")), { once: true });
        bodyStarted();
      }));
      return reply;
    });
    const pending = getNwsZoneBoundaries([zone()], controller.signal);
    await started;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect((await getNwsZoneBoundaries([zone()])).boundaries[0].cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("rejects a declared oversized body before reading it while allowing another small zone", async () => {
    const oversized = response(zone(), undefined, { headers: { "Content-Length": String(NWS_ZONE_LIMITS.responseBytes + 1) } });
    fetchMock.mockResolvedValueOnce(oversized);
    const result = await getNwsZoneBoundaries([zone(), zone("TXZ346")]);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(result).toMatchObject({ loaded: 1, failed: 1, notLoaded: 0 });
  });

  test("bounds accepted batch data and skips further downloads when the remaining budget is too small", async () => {
    const urls = [zone(), zone("TXZ346"), zone("TXZ347"), zone("TXZ348")];
    const bodies = urls.map((url) => JSON.stringify(feature(url, polygon, { ignoredPadding: "x".repeat(800_000) })));
    const replies = urls.map((url, index) => response(url, undefined, { text: bodies[index], headers: { "Content-Length": String(bodies[index].length) } }));
    fetchMock.mockImplementation(async (url) => replies[urls.indexOf(String(url))]);
    const result = await getNwsZoneBoundaries(urls);
    expect(result).toMatchObject({ loaded: 2, failed: 1, notLoaded: 1, notLoadedUrls: [urls[3]] });
    expect(replies[2].text).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.reason).toMatch(/budget/);
  });

  test("counts UTF-8 bytes when Content-Length is unavailable", async () => {
    const text = JSON.stringify(feature(zone(), polygon, { ignoredPadding: "界".repeat(400_000) }));
    expect(text.length).toBeLessThan(NWS_ZONE_LIMITS.responseBytes);
    fetchMock.mockResolvedValueOnce(response(zone(), undefined, { text }));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 0, failed: 1 });
  });

  test("an oversized unannounced response consumes the batch budget and stops later downloads", async () => {
    const urls = [zone(), zone("TXZ346"), zone("TXZ347"), zone("TXZ348")];
    fetchMock.mockImplementation(async (url) => response(String(url), feature(String(url), polygon, { ignoredPadding: "x".repeat(800_000) })));
    const result = await getNwsZoneBoundaries(urls);
    expect(result).toMatchObject({ loaded: 2, failed: 1, notLoaded: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.boundaries.length).toBeLessThanOrEqual(NWS_ZONE_LIMITS.endpoints);
  });

  test("unreadable JSON fails verification without concealing another valid zone", async () => {
    fetchMock.mockResolvedValueOnce(response(zone(), undefined, { text: "{not valid JSON" }));
    const result = await getNwsZoneBoundaries([zone(), zone("TXZ346")]);
    expect(result).toMatchObject({ loaded: 1, failed: 1 });
    expect(result.failures[0].error.kind).toBe("invalid-response");
  });

  test("accepts a realistic coastal multipart boundary and rejects geometry over its part budget", async () => {
    const coastal: AlertGeometry = { type: "MultiPolygon", coordinates: Array.from({ length: 247 }, () => [outer]) };
    fetchMock.mockResolvedValueOnce(response(zone(), feature(zone(), coastal)));
    expect((await getNwsZoneBoundaries([zone()])).boundaries[0].geometry).toEqual(coastal);
    const excess: AlertGeometry = { type: "MultiPolygon", coordinates: Array.from({ length: NWS_ZONE_LIMITS.parts + 1 }, () => [outer]) };
    fetchMock.mockResolvedValueOnce(response(zone("TXZ346"), feature(zone("TXZ346"), excess)));
    expect(await getNwsZoneBoundaries([zone("TXZ346")])).toMatchObject({ loaded: 0, failed: 1 });
  });

  test("rejects open rings and out-of-range coordinates", async () => {
    const invalid = [
      { type: "Polygon", coordinates: [[[-100, 30], [-99, 30], [-99, 31], [-100, 31]]] },
      { type: "Polygon", coordinates: [[[181, 30], [-99, 30], [-99, 31], [181, 30]]] },
    ];
    for (let index = 0; index < invalid.length; index += 1) {
      const url = zone(`TXZ${350 + index}`);
      fetchMock.mockResolvedValueOnce(response(url, feature(url, invalid[index] as AlertGeometry)));
      expect(await getNwsZoneBoundaries([url])).toMatchObject({ loaded: 0, failed: 1 });
    }
  });

  test("limits aggregate vertices independently of the per-zone budget", async () => {
    const dense: AlertGeometry = { type: "Polygon", coordinates: [Array.from({ length: 6_500 }, () => [-99, 30])] };
    fetchMock.mockImplementation(async (url) => response(String(url), feature(String(url), dense)));
    const result = await getNwsZoneBoundaries(Array.from({ length: 4 }, (_, index) => zone(`TXZ${350 + index}`)));
    expect(result).toMatchObject({ loaded: 3, failed: 0, notLoaded: 1 });
    expect(result.reason).toMatch(/geometry budget/);
  });

  test("rejects a zone beyond its individual vertex limit", async () => {
    const dense: AlertGeometry = { type: "Polygon", coordinates: [Array.from({ length: NWS_ZONE_LIMITS.vertices + 1 }, () => [-99, 30])] };
    fetchMock.mockResolvedValueOnce(response(zone(), feature(zone(), dense)));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 0, failed: 1 });
  });

  test("uses RAM copies with original fetch time then revalidates after 24 hours", async () => {
    const first = await getNwsZoneBoundaries([zone()]);
    jest.setSystemTime(Date.now() + 60_000);
    const cached = await getNwsZoneBoundaries([zone()]);
    expect(cached.boundaries[0]).toMatchObject({ cached: true, fetchedAt: first.boundaries[0].fetchedAt });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.setSystemTime(clock + NWS_ZONE_LIMITS.cacheAgeMs);
    expect((await getNwsZoneBoundaries([zone()])).boundaries[0].cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("evicts the oldest zone when the 16-entry RAM limit is reached", async () => {
    const urls = Array.from({ length: 17 }, (_, index) => zone(`TXZ${400 + index}`));
    for (const url of urls) await getNwsZoneBoundaries([url]);
    expect((await getNwsZoneBoundaries([urls[16]])).boundaries[0].cached).toBe(true);
    expect((await getNwsZoneBoundaries([urls[0]])).boundaries[0].cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(18);
  });

  test("revalidates a RAM entry after the device clock moves backwards", async () => {
    await getNwsZoneBoundaries([zone()]);
    jest.setSystemTime(Date.now() - 1);
    expect((await getNwsZoneBoundaries([zone()])).boundaries[0].cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("bounds RAM weight as well as entry count", async () => {
    fetchMock.mockImplementation(async (url) => response(String(url), feature(String(url), polygon, { ignoredPadding: "x".repeat(800_000) })));
    const urls = [zone("TXZ450"), zone("TXZ451"), zone("TXZ452")];
    for (const url of urls) await getNwsZoneBoundaries([url]);
    expect((await getNwsZoneBoundaries([urls[2]])).boundaries[0].cached).toBe(true);
    expect((await getNwsZoneBoundaries([urls[0]])).boundaries[0].cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("retains optional official validity metadata independently of warning dates", async () => {
    const dates = { effectiveDate: "2026-04-16T18:00:00+00:00", expirationDate: "2200-01-01T00:00:00+00:00" };
    fetchMock.mockResolvedValueOnce(response(zone(), feature(zone(), polygon, dates)));
    expect((await getNwsZoneBoundaries([zone()])).boundaries[0]).toMatchObject(dates);
    expect((await getNwsZoneBoundaries([zone("TXZ346")])).boundaries[0]).not.toHaveProperty("effectiveDate");
  });

  test.each([
    { effectiveDate: "2200-01-01T00:00:00Z" },
    { expirationDate: "2020-01-01T00:00:00Z" },
    { effectiveDate: "2026-02-30T00:00:00Z" },
    { expirationDate: "2200-01-01T00:00:00" },
    { expirationDate: null },
  ])("rejects unverifiable or noncurrent validity metadata %j", async (dates) => {
    fetchMock.mockResolvedValueOnce(response(zone(), feature(zone(), polygon, dates)));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 0, failed: 1 });
  });

  test("never returns an expired RAM boundary even before its 24-hour lifetime", async () => {
    const expirationDate = new Date(Date.now() + 60_000).toISOString();
    fetchMock.mockImplementation(async (url) => response(String(url), feature(String(url), polygon, { expirationDate })));
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 1 });
    jest.setSystemTime(Date.now() + 60_000);
    expect(await getNwsZoneBoundaries([zone()])).toMatchObject({ loaded: 0, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("removes a boundary that expires while another zone is downloading", async () => {
    const expiry = new Date(Date.now() + 1_000).toISOString();
    fetchMock.mockResolvedValueOnce(response(zone(), feature(zone(), polygon, { expirationDate: expiry })));
    fetchMock.mockImplementationOnce(async (url) => {
      jest.setSystemTime(Date.now() + 1_000);
      return response(String(url));
    });
    const result = await getNwsZoneBoundaries([zone(), zone("TXZ346")]);
    expect(result).toMatchObject({ loaded: 1, failed: 1, notLoaded: 0 });
    expect(result.boundaries[0].url).toBe(zone("TXZ346"));
    expect(result.failures[0].reason).toMatch(/expired/);
  });
});
