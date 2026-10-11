import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { alertKey, normalizeWarnings, pushMessage, timestamp, validExpoToken, validPoint } from './alerts.mjs';

export class ClientError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const digest = (text) => createHash('sha256').update(text).digest('hex');
export function secretEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(digest(a), 'hex'), Buffer.from(digest(b), 'hex'));
}
function input(value, enroll, now, maxAge) {
  const keys = enroll ? ['expoPushToken', 'point', 'locationObservedAt'] : ['point', 'locationObservedAt'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((k) => !(k in value)) || !validPoint(value.point) || !timestamp(value.locationObservedAt) || (enroll && !validExpoToken(value.expoPushToken))) throw new ClientError(400, 'invalid-input');
  const observed = Date.parse(value.locationObservedAt);
  if (observed > now + 60_000 || observed < now - maxAge) throw new ClientError(400, 'stale-or-future-location');
  return { point: { ...value.point }, locationObservedAt: value.locationObservedAt };
}
const safeInteger = (n) => Number.isSafeInteger(n) && n >= 0;
const boundedText = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
function validQueuedAlert(a) {
  return a && boundedText(a.id, 512) && boundedText(a.event, 160) && timestamp(a.sent) && timestamp(a.expires) && Date.parse(a.expires) > Date.parse(a.sent) && ['Alert', 'Update'].includes(a.messageType) && typeof a.source === 'string' && /^https:\/\/api\.weather\.gov\/alerts\/[^\s?#]+$/.test(a.source);
}
function validState(s, maxDevices) {
  if (s?.version !== 1 || !Array.isArray(s.devices) || s.devices.length > maxDevices) return false;
  const validDevice = (d) => {
    if (!d || typeof d !== 'object') return false;
    const identity = typeof d.id === 'string' && /^[a-f0-9-]{36}$/.test(d.id) && /^[a-f0-9]{64}$/.test(d.bearerHash) && validExpoToken(d.expoPushToken);
    const tracking = validPoint(d.point) && timestamp(d.locationObservedAt) && safeInteger(d.revision) && typeof d.baselined === 'boolean' && typeof d.enabled === 'boolean' && safeInteger(d.nextCheckAt) && safeInteger(d.failures) && safeInteger(d.updatedAt);
    const seen = Array.isArray(d.seen) && d.seen.length <= 2000 && d.seen.every((x) => x && typeof x.key === 'string' && x.key.length <= 1024 && safeInteger(x.expires));
    const queue = Array.isArray(d.queue) && d.queue.length <= 100 && d.queue.every((q) => q && validQueuedAlert(q.alert) && q.key === alertKey(q.alert) && ['queued', 'sending'].includes(q.phase) && safeInteger(q.attempts) && safeInteger(q.dueAt)) && new Set(d.queue.map((q) => q.key)).size === d.queue.length;
    const receipts = Array.isArray(d.receipts) && d.receipts.length <= 100 && d.receipts.every((r) => r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(r.id) && safeInteger(r.dueAt) && safeInteger(r.createdAt));
    return identity && tracking && seen && queue && receipts;
  };
  return s.devices.every(validDevice) && new Set(s.devices.map((d) => d.id)).size === s.devices.length && new Set(s.devices.map((d) => d.expoPushToken)).size === s.devices.length;
}

export class Watcher {
  constructor({ store, transport, now = Date.now, pollMs = 60_000, maxLocationAgeMs = 30 * 60_000, maxDevices = 100, concurrency = 2 }) {
    if (!Number.isInteger(pollMs) || pollMs < 60_000 || pollMs > 3_600_000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6 || maxDevices < 1 || maxDevices > 1000) throw new Error('invalid-watcher-config');
    Object.assign(this, { store, transport, now, pollMs, maxLocationAgeMs, maxDevices, concurrency });
    this.state = { version: 1, devices: [] };
    this.mutex = Promise.resolve(); this.controllers = new Map(); this.running = false; this.faulted = false;
  }
  async initialize() {
    const loaded = await this.store.load();
    if (loaded && !validState(loaded, this.maxDevices)) throw new Error('invalid-persisted-state');
    this.state = loaded ?? this.state;
    // A crash after Expo accepted a message has no safe automatic retry. Keep
    // its dedup entry and expose uncertainty rather than send a duplicate.
    for (const d of this.state.devices) {
      if (d.queue.some((q) => q.phase === 'sending')) d.lastDelivery = 'unknown-after-restart';
      d.queue = d.queue.filter((q) => q.phase !== 'sending');
    }
    await this.store.save(this.state);
  }
  async mutate(fn) {
    const operation = this.mutex.then(async () => {
      if (this.faulted) throw new ClientError(503, 'storage-unavailable');
      const before = structuredClone(this.state);
      try {
        const result = fn(this.state);
        await this.store.save(this.state);
        return result;
      } catch (error) {
        this.state = before;
        if (!(error instanceof ClientError)) { this.faulted = true; throw new ClientError(503, 'storage-unavailable'); }
        throw error;
      }
    });
    this.mutex = operation.catch(() => {});
    return operation;
  }
  device(id, bearer) {
    const d = this.state.devices.find((x) => x.id === id);
    if (!d || typeof bearer !== 'string' || !secretEqual(d.bearerHash, digest(bearer))) throw new ClientError(401, 'unauthorized');
    return d;
  }
  async enroll(body) {
    const now = this.now(); const location = input(body, true, now, this.maxLocationAgeMs);
    const id = randomUUID(); const bearer = randomBytes(32).toString('hex');
    await this.mutate((s) => {
      if (s.devices.length >= this.maxDevices) throw new ClientError(429, 'device-capacity');
      if (s.devices.some((d) => d.expoPushToken === body.expoPushToken)) throw new ClientError(409, 'token-already-enrolled');
      s.devices.push({ id, bearerHash: digest(bearer), expoPushToken: body.expoPushToken, ...location, revision: 0, baselined: false, enabled: true, updatedAt: now, nextCheckAt: now, failures: 0, seen: [], queue: [], receipts: [], lastCheckAt: null, lastDelivery: null, lastError: null });
    });
    return { deviceId: id, bearerToken: bearer, baseline: 'pending' };
  }
  async update(id, bearer, body) {
    const now = this.now(); const location = input(body, false, now, this.maxLocationAgeMs);
    let moved = false;
    await this.mutate(() => {
      const d = this.device(id, bearer);
      if (!d.enabled) throw new ClientError(409, 'token-disabled-reenroll');
      if (Date.parse(location.locationObservedAt) < Date.parse(d.locationObservedAt)) throw new ClientError(409, 'older-location');
      moved = d.point.latitude !== location.point.latitude || d.point.longitude !== location.point.longitude;
      Object.assign(d, location, { updatedAt: now });
      // Old-point queued warnings are discarded, but their dedup records remain.
      if (moved) { d.revision += 1; d.queue = []; }
    });
    if (moved) this.controllers.get(id)?.abort();
    return { updated: true };
  }
  async remove(id, bearer) {
    await this.mutate((s) => { this.device(id, bearer); s.devices = s.devices.filter((d) => d.id !== id); });
    this.controllers.get(id)?.abort();
    return { deleted: true };
  }
  status(id, bearer) {
    const d = this.device(id, bearer); const now = this.now();
    return { enabled: d.enabled && !this.faulted, baseline: d.baselined ? 'ready' : 'pending', locationFresh: now - Date.parse(d.locationObservedAt) <= this.maxLocationAgeMs, locationObservedAt: d.locationObservedAt, lastCheckAt: d.lastCheckAt, lastError: this.faulted ? 'storage-unavailable' : d.lastError, lastDelivery: d.lastDelivery, pendingReceipts: d.receipts.length };
  }
  alive(id, revision) {
    const d = this.state.devices.find((x) => x.id === id);
    return d && d.enabled && d.revision === revision && !this.faulted && this.now() - Date.parse(d.locationObservedAt) <= this.maxLocationAgeMs ? d : null;
  }
  async check(id) {
    const initial = this.state.devices.find((x) => x.id === id); if (!initial) return;
    const revision = initial.revision;
    if (!this.alive(id, revision)) return;
    const controller = new AbortController(); this.controllers.set(id, controller);
    try {
      const collection = await this.transport.getWarnings(initial.point, controller.signal);
      const alerts = normalizeWarnings(collection, this.now());
      if (!this.alive(id, revision) || controller.signal.aborted) return;
      await this.mutate(() => {
        const d = this.alive(id, revision); if (!d) return;
        const now = this.now(); const active = new Set(alerts.map(alertKey));
        d.seen = d.seen.filter((s) => s.expires > now - 48 * 3_600_000);
        d.queue = d.queue.filter((q) => active.has(q.key));
        const seen = new Set(d.seen.map((s) => s.key));
        for (const alert of alerts) {
          const key = alertKey(alert); if (seen.has(key)) continue;
          if (d.seen.length >= 2000 || (d.baselined && d.queue.length >= 100)) { d.lastError = 'dedup-capacity'; d.enabled = false; break; }
          d.seen.push({ key, expires: Date.parse(alert.expires) }); seen.add(key);
          if (d.baselined) d.queue.push({ key, alert, phase: 'queued', attempts: 0, dueAt: now });
        }
        d.baselined = true; d.lastCheckAt = new Date(now).toISOString(); d.nextCheckAt = now + this.pollMs; d.failures = 0;
        if (d.enabled) d.lastError = null;
      });
      for (let n = 0; n < 3; n += 1) {
        const d = this.alive(id, revision);
        const q = d?.queue.find((x) => x.phase === 'queued' && x.dueAt <= this.now());
        if (!q || controller.signal.aborted) break;
        const message = pushMessage(d.expoPushToken, q.alert, this.now());
        if (!message) break;
        // Durable intent precedes the external side effect.
        await this.mutate(() => { const current = this.alive(id, revision); const pending = current?.queue.find((x) => x.key === q.key); if (pending) pending.phase = 'sending'; });
        if (!this.alive(id, revision) || controller.signal.aborted) break;
        await this.send(id, revision, q, message, controller.signal);
      }
    } catch (error) {
      if (controller.signal.aborted || !this.alive(id, revision) || this.faulted) return;
      await this.mutate(() => {
        const d = this.alive(id, revision); if (!d) return;
        d.failures = Math.min(d.failures + 1, 10);
        d.nextCheckAt = this.now() + Math.max(this.pollMs, error.retryAfterMs ?? 0, Math.min(3_600_000, this.pollMs * 2 ** (d.failures - 1)));
        d.lastError = 'provider-check-failed';
      });
    } finally { if (this.controllers.get(id) === controller) this.controllers.delete(id); }
  }
  async send(id, revision, q, message, signal) {
    try {
      const response = await this.transport.send(message, signal);
      const ticket = Array.isArray(response?.data) ? response.data[0] : response?.data;
      await this.mutate(() => {
        const d = this.alive(id, revision); if (!d) return;
        d.queue = d.queue.filter((x) => x.key !== q.key);
        if (ticket?.status === 'ok' && typeof ticket.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(ticket.id) && d.receipts.length < 100) {
          d.receipts.push({ id: ticket.id, createdAt: this.now(), dueAt: this.now() + 15 * 60_000 }); d.lastDelivery = 'expo-ticket-accepted';
        } else if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          d.enabled = false; d.queue = []; d.receipts = []; d.lastError = 'device-not-registered'; d.lastDelivery = 'failed';
        } else { d.lastError = 'push-ticket-failed'; d.lastDelivery = 'failed'; }
      });
    } catch (error) {
      if (this.faulted) return;
      await this.mutate(() => {
        const d = this.alive(id, revision); if (!d) return;
        const pending = d.queue.find((x) => x.key === q.key); if (!pending) return;
        if (error.retryable && error.code?.startsWith('http-') && pending.attempts < 2 && Date.parse(pending.alert.expires) > this.now()) {
          pending.attempts += 1; pending.phase = 'queued'; pending.dueAt = this.now() + Math.max(this.pollMs * 2 ** pending.attempts, error.retryAfterMs ?? 0); d.lastError = 'push-retry-pending';
        } else {
          d.queue = d.queue.filter((x) => x.key !== q.key); d.lastError = 'push-send-failed'; d.lastDelivery = error.code === 'network-or-timeout' ? 'unknown' : 'failed';
        }
      });
    }
  }
  async checkReceipts(id) {
    const initial = this.state.devices.find((d) => d.id === id);
    if (!initial?.enabled || this.faulted) return;
    const due = initial.receipts.filter((r) => r.dueAt <= this.now()).slice(0, 100); if (!due.length) return;
    try {
      const response = await this.transport.receipts(due.map((r) => r.id));
      if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data)) throw new Error('invalid-receipts');
      await this.mutate(() => {
        const d = this.state.devices.find((x) => x.id === id); if (!d?.enabled) return;
        const ids = new Set(due.map((r) => r.id));
        d.receipts = d.receipts.filter((r) => {
          if (!ids.has(r.id)) return true;
          const receipt = response.data[r.id];
          if (receipt?.status === 'ok') { d.lastDelivery = 'provider-accepted'; return false; }
          if (receipt?.status === 'error') {
            d.lastDelivery = 'failed';
            if (receipt.details?.error === 'DeviceNotRegistered') { d.enabled = false; d.queue = []; d.lastError = 'device-not-registered'; }
            else d.lastError = 'push-receipt-failed';
            return false;
          }
          if (this.now() - r.createdAt >= 23 * 3_600_000) { d.lastDelivery = 'receipt-unavailable'; return false; }
          r.dueAt = this.now() + 15 * 60_000; d.lastError = 'receipt-not-yet-available'; return true;
        });
        if (!d.enabled) d.receipts = [];
      });
    } catch (error) {
      if (this.faulted) return;
      await this.mutate(() => {
        const d = this.state.devices.find((x) => x.id === id); if (!d) return;
        const ids = new Set(due.map((r) => r.id));
        d.receipts = d.receipts.filter((r) => {
          if (!ids.has(r.id)) return true;
          if (this.now() - r.createdAt >= 23 * 3_600_000) { d.lastDelivery = 'receipt-unavailable'; return false; }
          r.dueAt = this.now() + Math.max(15 * 60_000, error.retryAfterMs ?? 0);
          return true;
        });
        d.lastError = 'receipt-check-failed';
      });
    }
  }
  async tick() {
    if (this.running || this.faulted) return;
    this.running = true;
    try {
      await this.mutate((s) => { s.devices = s.devices.filter((d) => this.now() - d.updatedAt <= 7 * 24 * 3_600_000); });
      const due = this.state.devices.filter((d) => d.enabled && ((d.nextCheckAt <= this.now() && this.alive(d.id, d.revision)) || d.receipts.some((r) => r.dueAt <= this.now()))).slice(0, 10).map((d) => d.id);
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(this.concurrency, due.length) }, async () => {
        while (index < due.length && !this.faulted) {
          const id = due[index++]; const d = this.state.devices.find((x) => x.id === id);
          if (d?.nextCheckAt <= this.now()) await this.check(id);
          await this.checkReceipts(id);
        }
      }));
    } finally { this.running = false; }
  }
  stop() { for (const c of this.controllers.values()) c.abort(); }
}
