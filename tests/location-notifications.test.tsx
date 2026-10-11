import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import { useAppState } from "../src/state/AppState";
import { useAlertsContext } from "../src/state/AlertsProvider";
import { useFeedPreferences } from "../src/state/FeedPreferences";
import { LOCATION_NOTIFICATIONS_KEY, LocationNotificationsProvider, useLocationNotifications } from "../src/state/LocationNotifications";
import { startForegroundFollow } from "../src/services/foregroundFollow";
import type { ForegroundFollowPhase } from "../src/services/foregroundFollow";
import { cancelNotification, initializeNotifications, listenNotificationResponses, readNotificationPermission, requestNotificationPermission, sendNwsNotification, sendTestNotification } from "../src/services/notifications";
import { createNotificationLedger } from "../src/domain/notificationPolicy";
import type { AlertSnapshot, OfficialAlert, SelectedLocation } from "../src/domain/types";
import type { NotificationPermission } from "../src/services/notifications";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("../src/state/AppState", () => ({ useAppState: jest.fn() }));
jest.mock("../src/state/AlertsProvider", () => ({ useAlertsContext: jest.fn() }));
jest.mock("../src/state/FeedPreferences", () => ({ useFeedPreferences: jest.fn() }));
jest.mock("../src/services/foregroundFollow", () => ({ GPS_FOLLOW_MAX_AGE_MS: 120_000, startForegroundFollow: jest.fn() }));
jest.mock("../src/services/notifications", () => ({
  cancelNotification: jest.fn(), initializeNotifications: jest.fn(),
  listenNotificationResponses: jest.fn(), readNotificationPermission: jest.fn(),
  requestNotificationPermission: jest.fn(), sendNwsNotification: jest.fn(),
  sendTestNotification: jest.fn(),
}));

const originalGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const originalSetItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const allowed: NotificationPermission = { supported: true, granted: true, canAskAgain: true, status: "granted" };
const point: SelectedLocation = { label: "GPS follow reading", kind: "gps", coordinates: { latitude: 30, longitude: -99 } };
let app: ReturnType<typeof useAppState>;
let feed: ReturnType<typeof useAlertsContext>;
let preferences: ReturnType<typeof useFeedPreferences>;
let foregroundChanged: (value: AppStateStatus) => void;
let officialTapped: (id: string) => void;
let testTapped: (() => void) | undefined;
let followers: { reading: (selected: SelectedLocation) => void; error: (message: string) => void; current: () => boolean; remove: jest.Mock }[];
let listenerRemove: jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(originalGetItem);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(originalSetItem);
  await AsyncStorage.clear();
  jest.spyOn(Date, "now").mockReturnValue(TEST_NOW);
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    foregroundChanged = listener;
    return { remove: jest.fn() };
  });
  app = {
    mode: "live", scenario: "flood", location: null, locationReady: true, locationRevision: 0,
    locationError: null, setLocationError: jest.fn(), setScenario: jest.fn(),
    setMode: jest.fn((mode) => { app = { ...app, mode }; }),
    setLocation: jest.fn((selected, origin) => { app = { ...app, location: selected, locationRevision: app.locationRevision + (origin === "follow" ? 0 : 1) }; }),
  };
  feed = {
    source: "unavailable", alerts: [], snapshot: null, selectedLocation: null,
    isLoading: false, isRefreshing: false, error: null, offline: false, expiredCount: 0,
    refresh: jest.fn().mockResolvedValue(undefined), canRefresh: false, storageError: null,
  };
  preferences = { automatic: true, ready: true, storageError: null, setAutomatic: jest.fn() };
  jest.mocked(useAppState).mockImplementation(() => app);
  jest.mocked(useAlertsContext).mockImplementation(() => feed);
  jest.mocked(useFeedPreferences).mockImplementation(() => preferences);
  followers = [];
  jest.mocked(startForegroundFollow).mockReset().mockImplementation(async (reading, error, current) => {
    const remove = jest.fn();
    followers.push({ reading: (selected) => reading(selected, Date.now()), error, current, remove });
    return remove;
  });
  jest.mocked(initializeNotifications).mockReset().mockResolvedValue(true);
  jest.mocked(readNotificationPermission).mockReset().mockResolvedValue(allowed);
  jest.mocked(requestNotificationPermission).mockReset().mockResolvedValue(allowed);
  jest.mocked(sendNwsNotification).mockReset().mockResolvedValue("accepted-official-notice");
  jest.mocked(sendTestNotification).mockReset().mockResolvedValue("accepted-test-notice");
  jest.mocked(cancelNotification).mockReset().mockResolvedValue(undefined);
  listenerRemove = jest.fn();
  jest.mocked(listenNotificationResponses).mockReset().mockImplementation((official, test) => {
    officialTapped = official; testTapped = test;
    return listenerRemove;
  });
});
afterEach(async () => { await cleanup(); });

async function mount() {
  const hook = await renderHook(() => useLocationNotifications()!, { wrapper: LocationNotificationsProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
type Hook = Awaited<ReturnType<typeof mount>>;
async function enabled() {
  const hook = await mount();
  await act(() => hook.result.current.enable());
  await waitFor(() => expect(startForegroundFollow).toHaveBeenCalledTimes(1));
  await act(() => followers[0].reading(point));
  expect(hook.result.current.status).toBe("ON / GPS FOLLOW / APP OPEN");
  return hook;
}
async function publish(hook: Hook, alerts: OfficialAlert[], source: AlertSnapshot["source"] = "live", fetchedAt = new Date(TEST_NOW).toISOString(), key = "30,-99") {
  const snapshot: AlertSnapshot = { alerts, source, fetchedAt, locationKey: key };
  feed = { ...feed, source, snapshot, alerts };
  await hook.rerender(undefined);
}
async function savedSettings() {
  const raw = await AsyncStorage.getItem(LOCATION_NOTIFICATIONS_KEY);
  return raw === null ? null : JSON.parse(raw);
}

test("initial launch reads permission without requesting consent, tracking, scheduling or saving ON", async () => {
  const hook = await mount();
  expect(hook.result.current).toMatchObject({ enabled: false, busy: false, status: "OFF" });
  expect(initializeNotifications).toHaveBeenCalledTimes(1);
  expect(readNotificationPermission).toHaveBeenCalledTimes(1);
  expect(requestNotificationPermission).not.toHaveBeenCalled();
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(sendNwsNotification).not.toHaveBeenCalled();
  expect(await savedSettings()).toBeNull();
});

test("explicit enable requests notification permission and saves consent before accessing GPS", async () => {
  const hook = await mount();
  const grant = deferred<NotificationPermission>();
  const saved = deferred<void>();
  jest.mocked(requestNotificationPermission).mockReturnValueOnce(grant.promise);
  jest.mocked(AsyncStorage.setItem).mockReturnValueOnce(saved.promise);
  let pending!: Promise<void>;
  await act(() => { pending = hook.result.current.enable(); });
  expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(() => grant.resolve(allowed));
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toMatchObject({ enabled: true, ledger: null });
  expect(startForegroundFollow).not.toHaveBeenCalled();
  await act(async () => { saved.resolve(); await pending; });
  await waitFor(() => expect(startForegroundFollow).toHaveBeenCalledTimes(1));
  expect(hook.result.current.enabled).toBe(true);
});

test("denied notification permission never saves ON or starts GPS", async () => {
  const hook = await mount();
  jest.mocked(requestNotificationPermission).mockResolvedValueOnce({ ...allowed, granted: false, status: "denied" });
  await act(() => hook.result.current.enable());
  expect(hook.result.current).toMatchObject({ enabled: false, busy: false });
  expect(hook.result.current.error).toMatch(/denied/i);
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test("failed consent persistence leaves tracking OFF", async () => {
  const hook = await mount();
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("cannot save consent"));
  await act(() => hook.result.current.enable());
  expect(hook.result.current.enabled).toBe(false);
  expect(hook.result.current.error).toMatch(/cannot save consent/);
  expect(startForegroundFollow).not.toHaveBeenCalled();
});

test("disable while notification permission is pending cancels the enable request", async () => {
  const hook = await mount();
  const grant = deferred<NotificationPermission>();
  jest.mocked(requestNotificationPermission).mockReturnValueOnce(grant.promise);
  let pending!: Promise<void>;
  await act(() => { pending = hook.result.current.enable(); });
  await act(() => hook.result.current.disable());
  await act(async () => { grant.resolve(allowed); await pending; });
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(hook.result.current.enabled).toBe(false);
  expect(await savedSettings()).toMatchObject({ enabled: false });
});

test("manual selection while permission is pending takes precedence over the earlier GPS opt-in", async () => {
  const hook = await mount();
  const grant = deferred<NotificationPermission>();
  jest.mocked(requestNotificationPermission).mockReturnValueOnce(grant.promise);
  let pending!: Promise<void>;
  await act(() => { pending = hook.result.current.enable(); });
  app = { ...app, locationRevision: 1, location: { ...point, kind: "manual" } };
  await hook.rerender(undefined);
  await act(async () => { grant.resolve(allowed); await pending; });
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(hook.result.current).toMatchObject({ enabled: false, busy: false });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test("a manual point chosen during saved-consent hydration keeps GPS following OFF and persists that choice", async () => {
  const saved = deferred<string | null>();
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(saved.promise);
  const hook = await renderHook(() => useLocationNotifications()!, { wrapper: LocationNotificationsProvider });
  expect(hook.result.current.ready).toBe(false);
  const manualPoint: SelectedLocation = { ...point, kind: "manual", coordinates: { latitude: 31, longitude: -98 } };
  app.setLocation(manualPoint, "selection");
  await hook.rerender(undefined);
  await act(() => saved.resolve(JSON.stringify({ version: 1, enabled: true, generation: "previous-gps-consent", ledger: null })));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(app.location).toEqual(manualPoint);
  expect(hook.result.current.enabled).toBe(false);
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(requestNotificationPermission).not.toHaveBeenCalled();
  await waitFor(async () => expect(await savedSettings()).toMatchObject({ enabled: false, ledger: null }));
});

test.each(["demo", "manual", "selection"] as const)("%s during an in-flight consent save restores persisted OFF and never tracks", async (change) => {
  const hook = await mount();
  const saved = deferred<void>();
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce((key, raw) => saved.promise.then(() => originalSetItem(key, raw)));
  let pending!: Promise<void>;
  await act(() => { pending = hook.result.current.enable(); });
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
  if (change === "demo") app = { ...app, mode: "demo" };
  if (change === "manual") preferences = { ...preferences, automatic: false };
  if (change === "selection") app = { ...app, locationRevision: 1 };
  await hook.rerender(undefined);
  await act(async () => { saved.resolve(); await pending; });
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(hook.result.current.enabled).toBe(false);
  expect(await savedSettings()).toMatchObject({ enabled: false });
});

test.each(["demo", "manual", "background"] as const)("%s pauses an active GPS subscription and forbids official notices", async (change) => {
  const hook = await enabled();
  await publish(hook, []);
  if (change === "demo") app = { ...app, mode: "demo" };
  if (change === "manual") preferences = { ...preferences, automatic: false };
  if (change === "background") await act(() => foregroundChanged("background"));
  await hook.rerender(undefined);
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  expect(followers[0].current()).toBe(false);
  await act(() => followers[0].reading({ ...point, coordinates: { latitude: 31, longitude: -99 } }));
  await publish(hook, [officialAlert()]);
  expect(sendNwsNotification).not.toHaveBeenCalled();
  expect(hook.result.current.enabled).toBe(true);
  expect(hook.result.current.status).toMatch(/PAUSED/);
});

test("explicit disable removes GPS, ignores its queued callbacks and saves OFF", async () => {
  const hook = await enabled();
  const updates = jest.mocked(app.setLocation).mock.calls.length;
  await act(() => hook.result.current.disable());
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  await act(() => followers[0].reading(point));
  expect(app.setLocation).toHaveBeenCalledTimes(updates);
  expect(hook.result.current.status).toBe("OFF");
  await waitFor(async () => expect(await savedSettings()).toMatchObject({ enabled: false, ledger: null }));
});

test("manual location selection stops following and saves OFF", async () => {
  const hook = await enabled();
  app = { ...app, locationRevision: 1, location: { ...point, kind: "manual", coordinates: { latitude: 31, longitude: -98 } } };
  await hook.rerender(undefined);
  expect(hook.result.current.enabled).toBe(false);
  expect(hook.result.current.lastNotice).toMatch(/MANUAL POINT SELECTED/);
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  await waitFor(async () => expect(await savedSettings()).toMatchObject({ enabled: false }));
});

test("a pending GPS subscription is removed when it resolves after disable", async () => {
  const pending = deferred<() => void>();
  jest.mocked(startForegroundFollow).mockReturnValueOnce(pending.promise);
  const hook = await mount();
  await act(() => hook.result.current.enable());
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
  await act(() => hook.result.current.disable());
  const remove = jest.fn();
  await act(() => pending.resolve(remove));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(hook.result.current.enabled).toBe(false);
});

test("GPS errors remove the subscription and expose a paused reading without fabricating a point", async () => {
  const hook = await enabled();
  await act(() => followers[0].error("GPS stopped"));
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  expect(hook.result.current.error).toBe("GPS stopped");
  expect(hook.result.current.status).toBe("PAUSED / GPS ERROR");
  expect(followers[0].current()).toBe(false);
});

test("a failed first GPS fix shows a paused error, stays stopped and recovers only after an explicit retry", async () => {
  const firstAttempt = deferred<() => void>();
  jest.mocked(startForegroundFollow).mockImplementationOnce((_reading, _error, _current, phase) => {
    phase?.("ACQUIRE GPS");
    return firstAttempt.promise;
  });
  const hook = await mount();
  await act(() => hook.result.current.enable());
  expect(hook.result.current.status).toBe("ACQUIRE GPS");
  expect(hook.result.current.error).toBeNull();
  await act(() => firstAttempt.reject(new Error("GPS took too long. Retry or select a point manually.")));
  expect(hook.result.current.status).toBe("PAUSED / GPS ERROR");
  expect(hook.result.current.error).toMatch(/GPS took too long/);
  await hook.rerender(undefined);
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
  await act(() => hook.result.current.disable());
  await act(() => hook.result.current.enable());
  expect(startForegroundFollow).toHaveBeenCalledTimes(2);
  expect(hook.result.current.status).toBe("WAITING FOR GPS");
  expect(hook.result.current.error).toBeNull();
  await act(() => followers[0].reading(point));
  expect(hook.result.current.status).toBe("ON / GPS FOLLOW / APP OPEN");
});

test("pending startup reports its current step until watcher setup finishes", async () => {
  const registration = deferred<() => void>();
  let reportPhase!: (phase: ForegroundFollowPhase) => void;
  let acceptPoint!: (selected: SelectedLocation, observedAt: number) => void;
  jest.mocked(startForegroundFollow).mockImplementationOnce((reading, _error, _current, phase) => {
    acceptPoint = reading;
    reportPhase = (value) => phase?.(value);
    return registration.promise;
  });
  const hook = await mount();
  await act(() => hook.result.current.enable());
  expect(hook.result.current.status).toBe("CHECK GPS ACCESS");
  await act(() => reportPhase("CHECK DEVICE LOCATION"));
  expect(hook.result.current.status).toBe("CHECK DEVICE LOCATION");
  await act(() => reportPhase("ACQUIRE GPS"));
  expect(hook.result.current.status).toBe("ACQUIRE GPS");
  await act(() => { acceptPoint(point, Date.now()); reportPhase("START GPS WATCH"); });
  expect(hook.result.current.status).toBe("START GPS WATCH");
  await act(() => registration.resolve(jest.fn()));
  expect(hook.result.current.status).toBe("ON / GPS FOLLOW / APP OPEN");
  await act(() => hook.result.current.disable());
  await act(() => reportPhase("ACQUIRE GPS"));
  expect(hook.result.current.status).toBe("OFF");
});

test("a GPS update cannot clear an unrelated notification scheduling error", async () => {
  const hook = await enabled();
  await publish(hook, []);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  jest.mocked(sendNwsNotification).mockRejectedValueOnce(new Error("OS scheduling failed"));
  await publish(hook, [officialAlert()]);
  await waitFor(() => expect(hook.result.current.error).toMatch(/Notification or local save failed/));
  const unrelated = hook.result.current.error;
  await act(() => followers[0].reading(point));
  expect(hook.result.current.error).toBe(unrelated);
  expect(hook.result.current.status).toBe("ON / GPS FOLLOW / APP OPEN");
});

test("foreground resume rechecks OS permission; revoked notification permission prevents a new GPS subscription", async () => {
  const hook = await enabled();
  await act(() => foregroundChanged("background"));
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  jest.mocked(readNotificationPermission).mockResolvedValueOnce({ ...allowed, granted: false, status: "denied" });
  await act(() => foregroundChanged("active"));
  await waitFor(() => expect(hook.result.current.status).toBe("PAUSED / OS PERMISSION"));
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
  expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
});

test("foreground resume does not restart GPS while the refreshed OS permission read is pending", async () => {
  const hook = await enabled();
  await act(() => foregroundChanged("background"));
  const refreshed = deferred<NotificationPermission>();
  jest.mocked(readNotificationPermission).mockReturnValueOnce(refreshed.promise);
  await act(() => foregroundChanged("active"));
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
  await act(() => refreshed.resolve({ ...allowed, granted: false, status: "denied" }));
  expect(hook.result.current.status).toBe("PAUSED / OS PERMISSION");
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
});

test("an older permission grant cannot overwrite a newer denial from a later resume", async () => {
  const hook = await enabled();
  const older = deferred<NotificationPermission>();
  const newer = deferred<NotificationPermission>();
  jest.mocked(readNotificationPermission).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  await act(() => foregroundChanged("background"));
  await act(() => foregroundChanged("active"));
  await act(() => foregroundChanged("background"));
  await act(() => foregroundChanged("active"));
  await act(() => newer.resolve({ ...allowed, granted: false, status: "denied" }));
  expect(hook.result.current.status).toBe("PAUSED / OS PERMISSION");
  await act(() => older.resolve(allowed));
  expect(hook.result.current.status).toBe("PAUSED / OS PERMISSION");
  expect(startForegroundFollow).toHaveBeenCalledTimes(1);
});

test("first point snapshot sets a baseline; a new message sends once and persists acknowledged dedup", async () => {
  const hook = await enabled();
  const existing = officialAlert();
  await publish(hook, [existing]);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  expect(sendNwsNotification).not.toHaveBeenCalled();
  const added = officialAlert({ id: "new-warning", sourceUrl: "https://api.weather.gov/alerts/new-warning" });
  await publish(hook, [existing, added]);
  await waitFor(() => expect(sendNwsNotification).toHaveBeenCalledTimes(1));
  expect(sendNwsNotification).toHaveBeenCalledWith(added, expect.any(Function));
  await waitFor(async () => expect((await savedSettings()).ledger.records).toEqual(expect.arrayContaining([expect.objectContaining({ id: added.id, disposition: "delivered" })])));
  await publish(hook, [existing, added]);
  expect(sendNwsNotification).toHaveBeenCalledTimes(1);
});

test("GPS movement keeps the initial baseline, rejects the old point and notifies an unseen warning in the new area", async () => {
  const hook = await enabled();
  const existing = officialAlert();
  await publish(hook, [existing]);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  const entered = officialAlert({ id: "entered-new-area", sourceUrl: "https://api.weather.gov/alerts/entered-new-area" });
  await act(() => followers[0].reading({ ...point, coordinates: { latitude: 31, longitude: -99 } }));
  await publish(hook, [existing, entered]);
  expect(sendNwsNotification).not.toHaveBeenCalled();
  await publish(hook, [existing, entered], "live", new Date(TEST_NOW).toISOString(), "31,-99");
  await waitFor(() => expect(sendNwsNotification).toHaveBeenCalledTimes(1));
  expect(sendNwsNotification).toHaveBeenCalledWith(entered, expect.any(Function));
  await waitFor(async () => expect((await savedSettings()).ledger.records).toEqual(expect.arrayContaining([expect.objectContaining({ id: entered.id, disposition: "delivered" })])));
});

test.each(["cached", "demo"] as const)("%s snapshots neither establish a baseline nor schedule official notifications", async (source) => {
  const hook = await enabled();
  await publish(hook, [officialAlert()], source);
  expect(sendNwsNotification).not.toHaveBeenCalled();
  expect((await savedSettings()).ledger).toBeNull();
  await publish(hook, [officialAlert()]);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  expect(sendNwsNotification).not.toHaveBeenCalled();
});

test("a notification scheduling failure does not consume the unseen warning; next fresh response retries", async () => {
  const hook = await enabled();
  await publish(hook, []);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  jest.mocked(sendNwsNotification).mockRejectedValueOnce(new Error("OS scheduling failed"));
  const alert = officialAlert();
  await publish(hook, [alert]);
  await waitFor(() => expect(hook.result.current.error).toMatch(/Notification or local save failed/));
  expect((await savedSettings()).ledger.records).toEqual([]);
  await publish(hook, [alert]);
  await waitFor(() => expect(sendNwsNotification).toHaveBeenCalledTimes(2));
  await waitFor(async () => expect((await savedSettings()).ledger.records).toEqual([expect.objectContaining({ id: alert.id, disposition: "delivered" })]));
});

test("an OS delivery completing after disable is cancelled and never re-enables tracking", async () => {
  const hook = await enabled();
  await publish(hook, []);
  await waitFor(async () => expect((await savedSettings()).ledger.baselineEstablished).toBe(true));
  const pending = deferred<string>();
  jest.mocked(sendNwsNotification).mockReturnValueOnce(pending.promise);
  await publish(hook, [officialAlert()]);
  await waitFor(() => expect(sendNwsNotification).toHaveBeenCalledTimes(1));
  await act(() => hook.result.current.disable());
  await act(() => pending.resolve("obsolete-notification"));
  await waitFor(() => expect(cancelNotification).toHaveBeenCalledWith("obsolete-notification"));
  expect(hook.result.current.enabled).toBe(false);
  expect(await savedSettings()).toMatchObject({ enabled: false, ledger: null });
});

test("test notification is labeled by its adapter and isolated from location opt-in and official dedup", async () => {
  const hook = await mount();
  await act(() => hook.result.current.test());
  expect(sendTestNotification).toHaveBeenCalledTimes(1);
  expect(sendNwsNotification).not.toHaveBeenCalled();
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(hook.result.current.enabled).toBe(false);
  expect(hook.result.current.lastNotice).toMatch(/TEST QUEUED/);
  expect(await savedSettings()).toBeNull();
});

test("a test notification accepted after switching to demo is cancelled", async () => {
  const hook = await mount();
  const scheduled = deferred<string>();
  jest.mocked(sendTestNotification).mockReturnValueOnce(scheduled.promise);
  let pending!: Promise<void>;
  await act(() => { pending = hook.result.current.test(); });
  await waitFor(() => expect(sendTestNotification).toHaveBeenCalledTimes(1));
  app = { ...app, mode: "demo" };
  await hook.rerender(undefined);
  await act(async () => { scheduled.resolve("obsolete-test-notification"); await pending; });
  expect(cancelNotification).toHaveBeenCalledWith("obsolete-test-notification");
  expect(hook.result.current.enabled).toBe(false);
  expect(startForegroundFollow).not.toHaveBeenCalled();
});

test("an official notification tap exits demo and opens a fixed Home route; a test tap stays isolated", async () => {
  const hook = await mount();
  app = { ...app, mode: "demo" };
  await hook.rerender(undefined);
  await act(() => officialTapped("untrusted-id-with-a-url-https://example.com"));
  expect(app.setMode).toHaveBeenCalledWith("live");
  expect(router.navigate).toHaveBeenCalledWith("/");
  expect(hook.result.current.lastNotice).toMatch(/CHECK CURRENT NWS RESULTS/);
  jest.mocked(router.navigate).mockClear();
  jest.mocked(app.setMode).mockClear();
  await act(() => testTapped?.());
  expect(router.navigate).not.toHaveBeenCalled();
  expect(app.setMode).not.toHaveBeenCalled();
  expect(hook.result.current.lastNotice).toBe("TEST OPENED / NO EMERGENCY");
  expect(sendNwsNotification).not.toHaveBeenCalled();
});

test("an opted-in reopen with OS notification permission denied remains paused without starting GPS", async () => {
  await AsyncStorage.setItem(LOCATION_NOTIFICATIONS_KEY, JSON.stringify({ version: 1, enabled: true, generation: "saved-session", ledger: null }));
  jest.mocked(readNotificationPermission).mockResolvedValueOnce({ ...allowed, granted: false, status: "denied" });
  const hook = await mount();
  expect(hook.result.current).toMatchObject({ enabled: true, status: "PAUSED / OS PERMISSION" });
  expect(startForegroundFollow).not.toHaveBeenCalled();
  expect(requestNotificationPermission).not.toHaveBeenCalled();
});

test.each([
  "{invalid JSON",
  JSON.stringify({ version: 1, enabled: true, generation: "", ledger: null }),
  JSON.stringify({ version: 1, enabled: true, generation: "session", ledger: createNotificationLedger({ generation: "other-session", locationKey: "30,-99" }) }),
])("invalid saved settings do not silently re-enable tracking %#", async (raw) => {
  await AsyncStorage.setItem(LOCATION_NOTIFICATIONS_KEY, raw);
  const hook = await mount();
  expect(hook.result.current.enabled).toBe(false);
  expect(hook.result.current.error).toMatch(/unavailable/);
  expect(startForegroundFollow).not.toHaveBeenCalled();
});

test("unmount removes both the location subscription and notification response listener", async () => {
  const hook = await enabled();
  await hook.unmount();
  expect(followers[0].remove).toHaveBeenCalledTimes(1);
  expect(listenerRemove).toHaveBeenCalledTimes(1);
  expect(followers[0].current()).toBe(false);
});
