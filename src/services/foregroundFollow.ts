import * as Location from "expo-location";
import { validCoordinates } from "@/domain/alerts";
import type { SelectedLocation } from "@/domain/types";

export const GPS_FOLLOW_LABEL = "GPS follow · latest reading";
export const GPS_FOLLOW_MAX_AGE_MS = 120_000;
export type ForegroundFollowPhase =
  | "CHECK GPS ACCESS"
  | "ALLOW GPS ACCESS"
  | "CHECK DEVICE LOCATION"
  | "ACQUIRE GPS"
  | "START GPS WATCH";

async function boundedStep<T>(work: Promise<T>, duration: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), duration); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  onPhase?: (phase: ForegroundFollowPhase) => void,
): Promise<() => void> {
  const noOp = () => {};
  if (!isCurrent()) return noOp;
  onPhase?.("CHECK GPS ACCESS");
  let permission = await boundedStep(
    Location.getForegroundPermissionsAsync(), 8_000,
    "GPS access check timed out. Stop and enable GPS alerts again.",
  );
  if (!isCurrent()) return noOp;
  // Expo's Android permission request enters the Activity permission path even
  // when access is granted. Read first so resume/retry does not request it again.
  if (!permission.granted && permission.canAskAgain) {
    onPhase?.("ALLOW GPS ACCESS");
    permission = await boundedStep(
      Location.requestForegroundPermissionsAsync(), 60_000,
      "GPS permission request timed out. Stop and enable GPS alerts again.",
    );
    if (!isCurrent()) return noOp;
  }
  if (!permission.granted) throw new Error("GPS permission denied. Select a point manually.");
  onPhase?.("CHECK DEVICE LOCATION");
  const servicesEnabled = await boundedStep(
    Location.hasServicesEnabledAsync(), 8_000,
    "Device location check timed out. Stop and enable GPS alerts again.",
  );
  if (!isCurrent()) return noOp;
  if (!servicesEnabled) throw new Error("GPS is off. Enable location services or select a point manually.");
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
    onPhase?.("ACQUIRE GPS");
    const first = await boundedStep(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 20_000,
      "GPS took too long. Retry or select a point manually.",
    );
    if (!isCurrent()) return noOp;
    accept(first);
  } catch (cause) { stop(); throw cause; }
  if (!isCurrent()) { stop(); return noOp; }
  let lastAccepted = Date.now();
  try {
    onPhase?.("START GPS WATCH");
    const starting = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 0 },
      (position) => {
        if (stopped || !isCurrent() || Date.now() - lastAccepted < 60_000) return;
        try {
          accept(position);
          lastAccepted = Date.now();
        } catch { fail("GPS reading is stale. Following is paused; retry GPS."); }
      },
      () => fail("GPS following stopped. Check location permission and retry."),
    ).then((registered) => {
      subscription = registered;
      // SDK registration may complete after the wrapper times out or the app
      // pauses. Retain its handle only to remove it, never to resume tracking.
      if (stopped || !isCurrent()) stop();
      return registered;
    });
    await boundedStep(starting, 10_000, "GPS watch setup timed out. Stop and enable GPS alerts again.");
  } catch (cause) { stop(); throw cause; }
  if (stopped || !isCurrent()) { stop(); return noOp; }
  return stop;
}
