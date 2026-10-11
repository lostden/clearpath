import { isOfficialAlert, validTimestamp } from "../data/nws";
import { currentAlerts, locationKey } from "./alerts";
import type { AlertSnapshot, OfficialAlert } from "./types";

/** Match the point-alert feed's verification window. This is not a delivery guarantee. */
export const NOTIFICATION_FRESHNESS_MS = 90_000;
export const NOTIFICATION_LEDGER_LIMIT = 256;

export type NotificationWatch = {
  locationKey: string;
  /** Generate a new identity for each explicit enable, not for each GPS fix. */
  generation: string;
};

export type NotificationRecord = {
  id: string;
  sent: string;
  expires: string;
  disposition: "baseline" | "delivered";
};

export type NotificationLedger = {
  version: 1;
  watch: NotificationWatch;
  baselineEstablished: boolean;
  /** Null after retargeting; the previous point's response cannot order the new point. */
  lastSnapshotAt: string | null;
  records: NotificationRecord[];
};

export type NotificationCandidate = {
  key: string;
  watchGeneration: string;
  locationKey: string;
  alert: OfficialAlert;
};

export type NotificationEvaluation = {
  ledger: NotificationLedger;
  candidates: NotificationCandidate[];
  status:
    | "baseline"
    | "ready"
    | "capacity"
    | "not-live"
    | "wrong-location"
    | "invalid-snapshot"
    | "stale-snapshot"
    | "future-snapshot"
    | "older-snapshot"
    | "invalid-alerts";
  /** These messages remain unseen and may be retried when retention capacity permits. */
  deferredCount: number;
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const boundedText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
const validMessageId = (value: unknown): value is string =>
  boundedText(value, 2_048) && !/[\u0000-\u0020\u007f]/.test(value);

function validPointKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  const parts = value.split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) return false;
  try {
    return locationKey({ latitude: Number(parts[0]), longitude: Number(parts[1]) }) === value;
  } catch {
    return false;
  }
}

function validWatch(value: unknown): value is NotificationWatch {
  return object(value) && validPointKey(value.locationKey) && boundedText(value.generation, 128);
}

export function createNotificationLedger(watch: NotificationWatch): NotificationLedger {
  if (!validWatch(watch)) throw new TypeError("A valid watched point and enable generation are required.");
  return {
    version: 1,
    watch: { ...watch },
    baselineEstablished: false,
    lastSnapshotAt: null,
    records: [],
  };
}

function validRecord(value: unknown, now: number): value is NotificationRecord {
  return object(value) && validMessageId(value.id) &&
    validTimestamp(value.sent) && Date.parse(value.sent) <= now &&
    validTimestamp(value.expires) && Date.parse(value.expires) > Date.parse(value.sent) &&
    (value.disposition === "baseline" || value.disposition === "delivered");
}

/** Invalid/mismatched persistence resets to a baseline, never to a burst of "new" alerts. */
export function restoreNotificationLedger(
  value: unknown,
  watch: NotificationWatch,
  now = Date.now(),
): NotificationLedger {
  const empty = createNotificationLedger(watch);
  if (!Number.isFinite(now) || !object(value) || value.version !== 1 ||
    !validWatch(value.watch) || value.watch.generation !== watch.generation ||
    value.watch.locationKey !== watch.locationKey ||
    typeof value.baselineEstablished !== "boolean" ||
    !(value.lastSnapshotAt === null || (validTimestamp(value.lastSnapshotAt) && Date.parse(value.lastSnapshotAt) <= now)) ||
    !Array.isArray(value.records) || value.records.length > NOTIFICATION_LEDGER_LIMIT ||
    !value.records.every((entry) => validRecord(entry, now)) ||
    new Set(value.records.map((entry) => entry.id)).size !== value.records.length ||
    (!value.baselineEstablished && (value.lastSnapshotAt !== null || value.records.length !== 0))) {
    return empty;
  }
  return {
    version: 1,
    watch: { ...watch },
    baselineEstablished: value.baselineEstablished,
    lastSnapshotAt: value.lastSnapshotAt,
    records: value.records
      .filter((entry) => Date.parse(entry.expires) > now)
      .map((entry) => ({ id: entry.id, sent: entry.sent, expires: entry.expires, disposition: entry.disposition })),
  };
}

/** Following movement keeps the enable session and its seen messages, including its baseline. */
export function retargetNotificationLedger(
  ledger: NotificationLedger,
  nextLocationKey: string,
  now = Date.now(),
): NotificationLedger {
  if (!validPointKey(nextLocationKey)) throw new TypeError("A valid watched point is required.");
  const restored = restoreNotificationLedger(ledger, ledger.watch, now);
  if (nextLocationKey === restored.watch.locationKey) return restored;
  return {
    ...restored,
    watch: { ...restored.watch, locationKey: nextLocationKey },
    lastSnapshotAt: null,
  };
}

function candidateKey(generation: string, id: string, sent: string): string {
  return JSON.stringify([generation, id, sent]);
}

/**
 * Consume trusted NWS point-adapter results only, never regional map responses.
 * This checks provenance labels and normalized official records, not network authenticity.
 * Evaluation does not consume candidates: persist its ledger, schedule, then acknowledge.
 */
export function evaluateNotificationSnapshot(
  ledger: NotificationLedger,
  snapshot: AlertSnapshot,
  now = Date.now(),
): NotificationEvaluation {
  const restored = restoreNotificationLedger(ledger, ledger.watch, now);
  const result = (status: NotificationEvaluation["status"], candidates: NotificationCandidate[] = [], deferredCount = 0, next = restored): NotificationEvaluation =>
    ({ ledger: next, candidates, status, deferredCount });
  if (!Number.isFinite(now) || !object(snapshot)) return result("invalid-snapshot");
  if (snapshot.source !== "live") return result("not-live");
  if (snapshot.locationKey !== restored.watch.locationKey) return result("wrong-location");
  if (!validTimestamp(snapshot.fetchedAt) || !Array.isArray(snapshot.alerts)) return result("invalid-snapshot");
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  if (fetchedAt > now) return result("future-snapshot");
  if (now - fetchedAt >= NOTIFICATION_FRESHNESS_MS) return result("stale-snapshot");
  if (restored.lastSnapshotAt !== null && fetchedAt < Date.parse(restored.lastSnapshotAt)) return result("older-snapshot");
  if (!snapshot.alerts.every((alert) => isOfficialAlert(alert) && validMessageId(alert.id) && Date.parse(alert.sent) <= fetchedAt)) {
    return result("invalid-alerts");
  }
  // Existing domain semantics retain provider order, cancellations and referenced replacements.
  const active = currentAlerts(snapshot.alerts, now);
  if (!restored.baselineEstablished) {
    if (active.length > NOTIFICATION_LEDGER_LIMIT) return result("capacity", [], active.length);
    return result("baseline", [], 0, {
      ...restored,
      baselineEstablished: true,
      lastSnapshotAt: snapshot.fetchedAt,
      records: active.map((alert) => ({ id: alert.id, sent: alert.sent, expires: alert.expires, disposition: "baseline" })),
    });
  }
  const records = new Map(restored.records.map((entry) => [entry.id, entry]));
  let available = NOTIFICATION_LEDGER_LIMIT - records.size;
  let deferredCount = 0;
  const candidates: NotificationCandidate[] = [];
  for (const alert of active) {
    const previous = records.get(alert.id);
    if (previous && Date.parse(alert.sent) <= Date.parse(previous.sent)) continue;
    if (!previous && available === 0) {
      deferredCount += 1;
      continue;
    }
    if (!previous) available -= 1;
    candidates.push({
      key: candidateKey(restored.watch.generation, alert.id, alert.sent),
      watchGeneration: restored.watch.generation,
      locationKey: restored.watch.locationKey,
      alert,
    });
  }
  return result(deferredCount > 0 ? "capacity" : "ready", candidates, deferredCount, {
    ...restored,
    lastSnapshotAt: snapshot.fetchedAt,
  });
}

/** Call only for notifications accepted by the delivery adapter; a failure stays retryable. */
export function acknowledgeNotificationDelivery(
  ledger: NotificationLedger,
  accepted: readonly NotificationCandidate[],
  now = Date.now(),
): { ledger: NotificationLedger; acknowledgedKeys: string[]; unrecordedKeys: string[] } {
  const restored = restoreNotificationLedger(ledger, ledger.watch, now);
  const records = new Map(restored.records.map((entry) => [entry.id, entry]));
  const acknowledgedKeys: string[] = [];
  const unrecordedKeys: string[] = [];
  for (const candidate of accepted) {
    const alert = candidate.alert;
    if (!restored.baselineEstablished || candidate.watchGeneration !== restored.watch.generation ||
      candidate.locationKey !== restored.watch.locationKey || !isOfficialAlert(alert) ||
      !validMessageId(alert.id) || (alert.messageType !== "Alert" && alert.messageType !== "Update") ||
      Date.parse(alert.sent) > now || Date.parse(alert.expires) <= now ||
      candidate.key !== candidateKey(restored.watch.generation, alert.id, alert.sent)) {
      unrecordedKeys.push(candidate.key);
      continue;
    }
    const previous = records.get(alert.id);
    if (!previous && records.size >= NOTIFICATION_LEDGER_LIMIT) {
      unrecordedKeys.push(candidate.key);
      continue;
    }
    if (!previous || Date.parse(alert.sent) > Date.parse(previous.sent)) {
      records.set(alert.id, { id: alert.id, sent: alert.sent, expires: alert.expires, disposition: "delivered" });
    }
    acknowledgedKeys.push(candidate.key);
  }
  return { ledger: { ...restored, records: [...records.values()] }, acknowledgedKeys, unrecordedKeys };
}
