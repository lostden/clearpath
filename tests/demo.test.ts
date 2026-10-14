import { expect, test } from "@jest/globals";
import { currentAlerts } from "../src/domain/alerts";
import {
  DEMO_LOCATION,
  DEMO_TIMESTAMP,
  FRISCO_DEMO_LOCATION,
  getDemoLocation,
  getDemoScenarioDescription,
  getDemoSnapshot,
  isFriscoDemoLocation,
} from "../src/data/demo";
import { TEST_NOW } from "./fixtures/alerts";

test("all scenarios remain demo data and simulated messages cannot link to invented official warnings", () => {
  for (const scenario of ["flood", "tornado", "normal", "offline", "frisco"] as const) {
    const snapshot = getDemoSnapshot(scenario, TEST_NOW);
    expect(snapshot.source).toBe("demo");
    for (const alert of snapshot.alerts) {
      expect(alert.headline).toMatch(/SIMULATED/);
      expect(alert.agency).toMatch(/SIMULATED/);
      expect(alert.sourceUrl).toBeNull();
    }
  }
});

test("the North Texas scenario uses only invented training warnings at the exact Frisco reference point", () => {
  const snapshot = getDemoSnapshot("frisco");
  expect(snapshot.source).toBe("demo");
  expect(snapshot.locationKey).toBe("33.155424,-96.8225927");
  expect(snapshot.fetchedAt).toBe("2025-07-04T10:15:00.000Z");
  expect(snapshot.alerts.map((alert) => alert.event)).toEqual(["Flash Flood Warning", "Severe Thunderstorm Warning"]);
  expect(currentAlerts(snapshot.alerts, DEMO_TIMESTAMP)).toHaveLength(2);
  for (const alert of snapshot.alerts) {
    expect(alert.id).toMatch(/^demo:frisco-/);
    expect(alert.sourceUrl).toBeNull();
    expect(alert.description).toMatch(/invented North Texas training scenario/i);
    expect(alert.description).toMatch(/not.*historical event/i);
    expect(alert.description).not.toMatch(/Guadalupe|Hunt|gage|streamflow|July 4/i);
    expect(alert.instruction).toMatch(/SIMULATED/i);
  }
});

test("scenario locations change only the new Frisco option and retain every existing scene anchor", () => {
  expect(getDemoLocation("frisco").coordinates).toEqual({ latitude: 33.155424, longitude: -96.8225927 });
  expect(getDemoLocation("frisco")).toBe(FRISCO_DEMO_LOCATION);
  for (const scenario of ["flood", "tornado", "normal", "offline"] as const) {
    expect(getDemoLocation(scenario)).toBe(DEMO_LOCATION);
    expect(getDemoSnapshot(scenario).locationKey).toBe("30.0699,-99.3328");
  }
});

test("Frisco scene identification uses exact coordinates rather than a label or nearby location", () => {
  expect(isFriscoDemoLocation(null)).toBe(false);
  expect(isFriscoDemoLocation({ ...FRISCO_DEMO_LOCATION, label: "Any display label" })).toBe(true);
  expect(isFriscoDemoLocation({ ...FRISCO_DEMO_LOCATION, coordinates: { latitude: 33.155425, longitude: -96.8225927 } })).toBe(false);
  expect(isFriscoDemoLocation({ ...DEMO_LOCATION, label: "Frisco" })).toBe(false);
});

test("North Texas scene disclosure is fictional without borrowing the historic Hill Country claim", () => {
  expect(getDemoScenarioDescription("frisco")).toMatch(/invented North Texas training scenario/i);
  expect(getDemoScenarioDescription("frisco")).not.toMatch(/July 4|historical flood|Guadalupe/i);
  expect(getDemoScenarioDescription("flood")).toMatch(/Hill Country/i);
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
