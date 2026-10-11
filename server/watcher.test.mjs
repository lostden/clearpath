import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Watcher } from './watcher.mjs';
import { alertKey, normalizeWarnings, pushMessage } from './alerts.mjs';
import { RemoteError, createTransport, retryAfter } from './transport.mjs';
import { configuration, createApi } from './index.mjs';
import { fileStore } from './store.mjs';
import { Buffer } from 'node:buffer';

const start = Date.parse('2026-10-11T12:00:00Z');
const iso = (n) => new Date(n).toISOString();
const collection = (...features) => ({ type: 'FeatureCollection', features });
function feature(id, { sent = start - 60_000, expires = start + 3_600_000, messageType = 'Alert', references = [], status = 'Actual', scope = 'Public', event = 'Flood Warning' } = {}) {
  return { type: 'Feature', id: `https://api.weather.gov/alerts/${id}`, properties: { id, event, sent: iso(sent), expires: iso(expires), messageType, references, status, scope, severity: 'Severe' } };
}
function harness(options = {}) {
  let clock = start; let data = collection(); let saveFailure = false;
  const saved = []; const sent = []; const checks = []; const receiptChecks = [];
  const store = { load: async () => options.persisted ?? null, save: async (s) => { if (saveFailure) throw new Error('disk-full-secret-private-error'); saved.push(structuredClone(s)); } };
  const transport = {
    getWarnings: async (point, signal) => { checks.push(point); return options.getWarnings ? options.getWarnings(point, signal) : data; },
    send: async (message, signal) => { sent.push(message); return options.send ? options.send(message, signal) : { data: { status: 'ok', id: `receipt-${sent.length}` } }; },
    receipts: async (ids) => { receiptChecks.push(ids); return options.receipts ? options.receipts(ids) : { data: Object.fromEntries(ids.map((id) => [id, { status: 'ok' }])) }; },
  };
  const watcher = new Watcher({ store, transport, now: () => clock, ...options.config });
  const location = (latitude = 30, longitude = -99) => ({ point: { latitude, longitude }, locationObservedAt: iso(clock) });
  return { watcher, sent, saved, checks, receiptChecks, location, now: () => clock, advance: (ms = 60_000) => { clock += ms; }, setData: (v) => { data = v; }, failStore: () => { saveFailure = true; } };
}
async function enrolled(h, token = 'ExpoPushToken[abcdefgh12345678]') {
  return h.watcher.enroll({ expoPushToken: token, ...h.location() });
}
async function withNewWarning(h) {
  const d = await enrolled(h); await h.watcher.tick(); h.advance(); h.setData(collection(feature('new'))); await h.watcher.tick(); return d;
}

test('enrollment is durable, baselines without push, and suppresses existing records', async () => {
  const h = harness(); await h.watcher.initialize(); h.setData(collection(feature('old')));
  const d = await enrolled(h); assert.equal(h.saved.at(-1).devices[0].baselined, false);
  assert.equal(JSON.stringify(h.saved).includes(d.bearerToken), false);
  await h.watcher.tick(); assert.equal(h.sent.length, 0);
  h.advance(); await h.watcher.tick(); assert.equal(h.sent.length, 0);
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).baseline, 'ready');
});
test('new id/sent records notify once and preserve provider order', async () => {
  const h = harness(); await enrolled(h); await h.watcher.tick(); h.advance();
  h.setData(collection(feature('z'), feature('a'))); await h.watcher.tick();
  assert.deepEqual(h.sent.map((m) => m.data.alertId), ['z', 'a']);
  h.advance(); await h.watcher.tick(); assert.equal(h.sent.length, 2);
  h.advance(); h.setData(collection(feature('a', { sent: h.now() - 1000, expires: h.now() + 600_000 }))); await h.watcher.tick();
  assert.equal(h.sent.length, 3);
});
test('movement retains dedup; warnings newly encountered at the next point are eligible', async () => {
  const h = harness(); const d = await withNewWarning(h);
  h.advance(); await h.watcher.update(d.deviceId, d.bearerToken, h.location(31, -98));
  h.setData(collection(feature('new'), feature('different-point'))); await h.watcher.tick();
  assert.deepEqual(h.sent.map((m) => m.data.alertId), ['new', 'different-point']);
  assert.deepEqual(h.checks.at(-1), { latitude: 31, longitude: -98 });
});
test('expiry, cancellation, reference URLs, tests and private messages are excluded', () => {
  const old = feature('old'); const update = feature('update', { messageType: 'Update', sent: start - 1000, references: [{ '@id': old.id }] });
  const cancellation = feature('cancel', { sent: start, messageType: 'Cancel', references: [{ identifier: 'update' }] });
  const result = normalizeWarnings(collection(old, update, cancellation, feature('expired', { sent: start - 120_000, expires: start }), feature('test', { status: 'Test' }), feature('private', { scope: 'Private' }), feature('actual')), start);
  assert.deepEqual(result.map((a) => a.id), ['actual']);
});

test('future CAP records fail the collection before replacement, allowing only one minute of skew', () => {
  const current = feature('current');
  for (const messageType of ['Alert', 'Update', 'Cancel']) {
    const future = feature('future', { messageType, sent: start + 120_000, references: [{ identifier: 'current' }, { '@id': current.id }] });
    assert.throws(() => normalizeWarnings(collection(current, future), start), /invalid-alert-record/);
  }
  assert.deepEqual(normalizeWarnings(collection(feature('within-skew', { sent: start + 60_000 })), start).map((a) => a.id), ['within-skew']);
  assert.throws(() => normalizeWarnings(collection(feature('beyond-skew', { sent: start + 60_001 })), start), /invalid-alert-record/);
});

test('future cancellation cannot baseline an empty collection or overwrite the last successful check', async () => {
  const h = harness(); const d = await enrolled(h); const current = feature('current');
  h.setData(collection(current, feature('future-cancel', { messageType: 'Cancel', sent: start + 120_000, references: [{ identifier: 'current' }] })));
  await h.watcher.tick();
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).baseline, 'pending');
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastError, 'provider-check-failed');
  assert.equal(h.sent.length, 0);
  h.advance(300_000); h.setData(collection(current)); await h.watcher.tick();
  const lastCheckAt = h.watcher.status(d.deviceId, d.bearerToken).lastCheckAt;
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).baseline, 'ready');
  h.advance(); h.setData(collection(current, feature('another-future-cancel', { messageType: 'Cancel', sent: h.now() + 120_000, references: [{ identifier: 'current' }] })));
  await h.watcher.tick();
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastCheckAt, lastCheckAt);
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastError, 'provider-check-failed');
  assert.equal(h.sent.length, 0);
});
test('malformed Actual/Public record fails the whole check and does not baseline', async () => {
  const h = harness(); const d = await enrolled(h); const bad = feature('bad'); bad.properties.expires = '2026-02-30T00:00:00Z'; h.setData(collection(bad));
  await h.watcher.tick(); assert.equal(h.sent.length, 0);
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).baseline, 'pending');
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastError, 'provider-check-failed');
});
test('preview includes no coordinates, arbitrary URL, route, or provider instruction; TTL cannot outlive expiry', () => {
  const alert = normalizeWarnings(collection(feature('one', { expires: start + 91_234 })), start)[0];
  const m = pushMessage('ExpoPushToken[abcdefgh12345678]', alert, start);
  assert.equal(m.ttl, 91); assert.equal(m.channelId, 'clearpath-nws');
  assert.deepEqual(m.data, { kind: 'nws-point-alert', alertId: 'one' });
  assert.equal(pushMessage(m.to, alert, start + 91_234), null);
});
test('input forbids demo fields, invalid tokens, nonfinite/range coordinates, stale/future times and extra keys', async () => {
  const h = harness(); const good = { expoPushToken: 'ExpoPushToken[abcdefgh12345678]', ...h.location() };
  for (const body of [{ ...good, demo: true }, { ...good, expoPushToken: 'https://evil.invalid/' }, { ...good, point: { latitude: NaN, longitude: 0 } }, { ...good, point: { latitude: 91, longitude: 0 } }, { ...good, point: { ...good.point, x: 1 } }, { ...good, locationObservedAt: iso(start - 3_600_000) }, { ...good, locationObservedAt: iso(start + 120_000) }, { ...good, locationObservedAt: '2026-10-11' }]) await assert.rejects(h.watcher.enroll(body), (e) => e.status === 400);
  assert.equal(h.saved.length, 0);
});
test('device bearer, older point rejection, duplicate token and capacity are enforced', async () => {
  const h = harness({ config: { maxDevices: 1 } }); const d = await enrolled(h);
  assert.throws(() => h.watcher.status(d.deviceId, 'wrong'), (e) => e.status === 401);
  await assert.rejects(enrolled(h), (e) => e.status === 429);
  await assert.rejects(h.watcher.update(d.deviceId, d.bearerToken, { ...h.location(), locationObservedAt: iso(start - 1) }), (e) => e.status === 409);
  const two = harness(); await enrolled(two); await assert.rejects(enrolled(two), (e) => e.status === 409);
});
test('checks never run more than once a minute, even after movement', async () => {
  const h = harness(); const d = await enrolled(h); await h.watcher.tick();
  await h.watcher.update(d.deviceId, d.bearerToken, h.location(31)); await h.watcher.tick(); assert.equal(h.checks.length, 1);
  h.advance(); await h.watcher.tick(); assert.equal(h.checks.length, 2);
});
test('stale location pauses NWS checks; refreshing it resumes without new baseline', async () => {
  const h = harness(); const d = await enrolled(h); await h.watcher.tick(); h.advance(31 * 60_000); await h.watcher.tick();
  assert.equal(h.checks.length, 1); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).locationFresh, false);
  await h.watcher.update(d.deviceId, d.bearerToken, h.location()); h.setData(collection(feature('resume', { sent: h.now() - 1000, expires: h.now() + 600_000 }))); await h.watcher.tick(); assert.equal(h.sent.length, 1);
});
test('opt-out during NWS request prevents any push or reinserted device', async () => {
  let finish; const h = harness({ getWarnings: () => new Promise((r) => { finish = r; }) }); const d = await enrolled(h);
  const tick = h.watcher.tick(); while (!finish) await new Promise((r) => setImmediate(r));
  await h.watcher.remove(d.deviceId, d.bearerToken); finish(collection(feature('late'))); await tick;
  assert.equal(h.sent.length, 0); assert.equal(h.watcher.state.devices.length, 0);
});
test('opt-out during push aborts the request and ignores late tickets', async () => {
  let finish; let signal; const h = harness({ send: (_m, s) => { signal = s; return new Promise((r) => { finish = r; }); } });
  const d = await enrolled(h); await h.watcher.tick(); h.advance(); h.setData(collection(feature('new')));
  const tick = h.watcher.tick(); while (!finish) await new Promise((r) => setImmediate(r));
  await h.watcher.remove(d.deviceId, d.bearerToken); assert.equal(signal.aborted, true);
  finish({ data: { status: 'ok', id: 'late' } }); await tick; assert.equal(h.watcher.state.devices.length, 0);
});
test('storage failure blocks enrollment and all outbound work, preserving prior state', async () => {
  const h = harness(); h.failStore(); await assert.rejects(enrolled(h), (e) => e.status === 503);
  assert.equal(h.watcher.state.devices.length, 0); await h.watcher.tick(); assert.equal(h.checks.length, 0);
});
test('durable intent must save before sending; a failed save sends nothing', async () => {
  const h = harness(); await enrolled(h); await h.watcher.tick(); h.advance(); h.setData(collection(feature('new')));
  const original = h.watcher.store.save; h.watcher.store.save = async (s) => { if (s.devices.some((d) => d.queue.some((q) => q.phase === 'sending'))) throw new Error('disk'); return original(s); };
  await h.watcher.tick(); assert.equal(h.sent.length, 0); assert.equal(h.watcher.faulted, true);
});
test('restart drops uncertain sending intent without retrying or losing dedup', async () => {
  const h = harness(); const d = await withNewWarning(h); const s = structuredClone(h.watcher.state); const alert = normalizeWarnings(collection(feature('new')), h.now())[0];
  s.devices[0].queue = [{ key: alertKey(alert), alert, phase: 'sending', attempts: 0, dueAt: start }];
  const next = harness({ persisted: s }); await next.watcher.initialize(); assert.equal(next.watcher.state.devices[0].queue.length, 0);
  assert.equal(next.watcher.status(d.deviceId, d.bearerToken).lastDelivery, 'unknown-after-restart');
});
test('known transient HTTP push failure retries with backoff only while still active', async () => {
  let calls = 0; const h = harness({ send: async () => { calls += 1; if (calls === 1) throw new RemoteError('http-503', 300_000, true); return { data: { status: 'ok', id: 'after-retry' } }; } });
  await withNewWarning(h); assert.equal(h.sent.length, 1); h.advance(); await h.watcher.tick(); assert.equal(h.sent.length, 1);
  h.advance(240_000); await h.watcher.tick(); assert.equal(h.sent.length, 2);
});
test('ambiguous network push failure is not automatically resent', async () => {
  const h = harness({ send: async () => { throw new RemoteError('network-or-timeout', 0, true); } }); const d = await withNewWarning(h);
  h.advance(300_000); await h.watcher.tick(); assert.equal(h.sent.length, 1); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastDelivery, 'unknown');
});
test('cancellation removes queued retry before another send', async () => {
  const h = harness({ send: async () => { throw new RemoteError('http-429', 300_000, true); } }); await withNewWarning(h);
  h.advance(300_000); h.setData(collection(feature('new'), feature('cancel', { messageType: 'Cancel', sent: h.now() - 1000, expires: h.now() + 600_000, references: [{ identifier: 'new' }] }))); await h.watcher.tick(); assert.equal(h.sent.length, 1);
});
test('provider Retry-After and exponential backoff suppress repeated checks', async () => {
  const h = harness({ getWarnings: async () => { throw new RemoteError('http-429', 300_000, true); } }); await enrolled(h); await h.watcher.tick();
  h.advance(); await h.watcher.tick(); assert.equal(h.checks.length, 1); h.advance(240_000); await h.watcher.tick(); assert.equal(h.checks.length, 2);
});
test('dead-token ticket disables device and rejects updates until re-enrollment', async () => {
  const h = harness({ send: async () => ({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }) }); const d = await withNewWarning(h);
  assert.equal(h.watcher.status(d.deviceId, d.bearerToken).enabled, false);
  await assert.rejects(h.watcher.update(d.deviceId, d.bearerToken, h.location()), (e) => e.status === 409);
});
test('receipt checks begin after fifteen minutes; ok means provider acceptance only', async () => {
  const h = harness(); const d = await withNewWarning(h); h.advance(14 * 60_000); await h.watcher.tick(); assert.equal(h.receiptChecks.length, 0);
  h.advance(); await h.watcher.tick(); assert.equal(h.receiptChecks.length, 1); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastDelivery, 'provider-accepted');
});
test('receipt dead-token failure stops further sends', async () => {
  const h = harness({ receipts: async (ids) => ({ data: { [ids[0]]: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }) }); const d = await withNewWarning(h);
  h.advance(15 * 60_000); await h.watcher.tick(); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).enabled, false);
  h.advance(); h.setData(collection(feature('another'))); await h.watcher.tick(); assert.equal(h.sent.length, 1);
});
test('failed receipt request retains bounded retry; expired receipts are retired', async () => {
  let fail = true; const h = harness({ receipts: async () => { if (fail) throw new RemoteError('http-503', 0, true); return { data: {} }; } }); const d = await withNewWarning(h);
  h.advance(15 * 60_000); await h.watcher.tick(); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastError, 'receipt-check-failed');
  h.advance(23 * 3_600_000); fail = false; await h.watcher.tick(); assert.equal(h.watcher.status(d.deviceId, d.bearerToken).lastDelivery, 'receipt-unavailable');
});
test('watcher bounds global concurrency, devices per tick, and overlapping scheduler runs', async () => {
  let active = 0; let peak = 0; const h = harness({ getWarnings: async () => { active += 1; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 3)); active -= 1; return collection(); } });
  for (let n = 0; n < 12; n += 1) await enrolled(h, `ExpoPushToken[abcdefgh${n}12345678]`);
  await Promise.all([h.watcher.tick(), h.watcher.tick()]); assert.equal(peak, 2); assert.equal(h.checks.length, 10);
});
test('seven-day inactive enrollment retention deletes private data', async () => {
  const h = harness(); await enrolled(h); h.advance(7 * 24 * 3_600_000 + 1); await h.watcher.tick(); assert.equal(h.watcher.state.devices.length, 0);
});
test('invalid persisted state fails startup instead of treating old data as safe', async () => {
  const h = harness({ persisted: { version: 1, devices: [{ expoPushToken: 'private' }] } }); await assert.rejects(h.watcher.initialize(), /invalid-persisted-state/);
});
test('atomic file store replaces state and leaves no temporary file after success', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clearpath-watcher-'));
  try { const store = fileStore(dir); assert.equal(await store.load(), null); await store.save({ version: 1, devices: [] }); await store.save({ version: 2, devices: [] }); assert.equal((await store.load()).version, 2); assert.deepEqual(await readdir(dir), ['state.json']); assert.equal((await readFile(path.join(dir, 'state.json'), 'utf8')).includes('version'), true); } finally {
    const resolved = path.resolve(dir); const parent = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(parent) || !path.basename(resolved).startsWith('clearpath-watcher-')) throw new Error('unexpected-test-cleanup-path');
    await rm(resolved, { recursive: true, force: true });
  }
});

test('file store bounds UTF-8 saves before filesystem work and preserves restartable prior state', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clearpath-watcher-'));
  try {
    const store = fileStore(dir); const previous = { version: 1, devices: [] };
    await store.save(previous);
    const oversized = { padding: 'é'.repeat(5_000_000) };
    assert.ok(JSON.stringify(oversized).length < 10_000_000);
    assert.ok(Buffer.byteLength(JSON.stringify(oversized), 'utf8') > 10_000_000);
    await assert.rejects(store.save(oversized), /state-save-failed/);
    assert.deepEqual(await fileStore(dir).load(), previous);
    await assert.rejects(fileStore(path.join(dir, 'not-created')).save(oversized), /state-save-failed/);
    assert.deepEqual(await readdir(dir), ['state.json']);

    const overhead = Buffer.byteLength(JSON.stringify({ padding: '' }), 'utf8');
    const atLimit = { padding: 'a'.repeat(10_000_000 - overhead) };
    await store.save(atLimit);
    assert.equal((await readFile(path.join(dir, 'state.json'))).length, 10_000_000);
    assert.equal((await fileStore(dir).load()).padding.length, atLimit.padding.length);
    await assert.rejects(store.save({ padding: `${atLimit.padding}a` }), /state-save-failed/);
    assert.equal((await fileStore(dir).load()).padding.length, atLimit.padding.length);
    assert.deepEqual(await readdir(dir), ['state.json']);
  } finally {
    const resolved = path.resolve(dir); const parent = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(parent) || !path.basename(resolved).startsWith('clearpath-watcher-')) throw new Error('unexpected-test-cleanup-path');
    await rm(resolved, { recursive: true, force: true });
  }
});
test('transport uses fixed HTTPS providers, validates body size and honors Retry-After', async () => {
  let requested; const t = createTransport({ userAgent: 'ClearPath (contact@example.com)', fetchImpl: async (url, options) => { requested = { url, options }; return new Response('{}', { status: 429, headers: { 'retry-after': '120' } }); } });
  await assert.rejects(t.getWarnings({ latitude: 30, longitude: -99 }), (e) => e.retryAfterMs === 120_000);
  assert.match(requested.url, /^https:\/\/api\.weather\.gov\/alerts\/active\?point=30%2C-99$/); assert.equal(requested.options.redirect, 'error');
  assert.equal(retryAfter('99999999'), 3_600_000); assert.equal(retryAfter(iso(start + 60_000), start), 60_000);
  const huge = createTransport({ userAgent: 'a', fetchImpl: async () => new Response('{}', { headers: { 'content-length': '2000001' } }) }); await assert.rejects(huge.receipts(['one']), /response-too-large/);
});
test('transport timeout aborts I/O and reports a redacted uncertain failure', async () => {
  let aborted = false; const t = createTransport({ userAgent: 'a', timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('private-token-url')); }); }) });
  await assert.rejects(t.send({}), /network-or-timeout/); assert.equal(aborted, true);
});
test('configuration rejects public HTTP and publicly bound listeners', () => {
  const env = { CLEARPATH_ENROLLMENT_SECRET: 'a'.repeat(64), NWS_USER_AGENT: 'ClearPath (operator@example.com)' };
  assert.equal(configuration(env).port, 8787);
  assert.throws(() => configuration({ ...env, CLEARPATH_PUBLIC_URL: 'http://public.example' }), /invalid-public-url/);
  assert.throws(() => configuration({ ...env, HOST: '0.0.0.0' }), /bind-loopback-only/);
  assert.throws(() => configuration({ ...env, CLEARPATH_POLL_SECONDS: '10' }), /at-least-60/);
});

test('configuration rejects enrollment secrets the bearer parser cannot accept', () => {
  const env = { NWS_USER_AGENT: 'ClearPath (operator@example.com)' };
  for (const suffix of ['+', '/', '=', '.', '!', ' ', 'é']) {
    assert.throws(() => configuration({ ...env, CLEARPATH_ENROLLMENT_SECRET: `${'a'.repeat(32)}${suffix}` }), /enrollment-secret-required/);
  }
  for (const secret of ['a'.repeat(31), 'a'.repeat(257)]) {
    assert.throws(() => configuration({ ...env, CLEARPATH_ENROLLMENT_SECRET: secret }), /enrollment-secret-required/);
  }
  const base64url = `${'Ab09_-'.repeat(5)}Ab`;
  assert.equal(configuration({ ...env, CLEARPATH_ENROLLMENT_SECRET: base64url }).enrollmentSecret, base64url);
  assert.equal(configuration({ ...env, CLEARPATH_ENROLLMENT_SECRET: 'a'.repeat(256) }).enrollmentSecret.length, 256);
});
async function apiHarness(fn, extra = {}) {
  const h = harness(); const cfg = configuration({ CLEARPATH_ENROLLMENT_SECRET: 'a'.repeat(64), NWS_USER_AGENT: 'ClearPath (operator@example.com)', ...extra });
  const server = createApi(h.watcher, cfg, h.now); await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn(h, `http://127.0.0.1:${server.address().port}`, cfg); } finally { await new Promise((r) => { server.close(r); server.closeAllConnections(); }); }
}
test('HTTP enrollment and bearer status/update/delete contract works without outbound I/O', async () => {
  await apiHarness(async (h, url, cfg) => {
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${cfg.enrollmentSecret}` };
    assert.equal((await fetch(`${url}/v1/devices`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status, 401);
    const response = await fetch(`${url}/v1/devices`, { method: 'POST', headers, body: JSON.stringify({ expoPushToken: 'ExpoPushToken[abcdefgh12345678]', ...h.location() }) }); assert.equal(response.status, 201); const d = await response.json();
    const deviceHeaders = { ...headers, authorization: `Bearer ${d.bearerToken}` };
    assert.equal((await fetch(`${url}/v1/devices/${d.deviceId}/status`, { headers: deviceHeaders })).status, 200);
    assert.equal((await fetch(`${url}/v1/devices/${d.deviceId}/location`, { method: 'PUT', headers: deviceHeaders, body: JSON.stringify(h.location(31)) })).status, 200);
    assert.equal((await fetch(`${url}/v1/devices/${d.deviceId}`, { method: 'DELETE', headers: deviceHeaders })).status, 200);
    assert.equal((await fetch(`${url}/v1/devices/${d.deviceId}/status`, { headers: deviceHeaders })).status, 401); assert.equal(h.sent.length, 0);
  });
});
test('HTTP body bounds, content type, demo field, query rejection and enrollment rate limit', async () => {
  await apiHarness(async (h, url, cfg) => {
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${cfg.enrollmentSecret}` };
    assert.equal((await fetch(`${url}/v1/devices`, { method: 'POST', headers, body: 'x'.repeat(4097) })).status, 413);
    assert.equal((await fetch(`${url}/v1/devices`, { method: 'POST', headers: { authorization: headers.authorization }, body: '{}' })).status, 415);
    assert.equal((await fetch(`${url}/v1/devices?token=secret`, { method: 'POST', headers, body: '{}' })).status, 400);
    for (let n = 0; n < 9; n += 1) await fetch(`${url}/v1/devices`, { method: 'POST', headers, body: '{}' });
    assert.equal((await fetch(`${url}/v1/devices`, { method: 'POST', headers, body: '{}' })).status, 429);
  });
});
test('HTTPS public mode rejects traffic unless loopback TLS proxy is explicitly trusted', async () => {
  await apiHarness(async (_h, url) => { assert.equal((await fetch(`${url}/health`, { headers: { 'x-forwarded-proto': 'https' } })).status, 426); }, { CLEARPATH_PUBLIC_URL: 'https://watcher.example' });
  await apiHarness(async (_h, url) => { assert.equal((await fetch(`${url}/health`)).status, 426); assert.equal((await fetch(`${url}/health`, { headers: { 'x-forwarded-proto': 'https' } })).status, 200); }, { CLEARPATH_PUBLIC_URL: 'https://watcher.example', CLEARPATH_TRUST_LOOPBACK_PROXY: '1' });
});
