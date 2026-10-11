import type { Coordinates } from "@/domain/types";

export type CloudPoint = { point: Coordinates; locationObservedAt: string };
export type CloudEnrollment = CloudPoint & { enrollmentSecret: string };
export type CloudPushAvailability = {
  status: "unconfigured" | "unsupported" | "configured";
  backgroundFollowAvailable: boolean;
  reason: string;
};
export type CloudRegistrationState = {
  enrolled: boolean;
  following: boolean;
  serverAckPending: boolean;
  locationObservedAt: string | null;
  lastError: string | null;
};
export type CloudPushStatus = {
  enabled: boolean;
  baseline: "ready" | "pending";
  locationFresh: boolean;
  locationObservedAt: string;
  lastCheckAt: number | null;
  lastError: string | null;
  lastDelivery: string | null;
  pendingReceipts: number;
};
export type CloudFollowOptions = { backgroundPermissionExplained: true };
export type CloudRevocation = { localStopped: boolean; serverAckPending: boolean };

export class CloudPushError extends Error {
  constructor(readonly code: string, message: string, readonly serverAckPending = false) {
    super(message);
    this.name = "CloudPushError";
  }
}
