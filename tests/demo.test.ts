import { expect, test } from "@jest/globals";
import { currentAlerts } from "../src/domain/alerts";
import { getDemoSnapshot } from "../src/data/demo";
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
