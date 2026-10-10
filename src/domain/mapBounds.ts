import type { AlertGeometry, Coordinates } from "./types";

export type MapRegion = Coordinates & { latitudeDelta: number; longitudeDelta: number };

export function pointInRegion(point: Coordinates, region: MapRegion): boolean {
  const longitudeDistance = Math.abs(((point.longitude - region.longitude + 540) % 360) - 180);
  return Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
    longitudeDistance <= region.longitudeDelta / 2;
}

/** Culls offscreen overlays only; it does not infer whether an alert applies to a person. */
export function geometryIntersectsRegion(geometry: AlertGeometry, region: MapRegion): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => {
    const ring = rings[0];
    if (!ring?.length) return false;
    const latitudes = ring.map((position) => position[1]);
    if (Math.max(...latitudes) < region.latitude - region.latitudeDelta / 2 ||
      Math.min(...latitudes) > region.latitude + region.latitudeDelta / 2) return false;
    const longitudes = ring.map((position) => ((position[0] - region.longitude + 540) % 360) - 180);
    // Keep an antimeridian-spanning area rather than accidentally culling it.
    if (Math.max(...longitudes) - Math.min(...longitudes) > 180) return true;
    return Math.max(...longitudes) >= -region.longitudeDelta / 2 &&
      Math.min(...longitudes) <= region.longitudeDelta / 2;
  });
}

/** Fits supplied outlines only. The center is a viewport anchor, never a device location. */
export function fitMapGeometries(geometries: AlertGeometry[]): { point: Coordinates; span: number } | null {
  const positions = geometries.flatMap((geometry) =>
    (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flatMap((rings) => rings[0] ?? []),
  );
  if (!positions.length) return null;
  const latitudes = positions.map((position) => position[1]);
  const longitudes = positions.map((position) => (position[0] + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1;
  let start = longitudes[0];
  for (let index = 0; index < longitudes.length; index += 1) {
    const next = index + 1 < longitudes.length ? longitudes[index + 1] : longitudes[0] + 360;
    const gap = next - longitudes[index];
    if (gap > largestGap) {
      largestGap = gap;
      start = next % 360;
    }
  }
  const longitudeSpan = 360 - largestGap;
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  return {
    point: { latitude: (south + north) / 2, longitude: ((start + longitudeSpan / 2 + 180) % 360) - 180 },
    span: Math.min(360, Math.max(0.02, longitudeSpan, north - south) * 1.2),
  };
}
