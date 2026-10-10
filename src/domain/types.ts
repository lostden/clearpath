/** Domain models are independent of the provider's GeoJSON response. */
export type Coordinates = { latitude: number; longitude: number };

export type SelectedLocation = {
  label: string;
  coordinates: Coordinates;
  kind: "manual" | "gps";
};

/** GeoJSON positions use longitude first, unlike native map coordinates. */
export type GeoPosition = [longitude: number, latitude: number];
export type AlertGeometry =
  | { type: "Polygon"; coordinates: GeoPosition[][] }
  | { type: "MultiPolygon"; coordinates: GeoPosition[][][] };

export type AlertSeverity =
  | "Extreme"
  | "Severe"
  | "Moderate"
  | "Minor"
  | "Unknown";
export type AlertUrgency =
  | "Immediate"
  | "Expected"
  | "Future"
  | "Past"
  | "Unknown";
export type AlertCertainty =
  | "Observed"
  | "Likely"
  | "Possible"
  | "Unlikely"
  | "Unknown";
export type AlertMessageType = "Alert" | "Update" | "Cancel" | "Ack" | "Error";

export type OfficialAlert = {
  id: string;
  event: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  certainty: AlertCertainty;
  onset: string | null;
  expires: string;
  sent: string;
  agency: string;
  /** Null in demo fixtures: a simulation never links to a fabricated warning. */
  sourceUrl: string | null;
  geometry: AlertGeometry | null;
  /** Optional provider links for separately requested administrative boundaries. */
  affectedZones?: string[];
  messageType: AlertMessageType;
  /** Provider message identifiers and URLs that an update/cancellation replaces. */
  references: string[];
};

export type AlertSnapshot = {
  source: "live" | "cached" | "demo";
  alerts: OfficialAlert[];
  fetchedAt: string;
  locationKey: string;
};

export type DemoScenario = "flood" | "tornado" | "normal" | "offline";
