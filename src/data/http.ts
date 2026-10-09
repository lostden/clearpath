export type DataErrorKind =
  | "network"
  | "timeout"
  | "http"
  | "invalid-response"
  | "cancelled";

export class ClearPathDataError extends Error {
  readonly kind: DataErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    kind: DataErrorKind,
    message: string,
    options: { status?: number; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "ClearPathDataError";
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) {
    const milliseconds = Number(value) * 1_000;
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  // Numeric-looking malformed values must not be interpreted as calendar dates.
  if (!/^[A-Za-z]{3,9}(?:,|\s)/.test(value.trim())) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

type JsonRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

/** No retries inside this adapter: the query layer owns backoff and request frequency. */
export async function fetchJson(
  url: string,
  options: JsonRequestOptions = {},
): Promise<unknown> {
  if (options.signal?.aborted)
    throw new ClearPathDataError("cancelled", "The request was cancelled.");
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 12_000);

  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ClearPathDataError(
        "http",
        `The data service returned HTTP ${response.status}.`,
        {
          status: response.status,
          retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
        },
      );
    }
    try {
      const data: unknown = await response.json();
      if (controller.signal.aborted)
        throw new Error("Request aborted while reading the response.");
      return data;
    } catch {
      if (controller.signal.aborted)
        throw new Error("Request aborted while reading the response.");
      throw new ClearPathDataError(
        "invalid-response",
        "The data service returned unreadable information.",
      );
    }
  } catch (error) {
    if (options.signal?.aborted)
      throw new ClearPathDataError("cancelled", "The request was cancelled.");
    if (timedOut)
      throw new ClearPathDataError(
        "timeout",
        "The data service did not respond in time.",
      );
    if (error instanceof ClearPathDataError) throw error;
    throw new ClearPathDataError(
      "network",
      "Unable to connect to the data service.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
