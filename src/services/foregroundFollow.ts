import * as Location from "expo-location";
import { validCoordinates } from "@/domain/alerts";
import type { SelectedLocation } from "@/domain/types";

export const GPS_FOLLOW_LABEL = "GPS follow · latest reading";
export const GPS_FOLLOW_MAX_AGE_MS = 120_000;

export function followReading(position: Location.LocationObject, now = Date.now()): SelectedLocation {
  const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  if (!validCoordinates(coordinates) || !Number.isFinite(position.timestamp) ||
      position.timestamp > now + 5_000 || now - position.timestamp > 60_000)
    throw new Error("GPS reading is unavailable or stale. Choose a point manually.");
  const accuracy = position.coords.accuracy;
  return {
    coordinates,
    kind: "gps",
    label: `${GPS_FOLLOW_LABEL}${accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 ? ` · ±${Math.ceil(accuracy)} m` : ""}`,
  };
}

/** Foreground only. Never asks for background permission or starts a hidden service. */
export async function startForegroundFollow(
  onReading: (location: SelectedLocation, observedAt: number) => void,
  onError: (message: string) => void,
  isCurrent: () => boolean,
): Promise<() => void> {
  const noOp = () => {};
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!isCurrent()) return noOp;
  if (!permission.granted) throw new Error("GPS permission denied. Select a point manually.");
  if (!(await Location.hasServicesEnabledAsync())) throw new Error("GPS is off. Enable location services or select a point manually.");
  if (!isCurrent()) return noOp;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let freshnessTimer: ReturnType<typeof setTimeout> | undefined;
  let subscription: Location.LocationSubscription | undefined;
  let stopped = false;
  let removed = false;
  const stop = () => {
    stopped = true;
    if (freshnessTimer) clearTimeout(freshnessTimer);
    if (subscription && !removed) { removed = true; subscription.remove(); }
  };
  const fail = (message: string) => {
    const current = !stopped && isCurrent();
    stop();
    if (current) onError(message);
  };
  const accept = (position: Location.LocationObject) => {
    const selected = followReading(position);
    if (freshnessTimer) clearTimeout(freshnessTimer);
    freshnessTimer = setTimeout(() => fail("GPS updates stopped. Alerts are paused; stop and enable GPS alerts again."), Math.max(1, position.timestamp + GPS_FOLLOW_MAX_AGE_MS - Date.now()));
    onReading(selected, position.timestamp);
  };
  try {
    const first = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("GPS took too long. Retry or select a point manually.")), 20_000); }),
    ]);
    if (!isCurrent()) return noOp;
    accept(first);
  } catch (cause) { stop(); throw cause; }
  finally {
    if (timer) clearTimeout(timer);
  }
  if (!isCurrent()) { stop(); return noOp; }
  let lastAccepted = Date.now();
  try {
    subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 0 },
      (position) => {
        if (stopped || !isCurrent() || Date.now() - lastAccepted < 60_000) return;
        try {
          accept(position);
          lastAccepted = Date.now();
        } catch { fail("GPS reading is stale. Following is paused; retry GPS."); }
      },
      () => fail("GPS following stopped. Check location permission and retry."),
    );
  } catch (cause) { stop(); throw cause; }
  if (stopped || !isCurrent()) { stop(); return noOp; }
  return stop;
}
