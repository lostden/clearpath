import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import type * as ExpoLocation from "expo-location";
import type * as ExpoNotifications from "expo-notifications";
import type * as ExpoSecureStore from "expo-secure-store";
import type * as ExpoTaskManager from "expo-task-manager";
import { initializeNotifications, requestNotificationPermission } from "./notifications.native";
import { CloudPushError, type CloudEnrollment, type CloudFollowOptions, type CloudPoint, type CloudPushAvailability, type CloudPushStatus, type CloudRegistrationState, type CloudRevocation } from "./cloudPush.types";
import { CLOUD_LOCATION_TASK, CLOUD_PROJECT_ID, CLOUD_STORAGE_KEY, CLOUD_UPLOAD_INTERVAL_MS, cloudConfig, currentPoint, deviceId, expoToken, httpsOrigin, readServerStatus, record, safeBearer, type CloudConfig } from "./cloudPush.validation";

export * from "./cloudPush.types";

type NativeApis = {
  location: typeof ExpoLocation;
  notifications: typeof ExpoNotifications;
  storage: typeof ExpoSecureStore;
  tasks: typeof ExpoTaskManager;
};
type DeviceAuth = { endpoint: string; deviceId: string; bearerToken: string };
type Stored =
  | ({ version: 1; state: "active"; following: boolean; locationObservedAt: string; lastUploadAt: number; lastError: string | null } & DeviceAuth)
  | ({ version: 1; state: "revoking" } & DeviceAuth)
  | { version: 1; state: "uncertain"; endpoint: string };

let lifecycle = 0;
let sequence: Promise<unknown> = Promise.resolve();
const requests = new Set<AbortController>();

// Capability loading can fail in an older APK. No startup prompts or network I/O.
function nativeApis(): NativeApis | null {
  if (Platform.OS !== "android" || !Device.isDevice || Constants.executionEnvironment === "storeClient") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional modules can be absent in older installed builds.
    return { location: require("expo-location"), notifications: require("expo-notifications"), storage: require("expo-secure-store"), tasks: require("expo-task-manager") } as NativeApis;
  } catch { return null; }
}

function serial<T>(work: () => Promise<T>): Promise<T> {
  const pending = sequence.then(work, work);
  sequence = pending.catch(() => undefined);
  return pending;
}
function cancelled(generation: number): void {
  if (generation !== lifecycle) throw new CloudPushError("cancelled", "Cloud alerts were stopped.");
}
function configured(): { api: NativeApis; config: CloudConfig } {
  const api = nativeApis();
  const config = cloudConfig(Constants.expoConfig);
  if (!api || !config) throw new CloudPushError("unconfigured", "Cloud alerts are unavailable in this build.");
  return { api, config };
}
function secureOptions(api: NativeApis): ExpoSecureStore.SecureStoreOptions {
  return { keychainAccessible: api.storage.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, requireAuthentication: false };
}
async function load(api: NativeApis): Promise<Stored | null> {
  let raw: string | null;
  try { raw = await api.storage.getItemAsync(CLOUD_STORAGE_KEY, secureOptions(api)); }
  catch { throw new CloudPushError("storage-unavailable", "Cloud credentials could not be read."); }
  if (raw === null) return null;
  try {
    if (raw.length > 2048) throw new Error();
    const item: unknown = JSON.parse(raw);
    if (!record(item) || item.version !== 1 || httpsOrigin(item.endpoint) !== item.endpoint) throw new Error();
    if (item.state === "uncertain" && Object.keys(item).length === 3) return item as Stored;
    if (!deviceId(item.deviceId) || !safeBearer(item.bearerToken)) throw new Error();
    if (item.state === "revoking" && Object.keys(item).length === 5) return item as Stored;
    if (item.state !== "active" || Object.keys(item).length !== 9 || typeof item.following !== "boolean" ||
      typeof item.locationObservedAt !== "string" || !Number.isFinite(Date.parse(item.locationObservedAt)) ||
      typeof item.lastUploadAt !== "number" || !Number.isSafeInteger(item.lastUploadAt) || item.lastUploadAt < 0 ||
      (item.lastError !== null && (typeof item.lastError !== "string" || !/^[a-z][a-z-]{0,63}$/.test(item.lastError)))) throw new Error();
    return item as Stored;
  } catch { throw new CloudPushError("storage-invalid", "Cloud credentials need operator review. Do not re-enroll."); }
}
async function save(api: NativeApis, item: Stored | null): Promise<void> {
  try {
    if (item) await api.storage.setItemAsync(CLOUD_STORAGE_KEY, JSON.stringify(item), secureOptions(api));
    else await api.storage.deleteItemAsync(CLOUD_STORAGE_KEY, secureOptions(api));
  } catch { throw new CloudPushError("storage-unavailable", "Cloud credentials could not be saved.", true); }
}
function auth(item: Stored | null, config: CloudConfig): Extract<Stored, { state: "active" }> {
  if (!item || item.state !== "active") throw new CloudPushError("not-enrolled", "Enroll this phone before starting cloud alerts.", !!item);
  if (item.endpoint !== config.endpoint) throw new CloudPushError("endpoint-changed", "Review the existing enrollment before changing servers.", true);
  return item;
}

// Neither raw response/errors nor authorization headers enter app-facing errors.
async function request(endpoint: string, path: string, method: string, bearer: string, body?: unknown, expectedStatus = 200): Promise<unknown> {
  const controller = new AbortController();
  requests.add(controller);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${endpoint}${path}`, {
          method, headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Accept: "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal, redirect: "error",
        });
        if (response.redirected || (response.url && !response.url.startsWith(`${endpoint}/`))) {
          throw new CloudPushError("invalid-response", "Cloud response origin could not be verified.");
        }
        if (response.status < 200 || response.status >= 300) {
          throw new CloudPushError(`http-${response.status}`, "Cloud request was rejected. Check setup or try later.");
        }
        if (response.status !== expectedStatus) throw new CloudPushError("invalid-response", "Cloud response status could not be verified.");
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) throw new Error();
        const text = await response.text();
        if (text.length > 8192) throw new Error();
        try { return JSON.parse(text) as unknown; }
        catch { throw new CloudPushError("invalid-response", "Cloud response could not be verified."); }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new CloudPushError("request-uncertain", "Cloud response was not received. Check status before continuing.", true)); }, 10_000);
      }),
    ]);
  } catch (error) {
    if (error instanceof CloudPushError) throw error;
    throw new CloudPushError("request-uncertain", "Cloud response was not received. Check status before continuing.", true);
  } finally {
    if (timer) clearTimeout(timer);
    requests.delete(controller);
  }
}

function gpsPoint(location: ExpoLocation.LocationObject): CloudPoint {
  if (location.mocked || !Number.isSafeInteger(location.timestamp) || location.timestamp < 0) {
    throw new CloudPushError("invalid-location", "Use a fresh device GPS reading for cloud alerts.");
  }
  return currentPoint({ point: { latitude: location.coords.latitude, longitude: location.coords.longitude }, locationObservedAt: new Date(location.timestamp).toISOString() });
}
async function freshGps(api: NativeApis): Promise<CloudPoint> {
  if ((await api.location.requestForegroundPermissionsAsync()).status !== "granted") {
    throw new CloudPushError("location-denied", "Allow location access to enroll this phone.");
  }
  if (!(await api.location.hasServicesEnabledAsync())) throw new CloudPushError("location-off", "Enable phone location services.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return gpsPoint(await Promise.race([
      api.location.getCurrentPositionAsync({ accuracy: api.location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CloudPushError("gps-timeout", "GPS timed out. Try outdoors.")), 20_000); }),
    ]));
  } finally { if (timer) clearTimeout(timer); }
}

export async function readCloudPushAvailability(): Promise<CloudPushAvailability> {
  const api = nativeApis();
  if (!api) return { status: "unsupported", backgroundFollowAvailable: false, reason: "Use a configured installed Android app." };
  const config = cloudConfig(Constants.expoConfig);
  if (!config) return { status: "unconfigured", backgroundFollowAvailable: false, reason: "Cloud alerts require reviewed server and Firebase setup." };
  try {
    if (!(await api.storage.isAvailableAsync())) throw new Error();
    const background = config.background && await api.tasks.isAvailableAsync() && await api.location.isBackgroundLocationAvailableAsync();
    return { status: "configured", backgroundFollowAvailable: background, reason: background ? "Background following is available with permission." : "Only foreground GPS uploads are available." };
  } catch { return { status: "unsupported", backgroundFollowAvailable: false, reason: "Cloud alert storage is unavailable." }; }
}

export async function readCloudPushRegistration(): Promise<CloudRegistrationState> {
  return serial(async () => {
    const api = nativeApis();
    if (!api) return { enrolled: false, following: false, serverAckPending: false, locationObservedAt: null, lastError: null };
    const item = await load(api);
    if (!item) return { enrolled: false, following: false, serverAckPending: false, locationObservedAt: null, lastError: null };
    if (item.state !== "active") return { enrolled: false, following: false, serverAckPending: true, locationObservedAt: null, lastError: item.state === "uncertain" ? "enrollment-uncertain" : "deletion-pending" };
    const following = item.following && !!cloudConfig(Constants.expoConfig)?.background && await api.location.hasStartedLocationUpdatesAsync(CLOUD_LOCATION_TASK);
    return { enrolled: true, following, serverAckPending: false, locationObservedAt: item.locationObservedAt, lastError: item.lastError };
  });
}

export async function enrollCloudPush(input: CloudEnrollment): Promise<{ baseline: "pending" }> {
  const generation = lifecycle;
  return serial(async () => {
    const { api, config } = configured();
    if (!safeBearer(input.enrollmentSecret)) throw new CloudPushError("invalid-secret", "Enter the private operator enrollment code.");
    const enrollmentSecret = input.enrollmentSecret;
    currentPoint({ point: input.point, locationObservedAt: input.locationObservedAt });
    cancelled(generation);
    if (await load(api)) throw new CloudPushError("existing-enrollment", "Review or remove the existing enrollment before trying again.", true);
    cancelled(generation);
    if (!(await api.storage.isAvailableAsync())) throw new CloudPushError("storage-unavailable", "Secure storage is unavailable.");
    await initializeNotifications();
    cancelled(generation);
    if (!(await requestNotificationPermission()).granted) throw new CloudPushError("notifications-denied", "Allow notifications before enrolling this phone.");
    cancelled(generation);
    const point = await freshGps(api);
    cancelled(generation);
    let token: string;
    try { token = (await api.notifications.getExpoPushTokenAsync({ projectId: CLOUD_PROJECT_ID })).data; }
    catch { throw new CloudPushError("token-unavailable", "Push token unavailable. Check Firebase setup and network."); }
    if (!expoToken(token)) throw new CloudPushError("token-invalid", "Push token could not be verified.");
    cancelled(generation);
    const enrollmentPoint = currentPoint(point);
    // Persist intent before POST. A lost response must never cause silent re-enrollment.
    await save(api, { version: 1, state: "uncertain", endpoint: config.endpoint });
    if (generation !== lifecycle) { await save(api, null); cancelled(generation); }
    let value: unknown;
    try { value = await request(config.endpoint, "/v1/devices", "POST", enrollmentSecret, { expoPushToken: token, ...enrollmentPoint }, 201); }
    catch (error) {
      if (error instanceof CloudPushError && /^http-\d+$/.test(error.code)) await save(api, null);
      else throw new CloudPushError("enrollment-uncertain", "Enrollment response is unknown. Ask the operator to clean up before retrying.", true);
      throw error;
    }
    if (!record(value) || Object.keys(value).length !== 3 || !deviceId(value.deviceId) || !safeBearer(value.bearerToken) || value.baseline !== "pending") {
      throw new CloudPushError("enrollment-uncertain", "Enrollment response could not be verified. Ask the operator to review it.", true);
    }
    const credentials = { endpoint: config.endpoint, deviceId: value.deviceId, bearerToken: value.bearerToken };
    if (generation !== lifecycle) {
      await save(api, { version: 1, state: "revoking", ...credentials });
      throw new CloudPushError("cancelled", "Cloud alerts were stopped. Server deletion is pending.", true);
    }
    await save(api, { version: 1, state: "active", ...credentials, following: false, locationObservedAt: point.locationObservedAt, lastUploadAt: Date.now(), lastError: null });
    return { baseline: "pending" };
  });
}

async function upload(input: CloudPoint, generation: number, background = false): Promise<"updated" | "throttled" | "ignored"> {
  const { api, config } = configured();
  const point = currentPoint(input);
  const item = auth(await load(api), config);
  cancelled(generation);
  if (background && (!config.background || !item.following)) return "ignored";
  if (Date.parse(point.locationObservedAt) <= Date.parse(item.locationObservedAt)) return "ignored";
  if (Date.now() - item.lastUploadAt < CLOUD_UPLOAD_INTERVAL_MS) return "throttled";
  // Keep the request floor even after failure/restart; do not persist coordinates.
  const attempted = { ...item, lastUploadAt: Date.now() };
  await save(api, attempted);
  cancelled(generation);
  const value = await request(config.endpoint, `/v1/devices/${item.deviceId}/location`, "PUT", item.bearerToken, point);
  cancelled(generation);
  if (!record(value) || Object.keys(value).length !== 1 || value.updated !== true) throw new CloudPushError("invalid-response", "Location update could not be verified.");
  await save(api, { ...attempted, locationObservedAt: point.locationObservedAt, lastError: null });
  return "updated";
}
export async function updateCloudPushLocation(input: CloudPoint): Promise<"updated" | "throttled" | "ignored"> {
  const generation = lifecycle;
  return serial(() => upload(input, generation));
}
export async function readCloudPushStatus(): Promise<CloudPushStatus> {
  const generation = lifecycle;
  return serial(async () => {
    const { api, config } = configured();
    const item = auth(await load(api), config);
    cancelled(generation);
    const value = await request(config.endpoint, `/v1/devices/${item.deviceId}/status`, "GET", item.bearerToken);
    cancelled(generation);
    return readServerStatus(value);
  });
}

async function stopNative(api: NativeApis): Promise<void> {
  if (await api.location.hasStartedLocationUpdatesAsync(CLOUD_LOCATION_TASK)) await api.location.stopLocationUpdatesAsync(CLOUD_LOCATION_TASK);
}
export async function startCloudLocationFollow(options: CloudFollowOptions): Promise<void> {
  const generation = lifecycle;
  return serial(async () => {
    const { api, config } = configured();
    if (!config.background || options.backgroundPermissionExplained !== true || !(await api.tasks.isAvailableAsync()) || !(await api.location.isBackgroundLocationAvailableAsync())) {
      throw new CloudPushError("background-unavailable", "Background following is unavailable in this build.");
    }
    auth(await load(api), config);
    if (!(await requestNotificationPermission()).granted) throw new CloudPushError("notifications-denied", "Allow notifications before starting location following.");
    const point = await freshGps(api);
    cancelled(generation);
    if ((await api.location.requestBackgroundPermissionsAsync()).status !== "granted") throw new CloudPushError("background-denied", "Allow background location to follow this phone.");
    cancelled(generation);
    await upload(point, generation);
    const item = auth(await load(api), config);
    await save(api, { ...item, following: true });
    cancelled(generation);
    try {
      await api.location.startLocationUpdatesAsync(CLOUD_LOCATION_TASK, {
        accuracy: api.location.Accuracy.Balanced, timeInterval: CLOUD_UPLOAD_INTERVAL_MS, distanceInterval: 100,
        foregroundService: { notificationTitle: "CLEARPATH / LOCATION FOLLOW", notificationBody: "Sending the latest GPS point for cloud NWS alerts. Stop in ClearPath.", notificationColor: "#FF5A00", killServiceOnDestroy: true },
      });
      cancelled(generation);
    } catch {
      await stopNative(api);
      await save(api, { ...item, following: false });
      throw new CloudPushError("follow-not-started", "Location following did not start. Try again.");
    }
  });
}

export async function stopCloudLocationFollow(): Promise<void> {
  lifecycle += 1;
  for (const controller of requests) controller.abort();
  const api = nativeApis();
  if (!api) return;
  await stopNative(api);
  return serial(async () => {
    const item = await load(api);
    if (item?.state === "active") await save(api, { ...item, following: false });
  });
}
export async function revokeCloudPush(): Promise<CloudRevocation> {
  lifecycle += 1;
  for (const controller of requests) controller.abort();
  const api = nativeApis();
  if (!api) return { localStopped: true, serverAckPending: false };
  // Stop collecting before attempting deletion; retain only cleanup credentials.
  try { await stopNative(api); }
  catch { throw new CloudPushError("stop-failed", "Phone location following could not be stopped. Try again.", true); }
  return serial(async () => {
    const item = await load(api);
    if (!item) return { localStopped: true, serverAckPending: false };
    if (item.state === "uncertain") return { localStopped: true, serverAckPending: true };
    const pending: Stored = { version: 1, state: "revoking", endpoint: item.endpoint, deviceId: item.deviceId, bearerToken: item.bearerToken };
    await save(api, pending);
    if (cloudConfig(Constants.expoConfig)?.endpoint !== item.endpoint) return { localStopped: true, serverAckPending: true };
    try {
      const value = await request(item.endpoint, `/v1/devices/${item.deviceId}`, "DELETE", item.bearerToken);
      if (!record(value) || Object.keys(value).length !== 1 || value.deleted !== true) return { localStopped: true, serverAckPending: true };
      await save(api, null);
      return { localStopped: true, serverAckPending: false };
    } catch { return { localStopped: true, serverAckPending: true }; }
  });
}

const taskApi = nativeApis();
if (taskApi && !taskApi.tasks.isTaskDefined(CLOUD_LOCATION_TASK)) {
  taskApi.tasks.defineTask<{ locations?: ExpoLocation.LocationObject[] }>(CLOUD_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data || !Array.isArray(data.locations) || data.locations.length > 100 || !cloudConfig(Constants.expoConfig)?.background) return;
    const generation = lifecycle;
    try {
      if ((await taskApi.location.getForegroundPermissionsAsync()).status !== "granted" || (await taskApi.location.getBackgroundPermissionsAsync()).status !== "granted") return;
      const latest = data.locations.reduce<ExpoLocation.LocationObject | null>((newest, item) => !newest || item.timestamp > newest.timestamp ? item : newest, null);
      if (!latest) return;
      const point = gpsPoint(latest);
      await serial(() => upload(point, generation, true));
    } catch {
      // Background errors contain no raw location/auth data and cause no retry loop.
    }
  });
}
