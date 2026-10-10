import { ClearPathDataError, parseRetryAfter } from "../data/http";
import type { AlertGeometry, GeoPosition } from "../domain/types";
import type { OfficialWildfirePerimeter, WildfireCoverage, WildfireSnapshot } from "./wildfireTypes";

export const NIFC_PERIMETER_LAYER_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0";
export const WILDFIRE_LIMITS = {
  pages: 4, pageRecords: 5, responseBytes: 1024 * 1024, batchBytes: 2 * 1024 * 1024,
  parts: 512, rings: 2048, vertices: 25_000,
  batchParts: 1024, batchRings: 4096, batchVertices: 50_000,
  timeoutMs: 12_000,
} as const;

const CATEGORY = "Wildfire Daily Fire Perimeter";
const FIELDS = ["OBJECTID", "GlobalID", "poly_IncidentName", "attr_IncidentName", "poly_FeatureCategory", "poly_MapMethod", "poly_DateCurrent", "poly_PolygonDateTime", "attr_ModifiedOnDateTime_dt", "poly_GISAcres", "attr_IncidentSize", "attr_POOState", "attr_IncidentTypeCategory", "attr_IrwinID", "poly_IRWINID", "attr_PercentContained"].join(",");
const GUID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\})$/i;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const invalid = (message: string) => new ClearPathDataError("invalid-response", message);

/** Size/geometry rejection is distinguishable from a provider outage. No geometry is simplified. */
export class WildfireLimitError extends ClearPathDataError {
  readonly limit: "response-bytes" | "batch-bytes" | "parts" | "rings" | "vertices";
  constructor(limit: WildfireLimitError["limit"]) {
    super("invalid-response", `The wildfire ${limit} acceptance limit was reached.`);
    this.limit = limit;
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ClearPathDataError("cancelled", "The request was cancelled.");
}

/** Native runtimes need not provide TextEncoder. Count UTF-8 before JSON parsing. */
function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function queryUrl(coverage: WildfireCoverage, offset?: number): string {
  const url = new URL(`${NIFC_PERIMETER_LAYER_URL}/query`);
  const where = `attr_IncidentTypeCategory='WF' AND poly_FeatureCategory='${CATEGORY}'${coverage === "TX" ? " AND attr_POOState='US-TX'" : ""}`;
  url.searchParams.set("where", where);
  if (offset === undefined) {
    url.searchParams.set("f", "json");
    url.searchParams.set("returnCountOnly", "true");
  } else {
    url.searchParams.set("f", "geojson");
    url.searchParams.set("outFields", FIELDS);
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(WILDFIRE_LIMITS.pageRecords));
    url.searchParams.set("orderByFields", "poly_DateCurrent DESC,OBJECTID ASC");
  }
  return url.toString();
}

async function boundedJson(url: string, remaining: number, signal?: AbortSignal): Promise<{ data: unknown; bytes: number }> {
  checkAbort(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, WILDFIRE_LIMITS.timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/geo+json, application/json" }, redirect: "error" });
    const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
    if (!response.ok) throw new ClearPathDataError("http", `The wildfire service returned HTTP ${response.status}.`, { status: response.status, retryAfterMs });
    if (response.url) {
      const identity = new URL(response.url);
      const expected = new URL(url);
      if (identity.origin !== expected.origin || identity.pathname !== expected.pathname)
        throw invalid("The wildfire response came from an unexpected endpoint.");
    }
    const header = response.headers.get("Content-Length");
    const declared = header !== null && /^\d+$/.test(header) ? Number(header) : null;
    if (declared !== null && declared > Math.min(WILDFIRE_LIMITS.responseBytes, remaining)) {
      controller.abort();
      throw new WildfireLimitError(declared > WILDFIRE_LIMITS.responseBytes ? "response-bytes" : "batch-bytes");
    }
    // RN fetch may buffer text before this resolves. These cap accepted response
    // data, not compressed transfer bytes or the network's buffering behavior.
    const text = await response.text();
    checkAbort(signal);
    if (controller.signal.aborted) throw new Error("Aborted while reading wildfire data.");
    const bytes = utf8Bytes(text);
    if (bytes > WILDFIRE_LIMITS.responseBytes) throw new WildfireLimitError("response-bytes");
    if (bytes > remaining) throw new WildfireLimitError("batch-bytes");
    let data: unknown;
    try { data = JSON.parse(text); }
    catch { throw invalid("The wildfire service returned unreadable information."); }
    if (record(data) && data.error !== undefined) {
      if (record(data.error) && Number.isInteger(data.error.code) && Number(data.error.code) >= 400 && Number(data.error.code) <= 599)
        throw new ClearPathDataError("http", `The wildfire service reported error ${data.error.code}.`, { status: Number(data.error.code), retryAfterMs });
      throw invalid("The wildfire service reported an unverified ArcGIS error.");
    }
    checkAbort(signal);
    return { data, bytes };
  } catch (error) {
    controller.abort();
    checkAbort(signal);
    if (timedOut) throw new ClearPathDataError("timeout", "The wildfire service did not respond in time.");
    if (error instanceof ClearPathDataError) throw error;
    throw new ClearPathDataError("network", "Unable to connect to the wildfire service.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

type GeometryStats = { geometry: AlertGeometry; parts: number; rings: number; vertices: number };
function exactGeometry(value: unknown): GeometryStats {
  if (!record(value) || (value.type !== "Polygon" && value.type !== "MultiPolygon")) throw invalid("The mapped perimeter has no verified polygon geometry.");
  const polygons: unknown = value.type === "Polygon" ? [value.coordinates] : value.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) throw invalid("The mapped perimeter has invalid geometry.");
  if (polygons.length > WILDFIRE_LIMITS.parts) throw new WildfireLimitError("parts");
  let rings = 0;
  let vertices = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw invalid("The mapped perimeter has an invalid polygon.");
    rings += polygon.length;
    if (rings > WILDFIRE_LIMITS.rings) throw new WildfireLimitError("rings");
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw invalid("The mapped perimeter has an invalid ring.");
      vertices += ring.length;
      if (vertices > WILDFIRE_LIMITS.vertices) throw new WildfireLimitError("vertices");
      for (const position of ring) {
        if (!Array.isArray(position) || position.length !== 2 || typeof position[0] !== "number" || !Number.isFinite(position[0]) || Math.abs(position[0]) > 180 || typeof position[1] !== "number" || !Number.isFinite(position[1]) || Math.abs(position[1]) > 90)
          throw invalid("The mapped perimeter contains an invalid coordinate.");
      }
      const first = ring[0] as GeoPosition;
      const last = ring[ring.length - 1] as GeoPosition;
      if (first[0] !== last[0] || first[1] !== last[1]) throw invalid("The mapped perimeter contains an open ring.");
    }
  }
  return { geometry: value as AlertGeometry, parts: polygons.length, rings, vertices };
}

function optionalText(value: unknown, max = 256): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max || !value.trim()) throw invalid("The perimeter's text fields could not be verified.");
  return value;
}
function optionalNumber(value: unknown, max = Number.MAX_VALUE): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw invalid("The perimeter's numeric fields could not be verified.");
  return value;
}
function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > Date.now() + 5 * 60_000) throw invalid("The perimeter's source timestamps could not be verified.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw invalid("The perimeter's source timestamps could not be verified.");
  return date.toISOString();
}

function perimeter(value: unknown, coverage: WildfireCoverage): { item: OfficialWildfirePerimeter; stats: GeometryStats } {
  if (!record(value) || value.type !== "Feature" || !record(value.properties)) throw invalid("The perimeter Feature could not be verified.");
  const p = value.properties;
  if (p.attr_IncidentTypeCategory !== "WF" || p.poly_FeatureCategory !== CATEGORY || (coverage === "TX" && p.attr_POOState !== "US-TX")) throw invalid("The perimeter does not match the requested wildfire coverage.");
  if (!Number.isSafeInteger(p.OBJECTID) || Number(p.OBJECTID) < 0 || (value.id !== undefined && value.id !== p.OBJECTID) || typeof p.GlobalID !== "string" || !GUID.test(p.GlobalID)) throw invalid("The perimeter identity could not be verified.");
  const name = optionalText(p.poly_IncidentName) ?? optionalText(p.attr_IncidentName);
  if (!name) throw invalid("The mapped perimeter has no verified fire name.");
  const incidentId = optionalText(p.poly_IRWINID) ?? optionalText(p.attr_IrwinID);
  if (incidentId !== null && !GUID.test(incidentId)) throw invalid("The perimeter incident identity could not be verified.");
  const stats = exactGeometry(value.geometry);
  const objectId = Number(p.OBJECTID);
  return { stats, item: {
    id: p.GlobalID, objectId, incidentId, name, geometry: stats.geometry,
    capturedAt: optionalDate(p.poly_PolygonDateTime), polygonUpdatedAt: optionalDate(p.poly_DateCurrent), incidentUpdatedAt: optionalDate(p.attr_ModifiedOnDateTime_dt),
    acres: optionalNumber(p.poly_GISAcres), reportedAcres: optionalNumber(p.attr_IncidentSize), percentContained: optionalNumber(p.attr_PercentContained, 100),
    state: optionalText(p.attr_POOState, 64), mapMethod: optionalText(p.poly_MapMethod, 128), featureCategory: CATEGORY, sourceUrl: `${NIFC_PERIMETER_LAYER_URL}/${objectId}`,
  } };
}

function collection(value: unknown): { features: unknown[]; more: boolean } {
  if (!record(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features) || value.features.length > WILDFIRE_LIMITS.pageRecords) throw invalid("The wildfire service returned an invalid or oversized collection.");
  if (value.crs !== undefined && (!record(value.crs) || value.crs.type !== "name" || !record(value.crs.properties) || !["EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84", "urn:ogc:def:crs:EPSG::4326"].includes(String(value.crs.properties.name)))) throw invalid("The wildfire coordinate reference could not be verified.");
  if (value.properties !== undefined && !record(value.properties)) throw invalid("The wildfire collection metadata could not be verified.");
  const nested = record(value.properties) ? value.properties.exceededTransferLimit : undefined;
  const top = value.exceededTransferLimit;
  if ((nested !== undefined && typeof nested !== "boolean") || (top !== undefined && typeof top !== "boolean") || (nested !== undefined && top !== undefined && nested !== top)) throw invalid("The wildfire transfer-limit status could not be verified.");
  return { features: value.features, more: nested === true || top === true };
}

/** Anonymous, bounded lookups only; the caller owns scheduling, retries, and RAM retention. */
export async function getWildfirePerimeters(coverage: WildfireCoverage, signal?: AbortSignal): Promise<WildfireSnapshot> {
  checkAbort(signal);
  if (coverage !== "TX" && coverage !== "US") throw invalid("Choose Texas or United States wildfire coverage.");
  let bytes = 0;
  let available: number | null = null;
  let countedAt: string | null = null;
  let countError: ClearPathDataError | null = null;
  const reasons = new Set<string>();
  try {
    const response = await boundedJson(queryUrl(coverage), WILDFIRE_LIMITS.batchBytes, signal);
    bytes += response.bytes;
    if (!record(response.data) || !Number.isSafeInteger(response.data.count) || Number(response.data.count) < 0) throw invalid("The mapped-perimeter count could not be verified.");
    available = Number(response.data.count);
    countedAt = new Date().toISOString();
  } catch (cause) {
    checkAbort(signal);
    const error = cause instanceof ClearPathDataError ? cause : invalid("The mapped-perimeter count could not be verified.");
    if (error.kind === "cancelled" || error.status === 429 || error.retryAfterMs !== undefined) throw error;
    countError = error;
    reasons.add("The matching mapped-perimeter count could not be verified.");
  }
  const items: OfficialWildfirePerimeter[] = [];
  const ids = new Set<string>();
  let returned = 0;
  let parts = 0;
  let rings = 0;
  let vertices = 0;
  let more = false;
  let retryAfterMs: number | undefined;
  for (let page = 0; page < WILDFIRE_LIMITS.pages; page += 1) {
    checkAbort(signal);
    try {
      const response = await boundedJson(queryUrl(coverage, page * WILDFIRE_LIMITS.pageRecords), WILDFIRE_LIMITS.batchBytes - bytes, signal);
      bytes += response.bytes;
      const parsed = collection(response.data);
      returned += parsed.features.length;
      more = parsed.more;
      if (more && parsed.features.length === 0) throw invalid("The wildfire service reported more records without a usable page.");
      for (const feature of parsed.features) {
        checkAbort(signal);
        try {
          const parsed = perimeter(feature, coverage);
          const identity = parsed.item.id.replace(/[{}]/g, "").toLowerCase();
          if (ids.has(identity)) { reasons.add("Repeated records were omitted because the paged dataset changed."); continue; }
          if (parts + parsed.stats.parts > WILDFIRE_LIMITS.batchParts || rings + parsed.stats.rings > WILDFIRE_LIMITS.batchRings || vertices + parsed.stats.vertices > WILDFIRE_LIMITS.batchVertices) {
            reasons.add("Some whole perimeters were omitted at the batch geometry limit.");
            continue;
          }
          ids.add(identity);
          parts += parsed.stats.parts;
          rings += parsed.stats.rings;
          vertices += parsed.stats.vertices;
          items.push(parsed.item);
        } catch (cause) {
          checkAbort(signal);
          reasons.add(cause instanceof WildfireLimitError ? "Some whole perimeters exceeded geometry limits and were omitted." : "Some mapped records could not be verified and were omitted.");
        }
      }
      if (!more) break;
      if (page === WILDFIRE_LIMITS.pages - 1) reasons.add("Only the first 20 mapped records were requested; additional records were omitted.");
    } catch (cause) {
      checkAbort(signal);
      const error = cause instanceof ClearPathDataError ? cause : invalid("The wildfire page could not be verified.");
      if (error.kind === "cancelled" || items.length === 0) throw error;
      if (error.status === 429 || error.retryAfterMs !== undefined) retryAfterMs = error.retryAfterMs ?? 30_000;
      reasons.add(error instanceof WildfireLimitError ? "Further pages were omitted at the accepted response-data limit." : "A later page failed; only previously verified mapped perimeters are shown.");
      more = true;
      break;
    }
  }
  checkAbort(signal);
  if (items.length === 0 && (countError || returned > 0 || available !== 0 || more)) throw countError ?? invalid("No mapped perimeter could be verified; this is not a confirmed empty result.");
  if (available !== null && (returned > available || (!more && returned < available)))
    reasons.add("The count and returned records differ; the published dataset can change between requests.");
  else if (available !== null && available > items.length)
    reasons.add("Not all matching mapped records are included in this copy.");
  const omitted = available === null ? null : Math.max(0, available - items.length);
  const truncated = reasons.size > 0 || more || omitted === null || omitted > 0;
  return { items, coverage, fetchedAt: new Date().toISOString(), available, countedAt, returned, omitted, truncated, reason: reasons.size ? [...reasons].join(" ") : null, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };
}
