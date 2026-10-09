import AsyncStorage from "@react-native-async-storage/async-storage";
import { locationKey } from "../domain/alerts";
import type {
  AlertSnapshot,
  Coordinates,
  SelectedLocation,
} from "../domain/types";
import { isOfficialAlert, validTimestamp } from "./nws";

// Keep a single successful location snapshot rather than a movement history.
const STORAGE_KEY = "@clearpath/alerts/v1/latest";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function readAlertCache(
  location: Coordinates | SelectedLocation,
): Promise<AlertSnapshot | null> {
  const key = locationKey(location);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (
      !record(envelope) ||
      envelope.version !== 1 ||
      !record(envelope.snapshot)
    )
      return null;
    const snapshot = envelope.snapshot;
    if (
      snapshot.source !== "live" ||
      snapshot.locationKey !== key ||
      !validTimestamp(snapshot.fetchedAt) ||
      !Array.isArray(snapshot.alerts) ||
      !snapshot.alerts.every(isOfficialAlert)
    )
      return null;
    return {
      source: "cached",
      alerts: snapshot.alerts,
      fetchedAt: snapshot.fetchedAt,
      locationKey: key,
    };
  } catch {
    // A storage error cannot convert a failed network request into a no-alert state.
    return null;
  }
}

export async function writeAlertCache(snapshot: AlertSnapshot): Promise<void> {
  if (
    snapshot.source !== "live" ||
    !validTimestamp(snapshot.fetchedAt) ||
    !snapshot.alerts.every(isOfficialAlert) ||
    !validLocationKey(snapshot.locationKey)
  ) {
    throw new TypeError(
      "Only a validated live snapshot may enter the official-alert cache.",
    );
  }
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, snapshot }),
  );
}

function validLocationKey(key: string): boolean {
  const values = key.split(",");
  if (values.length !== 2 || values.some((value) => value.trim() === ""))
    return false;
  try {
    return (
      locationKey({
        latitude: Number(values[0]),
        longitude: Number(values[1]),
      }) === key
    );
  } catch {
    return false;
  }
}
