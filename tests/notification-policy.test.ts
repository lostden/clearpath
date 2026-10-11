import { describe, expect, test } from "@jest/globals";
import {
  acknowledgeNotificationDelivery,
  createNotificationLedger,
  evaluateNotificationSnapshot,
  NOTIFICATION_FRESHNESS_MS,
  NOTIFICATION_LEDGER_LIMIT,
  restoreNotificationLedger,
  retargetNotificationLedger,
} from "../src/domain/notificationPolicy";
import type { NotificationLedger, NotificationWatch } from "../src/domain/notificationPolicy";
import type { AlertSnapshot, OfficialAlert } from "../src/domain/types";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

const watch: NotificationWatch = { locationKey: "30,-99", generation: "explicit-enable-1" };
const stamp = (now = TEST_NOW) => new Date(now).toISOString();
const snapshot = (alerts: OfficialAlert[] = [], overrides: Partial<AlertSnapshot> = {}): AlertSnapshot =>
  ({ source: "live", alerts, fetchedAt: stamp(), locationKey: watch.locationKey, ...overrides });
const enabled = (alerts: OfficialAlert[] = []): NotificationLedger =>
  evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot(alerts), TEST_NOW).ledger;

describe("watched point notification provenance", () => {
  test.each(["cached", "demo"] as const)("rejects %s data without establishing a baseline", (source) => {
    const result = evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot([officialAlert()], { source }), TEST_NOW);
    expect(result.status).toBe("not-live");
    expect(result.ledger.baselineEstablished).toBe(false);
    expect(result.candidates).toEqual([]);
  });

  test("rejects wrong-point responses, including a late response after movement", () => {
    const moved = retargetNotificationLedger(enabled(), "31,-99", TEST_NOW);
    expect(evaluateNotificationSnapshot(moved, snapshot([officialAlert()]), TEST_NOW).status).toBe("wrong-location");
    expect(evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot([], { locationKey: "30.00001,-99" }), TEST_NOW).status).toBe("wrong-location");
  });

  test.each([
    ["invalid-snapshot", "yesterday"],
    ["invalid-snapshot", "2026-10-09T19:00:00"],
    ["invalid-snapshot", "2026-02-30T19:00:00Z"],
    ["future-snapshot", stamp(TEST_NOW + 1)],
    ["stale-snapshot", stamp(TEST_NOW - NOTIFICATION_FRESHNESS_MS)],
  ])("rejects %s timestamps (%s)", (status, fetchedAt) => {
    const result = evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot([], { fetchedAt }), TEST_NOW);
    expect(result.status).toBe(status);
    expect(result.ledger.baselineEstablished).toBe(false);
  });

  test("accepts a snapshot just inside the freshness window", () => {
    expect(evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot([], { fetchedAt: stamp(TEST_NOW - NOTIFICATION_FRESHNESS_MS + 1) }), TEST_NOW).status).toBe("baseline");
  });

  test.each([
    { sourceUrl: null },
    { sourceUrl: "https://api.weather.gov.evil.example/alerts/a" },
    { sourceUrl: "https://example.com/alerts/a" },
    { id: "malformed alert identifier" },
    { sent: "not-a-date" },
    { expires: "not-a-date" },
    { sent: stamp(TEST_NOW + 1) },
    { sent: stamp(TEST_NOW - 1), expires: stamp(TEST_NOW - 2) },
  ])("rejects an unverifiable record, including relabeled demo data: %j", (overrides) => {
    const result = evaluateNotificationSnapshot(enabled(), snapshot([officialAlert(overrides)]), TEST_NOW);
    expect(result.status).toBe("invalid-alerts");
    expect(result.candidates).toEqual([]);
  });

  test("rejects a message dated after the snapshot even when before the current clock", () => {
    expect(evaluateNotificationSnapshot(enabled(), snapshot([officialAlert({ sent: stamp(TEST_NOW + 1) })]), TEST_NOW + 10).status).toBe("invalid-alerts");
  });

  test("ignores a stale completion after a newer accepted snapshot", () => {
    const newer = evaluateNotificationSnapshot(enabled(), snapshot([], { fetchedAt: stamp(TEST_NOW + 10) }), TEST_NOW + 10).ledger;
    const result = evaluateNotificationSnapshot(newer, snapshot([officialAlert()]), TEST_NOW + 10);
    expect(result.status).toBe("older-snapshot");
    expect(result.ledger.lastSnapshotAt).toBe(stamp(TEST_NOW + 10));
  });
});

describe("baseline, delivery acknowledgement and agency order", () => {
  test("the first valid snapshot establishes an existing-message baseline without notifications", () => {
    const alert = officialAlert();
    const result = evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot([alert]), TEST_NOW);
    expect(result.status).toBe("baseline");
    expect(result.candidates).toEqual([]);
    expect(result.ledger.records).toEqual([{ id: alert.id, sent: alert.sent, expires: alert.expires, disposition: "baseline" }]);
    expect(evaluateNotificationSnapshot(result.ledger, snapshot([alert]), TEST_NOW).candidates).toEqual([]);
  });

  test("an empty baseline permits subsequently encountered active messages in provider order", () => {
    const minor = officialAlert({ id: "minor", severity: "Minor" });
    const extreme = officialAlert({ id: "extreme", severity: "Extreme" });
    const result = evaluateNotificationSnapshot(enabled(), snapshot([minor, extreme]), TEST_NOW);
    expect(result.candidates.map((candidate) => candidate.alert)).toEqual([minor, extreme]);
    expect(result.ledger.records).toEqual([]);
  });

  test("a scheduling failure does not mark unseen messages delivered or consume them", () => {
    const alert = officialAlert();
    const first = evaluateNotificationSnapshot(enabled(), snapshot([alert]), TEST_NOW);
    // Persisting an evaluated ledger before the OS scheduler rejects is safe.
    const persisted = restoreNotificationLedger(JSON.parse(JSON.stringify(first.ledger)), watch, TEST_NOW);
    const retry = evaluateNotificationSnapshot(persisted, snapshot([alert]), TEST_NOW);
    expect(retry.candidates).toEqual(first.candidates);
    expect(persisted.records).toEqual([]);
    const acknowledged = acknowledgeNotificationDelivery(retry.ledger, retry.candidates, TEST_NOW);
    expect(acknowledged.acknowledgedKeys).toEqual(first.candidates.map((candidate) => candidate.key));
    expect(acknowledged.unrecordedKeys).toEqual([]);
    expect(evaluateNotificationSnapshot(acknowledged.ledger, snapshot([alert]), TEST_NOW).candidates).toEqual([]);
  });

  test("partial batch scheduling consumes only successfully accepted notifications", () => {
    const alerts = [officialAlert({ id: "first" }), officialAlert({ id: "second" })];
    const result = evaluateNotificationSnapshot(enabled(), snapshot(alerts), TEST_NOW);
    const accepted = acknowledgeNotificationDelivery(result.ledger, [result.candidates[0]], TEST_NOW).ledger;
    expect(evaluateNotificationSnapshot(accepted, snapshot(alerts), TEST_NOW).candidates.map((candidate) => candidate.alert.id)).toEqual(["second"]);
  });

  test("the same identifier with a newer agency sent time is eligible, repeats and older versions are not", () => {
    const baseline = officialAlert();
    const update = officialAlert({ sent: "2026-10-09T18:45:00Z", messageType: "Update" });
    const result = evaluateNotificationSnapshot(enabled([baseline]), snapshot([baseline, update]), TEST_NOW);
    expect(result.candidates.map((candidate) => candidate.alert)).toEqual([update]);
    const accepted = acknowledgeNotificationDelivery(result.ledger, result.candidates, TEST_NOW).ledger;
    expect(accepted.records).toHaveLength(1);
    expect(evaluateNotificationSnapshot(accepted, snapshot([baseline, update]), TEST_NOW).candidates).toEqual([]);
    expect(evaluateNotificationSnapshot(accepted, snapshot([baseline]), TEST_NOW).candidates).toEqual([]);
  });

  test("equivalent sent times with different timezone text do not become new messages", () => {
    const alert = officialAlert();
    expect(evaluateNotificationSnapshot(enabled([alert]), snapshot([officialAlert({ sent: "2026-10-09T13:30:00-05:00" })]), TEST_NOW).candidates).toEqual([]);
  });
});

describe("existing active-alert semantics", () => {
  test("reference replacements suppress old records and preserve the replacement's provider position", () => {
    const old = officialAlert();
    const other = officialAlert({ id: "other", sourceUrl: "https://api.weather.gov/alerts/other" });
    const update = officialAlert({ id: "update", sourceUrl: "https://api.weather.gov/alerts/update", sent: "2026-10-09T18:45:00Z", messageType: "Update", references: [old.id, old.sourceUrl!] });
    expect(evaluateNotificationSnapshot(enabled(), snapshot([old, other, update]), TEST_NOW).candidates.map((candidate) => candidate.alert)).toEqual([other, update]);
  });

  test("expired cancellation still suppresses its referenced current warning", () => {
    const alert = officialAlert();
    const cancel = officialAlert({ id: "cancel", messageType: "Cancel", references: [alert.sourceUrl!], sent: "2026-10-09T18:45:00Z", expires: "2026-10-09T18:50:00Z" });
    expect(evaluateNotificationSnapshot(enabled(), snapshot([alert, cancel]), TEST_NOW).candidates).toEqual([]);
  });

  test("an older cancellation cannot suppress a later official update", () => {
    const update = officialAlert({ sent: "2026-10-09T18:50:00Z", messageType: "Update" });
    const cancel = officialAlert({ id: "cancel", messageType: "Cancel", references: [update.id], sent: "2026-10-09T18:45:00Z" });
    expect(evaluateNotificationSnapshot(enabled(), snapshot([cancel, update]), TEST_NOW).candidates.map((candidate) => candidate.alert)).toEqual([update]);
  });

  test("expired messages and Ack/Error messages are never notification candidates", () => {
    const alerts = [
      officialAlert({ id: "expired", expires: stamp() }),
      officialAlert({ id: "ack", messageType: "Ack" }),
      officialAlert({ id: "error", messageType: "Error" }),
    ];
    expect(evaluateNotificationSnapshot(enabled(), snapshot(alerts), TEST_NOW).candidates).toEqual([]);
  });
});

describe("movement and explicit enable generations", () => {
  test("moving preserves dedup and permits unseen warnings encountered at the new point", () => {
    const common = officialAlert();
    const newArea = officialAlert({ id: "entered-warning-area" });
    const moved = retargetNotificationLedger(enabled([common]), "31,-99", TEST_NOW);
    expect(moved.baselineEstablished).toBe(true);
    expect(moved.lastSnapshotAt).toBeNull();
    const result = evaluateNotificationSnapshot(moved, snapshot([common, newArea], { locationKey: "31,-99" }), TEST_NOW);
    expect(result.candidates.map((candidate) => candidate.alert.id)).toEqual([newArea.id]);
    const accepted = acknowledgeNotificationDelivery(result.ledger, result.candidates, TEST_NOW).ledger;
    const back = retargetNotificationLedger(accepted, watch.locationKey, TEST_NOW);
    expect(evaluateNotificationSnapshot(back, snapshot([common, newArea]), TEST_NOW).candidates).toEqual([]);
  });

  test("a delivered warning remains seen across movement, and a new version remains eligible", () => {
    const first = evaluateNotificationSnapshot(enabled(), snapshot([officialAlert()]), TEST_NOW);
    const accepted = acknowledgeNotificationDelivery(first.ledger, first.candidates, TEST_NOW).ledger;
    const moved = retargetNotificationLedger(accepted, "31,-99", TEST_NOW);
    expect(evaluateNotificationSnapshot(moved, snapshot([officialAlert()], { locationKey: "31,-99" }), TEST_NOW).candidates).toEqual([]);
    const update = officialAlert({ sent: "2026-10-09T18:45:00Z" });
    expect(evaluateNotificationSnapshot(moved, snapshot([update], { locationKey: "31,-99" }), TEST_NOW).candidates).toHaveLength(1);
  });

  test("disable/re-enable uses a new generation and initial snapshot baseline", () => {
    const nextWatch = { ...watch, generation: "explicit-enable-2" };
    const next = restoreNotificationLedger(enabled([officialAlert()]), nextWatch, TEST_NOW);
    expect(next).toEqual(createNotificationLedger(nextWatch));
    const baseline = evaluateNotificationSnapshot(next, snapshot([officialAlert({ id: "already-active" })]), TEST_NOW);
    expect(baseline.status).toBe("baseline");
    expect(baseline.candidates).toEqual([]);
  });

  test("acknowledgement from another point or enable generation cannot mutate the current watch", () => {
    const old = evaluateNotificationSnapshot(enabled(), snapshot([officialAlert()]), TEST_NOW);
    const moved = retargetNotificationLedger(old.ledger, "31,-99", TEST_NOW);
    const stalePoint = acknowledgeNotificationDelivery(moved, old.candidates, TEST_NOW);
    expect(stalePoint.ledger.records).toEqual([]);
    expect(stalePoint.unrecordedKeys).toEqual(old.candidates.map((candidate) => candidate.key));
    const otherSession = enabled();
    otherSession.watch.generation = "explicit-enable-2";
    expect(acknowledgeNotificationDelivery(otherSession, old.candidates, TEST_NOW).ledger.records).toEqual([]);
  });

  test("rejects malformed watched points and generation identities", () => {
    for (const locationKey of ["", "30,181", "30, -99", "NaN,-99", "30,-99,1"]) {
      expect(() => createNotificationLedger({ ...watch, locationKey })).toThrow(TypeError);
    }
    expect(() => createNotificationLedger({ ...watch, generation: "" })).toThrow(TypeError);
    expect(() => retargetNotificationLedger(enabled(), "90.1,0", TEST_NOW)).toThrow(TypeError);
  });
});

describe("bounded and defensive persistence", () => {
  test("round-trips only serializable records and drops expired retention entries", () => {
    const result = enabled([officialAlert({ expires: stamp(TEST_NOW + 1) })]);
    expect(restoreNotificationLedger(JSON.parse(JSON.stringify(result)), watch, TEST_NOW)).toEqual(result);
    expect(restoreNotificationLedger(result, watch, TEST_NOW + 1).records).toEqual([]);
  });

  test("malformed persisted ledgers reset safely to a fresh baseline", () => {
    const valid = enabled([officialAlert()]);
    const malformed = [
      null, "not decoded JSON", {}, { ...valid, version: 2 },
      { ...valid, lastSnapshotAt: "yesterday" },
      { ...valid, lastSnapshotAt: stamp(TEST_NOW + 1) },
      { ...valid, watch: { ...watch, locationKey: "31,-99" } },
      { ...valid, records: [...valid.records, ...valid.records] },
      { ...valid, records: [{ ...valid.records[0], sent: "malformed" }] },
      { ...valid, records: [{ ...valid.records[0], disposition: "pending" }] },
      { ...valid, baselineEstablished: false },
      { ...valid, records: Array.from({ length: NOTIFICATION_LEDGER_LIMIT + 1 }, (_, index) => ({ ...valid.records[0], id: `record-${index}` })) },
    ];
    for (const value of malformed) expect(restoreNotificationLedger(value, watch, TEST_NOW)).toEqual(createNotificationLedger(watch));
  });

  test("an oversized initial snapshot stays uninitialized instead of forgetting baseline messages", () => {
    const alerts = Array.from({ length: NOTIFICATION_LEDGER_LIMIT + 1 }, (_, index) => officialAlert({ id: `record-${index}` }));
    const result = evaluateNotificationSnapshot(createNotificationLedger(watch), snapshot(alerts), TEST_NOW);
    expect(result.status).toBe("capacity");
    expect(result.ledger.baselineEstablished).toBe(false);
    expect(result.candidates).toEqual([]);
    expect(result.deferredCount).toBe(alerts.length);
  });

  test("capacity defers unseen messages, allows same-id updates and never evicts unexpired dedup", () => {
    const alerts = Array.from({ length: NOTIFICATION_LEDGER_LIMIT }, (_, index) => officialAlert({ id: `record-${index}` }));
    const full = enabled(alerts);
    const unseen = officialAlert({ id: "unseen" });
    const update = officialAlert({ id: "record-0", sent: "2026-10-09T18:45:00Z" });
    const result = evaluateNotificationSnapshot(full, snapshot([unseen, update]), TEST_NOW);
    expect(result.status).toBe("capacity");
    expect(result.deferredCount).toBe(1);
    expect(result.candidates.map((candidate) => candidate.alert.id)).toEqual([update.id]);
    expect(result.ledger.records).toHaveLength(NOTIFICATION_LEDGER_LIMIT);
    const accepted = acknowledgeNotificationDelivery(result.ledger, result.candidates, TEST_NOW).ledger;
    expect(accepted.records).toHaveLength(NOTIFICATION_LEDGER_LIMIT);
    expect(evaluateNotificationSnapshot(accepted, snapshot([unseen, update]), TEST_NOW).deferredCount).toBe(1);
  });

  test("deferred unseen messages become eligible when an expired record releases capacity", () => {
    const alerts = Array.from({ length: NOTIFICATION_LEDGER_LIMIT }, (_, index) => officialAlert({ id: `record-${index}`, ...(index === 0 ? { expires: stamp(TEST_NOW + 1) } : {}) }));
    const full = enabled(alerts);
    const unseen = officialAlert({ id: "unseen" });
    const deferred = evaluateNotificationSnapshot(full, snapshot([unseen]), TEST_NOW);
    const retry = evaluateNotificationSnapshot(deferred.ledger, snapshot([unseen], { fetchedAt: stamp(TEST_NOW + 1) }), TEST_NOW + 1);
    expect(retry.candidates.map((candidate) => candidate.alert.id)).toEqual([unseen.id]);
    expect(retry.deferredCount).toBe(0);
  });

  test("capacity after concurrent evaluations returns unrecorded keys rather than claiming delivery retained", () => {
    const almostFull = enabled(Array.from({ length: NOTIFICATION_LEDGER_LIMIT - 1 }, (_, index) => officialAlert({ id: `record-${index}` })));
    const one = evaluateNotificationSnapshot(almostFull, snapshot([officialAlert({ id: "one" })]), TEST_NOW);
    const two = evaluateNotificationSnapshot(almostFull, snapshot([officialAlert({ id: "two" })]), TEST_NOW);
    const acceptedOne = acknowledgeNotificationDelivery(one.ledger, one.candidates, TEST_NOW).ledger;
    const second = acknowledgeNotificationDelivery(acceptedOne, two.candidates, TEST_NOW);
    expect(second.ledger.records).toHaveLength(NOTIFICATION_LEDGER_LIMIT);
    expect(second.acknowledgedKeys).toEqual([]);
    expect(second.unrecordedKeys).toEqual(two.candidates.map((candidate) => candidate.key));
  });

  test("forged identities and expired delivery acknowledgements are not recorded", () => {
    const result = evaluateNotificationSnapshot(enabled(), snapshot([officialAlert({ expires: stamp(TEST_NOW + 1) })]), TEST_NOW);
    expect(acknowledgeNotificationDelivery(result.ledger, [{ ...result.candidates[0], key: "forged" }], TEST_NOW).acknowledgedKeys).toEqual([]);
    expect(acknowledgeNotificationDelivery(result.ledger, result.candidates, TEST_NOW + 1).acknowledgedKeys).toEqual([]);
  });
});
