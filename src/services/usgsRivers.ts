import type { Coordinates } from "../domain/types";
import { ClearPathDataError, fetchJson } from "../data/http";
import {
  assertPoint, featureCollection, isRecord, isText, pointGeometry, validObservationTime,
  type RiverGauge, type RiverMeasurement, type UsgsSnapshot,
} from "./usgsTypes";

const API = "https://api.waterdata.usgs.gov/ogcapi/v1/collections";
export const RIVER_RADIUS_KM = 50;
export const RIVER_STATION_LIMIT = 12;
type Station = Omit<RiverGauge, "gageHeight" | "streamflow">;
const discoveryCache = new Map<string, { at: number; stations: Station[] }>();

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const haversine = Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

export function riverBoundingBox(point: Coordinates): string {
  assertPoint(point);
  const latitudeDelta = RIVER_RADIUS_KM / 110.5;
  const longitudeDelta = RIVER_RADIUS_KM / (110.5 * Math.max(0.01, Math.cos(point.latitude * Math.PI / 180)));
  return [Math.max(-180, point.longitude - longitudeDelta), Math.max(-90, point.latitude - latitudeDelta),
    Math.min(180, point.longitude + longitudeDelta), Math.min(90, point.latitude + latitudeDelta)]
    .map((value) => value.toFixed(5)).join(",");
}

export function normalizeStations(data: unknown, point: Coordinates): Station[] {
  assertPoint(point);
  const collection = featureCollection(data);
  const stations: Station[] = [];
  for (const feature of collection.features as unknown[]) {
    if (!isRecord(feature) || !isRecord(feature.properties))
      throw new ClearPathDataError("invalid-response", "USGS station locations could not be verified.");
    const p = feature.properties;
    if (p.state_code !== "48" || p.site_type_code !== "ST") continue;
    const coordinates = pointGeometry(feature.geometry);
    if (!coordinates || !isText(feature.id) || !/^USGS-\d{8,15}$/.test(feature.id) ||
        !isText(p.monitoring_location_name))
      throw new ClearPathDataError("invalid-response", "USGS station locations could not be verified.");
    const distance = distanceKm(point, coordinates);
    if (distance > RIVER_RADIUS_KM) continue;
    stations.push({
      id: feature.id, name: p.monitoring_location_name, coordinates, distanceKm: distance,
      sourceUrl: `https://waterdata.usgs.gov/monitoring-location/${feature.id}/`,
    });
  }
  return stations;
}

function nextPage(data: Record<string, unknown>, collection: string): string | null {
  if (!Array.isArray(data.links)) return null;
  const next = data.links.find((link) => isRecord(link) && link.rel === "next");
  if (!isRecord(next) || !isText(next.href)) return null;
  const parsed = new URL(next.href, `${API}/${collection}/items`);
  if (parsed.origin !== "https://api.waterdata.usgs.gov" || parsed.pathname !== `/ogcapi/v1/collections/${collection}/items`)
    throw new ClearPathDataError("invalid-response", "USGS returned an unverified pagination link.");
  return parsed.toString();
}

async function discoverStations(point: Coordinates, signal?: AbortSignal): Promise<Station[]> {
  const key = `${point.latitude},${point.longitude}`;
  const cached = discoveryCache.get(key);
  if (cached && Date.now() - cached.at < 60 * 60_000) return cached.stations;
  const query = new URLSearchParams({
    f: "json", bbox: riverBoundingBox(point), state_code: "48", site_type_code: "ST", agency_code: "USGS",
    limit: "200", properties: "id,monitoring_location_name,state_code,site_type_code",
  });
  let url: string | null = `${API}/monitoring-locations/items?${query}`;
  const stations = new Map<string, Station>();
  let pages = 0;
  while (url) {
    if (++pages > 5) throw new ClearPathDataError("invalid-response", "Too many nearby USGS stations to verify in this request.");
    const data = featureCollection(await fetchJson(url, { signal, timeoutMs: 20_000, headers: { Accept: "application/geo+json" } }));
    for (const station of normalizeStations(data, point)) stations.set(station.id, station);
    url = nextPage(data, "monitoring-locations");
  }
  const nearby = [...stations.values()].sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))
    .slice(0, RIVER_STATION_LIMIT);
  if (discoveryCache.size >= 8) discoveryCache.delete(discoveryCache.keys().next().value!);
  discoveryCache.set(key, { at: Date.now(), stations: nearby });
  return nearby;
}

function measurement(p: Record<string, unknown>): RiverMeasurement | null {
  if (p.value === null || p.value === undefined || p.value === "") return null;
  if (typeof p.value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(p.value.trim()) ||
      !Number.isFinite(Number(p.value)) || !isText(p.unit_of_measure) || !validObservationTime(p.time)) return null;
  return {
    value: Number(p.value), displayValue: p.value, units: p.unit_of_measure, observedAt: p.time,
    approvalStatus: p.approval_status === "Approved" || p.approval_status === "Provisional" ? p.approval_status : "Unknown",
    qualifier: isText(p.qualifier) ? p.qualifier : null,
  };
}

export function joinRiverObservations(stations: readonly Station[], data: unknown): RiverGauge[] {
  const collection = featureCollection(data);
  const gauges = new Map(stations.map((station) => [station.id, { ...station, gageHeight: null, streamflow: null } as RiverGauge]));
  for (const feature of collection.features as unknown[]) {
    if (!isRecord(feature) || !isRecord(feature.properties))
      throw new ClearPathDataError("invalid-response", "USGS river observations could not be verified.");
    const p = feature.properties;
    const gauge = typeof p.monitoring_location_id === "string" ? gauges.get(p.monitoring_location_id) : null;
    // 00011 is the instantaneous statistic. Do not mix mean/min/max series.
    if (!gauge || p.statistic_id !== "00011" || (p.parameter_code !== "00060" && p.parameter_code !== "00065")) continue;
    const observed = measurement(p);
    if (!observed) continue;
    const field = p.parameter_code === "00065" ? "gageHeight" : "streamflow";
    const previous = gauge[field];
    if (!previous || Date.parse(observed.observedAt) > Date.parse(previous.observedAt)) gauge[field] = observed;
  }
  return [...gauges.values()];
}

export async function getNearbyRiverGauges(point: Coordinates, signal?: AbortSignal): Promise<UsgsSnapshot<RiverGauge>> {
  assertPoint(point);
  if (signal?.aborted) throw new ClearPathDataError("cancelled", "The request was cancelled.");
  const stations = await discoverStations(point, signal);
  const features: unknown[] = [];
  if (stations.length) {
    const query = new URLSearchParams({ f: "json", monitoring_location_id: stations.map((station) => station.id).join(","),
      parameter_code: "00060,00065", statistic_id: "00011", limit: "100" });
    let url: string | null = `${API}/latest-continuous/items?${query}`;
    let pages = 0;
    while (url) {
      if (++pages > 3) throw new ClearPathDataError("invalid-response", "USGS river observations were incomplete.");
      const data = featureCollection(await fetchJson(url, { signal, timeoutMs: 20_000, headers: { Accept: "application/geo+json" } }));
      features.push(...data.features as unknown[]);
      url = nextPage(data, "latest-continuous");
    }
  }
  return {
    items: joinRiverObservations(stations, { type: "FeatureCollection", features }),
    fetchedAt: new Date().toISOString(), generatedAt: null,
    coverage: `Up to ${RIVER_STATION_LIMIT} nearest USGS Texas stream stations within ${RIVER_RADIUS_KM} km. Missing readings are unavailable. Gage height is not flood depth; no flood-stage thresholds are inferred.`,
  };
}
