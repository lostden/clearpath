import { CloudPushError, type CloudEnrollment, type CloudFollowOptions, type CloudPoint, type CloudPushAvailability, type CloudPushStatus, type CloudRegistrationState, type CloudRevocation } from "./cloudPush.types";
export * from "./cloudPush.types";

const unsupported = () => new CloudPushError("unsupported", "Cloud location alerts require a configured installed Android build.");
export async function readCloudPushAvailability(): Promise<CloudPushAvailability> {
  return { status: "unsupported", backgroundFollowAvailable: false, reason: "Use the installed Android app." };
}
export async function readCloudPushRegistration(): Promise<CloudRegistrationState> {
  return { enrolled: false, following: false, serverAckPending: false, locationObservedAt: null, lastError: null };
}
export async function enrollCloudPush(_input: CloudEnrollment): Promise<{ baseline: "pending" }> { throw unsupported(); }
export async function updateCloudPushLocation(_input: CloudPoint): Promise<"updated" | "throttled" | "ignored"> { throw unsupported(); }
export async function readCloudPushStatus(): Promise<CloudPushStatus> { throw unsupported(); }
export async function startCloudLocationFollow(_options: CloudFollowOptions): Promise<void> { throw unsupported(); }
export async function stopCloudLocationFollow(): Promise<void> {}
export async function revokeCloudPush(): Promise<CloudRevocation> { return { localStopped: true, serverAckPending: false }; }
