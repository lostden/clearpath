import { coordinatesFor, currentAlerts } from '../domain/alerts';
import type { AlertGeometry, Coordinates, GeoPosition, OfficialAlert, SelectedLocation } from '../domain/types';
import { ClearPathDataError, fetchJson } from './http';

const severities = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'] as const;
const urgencies = ['Immediate', 'Expected', 'Future', 'Past', 'Unknown'] as const;
const certainties = ['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'] as const;
const messageTypes = ['Alert', 'Update', 'Cancel', 'Ack', 'Error'] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** Requires a timezone: interpreting a provider timestamp in the phone's timezone is incorrect. */
export function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth &&
    Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6]) < 60;
}

function position(value: unknown): value is GeoPosition {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
    typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}

function ring(value: unknown): value is GeoPosition[] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(position)) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function polygon(value: unknown): value is GeoPosition[][] {
  return Array.isArray(value) && value.length > 0 && value.every(ring);
}

export function isAlertGeometry(value: unknown): value is AlertGeometry {
  if (!record(value)) return false;
  return value.type === 'Polygon' ? polygon(value.coordinates) :
    value.type === 'MultiPolygon' && Array.isArray(value.coordinates) &&
    value.coordinates.length > 0 && value.coordinates.every(polygon);
}

function officialUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/api\.weather\.gov\/alerts\/[^\s?#]+$/.test(value);
}

/** Runtime validation is also used for persisted real-data records. */
export function isOfficialAlert(value: unknown): value is OfficialAlert {
  if (!record(value)) return false;
  return nonempty(value.id) && nonempty(value.event) && nullableText(value.headline) &&
    typeof value.description === 'string' && nullableText(value.instruction) &&
    severities.some((item) => item === value.severity) &&
    urgencies.some((item) => item === value.urgency) &&
    certainties.some((item) => item === value.certainty) &&
    messageTypes.some((item) => item === value.messageType) &&
    (value.onset === null || validTimestamp(value.onset)) &&
    validTimestamp(value.sent) && validTimestamp(value.expires) &&
    Date.parse(value.expires) > Date.parse(value.sent) && nonempty(value.agency) &&
    officialUrl(value.sourceUrl) &&
    (value.geometry === null || isAlertGeometry(value.geometry)) &&
    Array.isArray(value.references) && value.references.every(nonempty);
}

function normalizeFeature(feature: unknown): OfficialAlert | null {
  if (!record(feature) || feature.type !== 'Feature' || !record(feature.properties)) return null;
  const properties = feature.properties;
  const referenceIds: string[] = [];
  if (Array.isArray(properties.references)) {
    for (const reference of properties.references) {
      if (!record(reference)) continue;
      if (nonempty(reference.identifier)) referenceIds.push(reference.identifier);
      if (nonempty(reference['@id'])) referenceIds.push(reference['@id']);
    }
  }
  const sourceUrl = officialUrl(feature.id) ? feature.id : properties['@id'];
  const candidate = {
    id: properties.id,
    event: properties.event,
    headline: properties.headline ?? null,
    description: properties.description,
    instruction: properties.instruction ?? null,
    severity: properties.severity,
    urgency: properties.urgency,
    certainty: properties.certainty,
    onset: properties.onset ?? null,
    expires: properties.expires,
    sent: properties.sent,
    agency: properties.senderName,
    sourceUrl,
    // Preserve usable warning text when no usable official polygon was supplied.
    geometry: isAlertGeometry(feature.geometry) ? feature.geometry : null,
    messageType: properties.messageType,
    references: [...new Set(referenceIds)],
  };
  return isOfficialAlert(candidate) ? candidate : null;
}

export function normalizeNwsCollection(data: unknown, now = Date.now()): OfficialAlert[] {
  if (!record(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new ClearPathDataError('invalid-response', 'The weather service returned an invalid alert collection.');
  }
  const alerts: OfficialAlert[] = [];
  let malformed = 0;
  let valid = 0;
  for (const feature of data.features) {
    const alert = normalizeFeature(feature);
    if (!alert) { malformed += 1; continue; }
    valid += 1;
    if (!record(feature) || !record(feature.properties)) continue;
    // CAP exercises/test messages must never be presented as live emergencies.
    if (feature.properties.status !== 'Actual' || feature.properties.scope !== 'Public') continue;
    alerts.push(alert);
  }
  if (malformed > 0 && valid === 0) {
    throw new ClearPathDataError('invalid-response', 'The weather service returned alerts that could not be verified.');
  }
  return currentAlerts(alerts, now);
}

export async function getActiveAlerts(
  location: Coordinates | SelectedLocation,
  signal?: AbortSignal,
): Promise<OfficialAlert[]> {
  const point = coordinatesFor(location);
  const query = encodeURIComponent(`${point.latitude},${point.longitude}`);
  const data = await fetchJson(`https://api.weather.gov/alerts/active?point=${query}`, {
    signal,
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'ClearPath/0.1 (student emergency information app)',
    },
  });
  return normalizeNwsCollection(data);
}
