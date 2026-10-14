import { describe, expect, test } from "@jest/globals";
import {
  currentAlerts,
  locationKey,
  uniqueAlerts,
  validCoordinates,
} from "../src/domain/alerts";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

describe("display baseline", () => {
  test("keeps provider order and does not invent priority scores", () => {
    const minor = officialAlert({ id: "minor", severity: "Minor" });
    const extreme = officialAlert({ id: "extreme", severity: "Extreme" });
    expect(currentAlerts([minor, extreme], TEST_NOW)).toEqual([minor, extreme]);
  });

  test("expires exactly at the provider timestamp, including cached data", () => {
    expect(
      currentAlerts(
        [officialAlert({ expires: new Date(TEST_NOW).toISOString() })],
        TEST_NOW,
      ),
    ).toEqual([]);
    expect(currentAlerts([officialAlert()], TEST_NOW)).toHaveLength(1);
    expect(
      currentAlerts([officialAlert({ expires: "unreadable" })], TEST_NOW),
    ).toEqual([]);
  });

  test("uses the newest duplicate content without moving its provider position", () => {
    const original = officialAlert();
    const latest = officialAlert({
      sent: "2026-10-09T18:45:00Z",
      instruction: "Updated official instruction",
    });
    const other = officialAlert({ id: "other" });
    expect(uniqueAlerts([original, other, latest])).toEqual([latest, other]);
    expect(uniqueAlerts([latest, original])).toEqual([latest]);
  });

  test("removes referenced messages on an update", () => {
    const original = officialAlert();
    const update = officialAlert({
      id: "update",
      sent: "2026-10-09T18:45:00Z",
      messageType: "Update",
      references: [original.id],
    });
    expect(uniqueAlerts([original, update])).toEqual([update]);
  });

  test("a cancellation suppresses its referenced message even after the cancellation expires", () => {
    const original = officialAlert();
    const cancellation = officialAlert({
      id: "cancel",
      sent: "2026-10-09T18:45:00Z",
      expires: "2026-10-09T18:50:00Z",
      messageType: "Cancel",
      references: [original.sourceUrl!],
    });
    expect(currentAlerts([original, cancellation], TEST_NOW)).toEqual([]);
  });

  test("does not let an older cancellation remove a later update", () => {
    const latest = officialAlert({ sent: "2026-10-09T18:50:00Z" });
    const cancellation = officialAlert({
      id: "cancel",
      sent: "2026-10-09T18:45:00Z",
      messageType: "Cancel",
      references: [latest.id],
    });
    expect(uniqueAlerts([latest, cancellation])).toEqual([latest]);
  });

  test.each(["Alert", "Update", "Cancel"] as const)(
    "a future-issued %s cannot remove a current warning from cached data",
    (messageType) => {
      const original = officialAlert();
      const future = officialAlert({
        id: messageType === "Alert" ? original.id : "urn:future",
        messageType,
        sent: "2026-10-09T19:02:00Z",
        sourceUrl: "https://api.weather.gov/alerts/urn:future",
        references: [original.id, original.sourceUrl!],
      });
      expect(currentAlerts([original, future], TEST_NOW)).toEqual([original]);
      expect(currentAlerts([future, original], TEST_NOW)).toEqual([original]);
    },
  );

  test("future issuance is bounded independently of a valid future onset", () => {
    const allowed = officialAlert({
      sent: "2026-10-09T14:01:00-05:00",
      onset: "2026-10-09T19:30:00Z",
    });
    expect(currentAlerts([allowed], TEST_NOW)).toEqual([allowed]);
    expect(currentAlerts([{
      ...allowed,
      sent: "2026-10-09T19:01:00.001Z",
    }], TEST_NOW)).toEqual([]);
  });
});

describe("location identity", () => {
  test("rejects missing, out-of-range, and nonfinite coordinates", () => {
    for (const coordinates of [
      null,
      {},
      { latitude: NaN, longitude: -99 },
      { latitude: 91, longitude: 0 },
      { latitude: 30, longitude: Infinity },
    ]) {
      expect(validCoordinates(coordinates)).toBe(false);
    }
    expect(() => locationKey({ latitude: 30, longitude: -181 })).toThrow(
      RangeError,
    );
  });

  test("preserves precise point identity and accepts a selected location", () => {
    expect(locationKey({ latitude: 30.000001, longitude: -99 })).not.toBe(
      locationKey({ latitude: 30.000002, longitude: -99 }),
    );
    expect(
      locationKey({
        label: "Kerrville",
        kind: "manual",
        coordinates: { latitude: 30, longitude: -99 },
      }),
    ).toBe("30,-99");
  });
});
