// Deliberately independent of the React Native TypeScript graph. Keep these CAP
// rules aligned with src/data/nws.ts and src/domain/alerts.ts.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 512) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const officialUrl = (v) => text(v, 2048) && /^https:\/\/api\.weather\.gov\/alerts\/[^\s?#]+$/.test(v);
export function timestamp(v) {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const days = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= days && Number(m[4]) < 24 && Number(m[5]) < 60 && Number(m[6]) < 60;
}
export function validPoint(v) {
  return object(v) && Object.keys(v).length === 2 && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180;
}
export const validExpoToken = (v) => typeof v === 'string' && /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/.test(v);
export const alertKey = (a) => `${a.id}\n${a.sent}`;

export function normalizeWarnings(data, now) {
  if (!object(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 500) throw new Error('invalid-alert-collection');
  const latest = new Map();
  for (const f of data.features) {
    if (!object(f) || f.type !== 'Feature' || !object(f.properties)) throw new Error('invalid-alert-record');
    const p = f.properties;
    // Test/exercise/private messages are never notification input.
    if (p.status !== 'Actual' || p.scope !== 'Public') continue;
    const source = officialUrl(f.id) ? f.id : p['@id'];
    if (!text(p.id) || !text(p.event, 160) || !officialUrl(source) || !timestamp(p.sent) || !timestamp(p.expires) || Date.parse(p.expires) <= Date.parse(p.sent) || !['Alert', 'Update', 'Cancel', 'Ack', 'Error'].includes(p.messageType) || !['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'].includes(p.severity) || !Array.isArray(p.references)) throw new Error('invalid-alert-record');
    // Allow one minute of clock skew, but fail the collection before a future
    // Update/Cancel can suppress an otherwise current warning.
    if (Date.parse(p.sent) > now + 60_000) throw new Error('invalid-alert-record');
    const refs = [];
    for (const r of p.references) {
      if (!object(r)) throw new Error('invalid-alert-reference');
      if (text(r.identifier)) refs.push(r.identifier);
      if (officialUrl(r['@id'])) refs.push(r['@id']);
    }
    const a = { id: p.id, event: p.event, source, sent: p.sent, expires: p.expires, messageType: p.messageType, severity: p.severity, references: refs };
    const previous = latest.get(a.id);
    if (!previous || Date.parse(a.sent) > Date.parse(previous.sent)) latest.set(a.id, a);
  }
  const replacements = new Map();
  for (const a of latest.values()) {
    if (a.messageType !== 'Cancel' && a.messageType !== 'Update') continue;
    for (const ref of a.references) replacements.set(ref, Math.max(replacements.get(ref) ?? -Infinity, Date.parse(a.sent)));
  }
  // Map insertion order preserves provider order. No priority engine is invented.
  return [...latest.values()].filter((a) => (a.messageType === 'Alert' || a.messageType === 'Update') && Date.parse(a.expires) > now && Math.max(replacements.get(a.id) ?? -Infinity, replacements.get(a.source) ?? -Infinity) < Date.parse(a.sent));
}

export function pushMessage(token, alert, now) {
  const ttl = Math.floor((Date.parse(alert.expires) - now) / 1000);
  if (ttl < 1) return null;
  return {
    to: token,
    title: `NWS / ${alert.event}`,
    body: 'Official warning for your last reported location. Open ClearPath for current instructions.',
    data: { kind: 'nws-point-alert', alertId: alert.id },
    ttl: Math.min(ttl, 3600),
    priority: 'high',
    channelId: 'clearpath-nws',
    sound: 'default',
  };
}
