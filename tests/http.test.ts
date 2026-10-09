import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fetchJson, parseRetryAfter } from "../src/data/http";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn<typeof fetch>();

beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = fetchMock as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

function response(
  options: {
    status?: number;
    retryAfter?: string;
    json?: () => Promise<unknown>;
  } = {},
): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => options.retryAfter ?? null },
    json: options.json ?? (async () => ({ valid: true })),
  } as unknown as Response;
}

test("fetches JSON and preserves configured request headers", async () => {
  fetchMock.mockResolvedValue(response());
  await expect(
    fetchJson("https://api.weather.gov", {
      headers: { "User-Agent": "ClearPath" },
    }),
  ).resolves.toEqual({ valid: true });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.weather.gov",
    expect.objectContaining({ headers: { "User-Agent": "ClearPath" } }),
  );
});

test("returns typed HTTP errors with rate-limit delay instead of retrying internally", async () => {
  fetchMock.mockResolvedValue(response({ status: 429, retryAfter: "30" }));
  await expect(fetchJson("https://api.weather.gov")).rejects.toMatchObject({
    kind: "http",
    status: 429,
    retryAfterMs: 30_000,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("separates malformed JSON and unavailable networks", async () => {
  fetchMock.mockResolvedValue(
    response({
      json: async () => {
        throw new Error("invalid JSON");
      },
    }),
  );
  await expect(fetchJson("https://api.weather.gov")).rejects.toMatchObject({
    kind: "invalid-response",
  });
  fetchMock.mockRejectedValue(new Error("no connection"));
  await expect(fetchJson("https://api.weather.gov")).rejects.toMatchObject({
    kind: "network",
  });
});

test("does not start obsolete requests and cancels pending requests", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    fetchJson("https://api.weather.gov", { signal: controller.signal }),
  ).rejects.toMatchObject({ kind: "cancelled" });
  expect(fetchMock).not.toHaveBeenCalled();
  const pending = new AbortController();
  fetchMock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const request = fetchJson("https://api.weather.gov", {
    signal: pending.signal,
  });
  const assertion = expect(request).rejects.toMatchObject({
    kind: "cancelled",
  });
  pending.abort();
  await assertion;
});

test("aborts a hung request after 12 seconds", async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const request = fetchJson("https://api.weather.gov");
  const assertion = expect(request).rejects.toMatchObject({ kind: "timeout" });
  await jest.advanceTimersByTimeAsync(12_000);
  await assertion;
});

test("parses seconds and HTTP dates but rejects invalid Retry-After values", () => {
  const now = Date.parse("2026-10-09T19:00:00Z");
  expect(parseRetryAfter("5", now)).toBe(5_000);
  expect(parseRetryAfter("Fri, 09 Oct 2026 19:00:10 GMT", now)).toBe(10_000);
  expect(parseRetryAfter("Fri, 09 Oct 2026 18:59:00 GMT", now)).toBe(0);
  for (const value of [null, "-3", "NaN", "forever"])
    expect(parseRetryAfter(value, now)).toBeUndefined();
});
