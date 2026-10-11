export type NotificationPermission = {
  supported: boolean;
  granted: boolean;
  canAskAgain: boolean;
  status: "granted" | "denied" | "undetermined" | "unsupported";
};

export const unsupportedNotificationPermission: NotificationPermission = {
  supported: false,
  granted: false,
  canAskAgain: false,
  status: "unsupported",
};
