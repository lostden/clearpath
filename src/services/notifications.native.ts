import { Platform } from "react-native";
import type * as ExpoNotifications from "expo-notifications";
import { isOfficialAlert } from "@/data/nws";
import type { OfficialAlert } from "@/domain/types";
import { unsupportedNotificationPermission, type NotificationPermission } from "./notifications.types";

export type { NotificationPermission } from "./notifications.types";
export const NWS_NOTIFICATION_CHANNEL = "clearpath-nws";

type NotificationApi = typeof ExpoNotifications;
type Payload = { kind: "nws-point-alert"; alertId: string } | { kind: "notification-test" };
let initialization: Promise<boolean> | null = null;

// Older installed APKs/Expo Go may lack the new native module. Loading it only
// here keeps that capability unavailable without breaking the rest of the app.
function nativeApi(): NotificationApi | null {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native capability can be absent in an older installed build.
    return require("expo-notifications") as NotificationApi;
  } catch {
    return null;
  }
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2_048 &&
    !/[\u0000-\u0020\u007f]/.test(value);
}

function payload(value: unknown): Payload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data);
  if (data.kind === "nws-point-alert" && keys.length === 2 &&
    keys.includes("alertId") && validIdentifier(data.alertId)) {
    return { kind: "nws-point-alert", alertId: data.alertId };
  }
  if (data.kind === "notification-test" && keys.length === 1) {
    return { kind: "notification-test" };
  }
  return null;
}

export function initializeNotifications(): Promise<boolean> {
  const api = nativeApi();
  if (!api) return Promise.resolve(false);
  if (initialization) return initialization;
  initialization = (async () => {
    api.setNotificationHandler({
      // No fetches/storage/permission prompts in the OS presentation callback.
      handleNotification: async (notification) => {
        const allowed = payload(notification.request.content.data) !== null;
        return {
          shouldShowBanner: allowed,
          shouldShowList: allowed,
          shouldPlaySound: allowed,
          shouldSetBadge: false,
        };
      },
    });
    if (Platform.OS === "android") {
      await api.setNotificationChannelAsync(NWS_NOTIFICATION_CHANNEL, {
        name: "NWS location alerts",
        description: "Official NWS messages for the selected alert point.",
        importance: api.AndroidImportance.HIGH,
        lightColor: "#FF5A00",
        lockscreenVisibility: api.AndroidNotificationVisibility.PRIVATE,
        sound: "default",
        bypassDnd: false,
        showBadge: false,
      });
    }
    return true;
  })().catch(() => {
    initialization = null;
    throw new Error("Notifications could not be prepared. Try again.");
  });
  return initialization;
}

function permissionResult(permission: ExpoNotifications.NotificationPermissionsStatus, api: NotificationApi): NotificationPermission {
  const iosStatus = permission.ios?.status;
  const granted = Platform.OS === "ios" && iosStatus !== undefined
    ? iosStatus === api.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === api.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === api.IosAuthorizationStatus.EPHEMERAL
    : permission.granted;
  return {
    supported: true,
    granted,
    canAskAgain: permission.canAskAgain,
    status: granted ? "granted" : permission.status === "undetermined" ? "undetermined" : "denied",
  };
}

export async function readNotificationPermission(): Promise<NotificationPermission> {
  const api = nativeApi();
  if (!api) return { ...unsupportedNotificationPermission };
  try {
    const permission = permissionResult(await api.getPermissionsAsync(), api);
    if (Platform.OS === "android" && permission.granted) {
      const channel = await api.getNotificationChannelAsync(NWS_NOTIFICATION_CHANNEL);
      if (channel?.importance === api.AndroidImportance.NONE) {
        return { supported: true, granted: false, canAskAgain: false, status: "denied" };
      }
    }
    return permission;
  } catch {
    throw new Error("Notification settings could not be read. Try again.");
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!(await initializeNotifications())) return { ...unsupportedNotificationPermission };
  const api = nativeApi();
  if (!api) return { ...unsupportedNotificationPermission };
  const current = await readNotificationPermission();
  if (current.granted || !current.canAskAgain) return current;
  try {
    await api.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return await readNotificationPermission();
  } catch {
    throw new Error("Notification permission could not be requested. Try again.");
  }
}

async function schedule(content: ExpoNotifications.NotificationContentInput, stillCurrent?: () => boolean): Promise<string> {
  if (!(await initializeNotifications())) {
    throw new Error("Notifications are unavailable in this app. Install the updated Android build.");
  }
  if (!(await readNotificationPermission()).granted) {
    throw new Error("Notifications are blocked. Allow them in phone settings.");
  }
  const api = nativeApi();
  if (!api) throw new Error("Notifications are unavailable in this app.");
  if (stillCurrent && !stillCurrent()) {
    throw new Error("Only a current official NWS message can trigger a location alert.");
  }
  try {
    return await api.scheduleNotificationAsync({
      content,
      trigger: Platform.OS === "android" ? { channelId: NWS_NOTIFICATION_CHANNEL } : null,
    });
  } catch {
    throw new Error("The notification could not be sent. Try again.");
  }
}

export async function sendNwsNotification(alert: OfficialAlert, isCurrent: () => boolean = () => true): Promise<string> {
  if (!isOfficialAlert(alert) || !validIdentifier(alert.id) ||
    (alert.messageType !== "Alert" && alert.messageType !== "Update") ||
    Date.parse(alert.expires) <= Date.now()) {
    throw new Error("Only a current official NWS message can trigger a location alert.");
  }
  return schedule({
    title: `NWS / ${alert.event}`,
    body: "NEW OFFICIAL MESSAGE / OPEN CLEARPATH",
    data: { kind: "nws-point-alert", alertId: alert.id },
    sound: "default",
    color: "#FF5A00",
  }, () => isCurrent() && Date.parse(alert.expires) > Date.now());
}

export async function sendTestNotification(isCurrent: () => boolean = () => true): Promise<string> {
  return schedule({
    title: "TEST / NO EMERGENCY",
    body: "NOTIFICATION TEST. NO EMERGENCY. OPEN CLEARPATH.",
    data: { kind: "notification-test" },
    sound: "default",
    color: "#FF5A00",
  }, isCurrent);
}

/** A caller can cancel a returned OS identifier after its watch becomes obsolete. */
export async function cancelNotification(identifier: string): Promise<void> {
  if (!validIdentifier(identifier)) return;
  const api = nativeApi();
  if (!api) return;
  const results = await Promise.allSettled([
    api.cancelScheduledNotificationAsync(identifier),
    api.dismissNotificationAsync(identifier),
  ]);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("The previous notification could not be removed.");
  }
}

/** Only validated IDs reach the caller; routing stays inside ClearPath. */
export function listenNotificationResponses(onOfficial: (alertId: string) => void, onTest?: () => void): () => void {
  const api = nativeApi();
  if (!api) return () => {};
  let active = true;
  const handled = new Set<string>();
  const respond = (response: ExpoNotifications.NotificationResponse) => {
    if (!active || response.actionIdentifier !== api.DEFAULT_ACTION_IDENTIFIER) return;
    const request = response.notification?.request;
    if (!request || !validIdentifier(request.identifier) || handled.has(request.identifier)) return;
    const data = payload(request.content?.data);
    if (!data) return;
    handled.add(request.identifier);
    if (handled.size > 32) handled.delete(handled.values().next().value!);
    if (data.kind === "nws-point-alert") onOfficial(data.alertId);
    else onTest?.();
    api.clearLastNotificationResponse();
  };
  try {
    const subscription = api.addNotificationResponseReceivedListener(respond);
    // Subscribe first so a tap during initial-response retrieval is not lost.
    try {
      const initial = api.getLastNotificationResponse();
      if (initial) respond(initial);
    } catch {
      // A failed initial lookup does not remove the live response listener.
    }
    return () => { active = false; subscription.remove(); };
  } catch {
    active = false;
    return () => {};
  }
}
