import http from 'node:http';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClientError, Watcher, secretEqual } from './watcher.mjs';
import { createTransport } from './transport.mjs';
import { fileStore } from './store.mjs';

const loopback = (host) => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);
export function configuration(env) {
  const publicUrl = new URL(env.CLEARPATH_PUBLIC_URL || 'http://127.0.0.1:8787');
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/' || (publicUrl.protocol !== 'https:' && !loopback(publicUrl.hostname))) throw new Error('invalid-public-url');
  const enrollmentSecret = env.CLEARPATH_ENROLLMENT_SECRET;
  if (typeof enrollmentSecret !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(enrollmentSecret)) throw new Error('enrollment-secret-required');
  const userAgent = env.NWS_USER_AGENT;
  if (typeof userAgent !== 'string' || userAgent.length < 10 || userAgent.length > 256 || /[\r\n]/.test(userAgent) || !/[@]|https:\/\//.test(userAgent)) throw new Error('nws-contact-user-agent-required');
  const pollMs = Number(env.CLEARPATH_POLL_SECONDS || '60') * 1000;
  if (!Number.isInteger(pollMs) || pollMs < 60_000 || pollMs > 3_600_000) throw new Error('poll-interval-must-be-at-least-60-seconds');
  const port = Number(env.PORT || '8787');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid-port');
  const host = env.HOST || '127.0.0.1';
  // Plain HTTP is only bound to loopback. A TLS reverse proxy must be on the
  // same machine and explicitly trusted; no publicly exposed HTTP listener.
  if (!loopback(host)) throw new Error('bind-loopback-only');
  if (env.EXPO_ACCESS_TOKEN && (env.EXPO_ACCESS_TOKEN.length > 4096 || /[\r\n]/.test(env.EXPO_ACCESS_TOKEN))) throw new Error('invalid-expo-access-token');
  return { publicUrl, enrollmentSecret, userAgent, expoAccessToken: env.EXPO_ACCESS_TOKEN, pollMs, port, host, trustLoopbackProxy: env.CLEARPATH_TRUST_LOOPBACK_PROXY === '1', dataDirectory: path.resolve(env.CLEARPATH_DATA_DIRECTORY || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')) };
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function body(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json' || (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity')) throw new ClientError(415, 'json-required');
  if (Number(request.headers['content-length']) > 4096) throw new ClientError(413, 'body-too-large');
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4096) throw new ClientError(413, 'body-too-large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ClientError(400, 'invalid-json'); }
}
export function createApi(watcher, config, now = Date.now) {
  const limits = new Map();
  function limit(key, max) {
    const minute = Math.floor(now() / 60_000);
    for (const [k, v] of limits) if (v.minute !== minute) limits.delete(k);
    const state = limits.get(key) || { minute, count: 0 }; state.count += 1;
    if (limits.size >= 1000 && !limits.has(key)) throw new ClientError(429, 'rate-limited');
    limits.set(key, state); if (state.count > max) throw new ClientError(429, 'rate-limited');
  }
  const server = http.createServer(async (request, response) => {
    try {
      const local = loopback(request.socket.remoteAddress);
      if (!local || (config.publicUrl.protocol === 'https:' && !(config.trustLoopbackProxy && request.headers['x-forwarded-proto'] === 'https'))) throw new ClientError(426, 'https-required');
      const url = new URL(request.url, 'http://localhost');
      if (url.search || url.hash || request.url.length > 200) throw new ClientError(400, 'invalid-path');
      if (request.method === 'GET' && url.pathname === '/health') return json(response, watcher.faulted ? 503 : 200, { status: watcher.faulted ? 'storage-unavailable' : 'ready' });
      const auth = request.headers.authorization;
      const bearer = typeof auth === 'string' && /^Bearer [A-Za-z0-9_-]{32,256}$/.test(auth) ? auth.slice(7) : null;
      if (request.method === 'POST' && url.pathname === '/v1/devices') {
        if (!secretEqual(bearer, config.enrollmentSecret)) throw new ClientError(401, 'unauthorized');
        limit('enrollment', 10);
        return json(response, 201, await watcher.enroll(await body(request)));
      }
      const match = /^\/v1\/devices\/([a-f0-9-]{36})(?:\/(location|status))?$/.exec(url.pathname);
      if (!match) throw new ClientError(404, 'not-found');
      watcher.device(match[1], bearer); limit(match[1], 120);
      if (request.method === 'GET' && match[2] === 'status') return json(response, 200, watcher.status(match[1], bearer));
      if (request.method === 'PUT' && match[2] === 'location') return json(response, 200, await watcher.update(match[1], bearer, await body(request)));
      if (request.method === 'DELETE' && !match[2]) return json(response, 200, await watcher.remove(match[1], bearer));
      throw new ClientError(405, 'method-not-allowed');
    } catch (error) {
      // Do not log request URLs, errors, coordinates, headers, or provider bodies.
      json(response, error instanceof ClientError ? error.status : 503, { error: error instanceof ClientError ? error.code : 'service-unavailable' });
    }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5_000; server.maxHeadersCount = 30;
  return server;
}

async function main() {
  const config = configuration(process.env);
  const watcher = new Watcher({ store: fileStore(config.dataDirectory), transport: createTransport(config), pollMs: config.pollMs });
  await watcher.initialize();
  const server = createApi(watcher, config);
  let schedulerFault = false;
  const timer = setInterval(() => {
    watcher.tick().catch(() => { if (!schedulerFault) { schedulerFault = true; console.error('Watcher stopped: persistent state unavailable. Restart after repairing storage.'); } });
  }, 5_000);
  timer.unref();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
  console.log('ClearPath alert watcher listening on loopback. No device is enrolled by default.');
  const stop = () => { clearInterval(timer); watcher.stop(); server.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Watcher startup failed. Check private environment settings and state storage.'); process.exitCode = 1; });
}
