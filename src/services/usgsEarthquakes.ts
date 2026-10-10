import { ClearPathDataError, fetchJson } from "../data/http";
import {
  featureCollection, isFiniteNumber, isRecord, isText, pointGeometry,
  type OfficialEarthquake, type UsgsSnapshot,
} from "./usgsTypes";

export const EARTHQUAKE_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
export const EARTHQUAKE_WINDOW_MS = 24 * 60 * 60_000;

export function normalizeEarthquakes(data: unknown, now = Date.now()): OfficialEarthquake[] {
  const collection = featureCollection(data);
  const events = new Map<string, OfficialEarthquake>();
  for (const feature of collection.features as unknown[]) {
    if (!isRecord(feature) || !isRecord(feature.properties))
      throw new ClearPathDataError("invalid-response", "USGS earthquake records could not be verified.");
    const p = feature.properties;
    // Quarry blasts and other event types are not earthquakes.
    if (p.type !== "earthquake") continue;
    const coordinates = pointGeometry(feature.geometry);
    const depth = isRecord(feature.geometry) && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates[2] : null;
    if (feature.type !== "Feature" || !isText(feature.id) || !coordinates ||
        !isFiniteNumber(depth) || !isFiniteNumber(p.time) || !isFiniteNumber(p.updated) ||
        !isText(p.url) || !/^https:\/\/earthquake\.usgs\.gov\/earthquakes\/eventpage\/[^\s?#]+$/.test(p.url) ||
        !(p.mag === null || (isFiniteNumber(p.mag) && p.mag >= -10 && p.mag <= 12)) ||
        !Number.isFinite(new Date(p.time).getTime()) || !Number.isFinite(new Date(p.updated).getTime()))
      throw new ClearPathDataError("invalid-response", "USGS earthquake records could not be verified.");
    if (p.time < now - EARTHQUAKE_WINDOW_MS || p.time > now + 5 * 60_000) continue;
    const event: OfficialEarthquake = {
      id: feature.id,
      name: isText(p.place) ? p.place : "Location description unavailable",
      coordinates,
      magnitude: p.mag,
      depthKm: depth,
      observedAt: new Date(p.time).toISOString(),
      updatedAt: new Date(p.updated).toISOString(),
      sourceUrl: p.url,
      reviewStatus: isText(p.status) ? p.status : "Unknown",
    };
    const previous = events.get(event.id);
    if (!previous || Date.parse(event.updatedAt) > Date.parse(previous.updatedAt)) events.set(event.id, event);
  }
  return [...events.values()];
}

export async function getEarthquakes(signal?: AbortSignal): Promise<UsgsSnapshot<OfficialEarthquake>> {
  const data = await fetchJson(EARTHQUAKE_FEED_URL, { signal, headers: { Accept: "application/geo+json" } });
  const now = Date.now();
  if (!isRecord(data) || !isRecord(data.metadata) || !isFiniteNumber(data.metadata.generated) ||
      !Number.isFinite(new Date(data.metadata.generated).getTime()))
    throw new ClearPathDataError("invalid-response", "USGS earthquake feed timestamp could not be verified.");
  return {
    items: normalizeEarthquakes(data, now),
    fetchedAt: new Date(now).toISOString(),
    generatedAt: new Date(data.metadata.generated).toISOString(),
    coverage: "USGS reported earthquakes worldwide in the past 24 hours. Locations are epicenters, not impact areas.",
  };
}
