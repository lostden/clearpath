import type { Coordinates, OfficialAlert, SelectedLocation } from "./types";

export function validCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function coordinatesFor(
  location: Coordinates | SelectedLocation,
): Coordinates {
  const point = "coordinates" in location ? location.coordinates : location;
  if (!validCoordinates(point))
    throw new RangeError("A valid latitude and longitude are required.");
  return point;
}

/** Exact coordinates prevent a cache for one selected point appearing at another. */
export function locationKey(location: Coordinates | SelectedLocation): string {
  const point = coordinatesFor(location);
  return `${point.latitude},${point.longitude}`;
}

/** Provider ordering is retained. No student priority/relevance algorithm is supplied here. */
export function uniqueAlerts(
  alerts: readonly OfficialAlert[],
): OfficialAlert[] {
  const latest = new Map<string, OfficialAlert>();
  for (const alert of alerts) {
    const previous = latest.get(alert.id);
    if (!previous || Date.parse(alert.sent) > Date.parse(previous.sent))
      latest.set(alert.id, alert);
  }
  const replacements = new Map<string, number>();
  for (const alert of latest.values()) {
    if (alert.messageType !== "Cancel" && alert.messageType !== "Update")
      continue;
    for (const reference of alert.references) {
      replacements.set(
        reference,
        Math.max(
          replacements.get(reference) ?? -Infinity,
          Date.parse(alert.sent),
        ),
      );
    }
  }
  return [...latest.values()].filter((alert) => {
    if (alert.messageType !== "Alert" && alert.messageType !== "Update")
      return false;
    const replacedAt = Math.max(
      replacements.get(alert.id) ?? -Infinity,
      alert.sourceUrl
        ? (replacements.get(alert.sourceUrl) ?? -Infinity)
        : -Infinity,
    );
    return replacedAt < Date.parse(alert.sent);
  });
}

/** Expiration changes while a screen stays open; call with the current clock at render time. */
export function currentAlerts(
  alerts: readonly OfficialAlert[],
  now = Date.now(),
): OfficialAlert[] {
  return uniqueAlerts(alerts).filter((alert) => {
    const expires = Date.parse(alert.expires);
    return Number.isFinite(expires) && expires > now;
  });
}
