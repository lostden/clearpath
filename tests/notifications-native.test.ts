import type * as ExpoNotifications from "expo-notifications";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

let notifications: typeof ExpoNotifications;
let service: typeof import("../src/services/notifications.native");
let platform: { OS: string };

const granted = { status: "granted", granted: true, canAskAgain: true, expires: "never" };
const denied = { ...granted, status: "denied", granted: false, canAskAgain: false };
const undetermined = { ...granted, status: "undetermined", granted: false };

function response(data: unknown, identifier = "notice-1", actionIdentifier = "default") {
  return {
    actionIdentifier,
    notification: { request: { identifier, content: { data } } },
  } as ExpoNotifications.NotificationResponse;
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers().setSystemTime(TEST_NOW);
  jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
  jest.doMock("expo-notifications", () => ({
    AndroidImportance: { HIGH: 6, NONE: 2 },
    AndroidNotificationVisibility: { PRIVATE: 2 },
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    DEFAULT_ACTION_IDENTIFIER: "default",
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn().mockResolvedValue({ id: "clearpath-nws" }),
    getPermissionsAsync: jest.fn().mockResolvedValue(granted),
    getNotificationChannelAsync: jest.fn().mockResolvedValue({ id: "clearpath-nws", importance: 6 }),
    requestPermissionsAsync: jest.fn().mockResolvedValue(granted),
    scheduleNotificationAsync: jest.fn().mockResolvedValue("notice-1"),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
    addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    getLastNotificationResponse: jest.fn().mockReturnValue(null),
    clearLastNotificationResponse: jest.fn(),
    getDevicePushTokenAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
  }));
  notifications = jest.requireMock("expo-notifications");
  platform = jest.requireMock("react-native").Platform;
  service = jest.requireActual("../src/services/notifications.native");
});

afterEach(() => { jest.useRealTimers(); });

test("Android creates a private high-importance channel before its permission prompt", async () => {
  jest.mocked(notifications.getPermissionsAsync).mockResolvedValueOnce(undetermined as ExpoNotifications.NotificationPermissionsStatus);
  expect(await service.requestNotificationPermission()).toEqual({
    supported: true, status: "granted", granted: true, canAskAgain: true,
  });
  expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith("clearpath-nws", expect.objectContaining({
    importance: 6, lightColor: "#FF5A00", lockscreenVisibility: 2, bypassDnd: false, showBadge: false,
  }));
  expect(jest.mocked(notifications.setNotificationChannelAsync).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(notifications.requestPermissionsAsync).mock.invocationCallOrder[0],
  );
  expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test("initialization shares concurrent preparation without opening a permission prompt", async () => {
  await Promise.all([service.initializeNotifications(), service.initializeNotifications()]);
  expect(notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("channel preparation failure is actionable and allows another explicit attempt", async () => {
  jest.mocked(notifications.setNotificationChannelAsync).mockRejectedValueOnce(new Error("private native details"));
  await expect(service.requestNotificationPermission()).rejects.toThrow("Notifications could not be prepared. Try again.");
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(await service.initializeNotifications()).toBe(true);
  expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
});

test("permission reading does not request permission or initialize a channel", async () => {
  await expect(service.readNotificationPermission()).resolves.toMatchObject({ supported: true, granted: true });
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
});

test("permanent permission denial remains denied and does not repeat a prompt", async () => {
  jest.mocked(notifications.getPermissionsAsync).mockResolvedValue(denied as ExpoNotifications.NotificationPermissionsStatus);
  await expect(service.requestNotificationPermission()).resolves.toEqual({
    supported: true, granted: false, canAskAgain: false, status: "denied",
  });
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  await expect(service.sendTestNotification()).rejects.toThrow("Notifications are blocked.");
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("permission prompt denial returns the actual denied state", async () => {
  jest.mocked(notifications.getPermissionsAsync)
    .mockResolvedValueOnce(undetermined as ExpoNotifications.NotificationPermissionsStatus)
    .mockResolvedValueOnce(denied as ExpoNotifications.NotificationPermissionsStatus);
  jest.mocked(notifications.requestPermissionsAsync).mockResolvedValue(denied as ExpoNotifications.NotificationPermissionsStatus);
  await expect(service.requestNotificationPermission()).resolves.toMatchObject({ granted: false, status: "denied" });
});

test("a user-disabled Android channel stays blocked even with global permission", async () => {
  jest.mocked(notifications.getNotificationChannelAsync).mockResolvedValue({ importance: 2 } as ExpoNotifications.NotificationChannel);
  expect(await service.readNotificationPermission()).toEqual({
    supported: true, granted: false, canAskAgain: false, status: "denied",
  });
  await expect(service.sendTestNotification()).rejects.toThrow("Notifications are blocked.");
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("permission read failure does not pretend that notifications are enabled", async () => {
  jest.mocked(notifications.getPermissionsAsync).mockRejectedValue(new Error("native state"));
  await expect(service.readNotificationPermission()).rejects.toThrow("Notification settings could not be read.");
  await expect(service.sendNwsNotification(officialAlert())).rejects.toThrow("Notification settings could not be read.");
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("permission prompt failures leave scheduling untouched", async () => {
  jest.mocked(notifications.getPermissionsAsync).mockResolvedValue(undetermined as ExpoNotifications.NotificationPermissionsStatus);
  jest.mocked(notifications.requestPermissionsAsync).mockRejectedValue(new Error("native state"));
  await expect(service.requestNotificationPermission()).rejects.toThrow("Notification permission could not be requested.");
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("a current official message is immediate, contains no location or copied partial instruction, and returns its OS ID", async () => {
  await expect(service.sendNwsNotification(officialAlert())).resolves.toBe("notice-1");
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: {
      title: "NWS / Flash Flood Warning",
      body: "NEW OFFICIAL MESSAGE / OPEN CLEARPATH",
      data: { kind: "nws-point-alert", alertId: "urn:test:1" },
      sound: "default", color: "#FF5A00",
    },
    trigger: { channelId: "clearpath-nws" },
  });
  expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test.each([
  { sourceUrl: null },
  { expires: new Date(TEST_NOW).toISOString() },
  { messageType: "Cancel" as const },
  { messageType: "Ack" as const },
  { id: "bad\nidentifier" },
])("rejects demo/non-current/non-warning input %j before OS scheduling", async (override) => {
  await expect(service.sendNwsNotification(officialAlert(override))).rejects.toThrow("Only a current official NWS message");
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
});

test("provider updates remain valid notices without priority filtering", async () => {
  await service.sendNwsNotification(officialAlert({ messageType: "Update", severity: "Minor" }));
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

test("a warning that expires while reading permission is not scheduled", async () => {
  const alert = officialAlert({ expires: new Date(TEST_NOW + 1_000).toISOString() });
  jest.mocked(notifications.getPermissionsAsync).mockImplementation(async () => {
    jest.setSystemTime(TEST_NOW + 1_000);
    return granted as ExpoNotifications.NotificationPermissionsStatus;
  });
  await expect(service.sendNwsNotification(alert)).rejects.toThrow("Only a current official NWS message");
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test.each(["official", "test"] as const)("%s notification cancelled during its permission read never reaches the OS scheduler", async (kind) => {
  await service.initializeNotifications();
  let resolvePermission!: (value: ExpoNotifications.NotificationPermissionsStatus) => void;
  const permission = new Promise<ExpoNotifications.NotificationPermissionsStatus>((resolve) => { resolvePermission = resolve; });
  let permissionReadStarted!: () => void;
  const readStarted = new Promise<void>((resolve) => { permissionReadStarted = resolve; });
  jest.mocked(notifications.getPermissionsAsync).mockImplementationOnce(() => {
    permissionReadStarted();
    return permission;
  });
  let current = true;
  const task = kind === "official"
    ? service.sendNwsNotification(officialAlert(), () => current)
    : service.sendTestNotification(() => current);
  const cancelled = expect(task).rejects.toThrow("Only a current official NWS message");
  await readStarted;
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  current = false;
  resolvePermission(granted as ExpoNotifications.NotificationPermissionsStatus);
  await cancelled;
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(notifications.dismissNotificationAsync).not.toHaveBeenCalled();
});

test("test notification is explicitly non-emergency and has no official alert ID", async () => {
  await expect(service.sendTestNotification()).resolves.toBe("notice-1");
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    content: expect.objectContaining({
      title: "TEST / NO EMERGENCY", body: "NOTIFICATION TEST. NO EMERGENCY. OPEN CLEARPATH.",
      data: { kind: "notification-test" },
    }),
  }));
});

test("scheduling rejection preserves failure rather than returning a fake identifier", async () => {
  jest.mocked(notifications.scheduleNotificationAsync).mockRejectedValue(new Error("native implementation detail"));
  await expect(service.sendTestNotification()).rejects.toThrow("The notification could not be sent.");
});

test("fast presentation handler shows only the supported official/test payloads", async () => {
  await service.initializeNotifications();
  const handler = jest.mocked(notifications.setNotificationHandler).mock.calls[0][0]!;
  const notification = response({ kind: "nws-point-alert", alertId: "urn:test:1" }).notification;
  await expect(handler.handleNotification(notification)).resolves.toEqual({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  });
  await expect(handler.handleNotification(response({ kind: "unknown", url: "https://untrusted.invalid" }).notification)).resolves.toEqual({
    shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false,
  });
});

test("cold-start response plus duplicate event routes once and cleanup ignores a queued tap", () => {
  const official = jest.fn();
  const initial = response({ kind: "nws-point-alert", alertId: "urn:test:1" });
  jest.mocked(notifications.getLastNotificationResponse).mockReturnValue(initial);
  const stop = service.listenNotificationResponses(official);
  const listener = jest.mocked(notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
  listener(initial);
  expect(official).toHaveBeenCalledTimes(1);
  expect(official).toHaveBeenCalledWith("urn:test:1");
  expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  stop();
  listener(response({ kind: "nws-point-alert", alertId: "urn:test:2" }, "notice-2"));
  expect(official).toHaveBeenCalledTimes(1);
  expect(jest.mocked(notifications.addNotificationResponseReceivedListener).mock.results[0].value.remove).toHaveBeenCalled();
});

test.each([
  null,
  [],
  { kind: "nws-point-alert", alertId: "" },
  { kind: "nws-point-alert", alertId: "urn:test:1", url: "https://untrusted.invalid" },
  { kind: "nws-point-alert", alertId: "urn:test:1\n" },
  { kind: "nws-point-alert", alertId: "a".repeat(2_049) },
  { kind: "unknown", alertId: "urn:test:1" },
  { kind: "notification-test", alertId: "urn:test:1" },
])("ignores malformed or extended response payload %#", (data) => {
  const official = jest.fn();
  const test = jest.fn();
  service.listenNotificationResponses(official, test);
  jest.mocked(notifications.addNotificationResponseReceivedListener).mock.calls[0][0](response(data));
  expect(official).not.toHaveBeenCalled();
  expect(test).not.toHaveBeenCalled();
});

test("custom notification actions are not treated as default taps", () => {
  const official = jest.fn();
  service.listenNotificationResponses(official);
  jest.mocked(notifications.addNotificationResponseReceivedListener).mock.calls[0][0](response({ kind: "nws-point-alert", alertId: "urn:test:1" }, "notice-1", "untrusted-action"));
  expect(official).not.toHaveBeenCalled();
});

test("test taps use only the test callback and never the official callback", () => {
  const official = jest.fn();
  const test = jest.fn();
  service.listenNotificationResponses(official, test);
  jest.mocked(notifications.addNotificationResponseReceivedListener).mock.calls[0][0](response({ kind: "notification-test" }));
  expect(test).toHaveBeenCalledTimes(1);
  expect(official).not.toHaveBeenCalled();
});

test("initial lookup failure retains response handling for later taps", () => {
  jest.mocked(notifications.getLastNotificationResponse).mockImplementation(() => { throw new Error("native lookup"); });
  const official = jest.fn();
  service.listenNotificationResponses(official);
  jest.mocked(notifications.addNotificationResponseReceivedListener).mock.calls[0][0](response({ kind: "nws-point-alert", alertId: "urn:test:1" }));
  expect(official).toHaveBeenCalledWith("urn:test:1");
});

test("cancellation attempts both pending cancellation and tray dismissal when one fails", async () => {
  jest.mocked(notifications.cancelScheduledNotificationAsync).mockRejectedValue(new Error("native cancellation"));
  await expect(service.cancelNotification("notice-1")).rejects.toThrow("The previous notification could not be removed.");
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notice-1");
  expect(notifications.dismissNotificationAsync).toHaveBeenCalledWith("notice-1");
});

test("iOS permission interpretation respects provisional and denied authorization status", async () => {
  platform.OS = "ios";
  jest.mocked(notifications.getPermissionsAsync).mockResolvedValue({
    ...undetermined, ios: { status: 3 },
  } as ExpoNotifications.NotificationPermissionsStatus);
  expect((await service.readNotificationPermission()).granted).toBe(true);
  jest.mocked(notifications.getPermissionsAsync).mockResolvedValue({
    ...granted, ios: { status: 1 },
  } as ExpoNotifications.NotificationPermissionsStatus);
  expect((await service.readNotificationPermission()).granted).toBe(false);
});

test("iOS immediate notices do not create an Android channel", async () => {
  platform.OS = "ios";
  await service.sendTestNotification();
  expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: null }));
});

test("missing native module stays unsupported without crashing import/startup", async () => {
  jest.resetModules();
  jest.doMock("expo-notifications", () => { throw new Error("Cannot find native module"); });
  const missing: typeof service = jest.requireActual("../src/services/notifications.native");
  expect(await missing.initializeNotifications()).toBe(false);
  expect(await missing.readNotificationPermission()).toEqual({
    supported: false, granted: false, canAskAgain: false, status: "unsupported",
  });
  expect(() => missing.listenNotificationResponses(jest.fn())()).not.toThrow();
  await expect(missing.sendTestNotification()).rejects.toThrow("Notifications are unavailable");
});

test("web is fail-closed and never accesses Expo notification APIs", async () => {
  const web: typeof import("../src/services/notifications.web") = jest.requireActual("../src/services/notifications.web");
  expect(await web.initializeNotifications()).toBe(false);
  expect(await web.requestNotificationPermission()).toMatchObject({ supported: false, granted: false, status: "unsupported" });
  await expect(web.sendTestNotification()).rejects.toThrow("installed Android app");
  await expect(web.sendNwsNotification(officialAlert())).rejects.toThrow("installed Android app");
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
