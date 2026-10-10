import { ClearPathDataError } from "../src/data/http";
import type { AlertGeometry, GeoPosition } from "../src/domain/types";
import { getWildfirePerimeters, NIFC_PERIMETER_LAYER_URL, WILDFIRE_LIMITS, WildfireLimitError } from "../src/services/nifcWildfires";

const NOW = Date.parse("2026-10-10T23:00:00Z");
const outer: GeoPosition[] = [[-100, 29], [-98, 29], [-98, 31], [-100, 31], [-100, 29]];
const hole: GeoPosition[] = [[-99.8, 29.2], [-99.8, 29.8], [-99.2, 29.8], [-99.2, 29.2], [-99.8, 29.2]];
const polygon: AlertGeometry = { type: "Polygon", coordinates: [outer, hole] };

function feature(id = 1, geometry: unknown = polygon, extra: Record<string, unknown> = {}) {
  return {
    type: "Feature", id, geometry,
    properties: {
      OBJECTID: id, GlobalID: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      poly_IncidentName: `Fire ${id}`, attr_IncidentName: "Incident name", poly_FeatureCategory: "Wildfire Daily Fire Perimeter",
      attr_IncidentTypeCategory: "WF", attr_POOState: "US-TX", poly_MapMethod: "Infrared Image",
      poly_PolygonDateTime: NOW - 10 * 86_400_000, poly_DateCurrent: NOW - 60_000,
      attr_ModifiedOnDateTime_dt: NOW - 2 * 86_400_000, poly_GISAcres: 120.5, attr_IncidentSize: 150,
      attr_PercentContained: 10, poly_IRWINID: "{11111111-1111-4111-8111-111111111111}", ...extra,
    },
  };
}
function collection(features: unknown[], more = false, extra: Record<string, unknown> = {}) {
  return { type: "FeatureCollection", crs: { type: "name", properties: { name: "EPSG:4326" } }, properties: { exceededTransferLimit: more }, features, ...extra };
}
function response(url: string, data: unknown, options: { status?: number; headers?: Record<string, string>; text?: string } = {}) {
  const status = options.status ?? 200;
  const headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    url, status, ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: jest.fn(async () => options.text ?? JSON.stringify(data)),
  } as unknown as Response;
}
let fetchMock: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  fetchMock = jest.spyOn(globalThis, "fetch");
  replies(1, [collection([feature()])]);
});
afterEach(() => { fetchMock.mockRestore(); jest.useRealTimers(); });

function replies(count: unknown, pages: unknown[]) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const params = new URL(url).searchParams;
    return response(url, params.get("returnCountOnly") === "true" ? { count } : pages[Number(params.get("resultOffset")) / 5]);
  });
}
function ring(length: number): GeoPosition[] {
  const result: GeoPosition[] = Array.from({ length: length - 1 }, (_, index) => {
    const angle = index / (length - 1) * 2 * Math.PI;
    return [Number((-99 + Math.cos(angle)).toFixed(6)), Number((30 + Math.sin(angle)).toFixed(6))];
  });
  return [...result, result[0]];
}

describe("bounded official NIFC wildfire perimeters", () => {
  test("retains exact holes, capture time, independent edit times, identity, and separate acreage", async () => {
    const result = await getWildfirePerimeters("TX");
    expect(result).toMatchObject({ coverage: "TX", available: 1, returned: 1, omitted: 0, truncated: false, reason: null, fetchedAt: new Date(NOW).toISOString(), countedAt: new Date(NOW).toISOString() });
    expect(result.items[0]).toMatchObject({ name: "Fire 1", geometry: polygon, capturedAt: new Date(NOW - 10 * 86_400_000).toISOString(), polygonUpdatedAt: new Date(NOW - 60_000).toISOString(), incidentUpdatedAt: new Date(NOW - 2 * 86_400_000).toISOString(), acres: 120.5, reportedAcres: 150, percentContained: 10, sourceUrl: `${NIFC_PERIMETER_LAYER_URL}/1` });
    expect(result.items[0].geometry.coordinates).toEqual([outer, hole]);
  });

  test("missing capture remains unknown rather than inheriting fresh edit or fetch time", async () => {
    replies(1, [collection([feature(1, polygon, { poly_PolygonDateTime: null, poly_MapMethod: null, poly_GISAcres: null, attr_IncidentSize: null, attr_PercentContained: null })])]);
    expect((await getWildfirePerimeters("US")).items[0]).toMatchObject({ capturedAt: null, acres: null, reportedAcres: null, percentContained: null, mapMethod: null, polygonUpdatedAt: new Date(NOW - 60_000).toISOString() });
  });

  test("preserves supplied MultiPolygon holes and dateline coordinates without normalization", async () => {
    const dateline: GeoPosition[] = [[179, 10], [-179, 10], [-179, 12], [179, 12], [179, 10]];
    const geometry: AlertGeometry = { type: "MultiPolygon", coordinates: [[outer, hole], [dateline]] };
    replies(1, [collection([feature(1, geometry)])]);
    expect((await getWildfirePerimeters("US")).items[0].geometry).toEqual(geometry);
  });

  test.each(["TX", "US"] as const)("%s queries exact WF/daily-perimeter fields without simplifying or a geographic box", async (coverage) => {
    await getWildfirePerimeters(coverage);
    for (const [input, options] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(`${url.origin}${url.pathname}`).toBe(`${NIFC_PERIMETER_LAYER_URL}/query`);
      expect(url.searchParams.get("where")).toBe(`attr_IncidentTypeCategory='WF' AND poly_FeatureCategory='Wildfire Daily Fire Perimeter'${coverage === "TX" ? " AND attr_POOState='US-TX'" : ""}`);
      for (const field of ["geometry", "geometryPrecision", "maxAllowableOffset", "quantizationParameters"]) expect(url.searchParams.has(field)).toBe(false);
      expect(options).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    }
    const page = new URL(String(fetchMock.mock.calls[1][0]));
    expect(page.searchParams.get("outSR")).toBe("4326");
    expect(page.searchParams.get("resultRecordCount")).toBe("5");
    expect(page.searchParams.get("orderByFields")).toBe("poly_DateCurrent DESC,OBJECTID ASC");
  });

  test("counts first, fetches pages sequentially, and stops at four pages/twenty raw records", async () => {
    let complete!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { complete = resolve; }));
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      const offset = Number(new URL(url).searchParams.get("resultOffset"));
      return response(url, collection(Array.from({ length: 5 }, (_, index) => feature(offset + index + 1)), true));
    });
    const pending = getWildfirePerimeters("US");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    complete(response(String(fetchMock.mock.calls[0][0]), { count: 105 }));
    const result = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.slice(1).map(([input]) => new URL(String(input)).searchParams.get("resultOffset"))).toEqual(["0", "5", "10", "15"]);
    expect(result).toMatchObject({ available: 105, returned: 20, omitted: 85, truncated: true });
    expect(result.items).toHaveLength(20);
    expect(result.reason).toMatch(/first 20/);
    expect(result.reason).not.toMatch(/dataset can change/);
  });

  test("a premature page end below the verified count reports a possible changed dataset", async () => {
    replies(2, [collection([feature()])]);
    expect(await getWildfirePerimeters("US")).toMatchObject({ returned: 1, available: 2, omitted: 1, truncated: true, reason: expect.stringMatching(/count and returned records differ/i) });
  });

  test("records exceeding an earlier count remain partial and do not produce negative omitted counts", async () => {
    replies(0, [collection([feature()])]);
    expect(await getWildfirePerimeters("US")).toMatchObject({ returned: 1, available: 0, omitted: 0, truncated: true, reason: expect.stringMatching(/count and returned records differ/i) });
  });

  test("requires both a verified zero count and usable empty collection for an empty snapshot", async () => {
    replies(0, [collection([])]);
    expect(await getWildfirePerimeters("TX")).toMatchObject({ items: [], available: 0, returned: 0, omitted: 0, truncated: false, reason: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each([null, -1, 1.2, "0", Number.MAX_SAFE_INTEGER + 1])("an unverifiable count %s may preserve records only as partial/uncounted", async (count) => {
    replies(count, [collection([feature()])]);
    expect(await getWildfirePerimeters("TX")).toMatchObject({ available: null, countedAt: null, omitted: null, truncated: true, returned: 1, reason: expect.stringMatching(/count could not be verified/) });
  });

  test("a failed count plus an empty page rejects rather than claiming no fires", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      return new URL(url).searchParams.has("returnCountOnly") ? response(url, {}, { status: 503 }) : response(url, collection([]));
    });
    await expect(getWildfirePerimeters("US")).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  test("a malformed count plus empty page rejects, including an otherwise valid zero-length collection", async () => {
    replies("0", [collection([])]);
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("positive count and empty page cannot publish verified empty coverage", async () => {
    replies(12, [collection([])]);
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("a count failure with verified page records is explicit partial data", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      return new URL(url).searchParams.has("returnCountOnly") ? response(url, {}, { status: 502 }) : response(url, collection([feature()]));
    });
    const result = await getWildfirePerimeters("US");
    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({ available: null, omitted: null, countedAt: null, truncated: true });
  });

  test.each([
    { attr_IncidentTypeCategory: "RX" }, { poly_FeatureCategory: "Wildfire Evacuation Area" },
    { attr_POOState: "US-NM" }, { GlobalID: "unverified" }, { OBJECTID: 2 },
    { poly_PolygonDateTime: "2026-10-01T00:00:00Z" }, { poly_DateCurrent: NOW + 600_000 },
    { attr_PercentContained: 101 }, { poly_GISAcres: -1 },
  ])("omits unverifiable/nonmatching record %j only with explicit partial counts", async (extra) => {
    replies(2, [collection([feature(1, polygon, extra), feature(2)])]);
    const result = await getWildfirePerimeters("TX");
    expect(result.items.map((item) => item.objectId)).toEqual([2]);
    expect(result).toMatchObject({ returned: 2, available: 2, omitted: 1, truncated: true, reason: expect.stringMatching(/could not be verified/) });
  });

  test("all-invalid records reject instead of turning missing perimeters into a zero result", async () => {
    replies(1, [collection([feature(1, null)])]);
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test.each([
    { type: "Point", coordinates: [-100, 30] },
    { type: "Polygon", coordinates: [[[181, 30], [180, 31], [179, 30], [181, 30]]] },
    { type: "Polygon", coordinates: [[[0, 91], [1, 89], [0, 89], [0, 91]]] },
    { type: "Polygon", coordinates: [[[0, 0, 5], [1, 0, 5], [1, 1, 5], [0, 0, 5]]] },
    { type: "Polygon", coordinates: [outer.slice(0, -1)] },
    { type: "MultiPolygon", coordinates: [] },
  ])("rejects invalid exact geometry %j", async (geometry) => {
    replies(1, [collection([feature(1, geometry)])]);
    await expect(getWildfirePerimeters("US")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("deduplicates repeated stable GlobalIDs across changing pages without pretending complete", async () => {
    replies(2, [collection([feature()], true), collection([feature()])]);
    const result = await getWildfirePerimeters("US");
    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({ returned: 2, omitted: 1, truncated: true, reason: expect.stringMatching(/Repeated records/) });
  });

  test.each([
    collection(Array.from({ length: 6 }, (_, index) => feature(index + 1))),
    collection([feature()], false, { properties: { exceededTransferLimit: "true" } }),
    collection([], true),
    collection([feature()], false, { crs: { type: "name", properties: { name: "EPSG:3857" } } }),
    { type: "FeatureCollection", features: null },
  ])("rejects an invalid collection without usable items", async (page) => {
    replies(1, [page]);
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("a later network failure retains previously verified records with explicit omitted count", async () => {
    replies(8, [collection([feature()], true)]);
    fetchMock.mockImplementationOnce(async (input) => response(String(input), { count: 8 }))
      .mockImplementationOnce(async (input) => response(String(input), collection([feature()], true)))
      .mockImplementationOnce(async () => { throw new Error("Network lost"); });
    expect(await getWildfirePerimeters("US")).toMatchObject({ items: [expect.objectContaining({ objectId: 1 })], available: 8, returned: 1, omitted: 7, truncated: true, reason: expect.stringMatching(/later page failed/) });
  });

  test("HTTP-200 ArcGIS errors reject, preserving typed Retry-After and stopping page work", async () => {
    fetchMock.mockImplementation(async (input) => response(String(input), { error: { code: 429, message: "Too many requests" } }, { headers: { "Retry-After": "90" } }));
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "http", status: 429, retryAfterMs: 90_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("HTTP-200 page error after accepted records returns partial with provider pause", async () => {
    replies(8, [collection([feature()], true), { error: { code: 429 } }]);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      const params = new URL(url).searchParams;
      if (params.has("returnCountOnly")) return response(url, { count: 8 });
      return params.get("resultOffset") === "0" ? response(url, collection([feature()], true)) : response(url, { error: { code: 429 } }, { headers: { "Retry-After": "75" } });
    });
    expect(await getWildfirePerimeters("US")).toMatchObject({ truncated: true, omitted: 7, retryAfterMs: 75_000, items: [expect.objectContaining({ objectId: 1 })] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("ordinary HTTP Retry-After is preserved as milliseconds", async () => {
    fetchMock.mockImplementation(async (input) => response(String(input), {}, { status: 503, headers: { "Retry-After": new Date(NOW + 120_000).toUTCString() } }));
    await expect(getWildfirePerimeters("US")).rejects.toMatchObject({ kind: "http", status: 503, retryAfterMs: 120_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("ArcGIS error envelopes without verified HTTP error codes cannot become empty data", async () => {
    replies(0, [{ error: { code: "bad", message: "Error" } }]);
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("refuses declared oversized bodies without reading or parsing them", async () => {
    const oversized = response(`${NIFC_PERIMETER_LAYER_URL}/query`, null, { headers: { "Content-Length": String(WILDFIRE_LIMITS.responseBytes + 1) } });
    fetchMock.mockResolvedValue(oversized);
    await expect(getWildfirePerimeters("US")).rejects.toBeInstanceOf(WildfireLimitError);
    expect(oversized.text).not.toHaveBeenCalled();
  });

  test("counts UTF-8 bytes before JSON.parse, including four-byte characters", async () => {
    const text = JSON.stringify(collection([], false, { padding: "🔥".repeat(WILDFIRE_LIMITS.responseBytes / 4) }));
    replies(0, []);
    fetchMock.mockImplementationOnce(async (input) => response(String(input), { count: 0 }))
      .mockImplementationOnce(async (input) => response(String(input), null, { text }));
    const parse = jest.spyOn(JSON, "parse");
    try {
      await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ limit: "response-bytes" });
      expect(parse).not.toHaveBeenCalledWith(text);
    } finally { parse.mockRestore(); }
  });

  test("stops at the two-MiB accepted batch, preserving earlier whole records only", async () => {
    const padded = (id: number, more: boolean) => collection([feature(id)], more, { padding: "x".repeat(740_000) });
    replies(3, [padded(1, true), padded(2, true), padded(3, false)]);
    const result = await getWildfirePerimeters("US");
    expect(result.items.map((item) => item.objectId)).toEqual([1, 2]);
    expect(result).toMatchObject({ omitted: 1, truncated: true, returned: 2, reason: expect.stringMatching(/accepted response-data limit/) });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("allows a large exact 20,672-vertex perimeter but omits one above 25,000 whole", async () => {
    const large = { type: "Polygon", coordinates: [ring(20_672)] };
    const tooLarge = { type: "Polygon", coordinates: [ring(25_001)] };
    replies(2, [collection([feature(1, large)], true), collection([feature(2, tooLarge)])]);
    const result = await getWildfirePerimeters("US");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].geometry).toEqual(large);
    expect(result).toMatchObject({ returned: 2, omitted: 1, truncated: true, reason: expect.stringMatching(/geometry limits/) });
  });

  test("omits a whole perimeter when the 50,000 batch vertex budget would be exceeded", async () => {
    const geometry = { type: "Polygon", coordinates: [ring(20_000)] };
    replies(3, [collection([feature(1, geometry)], true), collection([feature(2, geometry)], true), collection([feature(3, geometry)])]);
    const result = await getWildfirePerimeters("US");
    expect(result.items.map((item) => item.objectId)).toEqual([1, 2]);
    expect(result).toMatchObject({ returned: 3, omitted: 1, truncated: true, reason: expect.stringMatching(/batch geometry limit/) });
  });

  test.each([
    { type: "MultiPolygon", coordinates: Array.from({ length: WILDFIRE_LIMITS.parts + 1 }, () => [outer]) },
    { type: "Polygon", coordinates: Array.from({ length: WILDFIRE_LIMITS.rings + 1 }, () => outer) },
  ])("parts/rings budgets omit oversized whole geometries with explicit partial data", async (geometry) => {
    replies(2, [collection([feature(1, geometry), feature(2)])]);
    const result = await getWildfirePerimeters("US");
    expect(result.items.map((item) => item.objectId)).toEqual([2]);
    expect(result).toMatchObject({ omitted: 1, truncated: true, reason: expect.stringMatching(/geometry limits/) });
  });

  test("rejects an unexpected response endpoint", async () => {
    fetchMock.mockImplementation(async () => response("https://example.test/query", { count: 0 }));
    await expect(getWildfirePerimeters("TX")).rejects.toMatchObject({ kind: "invalid-response" });
  });

  test("cancellation before starting does not perform even the count lookup", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(getWildfirePerimeters("US", controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("cancellation after accepted records discards the entire partial result", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (input, options) => {
      const url = String(input); const params = new URL(url).searchParams;
      if (params.has("returnCountOnly")) return response(url, { count: 8 });
      if (params.get("resultOffset") === "0") return response(url, collection([feature()], true));
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
        controller.abort();
      });
    });
    await expect(getWildfirePerimeters("US", controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchMock.mock.calls[2][1].signal.aborted).toBe(true);
  });

  test("cancellation while reading text never publishes a parsed snapshot", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (input) => {
      const value = response(String(input), { count: 0 });
      value.text = async () => { controller.abort(); return '{"count":0}'; };
      return value;
    });
    await expect(getWildfirePerimeters("TX", controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
  });

  test("per-request timeout aborts fetch and remains a typed failure, not empty coverage", async () => {
    fetchMock.mockImplementation((_input, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    }));
    const pending = getWildfirePerimeters("US");
    const assertion = expect(pending).rejects.toBeInstanceOf(ClearPathDataError);
    await jest.advanceTimersByTimeAsync(WILDFIRE_LIMITS.timeoutMs);
    // A failed count permits one bounded geometry lookup; that also times out.
    await jest.advanceTimersByTimeAsync(WILDFIRE_LIMITS.timeoutMs);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  });
});
