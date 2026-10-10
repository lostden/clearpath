import { expect, test } from "@jest/globals";
import { currentAlerts } from "../src/domain/alerts";
import { DEMO_TIMESTAMP, getDemoSnapshot } from "../src/data/demo";
import { TEST_NOW } from "./fixtures/alerts";

test("all scenarios remain demo data and simulated messages cannot link to invented official warnings", () => {
  for (const scenario of ["flood", "tornado", "normal", "offline"] as const) {
    const snapshot = getDemoSnapshot(scenario, TEST_NOW);
    expect(snapshot.source).toBe("demo");
    for (const alert of snapshot.alerts) {
      expect(alert.headline).toMatch(/SIMULATED/);
      expect(alert.agency).toMatch(/SIMULATED/);
      expect(alert.sourceUrl).toBeNull();
    }
  }
});

test("outage retains its earlier retrieval time and excludes an expired simulated message from current display", () => {
  const snapshot = getDemoSnapshot("offline", TEST_NOW);
  expect(Date.parse(snapshot.fetchedAt)).toBe(TEST_NOW - 18 * 60_000);
  expect(snapshot.alerts).toHaveLength(2);
  expect(currentAlerts(snapshot.alerts, TEST_NOW)).toHaveLength(1);
  expect(getDemoSnapshot("normal", TEST_NOW).alerts).toEqual([]);
});

test("the default historical scene remains current only on its frozen simulation clock", () => {
  const snapshot = getDemoSnapshot("flood");
  expect(snapshot.fetchedAt).toBe("2025-07-04T10:15:00.000Z");
  expect(currentAlerts(snapshot.alerts, DEMO_TIMESTAMP)).toHaveLength(2);
  expect(currentAlerts(snapshot.alerts, TEST_NOW)).toEqual([]);
  expect(snapshot.alerts.every((alert) => alert.geometry !== null)).toBe(true);
});

test("an outage snapshot cannot contain a warning issued after it was retrieved", () => {
  const snapshot = getDemoSnapshot("offline");
  for (const alert of snapshot.alerts) {
    expect(Date.parse(alert.sent)).toBeLessThanOrEqual(Date.parse(snapshot.fetchedAt));
  }
  expect(currentAlerts(snapshot.alerts, DEMO_TIMESTAMP)).toHaveLength(1);
});
