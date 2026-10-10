import type { Coordinates } from "../domain/types";
import { ClearPathDataError } from "../data/http";

export type OfficialEarthquake = {
  id: string;
  name: string;
  coordinates: Coordinates;
  magnitude: number | null;
  depthKm: number;
  observedAt: string;
  updatedAt: string;
  sourceUrl: string;
  reviewStatus: string;
};

export type RiverMeasurement = {
  value: number;
  /** Preserve the provider's decimal representation and actual units. */
  displayValue: string;
  units: string;
  observedAt: string;
  approvalStatus: "Provisional" | "Approved" | "Unknown";
  qualifier: string | null;
};

export type RiverGauge = {
  id: string;
  name: string;
  coordinates: Coordinates;
  distanceKm: number;
  sourceUrl: string;
  gageHeight: RiverMeasurement | null;
  streamflow: RiverMeasurement | null;
};

export type UsgsSnapshot<T> = {
  items: T[];
  fetchedAt: string;
  generatedAt: string | null;
  coverage: string;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function assertPoint(point: Coordinates): void {
  if (
    !isFiniteNumber(point.latitude) || Math.abs(point.latitude) > 90 ||
    !isFiniteNumber(point.longitude) || Math.abs(point.longitude) > 180
  ) throw new ClearPathDataError("invalid-response", "Invalid selected coordinates.");
}

export function pointGeometry(value: unknown): Coordinates | null {
  if (!isRecord(value) || value.type !== "Point" || !Array.isArray(value.coordinates)) return null;
  const [longitude, latitude] = value.coordinates;
  if (!isFiniteNumber(latitude) || Math.abs(latitude) > 90 ||
      !isFiniteNumber(longitude) || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function featureCollection(data: unknown): Record<string, unknown> {
  if (!isRecord(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw new ClearPathDataError("invalid-response", "USGS returned an invalid feature collection.");
  return data;
}

/** RFC 3339 with an explicit timezone; reject invalid dates and fabricated local times. */
export function validObservationTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= days &&
    Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 &&
    (!offsetHour || (Number(offsetHour) < 24 && Number(offsetMinute) < 60));
}

/** Observation recency is distinct from successfully retrieving a snapshot. */
export function isRiverObservationDelayed(measurement: RiverMeasurement, now = Date.now()): boolean {
  const age = now - Date.parse(measurement.observedAt);
  return age > 90 * 60_000 || age < -5 * 60_000;
}
