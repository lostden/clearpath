import { Buffer } from 'node:buffer';

export class RemoteError extends Error {
  constructor(code, retryAfterMs = 0, retryable = false) {
    super(code);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
  }
}
export function retryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), 3_600_000) : 0;
}

export function createTransport({ userAgent, expoAccessToken, fetchImpl = fetch, now = Date.now, timeoutMs = 10_000 }) {
  async function request(url, options, externalSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, redirect: 'error', signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new RemoteError(`http-${response.status}`, retryAfter(response.headers.get('retry-after'), now()), response.status === 429 || response.status >= 500);
      }
      const limit = 2_000_000;
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new RemoteError('response-too-large');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new RemoteError('missing-response');
      const parts = []; let bytes = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > limit) { await reader.cancel(); throw new RemoteError('response-too-large'); }
        parts.push(part.value);
      }
      try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new RemoteError('invalid-json'); }
    } catch (error) {
      if (error instanceof RemoteError) throw error;
      // A lost response may follow an accepted push. The watcher records an
      // uncertain send rather than retrying it and causing duplicate notices.
      throw new RemoteError('network-or-timeout', 0, true);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }
  const pushHeaders = { Accept: 'application/json', 'Content-Type': 'application/json', ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}) };
  return {
    getWarnings(point, signal) {
      const url = `https://api.weather.gov/alerts/active?point=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
      return request(url, { headers: { Accept: 'application/geo+json', 'User-Agent': userAgent } }, signal);
    },
    send(message, signal) { return request('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: pushHeaders, body: JSON.stringify(message) }, signal); },
    receipts(ids, signal) { return request('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: pushHeaders, body: JSON.stringify({ ids }) }, signal); },
  };
}
