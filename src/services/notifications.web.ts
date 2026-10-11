import type { OfficialAlert } from "@/domain/types";
import { unsupportedNotificationPermission, type NotificationPermission } from "./notifications.types";

export type { NotificationPermission } from "./notifications.types";
export const NWS_NOTIFICATION_CHANNEL = "clearpath-nws";

export async function initializeNotifications(): Promise<boolean> { return false; }
export async function readNotificationPermission(): Promise<NotificationPermission> { return { ...unsupportedNotificationPermission }; }
export async function requestNotificationPermission(): Promise<NotificationPermission> { return { ...unsupportedNotificationPermission }; }
export async function sendNwsNotification(_alert: OfficialAlert, _isCurrent?: () => boolean): Promise<string> {
  throw new Error("Location notifications require the installed Android app.");
}
export async function sendTestNotification(_isCurrent?: () => boolean): Promise<string> {
  throw new Error("Location notifications require the installed Android app.");
}
export async function cancelNotification(_identifier: string): Promise<void> {}
export function listenNotificationResponses(_onOfficial: (alertId: string) => void, _onTest?: () => void): () => void { return () => {}; }
