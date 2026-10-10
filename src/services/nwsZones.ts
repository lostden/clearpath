import { ClearPathDataError, parseRetryAfter } from "../data/http";
import type { AlertGeometry, GeoPosition } from "../domain/types";

export type NwsZoneType = "forecast" | "county" | "fire";
export type OfficialZoneBoundary = {
  url: string;
  id: string;
  name: string;
  zoneType: NwsZoneType;
  geometry: AlertGeometry;
  fetchedAt: string;
  /** Optional validity dates supplied by the zone endpoint, separate from CAP alert dates. */
  effectiveDate?: string;
  expirationDate?: string;
  /** Retained for at most 24 hours in RAM; unrelated to the warning's source. */
  cached: boolean;
};
export type ZoneBoundaryFailure = { url: string; reason: string; error: ClearPathDataError };
export type ZoneBoundaryResult = {
  boundaries: OfficialZoneBoundary[];
  requested: number;
  loaded: number;
  failed: number;
  notLoaded: number;
  reason?: string;
  failures: ZoneBoundaryFailure[];
  notLoadedUrls: string[];
  retryAfterMs?: number;
};

export const NWS_ZONE_LIMITS = {
  endpoints: 4,
  responseBytes: 1024 * 1024,
  batchBytes: 2 * 1024 * 1024,
  parts: 512,
  rings: 2048,
  vertices: 20_000,
  batchParts: 1024,
  batchVertices: 25_000,
  cacheEntries: 16,
  cacheBytes: 2 * 1024 * 1024,
  cacheAgeMs: 24 * 60 * 60_000,
} as const;

const URL_PATTERN = /^https:\/\/api\.weather\.gov\/zones\/(forecast|county|fire)\/([A-Z]{2}[CZ][0-9]{3})$/;
export function validNwsZoneUrl(value: unknown): value is string {
  return typeof value === "string" && URL_PATTERN.test(value);
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type CacheEntry = { boundary: OfficialZoneBoundary; bytes: number; weight: number; at: number; parts: number; vertices: number };
const memory = new Map<string, CacheEntry>();
let memoryWeight = 0;
let blockedUntil = 0;

class ZoneLimitError extends ClearPathDataError {
  readonly bytes: number;
  readonly batchLimit: boolean;
  constructor(message: string, bytes = 0, batchLimit = false) {
    super("invalid-response", message);
    this.bytes = bytes;
    this.batchLimit = batchLimit;
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ClearPathDataError("cancelled", "The request was cancelled.");
}

function validZoneTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6]) < 60 &&
    (match[7] === undefined || (Number(match[7]) < 24 && Number(match[8]) < 60));
}

function boundaryCurrent(value: { effectiveDate?: string; expirationDate?: string }, now = Date.now()): boolean {
  const effective = value.effectiveDate === undefined ? null : Date.parse(value.effectiveDate);
  const expiration = value.expirationDate === undefined ? null : Date.parse(value.expirationDate);
  return (effective === null || effective <= now) && (expiration === null || expiration > now) &&
    (effective === null || expiration === null || expiration > effective);
}

/** Count UTF-8 without depending on TextEncoder availability on native runtimes. */
function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

async function zoneText(url: string, remaining: number, signal?: AbortSignal): Promise<{ text: string; bytes: number }> {
  checkAbort(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json", "User-Agent": "ClearPath/0.1 (student emergency information app)" },
      redirect: "error",
    });
    if (!response.ok) throw new ClearPathDataError("http", `The weather service returned HTTP ${response.status}.`, {
      status: response.status, retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
    });
    if (response.url && response.url !== url)
      throw new ClearPathDataError("invalid-response", "The zone endpoint returned an unexpected identity.");
    const lengthHeader = response.headers.get("Content-Length");
    const declared = lengthHeader && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null;
    if (declared !== null && declared > Math.min(NWS_ZONE_LIMITS.responseBytes, remaining)) {
      controller.abort();
      throw new ZoneLimitError("The zone response exceeds the permitted data size.", 0, declared <= NWS_ZONE_LIMITS.responseBytes);
    }
    // Native fetch may buffer a response before text() resolves. These are
    // acceptance limits, not a promise about compressed bytes on the wire.
    const text = await response.text();
    checkAbort(signal);
    if (controller.signal.aborted) throw new Error("Request aborted while reading the zone.");
    const bytes = utf8Bytes(text);
    if (bytes > NWS_ZONE_LIMITS.responseBytes || bytes > remaining)
      throw new ZoneLimitError("The zone response exceeds the permitted data size.", bytes, bytes > remaining);
    return { text, bytes };
  } catch (error) {
    controller.abort();
    checkAbort(signal);
    if (timedOut) throw new ClearPathDataError("timeout", "The zone service did not respond in time.");
    if (error instanceof ClearPathDataError) throw error;
    throw new ClearPathDataError("network", "Unable to connect to the zone service.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

function zoneGeometry(value: unknown): { geometry: AlertGeometry; parts: number; vertices: number; rings: number } {
  if (!record(value) || (value.type !== "Polygon" && value.type !== "MultiPolygon"))
    throw new ClearPathDataError("invalid-response", "The zone boundary has no verified polygon geometry.");
  const polygons: unknown = value.type === "Polygon" ? [value.coordinates] : value.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0)
    throw new ClearPathDataError("invalid-response", "The zone boundary has invalid polygon geometry.");
  if (polygons.length > NWS_ZONE_LIMITS.parts)
    throw new ZoneLimitError("The zone boundary exceeds the polygon part limit.");
  let vertices = 0;
  let rings = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0)
      throw new ClearPathDataError("invalid-response", "The zone boundary has an invalid polygon.");
    rings += polygon.length;
    if (rings > NWS_ZONE_LIMITS.rings) throw new ZoneLimitError("The zone boundary exceeds the ring limit.");
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4)
        throw new ClearPathDataError("invalid-response", "The zone boundary has an invalid ring.");
      vertices += ring.length;
      if (vertices > NWS_ZONE_LIMITS.vertices) throw new ZoneLimitError("The zone boundary exceeds the vertex limit.");
      for (const position of ring) {
        if (!Array.isArray(position) || position.length !== 2 ||
            typeof position[0] !== "number" || !Number.isFinite(position[0]) || Math.abs(position[0]) > 180 ||
            typeof position[1] !== "number" || !Number.isFinite(position[1]) || Math.abs(position[1]) > 90)
          throw new ClearPathDataError("invalid-response", "The zone boundary contains an invalid coordinate.");
      }
      const first = ring[0] as GeoPosition;
      const last = ring[ring.length - 1] as GeoPosition;
      if (first[0] !== last[0] || first[1] !== last[1])
        throw new ClearPathDataError("invalid-response", "The zone boundary contains an open ring.");
    }
  }
  return { geometry: value as AlertGeometry, parts: polygons.length, vertices, rings };
}

function boundary(data: unknown, url: string): { boundary: OfficialZoneBoundary; parts: number; vertices: number; rings: number } {
  const match = URL_PATTERN.exec(url)!;
  const zoneType = match[1] as NwsZoneType;
  const id = match[2];
  if (!record(data) || data.type !== "Feature" || data.id !== url || !record(data.properties))
    throw new ClearPathDataError("invalid-response", "The zone Feature identity could not be verified.");
  const p = data.properties;
  if (p.id !== id || (p["@id"] !== undefined && p["@id"] !== url) ||
      !(p.type === zoneType || (zoneType === "forecast" && p.type === "public")) ||
      typeof p.name !== "string" || !p.name.trim())
    throw new ClearPathDataError("invalid-response", "The zone identity or type could not be verified.");
  if ((p.effectiveDate !== undefined && !validZoneTimestamp(p.effectiveDate)) ||
      (p.expirationDate !== undefined && !validZoneTimestamp(p.expirationDate)))
    throw new ClearPathDataError("invalid-response", "The zone validity dates could not be verified.");
  const dates = {
    ...(p.effectiveDate !== undefined ? { effectiveDate: p.effectiveDate as string } : {}),
    ...(p.expirationDate !== undefined ? { expirationDate: p.expirationDate as string } : {}),
  };
  if (!boundaryCurrent(dates))
    throw new ClearPathDataError("invalid-response", "The zone boundary is not currently effective or has expired.");
  const parsed = zoneGeometry(data.geometry);
  return { ...parsed, boundary: { url, id, name: p.name, zoneType, geometry: parsed.geometry, fetchedAt: new Date().toISOString(), cached: false, ...dates } };
}

function removeEntry(url: string): void {
  const existing = memory.get(url);
  if (existing) memoryWeight -= existing.weight;
  memory.delete(url);
}
function pruneCache(): void {
  for (const [url, entry] of memory) {
    const age = Date.now() - entry.at;
    if (age < 0 || age >= NWS_ZONE_LIMITS.cacheAgeMs || !boundaryCurrent(entry.boundary)) removeEntry(url);
  }
}
function remember(entry: CacheEntry): void {
  removeEntry(entry.boundary.url);
  if (entry.weight > NWS_ZONE_LIMITS.cacheBytes) return;
  while (memory.size >= NWS_ZONE_LIMITS.cacheEntries || memoryWeight + entry.weight > NWS_ZONE_LIMITS.cacheBytes)
    removeEntry(memory.keys().next().value!);
  memory.set(entry.boundary.url, entry);
  memoryWeight += entry.weight;
}

/** Explicit individual lookups only. No auto fetch, disk cache, retry loop, or alert-geometry substitution. */
export async function getNwsZoneBoundaries(urls: readonly string[], signal?: AbortSignal): Promise<ZoneBoundaryResult> {
  checkAbort(signal);
  pruneCache();
  const requested = [...new Set(urls)];
  const result: ZoneBoundaryResult = { boundaries: [], requested: requested.length, loaded: 0, failed: 0, notLoaded: 0, failures: [], notLoadedUrls: [] };
  let slots = 0;
  let received = 0;
  let accepted = 0;
  let parts = 0;
  let vertices = 0;
  let batchLimited = false;
  for (const url of requested) {
    checkAbort(signal);
    if (!validNwsZoneUrl(url)) {
      const error = new ClearPathDataError("invalid-response", "Only an exact official NWS zone URL may be requested.");
      result.failures.push({ url, reason: error.message, error });
      continue;
    }
    if (slots >= NWS_ZONE_LIMITS.endpoints || batchLimited) {
      result.notLoadedUrls.push(url);
      continue;
    }
    slots += 1;
    let cached = memory.get(url);
    if (cached && !boundaryCurrent(cached.boundary)) { removeEntry(url); cached = undefined; }
    if (!cached && Date.now() < blockedUntil) {
      result.notLoadedUrls.push(url);
      continue;
    }
    try {
      let entry = cached;
      if (!entry) {
        const response = await zoneText(url, Math.min(NWS_ZONE_LIMITS.batchBytes - received, NWS_ZONE_LIMITS.batchBytes - accepted), signal);
        received += response.bytes;
        let data: unknown;
        try { data = JSON.parse(response.text); }
        catch { throw new ClearPathDataError("invalid-response", "The zone service returned unreadable information."); }
        const parsed = boundary(data, url);
        checkAbort(signal);
        entry = {
          boundary: parsed.boundary, bytes: response.bytes, parts: parsed.parts, vertices: parsed.vertices, at: Date.now(),
          // Account conservatively for parsed arrays as well as the JSON bytes.
          weight: Math.max(response.bytes, parsed.vertices * 64 + parsed.rings * 96 + parsed.parts * 128 + utf8Bytes(parsed.boundary.name) * 2 + 512),
        };
        remember(entry);
      }
      if (!boundaryCurrent(entry.boundary)) {
        removeEntry(url);
        throw new ClearPathDataError("invalid-response", "The zone boundary expired before the request finished.");
      }
      if (accepted + entry.bytes > NWS_ZONE_LIMITS.batchBytes || parts + entry.parts > NWS_ZONE_LIMITS.batchParts || vertices + entry.vertices > NWS_ZONE_LIMITS.batchVertices) {
        batchLimited = true;
        result.notLoadedUrls.push(url);
        continue;
      }
      accepted += entry.bytes;
      parts += entry.parts;
      vertices += entry.vertices;
      if (cached) { memory.delete(url); memory.set(url, entry); }
      result.boundaries.push({ ...entry.boundary, cached: !!cached });
    } catch (cause) {
      checkAbort(signal);
      const error = cause instanceof ClearPathDataError ? cause : new ClearPathDataError("invalid-response", "The zone boundary could not be verified.");
      if (error instanceof ZoneLimitError) {
        received += error.bytes;
        batchLimited ||= error.batchLimit || received >= NWS_ZONE_LIMITS.batchBytes;
      }
      if (error.kind === "http" && (error.status === 429 || error.retryAfterMs !== undefined))
        blockedUntil = Math.max(blockedUntil, Date.now() + (error.retryAfterMs ?? 30_000));
      result.failures.push({ url, reason: error.message, error });
    }
  }
  checkAbort(signal);
  result.boundaries = result.boundaries.filter((item) => {
    if (boundaryCurrent(item)) return true;
    removeEntry(item.url);
    const error = new ClearPathDataError("invalid-response", "The zone boundary expired before the request finished.");
    result.failures.push({ url: item.url, reason: error.message, error });
    return false;
  });
  result.loaded = result.boundaries.length;
  result.failed = result.failures.length;
  result.notLoaded = result.notLoadedUrls.length;
  if (Date.now() < blockedUntil) {
    result.retryAfterMs = blockedUntil - Date.now();
    result.reason = "The weather service requested a pause. Remaining uncached boundaries were not downloaded.";
  } else if (batchLimited) result.reason = "The boundary data or geometry budget was reached. Some zones were not loaded.";
  else if (result.notLoaded) result.reason = "Up to four zones are loaded per request. Remaining boundaries were not downloaded.";
  else if (result.failed) result.reason = "Some zone boundaries could not be verified. Read the original warning for affected areas.";
  return result;
}
