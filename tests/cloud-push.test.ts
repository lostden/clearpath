import type * as ExpoLocation from "expo-location";
import { CLOUD_LOCATION_TASK, CLOUD_PROJECT_ID, CLOUD_STORAGE_KEY, cloudConfig, currentPoint, httpsOrigin, readServerStatus } from "../src/services/cloudPush.validation";

const NOW = Date.parse("2026-10-11T09:00:00Z");
const ID = "11111111-2222-4333-8444-555555555555";
const BEARER = "device-bearer-for-unit-tests-only-000000000";
const SECRET = "operator-secret-for-unit-tests-only-000000";
const TOKEN = "ExpoPushToken[unit-test-token-only]";
const POINT = { latitude: 30.0474, longitude: -99.1403 };
const ISO = new Date(NOW).toISOString();
const configured = (background = true) => ({
  android: { googleServicesFile: "private-firebase-file.json" },
  extra: { cloudPushEnabled: true, cloudPushEndpoint: "https://alerts.example.org", cloudPushFcmConfigured: true, cloudPushBackgroundLocationEnabled: background, eas: { projectId: CLOUD_PROJECT_ID } },
});
const input = () => ({ point: POINT, locationObservedAt: new Date(Date.now()).toISOString() });
const status = () => ({ enabled: true, baseline: "ready", locationFresh: true, locationObservedAt: ISO, lastCheckAt: ISO, lastError: null, lastDelivery: "provider-accepted", pendingReceipts: 0 });
const gps = (time = Date.now(), point = POINT): ExpoLocation.LocationObject => ({
  timestamp: time, mocked: false, coords: { ...point, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null },
});

let service: typeof import("../src/services/cloudPush.native");
let constants: { expoConfig: ReturnType<typeof configured> | null; executionEnvironment: string };
let platform: { OS: string };
type LocationMethods = "requestForegroundPermissionsAsync" | "requestBackgroundPermissionsAsync" | "getForegroundPermissionsAsync" | "getBackgroundPermissionsAsync" | "getCurrentPositionAsync" | "hasServicesEnabledAsync" | "isBackgroundLocationAvailableAsync" | "hasStartedLocationUpdatesAsync" | "startLocationUpdatesAsync" | "stopLocationUpdatesAsync";
let location: Record<LocationMethods, jest.Mock> & { Accuracy: { Balanced: number } };
let notifications: { getExpoPushTokenAsync: jest.Mock };
let localNotifications: { initializeNotifications: jest.Mock; requestNotificationPermission: jest.Mock };
let storage: { getItemAsync: jest.Mock; setItemAsync: jest.Mock; deleteItemAsync: jest.Mock; isAvailableAsync: jest.Mock };
let tasks: { defineTask: jest.Mock; isTaskDefined: jest.Mock; isAvailableAsync: jest.Mock };
let saved: string | null;
let started: boolean;
let fetchMock: jest.SpyInstance;
let executor: (value: { data?: { locations: ExpoLocation.LocationObject[] }; error?: unknown }) => Promise<void>;

function response(value: unknown, code = 200): Response {
  return { status: code, redirected: false, url: "https://alerts.example.org/v1/devices", headers: { get: () => null }, text: async () => JSON.stringify(value) } as unknown as Response;
}
function next(value: unknown, code = 200) { fetchMock.mockResolvedValueOnce(response(value, code)); }
async function enroll() {
  next({ deviceId: ID, bearerToken: BEARER, baseline: "pending" }, 201);
  return service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET });
}
function body(call = fetchMock.mock.calls.length - 1): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body);
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers().setSystemTime(NOW);
  saved = null;
  started = false;
  constants = { expoConfig: configured(), executionEnvironment: "standalone" };
  platform = { OS: "android" };
  location = {
    Accuracy: { Balanced: 3 },
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    getCurrentPositionAsync: jest.fn().mockImplementation(async () => gps()),
    hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
    isBackgroundLocationAvailableAsync: jest.fn().mockResolvedValue(true),
    hasStartedLocationUpdatesAsync: jest.fn().mockImplementation(async () => started),
    startLocationUpdatesAsync: jest.fn().mockImplementation(async () => { started = true; }),
    stopLocationUpdatesAsync: jest.fn().mockImplementation(async () => { started = false; }),
  };
  notifications = { getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: TOKEN }) };
  localNotifications = { initializeNotifications: jest.fn().mockResolvedValue(true), requestNotificationPermission: jest.fn().mockResolvedValue({ granted: true }) };
  storage = {
    getItemAsync: jest.fn().mockImplementation(async () => saved),
    setItemAsync: jest.fn().mockImplementation(async (_key: string, value: string) => { saved = value; }),
    deleteItemAsync: jest.fn().mockImplementation(async () => { saved = null; }),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
  };
  tasks = {
    defineTask: jest.fn().mockImplementation((_name: string, handler: typeof executor) => { executor = handler; }),
    isTaskDefined: jest.fn().mockReturnValue(false), isAvailableAsync: jest.fn().mockResolvedValue(true),
  };
  jest.doMock("react-native", () => ({ Platform: platform }));
  jest.doMock("expo-constants", () => ({ __esModule: true, default: constants }));
  jest.doMock("expo-device", () => ({ isDevice: true }));
  jest.doMock("expo-location", () => location);
  jest.doMock("expo-notifications", () => notifications);
  jest.doMock("expo-secure-store", () => ({ ...storage, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6 }));
  jest.doMock("expo-task-manager", () => tasks);
  jest.doMock("../src/services/notifications.native", () => localNotifications);
  fetchMock = jest.spyOn(global, "fetch").mockRejectedValue(new Error("Unexpected real network attempt"));
  service = jest.requireActual("../src/services/cloudPush.native");
});
afterEach(() => { jest.useRealTimers(); });

test.each(["http://alerts.example.org", "https://alerts.example.org/path", "https://user:pass@alerts.example.org", "https://localhost", "https://127.0.0.1", "https://alerts.example.org?token=secret", " https://alerts.example.org"])("rejects unsafe cloud origin %s", (url) => {
  expect(httpsOrigin(url)).toBeNull();
});
test("accepts only a reviewed HTTPS origin, exact EAS project and explicit Android FCM configuration", () => {
  expect(cloudConfig(configured())).toEqual({ endpoint: "https://alerts.example.org", background: true });
  for (const change of [{ cloudPushEnabled: false }, { cloudPushFcmConfigured: false }, { eas: { projectId: "another-project" } }]) {
    const value = configured(); Object.assign(value.extra, change); expect(cloudConfig(value)).toBeNull();
  }
  expect(cloudConfig({ ...configured(), android: {} })).toBeNull();
});
test("unconfigured builds are inert even when enrollment is called", async () => {
  constants.expoConfig = null;
  await expect(service.readCloudPushAvailability()).resolves.toMatchObject({ status: "unconfigured", backgroundFollowAvailable: false });
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "unconfigured" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localNotifications.requestNotificationPermission).not.toHaveBeenCalled();
  expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});
test("web and Expo Go are unsupported without prompts or secure storage reads", async () => {
  platform.OS = "web";
  await expect(service.readCloudPushAvailability()).resolves.toMatchObject({ status: "unsupported" });
  platform.OS = "android"; constants.executionEnvironment = "storeClient";
  await expect(service.readCloudPushRegistration()).resolves.toMatchObject({ enrolled: false });
  expect(storage.getItemAsync).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
test("availability reads never request permission or contact the server", async () => {
  expect(await service.readCloudPushAvailability()).toMatchObject({ status: "configured", backgroundFollowAvailable: true });
  expect(localNotifications.requestNotificationPermission).not.toHaveBeenCalled();
  expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
test("explicit enrollment prepares notification permission before token and uses the actual fresh GPS fix", async () => {
  next({ deviceId: ID, bearerToken: BEARER, baseline: "pending" }, 201);
  await expect(service.enrollCloudPush({ point: { latitude: 0, longitude: 0 }, locationObservedAt: ISO, enrollmentSecret: SECRET })).resolves.toEqual({ baseline: "pending" });
  expect(localNotifications.initializeNotifications.mock.invocationCallOrder[0]).toBeLessThan(notifications.getExpoPushTokenAsync.mock.invocationCallOrder[0]);
  expect(localNotifications.requestNotificationPermission.mock.invocationCallOrder[0]).toBeLessThan(notifications.getExpoPushTokenAsync.mock.invocationCallOrder[0]);
  expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: CLOUD_PROJECT_ID });
  expect(fetchMock).toHaveBeenCalledWith("https://alerts.example.org/v1/devices", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: `Bearer ${SECRET}` }), redirect: "error" }));
  expect(body()).toEqual({ expoPushToken: TOKEN, point: POINT, locationObservedAt: ISO });
  expect(saved).not.toContain("latitude"); expect(saved).not.toContain(TOKEN); expect(saved).not.toContain(SECRET);
  expect(storage.setItemAsync).toHaveBeenCalledWith(CLOUD_STORAGE_KEY, expect.any(String), expect.objectContaining({ requireAuthentication: false }));
  const publicState = JSON.stringify(await service.readCloudPushRegistration());
  expect(publicState).not.toContain(BEARER); expect(publicState).not.toContain(ID);
  expect(location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
});
test("denied notification permission prevents tokens, GPS and enrollment", async () => {
  localNotifications.requestNotificationPermission.mockResolvedValue({ granted: false });
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "notifications-denied" });
  expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(location.getCurrentPositionAsync).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
test.each(["bad secret", "short", "base64+with/slashes="])("rejects invalid private enrollment code before prompts %s", async (secret) => {
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: secret })).rejects.toMatchObject({ code: "invalid-secret" });
  expect(localNotifications.requestNotificationPermission).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
test.each([gps(NOW - 6 * 60_000), { ...gps(), mocked: true }])("stale or mocked native GPS never reaches the cloud", async (fix) => {
  location.getCurrentPositionAsync.mockResolvedValue(fix);
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toBeInstanceOf(Error);
  expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
test("lost POST response leaves durable uncertainty and blocks automatic or explicit duplicate enrollment", async () => {
  fetchMock.mockRejectedValueOnce(new Error("private raw network error"));
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "enrollment-uncertain", serverAckPending: true });
  expect(JSON.parse(saved!)).toEqual({ version: 1, state: "uncertain", endpoint: "https://alerts.example.org" });
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "existing-enrollment" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await service.readCloudPushRegistration()).toMatchObject({ enrolled: false, serverAckPending: true, lastError: "enrollment-uncertain" });
  expect(await service.revokeCloudPush()).toEqual({ localStopped: true, serverAckPending: true });
});
test("known rejected enrollment can be retried; malformed success remains uncertain", async () => {
  next({ error: "not-authorized" }, 401);
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "http-401" });
  expect(saved).toBeNull();
  next({ deviceId: ID, bearerToken: BEARER, baseline: "pending", injected: true }, 201);
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "enrollment-uncertain" });
  expect(JSON.parse(saved!).state).toBe("uncertain");
});
test("failed secure storage prevents POST; invalid stored data is preserved for review", async () => {
  storage.setItemAsync.mockRejectedValueOnce(new Error("private storage info"));
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "storage-unavailable" });
  expect(fetchMock).not.toHaveBeenCalled();
  saved = "corrupt";
  await expect(service.readCloudPushRegistration()).rejects.toMatchObject({ code: "storage-invalid" });
  expect(saved).toBe("corrupt");
});
test("updates enforce observation order, freshness and durable one-minute request floor", async () => {
  await enroll();
  expect(await service.updateCloudPushLocation(input())).toBe("ignored");
  jest.setSystemTime(NOW + 30_000);
  expect(await service.updateCloudPushLocation(input())).toBe("throttled");
  jest.setSystemTime(NOW + 60_000); next({ updated: true });
  expect(await service.updateCloudPushLocation(input())).toBe("updated");
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PUT", headers: expect.objectContaining({ Authorization: `Bearer ${BEARER}` }) });
  expect(body()).toEqual(input());
  await expect(service.updateCloudPushLocation({ point: POINT, locationObservedAt: ISO })).resolves.toBe("ignored");
  await expect(service.updateCloudPushLocation({ point: POINT, locationObservedAt: new Date(NOW - 6 * 60_000).toISOString() })).rejects.toMatchObject({ code: "stale-location" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(saved).not.toContain("latitude");
});
test("failed PUT consumes the request floor and never publishes a false observed timestamp", async () => {
  await enroll(); jest.setSystemTime(NOW + 60_000);
  fetchMock.mockRejectedValueOnce(new Error("private network info"));
  await expect(service.updateCloudPushLocation(input())).rejects.toMatchObject({ code: "request-uncertain" });
  jest.setSystemTime(NOW + 60_001);
  expect(await service.updateCloudPushLocation(input())).toBe("throttled");
  expect((await service.readCloudPushRegistration()).locationObservedAt).toBe(ISO);
});
test("status is strict, authenticated, contains no coordinates and keeps provider acceptance separate from display", async () => {
  await enroll(); next(status());
  expect(await service.readCloudPushStatus()).toEqual(status());
  expect(fetchMock.mock.calls[1][0]).toBe(`https://alerts.example.org/v1/devices/${ID}/status`);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "GET", headers: expect.objectContaining({ Authorization: `Bearer ${BEARER}` }) });
  expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  next({ ...status(), point: POINT });
  await expect(service.readCloudPushStatus()).rejects.toMatchObject({ code: "invalid-response" });
  expect(() => readServerStatus({ ...status(), pendingReceipts: 101 })).toThrow();
});
test("changed server cannot silently reuse credentials", async () => {
  await enroll(); constants.expoConfig!.extra.cloudPushEndpoint = "https://other.example.org";
  await expect(service.readCloudPushStatus()).rejects.toMatchObject({ code: "endpoint-changed" });
  expect(await service.revokeCloudPush()).toEqual({ localStopped: true, serverAckPending: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("explicit background consent and all permissions are required before starting the foreground service", async () => {
  await enroll();
  await expect(service.startCloudLocationFollow({ backgroundPermissionExplained: false } as never)).rejects.toMatchObject({ code: "background-unavailable" });
  expect(location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  expect(location.startLocationUpdatesAsync).toHaveBeenCalledWith(CLOUD_LOCATION_TASK, expect.objectContaining({ timeInterval: 60_000, distanceInterval: 100, foregroundService: expect.objectContaining({ killServiceOnDestroy: true }) }));
  expect(await service.readCloudPushRegistration()).toMatchObject({ following: true });
  expect(tasks.defineTask).toHaveBeenCalledWith(CLOUD_LOCATION_TASK, expect.any(Function));
});
test("background-disabled build cannot request background location", async () => {
  constants.expoConfig = configured(false); await enroll();
  await expect(service.startCloudLocationFollow({ backgroundPermissionExplained: true })).rejects.toMatchObject({ code: "background-unavailable" });
  expect(location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
});
test("denied background permission does not start the service", async () => {
  await enroll(); location.requestBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
  await expect(service.startCloudLocationFollow({ backgroundPermissionExplained: true })).rejects.toMatchObject({ code: "background-denied" });
  expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});
test("background task submits only the newest fresh GPS fix while opted in, then stops on opt-out", async () => {
  await enroll(); await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  jest.setSystemTime(NOW + 120_000); next({ updated: true });
  const latest = { latitude: 30.1, longitude: -99.1 };
  await executor({ data: { locations: [gps(NOW + 120_000, latest), gps(NOW + 60_000)] } });
  expect(body()).toEqual({ point: latest, locationObservedAt: new Date(NOW + 120_000).toISOString() });
  next({ deleted: true });
  expect(await service.revokeCloudPush()).toEqual({ localStopped: true, serverAckPending: false });
  expect(location.stopLocationUpdatesAsync.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[2]);
  const requestsBefore = fetchMock.mock.calls.length;
  jest.setSystemTime(NOW + 240_000); await executor({ data: { locations: [gps()] } });
  expect(fetchMock).toHaveBeenCalledTimes(requestsBefore); expect(saved).toBeNull();
});
test("task rejects stale, mocked and permission-revoked GPS without network I/O", async () => {
  await enroll(); await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  jest.setSystemTime(NOW + 120_000);
  await executor({ data: { locations: [gps(NOW - 6 * 60_000)] } });
  await executor({ data: { locations: [{ ...gps(), mocked: true }] } });
  location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
  await executor({ data: { locations: [gps()] } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("pending deletion retains only cleanup credentials and can be explicitly retried", async () => {
  await enroll(); await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  fetchMock.mockRejectedValueOnce(new Error("private network error"));
  expect(await service.revokeCloudPush()).toEqual({ localStopped: true, serverAckPending: true });
  expect(JSON.parse(saved!)).toEqual({ version: 1, state: "revoking", endpoint: "https://alerts.example.org", deviceId: ID, bearerToken: BEARER });
  expect(await service.readCloudPushRegistration()).toMatchObject({ enrolled: false, following: false, locationObservedAt: null, serverAckPending: true });
  await expect(service.updateCloudPushLocation(input())).rejects.toMatchObject({ code: "not-enrolled" });
  next({ deleted: true }); expect(await service.revokeCloudPush()).toEqual({ localStopped: true, serverAckPending: false });
  expect(saved).toBeNull();
});
test("stop during a GPS prompt cancels enrollment before POST", async () => {
  let finish!: (value: ExpoLocation.LocationObject) => void;
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET });
  await jest.advanceTimersByTimeAsync(0);
  const stopped = service.stopCloudLocationFollow(); finish(gps());
  await expect(pending).rejects.toMatchObject({ code: "cancelled" }); await stopped;
  expect(fetchMock).not.toHaveBeenCalled();
});
test("opt-out during enrollment keeps returned credentials only long enough to delete on the server", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const enrolling = service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET });
  await jest.advanceTimersByTimeAsync(0);
  const revoking = service.revokeCloudPush();
  next({ deleted: true }); finish(response({ deviceId: ID, bearerToken: BEARER, baseline: "pending" }, 201));
  await expect(enrolling).rejects.toMatchObject({ code: "cancelled", serverAckPending: true });
  await expect(revoking).resolves.toEqual({ localStopped: true, serverAckPending: false });
  expect(saved).toBeNull();
});
test("bounded request timeout remains uncertain without retrying", async () => {
  fetchMock.mockImplementationOnce(() => new Promise(() => {}));
  const pending = service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET });
  const outcome = expect(pending).rejects.toMatchObject({ code: "enrollment-uncertain" });
  await jest.advanceTimersByTimeAsync(10_000); await outcome;
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(JSON.parse(saved!).state).toBe("uncertain");
});
test.each([
  { status: 201, redirected: true, url: "https://other.example.org/device", headers: { get: () => null }, text: async (): Promise<string> => JSON.stringify({ deviceId: ID, bearerToken: BEARER, baseline: "pending" }) },
  { status: 201, redirected: false, url: "https://alerts.example.org/v1/devices", headers: { get: () => "9000" }, text: async (): Promise<string> => "{}" },
  { status: 201, redirected: false, url: "https://alerts.example.org/v1/devices", headers: { get: () => null }, text: async (): Promise<string> => "x".repeat(9000) },
  { status: 201, redirected: false, url: "https://alerts.example.org/v1/devices", headers: { get: () => null }, text: async (): Promise<string> => "invalid JSON" },
  response({ deviceId: ID, bearerToken: BEARER, baseline: "pending" }, 200),
])("redirected, oversized, invalid JSON or wrong-status successful enrollment is not trusted", async (value) => {
  fetchMock.mockResolvedValueOnce(value);
  await expect(service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET })).rejects.toMatchObject({ code: "enrollment-uncertain", serverAckPending: true });
  expect(JSON.parse(saved!).state).toBe("uncertain");
});
test("GPS timeout never obtains a token or sends enrollment", async () => {
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
  const pending = service.enrollCloudPush({ ...input(), enrollmentSecret: SECRET });
  const outcome = expect(pending).rejects.toMatchObject({ code: "gps-timeout" });
  await jest.advanceTimersByTimeAsync(20_000); await outcome;
  expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
test("follow start failure rolls back persisted following and stops a partly started service", async () => {
  await enroll();
  location.startLocationUpdatesAsync.mockImplementationOnce(async () => { started = true; throw new Error("private native info"); });
  await expect(service.startCloudLocationFollow({ backgroundPermissionExplained: true })).rejects.toMatchObject({ code: "follow-not-started" });
  expect(location.stopLocationUpdatesAsync).toHaveBeenCalledWith(CLOUD_LOCATION_TASK);
  expect((await service.readCloudPushRegistration()).following).toBe(false);
});
test("opt-out aborts a pending location upload and does not restore its enrollment", async () => {
  await enroll(); await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  jest.setSystemTime(NOW + 60_000);
  fetchMock.mockImplementationOnce((_url, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const pending = service.updateCloudPushLocation(input());
  const outcome = expect(pending).rejects.toBeInstanceOf(Error);
  await jest.advanceTimersByTimeAsync(0); next({ deleted: true });
  await expect(service.revokeCloudPush()).resolves.toEqual({ localStopped: true, serverAckPending: false });
  await outcome; expect(saved).toBeNull();
});
test("failure to stop the native service is never reported as a completed opt-out", async () => {
  await enroll(); await service.startCloudLocationFollow({ backgroundPermissionExplained: true });
  location.stopLocationUpdatesAsync.mockRejectedValueOnce(new Error("private native info"));
  await expect(service.revokeCloudPush()).rejects.toMatchObject({ code: "stop-failed", serverAckPending: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("strict point validation rejects extra fields and future or invalid coordinates", () => {
  expect(() => currentPoint({ ...input(), demo: true })).toThrow();
  expect(() => currentPoint({ point: { latitude: 91, longitude: 0 }, locationObservedAt: ISO })).toThrow();
  expect(() => currentPoint({ point: POINT, locationObservedAt: new Date(NOW + 61_000).toISOString() })).toThrow();
});
