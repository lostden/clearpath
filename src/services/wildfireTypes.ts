import type { AlertGeometry } from "../domain/types";

export type WildfireCoverage = "TX" | "US";

/** A supplied NIFC mapped perimeter; never a current fire edge or evacuation area. */
export type OfficialWildfirePerimeter = {
  id: string;
  objectId: number;
  incidentId: string | null;
  name: string;
  geometry: AlertGeometry;
  /** Polygon capture time only; missing capture time stays unknown. */
  capturedAt: string | null;
  polygonUpdatedAt: string | null;
  incidentUpdatedAt: string | null;
  /** Mapped polygon acreage, separate from the incident's reported size. */
  acres: number | null;
  reportedAcres: number | null;
  percentContained: number | null;
  state: string | null;
  mapMethod: string | null;
  featureCategory: "Wildfire Daily Fire Perimeter";
  sourceUrl: string;
};

export type WildfireSnapshot = {
  items: OfficialWildfirePerimeter[];
  /** TX identifies incidents reported in Texas, not bounding-box intersections. */
  coverage: WildfireCoverage;
  fetchedAt: string;
  /** Matching mapped records at countedAt; never the number of all fires. */
  available: number | null;
  countedAt: string | null;
  /** Raw records received, including ones omitted after validation. */
  returned: number;
  omitted: number | null;
  truncated: boolean;
  reason: string | null;
  /** A server-requested pause after a later page failed; accepted items remain partial. */
  retryAfterMs?: number;
};
