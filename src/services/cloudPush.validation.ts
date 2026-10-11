import { validCoordinates } from "@/domain/alerts";
import { validTimestamp } from "@/data/nws";
import { CloudPushError, type CloudPoint, type CloudPushStatus } from "./cloudPush.types";

export const CLOUD_PROJECT_ID = "93c6f679-06ad-4edf-8ff7-8eec0290035b";
export const CLOUD_LOCATION_TASK = "clearpath-cloud-location-v1";
export const CLOUD_STORAGE_KEY = "clearpath.cloud-device.v1";
export const CLOUD_UPLOAD_INTERVAL_MS = 60_000;
export const CLOUD_POINT_MAX_AGE_MS = 5 * 60_000;
export type CloudConfig = { endpoint: string; background: boolean };

export const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const safeBearer = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
export const deviceId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const expoToken = (value: unknown): value is string =>
  typeof value === "string" && /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/.test(value);
const code = (value: unknown): value is string | null => value === null ||
  (typeof value === "string" && /^[a-z][a-z-]{0,63}$/.test(value));
const clock = (value: unknown): value is number | null => value === null ||
  (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

export function httpsOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256 || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || !url.hostname ||
      /^(?:localhost|127\.|0\.|\[?::1\]?)/i.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function cloudConfig(config: unknown): CloudConfig | null {
  if (!record(config) || !record(config.extra) || !record(config.android)) return null;
  const extra = config.extra;
  const endpoint = httpsOrigin(extra.cloudPushEndpoint);
  if (!endpoint || extra.cloudPushEnabled !== true || extra.cloudPushFcmConfigured !== true ||
    typeof config.android.googleServicesFile !== "string" || !config.android.googleServicesFile.trim() ||
    !record(extra.eas) || extra.eas.projectId !== CLOUD_PROJECT_ID) return null;
  return { endpoint, background: extra.cloudPushBackgroundLocationEnabled === true };
}

export function currentPoint(value: unknown, now = Date.now()): CloudPoint {
  if (!record(value) || Object.keys(value).length !== 2 || !record(value.point) ||
    Object.keys(value.point).length !== 2 || !validCoordinates(value.point) || !validTimestamp(value.locationObservedAt)) {
    throw new CloudPushError("invalid-location", "Use a fresh valid GPS point for cloud alerts.");
  }
  const observed = Date.parse(value.locationObservedAt);
  if (observed < now - CLOUD_POINT_MAX_AGE_MS || observed > now + 60_000) {
    throw new CloudPushError("stale-location", "GPS is stale. Get a new location before continuing.");
  }
  return { point: { latitude: value.point.latitude, longitude: value.point.longitude }, locationObservedAt: value.locationObservedAt };
}

export function readServerStatus(value: unknown): CloudPushStatus {
  const keys = ["enabled", "baseline", "locationFresh", "locationObservedAt", "lastCheckAt", "lastError", "lastDelivery", "pendingReceipts"];
  if (!record(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value)) ||
    typeof value.enabled !== "boolean" || (value.baseline !== "pending" && value.baseline !== "ready") ||
    typeof value.locationFresh !== "boolean" || !validTimestamp(value.locationObservedAt) ||
    !clock(value.lastCheckAt) || !code(value.lastError) || !code(value.lastDelivery) ||
    typeof value.pendingReceipts !== "number" || !Number.isSafeInteger(value.pendingReceipts) ||
    value.pendingReceipts < 0 || value.pendingReceipts > 100) {
    throw new CloudPushError("invalid-response", "Cloud alert status could not be verified.");
  }
  return value as CloudPushStatus;
}
