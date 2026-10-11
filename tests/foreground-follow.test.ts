import * as Location from "expo-location";
import { followReading, GPS_FOLLOW_LABEL, startForegroundFollow } from "../src/services/foregroundFollow";
import { TEST_NOW } from "./fixtures/alerts";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function reading(overrides: Partial<Location.LocationObject> = {}): Location.LocationObject {
  return {
    timestamp: Date.now(),
    coords: { latitude: 30, longitude: -99, altitude: null, accuracy: 12.2, altitudeAccuracy: null, heading: null, speed: null },
    ...overrides,
  };
}

const permission = { status: "granted", granted: true, canAskAgain: true, expires: "never" } as Location.LocationPermissionResponse;
const ask = jest.mocked(Location.requestForegroundPermissionsAsync);
const services = jest.mocked(Location.hasServicesEnabledAsync);
const firstPosition = jest.mocked(Location.getCurrentPositionAsync);
const subscribe = jest.mocked(Location.watchPositionAsync);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(TEST_NOW);
  ask.mockReset().mockResolvedValue(permission);
  services.mockReset().mockResolvedValue(true);
  firstPosition.mockReset().mockResolvedValue(reading());
  subscribe.mockReset().mockResolvedValue({ remove: jest.fn() });
});
afterEach(() => { jest.useRealTimers(); });

test("returns a fresh precise GPS selection with a dry accuracy label", () => {
  expect(followReading(reading(), TEST_NOW)).toEqual({ coordinates: { latitude: 30, longitude: -99 }, kind: "gps", label: `${GPS_FOLLOW_LABEL} · ±13 m` });
  expect(followReading(reading({ coords: { ...reading().coords, accuracy: null } })).label).toBe(GPS_FOLLOW_LABEL);
});

test.each([
  { timestamp: TEST_NOW - 60_001 },
  { timestamp: TEST_NOW + 5_001 },
  { timestamp: NaN },
  { timestamp: Infinity },
  { coords: { ...reading().coords, latitude: 91 } },
  { coords: { ...reading().coords, longitude: -181 } },
])("rejects stale, invalid or implausibly future GPS readings: %j", (overrides) => {
  expect(() => followReading(reading(overrides), TEST_NOW)).toThrow(/unavailable or stale/);
});

test("accepts the explicit GPS age/skew boundaries and omits invalid accuracy", () => {
  expect(() => followReading(reading({ timestamp: TEST_NOW - 60_000 }), TEST_NOW)).not.toThrow();
  expect(() => followReading(reading({ timestamp: TEST_NOW + 5_000 }), TEST_NOW)).not.toThrow();
  expect(followReading(reading({ coords: { ...reading().coords, accuracy: -1 } })).label).toBe(GPS_FOLLOW_LABEL);
});

test("requests foreground permission only and performs balanced initial/subsequent readings", async () => {
  const accepted = jest.fn();
  const stop = await startForegroundFollow(accepted, jest.fn(), () => true);
  expect(ask).toHaveBeenCalledTimes(1);
  expect(firstPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  expect(accepted).toHaveBeenCalledTimes(1);
  expect(subscribe).toHaveBeenCalledWith(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 0 },
    expect.any(Function), expect.any(Function),
  );
  const subscription = await subscribe.mock.results[0].value;
  stop();
  expect(subscription.remove).toHaveBeenCalledTimes(1);
});

test("denied foreground permission and disabled services never request a position or subscribe", async () => {
  ask.mockResolvedValueOnce({ ...permission, granted: false, status: "denied" } as Location.LocationPermissionResponse);
  await expect(startForegroundFollow(jest.fn(), jest.fn(), () => true)).rejects.toThrow(/GPS permission denied/);
  expect(services).not.toHaveBeenCalled();
  services.mockResolvedValueOnce(false);
  await expect(startForegroundFollow(jest.fn(), jest.fn(), () => true)).rejects.toThrow(/GPS is off/);
  expect(firstPosition).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});

test("an obsolete permission completion cannot access GPS services", async () => {
  const pending = deferred<Location.LocationPermissionResponse>();
  ask.mockReturnValueOnce(pending.promise);
  let current = true;
  const task = startForegroundFollow(jest.fn(), jest.fn(), () => current);
  current = false;
  pending.resolve(permission);
  await task;
  expect(services).not.toHaveBeenCalled();
  expect(firstPosition).not.toHaveBeenCalled();
});

test("an obsolete services check cannot start a location request", async () => {
  const pending = deferred<boolean>();
  services.mockReturnValueOnce(pending.promise);
  let current = true;
  const task = startForegroundFollow(jest.fn(), jest.fn(), () => current);
  await Promise.resolve();
  current = false;
  pending.resolve(true);
  await task;
  expect(firstPosition).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});

test("a current-position completion after cancellation neither changes the point nor subscribes", async () => {
  const pending = deferred<Location.LocationObject>();
  firstPosition.mockReturnValueOnce(pending.promise);
  const accepted = jest.fn();
  let current = true;
  const task = startForegroundFollow(accepted, jest.fn(), () => current);
  await Promise.resolve(); await Promise.resolve();
  current = false;
  pending.resolve(reading());
  await task;
  expect(accepted).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("the initial GPS request times out without installing a watcher or accepting its late result", async () => {
  const pending = deferred<Location.LocationObject>();
  firstPosition.mockReturnValueOnce(pending.promise);
  const accepted = jest.fn();
  const task = startForegroundFollow(accepted, jest.fn(), () => true);
  const assertion = expect(task).rejects.toThrow(/GPS took too long/);
  await jest.advanceTimersByTimeAsync(20_000);
  await assertion;
  pending.resolve(reading());
  await Promise.resolve();
  expect(accepted).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("a subscription resolving after cancellation is removed immediately", async () => {
  const pending = deferred<Location.LocationSubscription>();
  subscribe.mockReturnValueOnce(pending.promise);
  const accepted = jest.fn();
  let current = true;
  const task = startForegroundFollow(accepted, jest.fn(), () => current);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(subscribe).toHaveBeenCalledTimes(1);
  current = false;
  const remove = jest.fn();
  pending.resolve({ remove });
  await task;
  expect(remove).toHaveBeenCalledTimes(1);
});

test("movement is throttled to one accepted point per minute and stale callbacks are suppressed", async () => {
  const accepted = jest.fn();
  let current = true;
  await startForegroundFollow(accepted, jest.fn(), () => current);
  const update = subscribe.mock.calls[0][1];
  update(reading({ coords: { ...reading().coords, latitude: 31 } }));
  expect(accepted).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(59_999);
  update(reading());
  expect(accepted).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  update(reading({ coords: { ...reading().coords, latitude: 31 } }));
  expect(accepted).toHaveBeenCalledTimes(2);
  expect(accepted.mock.calls[1][0].coordinates.latitude).toBe(31);
  current = false;
  await jest.advanceTimersByTimeAsync(60_000);
  update(reading());
  expect(accepted).toHaveBeenCalledTimes(2);
});

test("stale watcher data reports one pause without accepting an invalid point", async () => {
  const accepted = jest.fn();
  const error = jest.fn();
  let current = true;
  await startForegroundFollow(accepted, error, () => current);
  await jest.advanceTimersByTimeAsync(60_000);
  subscribe.mock.calls[0][1](reading({ timestamp: Date.now() - 60_001 }));
  expect(accepted).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/stale/));
  subscribe.mock.calls[0][2]?.("native location error");
  expect(error).toHaveBeenCalledTimes(1);
  current = false;
  error.mockClear();
  subscribe.mock.calls[0][2]?.("obsolete native error");
  expect(error).not.toHaveBeenCalled();
});

test("SDK watcher errors stop following and are ignored after the follower is obsolete", async () => {
  const error = jest.fn();
  let current = true;
  await startForegroundFollow(jest.fn(), error, () => current);
  subscribe.mock.calls[0][2]?.("native location error");
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/following stopped/));
  expect(jest.getTimerCount()).toBe(0);
  current = false;
  error.mockClear();
  subscribe.mock.calls[0][2]?.("obsolete native error");
  expect(error).not.toHaveBeenCalled();
});

test("a silent native watcher pauses after 120 seconds without a fresh accepted GPS point", async () => {
  const accepted = jest.fn();
  const error = jest.fn();
  const stop = await startForegroundFollow(accepted, error, () => true);
  await jest.advanceTimersByTimeAsync(119_999);
  expect(error).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/GPS/i));
  expect(accepted).toHaveBeenCalledTimes(1);
  stop();
});

test("a fresh accepted watcher point resets the 120-second silence deadline", async () => {
  const accepted = jest.fn();
  const error = jest.fn();
  const stop = await startForegroundFollow(accepted, error, () => true);
  await jest.advanceTimersByTimeAsync(60_000);
  subscribe.mock.calls[0][1](reading());
  expect(accepted).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(119_999);
  expect(error).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(error).toHaveBeenCalledTimes(1);
  stop();
});

test("stopping a GPS follower clears its silence timer", async () => {
  const error = jest.fn();
  let current = true;
  const stop = await startForegroundFollow(jest.fn(), error, () => current);
  expect(jest.getTimerCount()).toBe(1);
  current = false;
  stop();
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(120_000);
  expect(error).not.toHaveBeenCalled();
});

test("throttled callbacks do not extend the watchdog without an accepted fresh reading", async () => {
  const accepted = jest.fn();
  const error = jest.fn();
  const stop = await startForegroundFollow(accepted, error, () => true);
  await jest.advanceTimersByTimeAsync(59_000);
  subscribe.mock.calls[0][1](reading());
  expect(accepted).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(61_000);
  expect(error).toHaveBeenCalledTimes(1);
  expect(accepted).toHaveBeenCalledTimes(1);
  stop();
});

test("the watchdog uses the actual fix timestamp rather than extending a cached initial point's age", async () => {
  firstPosition.mockResolvedValueOnce(reading({ timestamp: TEST_NOW - 60_000 }));
  const error = jest.fn();
  const stop = await startForegroundFollow(jest.fn(), error, () => true);
  await jest.advanceTimersByTimeAsync(59_999);
  expect(error).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(error).toHaveBeenCalledTimes(1);
  stop();
});
