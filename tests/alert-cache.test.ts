import AsyncStorage from "@react-native-async-storage/async-storage";
import { readAlertCache, writeAlertCache } from "../src/data/alertCache";
import { getDemoSnapshot } from "../src/data/demo";
import { currentAlerts, locationKey } from "../src/domain/alerts";
import type { AlertSnapshot } from "../src/domain/types";
import { officialAlert } from "./fixtures/officialAlert";

const point = { latitude: 30.0474, longitude: -99.1403 };
const storageKey = "@clearpath/alerts/v1/latest";
const liveSnapshot: AlertSnapshot = {
  source: "live",
  alerts: [officialAlert],
  fetchedAt: "2026-10-09T18:05:00Z",
  locationKey: locationKey(point),
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("official alert persistence", () => {
  test("restores last successful warnings and timestamp with cached provenance", async () => {
    await writeAlertCache(liveSnapshot);
    const restored = await readAlertCache(point);
    expect(restored).toEqual({ ...liveSnapshot, source: "cached" });
    expect(restored?.source).not.toBe("live");
  });

  test("a restored future cancellation cannot suppress a current cached warning", async () => {
    await writeAlertCache({
      ...liveSnapshot,
      alerts: [officialAlert, {
        ...officialAlert,
        id: "urn:future-cancel",
        messageType: "Cancel",
        sent: "2026-10-09T18:07:00Z",
        references: [officialAlert.id],
      }],
    });
    const restored = await readAlertCache(point);
    expect(restored?.source).toBe("cached");
    expect(restored?.fetchedAt).toBe("2026-10-09T18:05:00Z");
    expect(currentAlerts(restored!.alerts, Date.parse("2026-10-09T18:05:00Z"))).toEqual([officialAlert]);
  });

  test("never returns warnings cached for a different selected point", async () => {
    await writeAlertCache(liveSnapshot);
    expect(
      await readAlertCache({ ...point, latitude: point.latitude + 0.00001 }),
    ).toBeNull();
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        snapshot: { ...liveSnapshot, locationKey: "31,-99" },
      }),
    );
    expect(await readAlertCache(point)).toBeNull();
  });

  test("a valid empty successful snapshot is distinct from a missing snapshot", async () => {
    expect(await readAlertCache(point)).toBeNull();
    await writeAlertCache({ ...liveSnapshot, alerts: [] });
    expect(await readAlertCache(point)).toEqual({
      ...liveSnapshot,
      source: "cached",
      alerts: [],
    });
  });

  test("simulation cannot enter the official cache", async () => {
    await expect(writeAlertCache(getDemoSnapshot("flood"))).rejects.toThrow(
      TypeError,
    );
    expect(await AsyncStorage.getItem(storageKey)).toBeNull();
  });

  test.each([
    "not json",
    JSON.stringify({ version: 999, snapshot: liveSnapshot }),
    JSON.stringify({
      version: 1,
      snapshot: { ...liveSnapshot, source: "demo" },
    }),
    JSON.stringify({
      version: 1,
      snapshot: { ...liveSnapshot, fetchedAt: "yesterday" },
    }),
    JSON.stringify({
      version: 1,
      snapshot: {
        ...liveSnapshot,
        alerts: [{ ...officialAlert, severity: "Dangerous" }],
      },
    }),
  ])("rejects corrupt or untrusted persisted records %#", async (raw) => {
    await AsyncStorage.setItem(storageKey, raw);
    expect(await readAlertCache(point)).toBeNull();
  });

  test("storage read failure remains unavailable rather than becoming no alerts", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await readAlertCache(point)).toBeNull();
  });

  test("cached snapshots cannot be written back as successful live refreshes", async () => {
    await expect(
      writeAlertCache({ ...liveSnapshot, source: "cached" }),
    ).rejects.toThrow(TypeError);
  });
});
