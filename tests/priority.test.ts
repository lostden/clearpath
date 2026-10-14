import { describe, expect, test } from "@jest/globals";
import type { OfficialAlert } from "../src/domain/types";
import {
  prioritizeWarnings,
  type PriorityContext,
} from "../src/student/priority";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

const context: PriorityContext = {
  point: { latitude: 33.1507, longitude: -96.8236 },
  now: TEST_NOW,
  source: "live",
  applicability: "nws-point",
};

function warning(id: string, overrides: Partial<OfficialAlert> = {}) {
  return officialAlert({
    id,
    sourceUrl: `https://api.weather.gov/alerts/${id}`,
    ...overrides,
  });
}

function ids(alerts: readonly OfficialAlert[], value = context) {
  return prioritizeWarnings(alerts, value).map(({ alert }) => alert.id);
}

function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

describe("explainable warning display order", () => {
  test("immediate urgency leads even when an expected warning is more severe and certain", () => {
    const expected = warning("expected", {
      urgency: "Expected", severity: "Extreme", certainty: "Observed",
    });
    const immediate = warning("immediate", {
      urgency: "Immediate", severity: "Moderate", certainty: "Possible",
    });
    expect(ids([expected, immediate])).toEqual(["immediate", "expected"]);
    const first = prioritizeWarnings([expected, immediate], context)[0];
    expect(first.explanation).toMatch(/shown first.*urgency/i);
    expect(first.explanation).toContain("Immediate");
    expect(first.explanation).toMatch(/display order.*personal danger/i);
  });

  test("equal urgency uses severity before certainty without hiding either warning", () => {
    expect(ids([
      warning("observed-minor", { severity: "Minor", certainty: "Observed" }),
      warning("possible-severe", { severity: "Severe", certainty: "Possible" }),
    ])).toEqual(["possible-severe", "observed-minor"]);
    expect(prioritizeWarnings([
      warning("observed-minor", { severity: "Minor" }),
      warning("possible-severe", { certainty: "Possible" }),
    ], context)[0].explanation).toMatch(/shown first.*severity/i);
  });

  test("equal urgency and severity use certainty before newest issuance", () => {
    const likely = warning("likely-newer", { certainty: "Likely", sent: "2026-10-09T18:55:00Z" });
    const observed = warning("observed-older", { certainty: "Observed", sent: "2026-10-09T18:30:00Z" });
    expect(ids([likely, observed])).toEqual(["observed-older", "likely-newer"]);
    expect(prioritizeWarnings([likely, observed], context)[0].explanation).toMatch(/shown first.*certainty/i);
  });

  test("each known urgency has an explicit position and unknown remains visible", () => {
    expect(ids([
      warning("unknown", { urgency: "Unknown" }),
      warning("past", { urgency: "Past" }),
      warning("future", { urgency: "Future" }),
      warning("expected", { urgency: "Expected" }),
      warning("immediate", { urgency: "Immediate" }),
    ])).toEqual(["immediate", "expected", "future", "past", "unknown"]);
  });

  test("unknown and missing runtime classifications stay visible without becoming low danger", () => {
    const unknown = warning("unknown", { urgency: "Unknown", severity: "Unknown", certainty: "Unknown" });
    const incomplete = warning("incomplete");
    delete (incomplete as Partial<OfficialAlert>).urgency;
    Object.assign(incomplete, { severity: "unexpected", certainty: null });
    const output = prioritizeWarnings([unknown, incomplete, warning("known", { urgency: "Past", severity: "Minor", certainty: "Unlikely" })], context);
    expect(output.map(({ alert }) => alert.id)).toEqual(["known", "incomplete", "unknown"]);
    for (const row of output.slice(1)) {
      expect(row.explanation).toMatch(/unknown.*does not mean low danger/i);
      expect(row.explanation).toMatch(/urgency.*unknown.*severity.*unknown.*certainty.*unknown/i);
    }
    expect(output[1].alert).toBe(incomplete);
    expect(incomplete.severity).toBe("unexpected");
  });

  test("frozen shuffled inputs produce the same ordering and preserve original source objects", () => {
    const expected = warning("expected", { urgency: "Expected" });
    const immediate = warning("immediate", { geometry: {
      type: "Polygon", coordinates: [[[-97, 33], [-96, 33], [-96, 34], [-97, 33]]],
    } });
    const alerts = freezeTree([expected, immediate]);
    const frozenContext = freezeTree({ ...context, point: { ...context.point } });
    const first = prioritizeWarnings(alerts, frozenContext);
    const shuffled = prioritizeWarnings(freezeTree([immediate, expected]), frozenContext);
    expect(first).toEqual(shuffled);
    expect(first.map(({ alert }) => alert)).toEqual([immediate, expected]);
    expect(first[0].alert).toBe(immediate);
    expect(first[0].alert.instruction).toBe("Original official instruction.\nSecond line.");
    expect(first[0].alert.description).toBe("Official description.\nOriginal line breaks.");
    expect(alerts).toEqual([expected, immediate]);
  });

  test("equal classifications prefer newest sent timestamp even with time-zone equivalents", () => {
    const older = warning("older", { sent: "2026-10-09T13:30:00-05:00" });
    const newer = warning("newer", { sent: "2026-10-09T18:45:00Z" });
    expect(ids([older, newer])).toEqual(["newer", "older"]);
    expect(prioritizeWarnings([older, newer], context)[0].explanation).toMatch(/shown first.*newer issue/i);
  });

  test("equal sent instants use stable identifiers rather than feed order", () => {
    const zulu = warning("zulu", { sent: "2026-10-09T13:30:00-05:00" });
    const alpha = warning("alpha", { sent: "2026-10-09T18:30:00Z" });
    expect(ids([zulu, alpha])).toEqual(["alpha", "zulu"]);
    expect(ids([alpha, zulu])).toEqual(["alpha", "zulu"]);
    expect(prioritizeWarnings([zulu, alpha], context)[0].explanation).toMatch(/shown first.*stable identifier/i);
  });
});

describe("lifecycle before ordering", () => {
  test("excludes expiration exactly at the clock while retaining a warning one millisecond later", () => {
    expect(ids([
      warning("expired", { expires: "2026-10-09T19:00:00Z" }),
      warning("current", { expires: "2026-10-09T19:00:00.001Z" }),
      warning("invalid-expiry", { expires: "invalid" }),
    ])).toEqual(["current"]);
  });

  test("newer duplicate content survives without inventing or rewriting source text", () => {
    const original = warning("same", { sent: "2026-10-09T18:00:00Z" });
    const newer = warning("same", { sent: "2026-10-09T18:45:00Z", instruction: "Updated official instruction" });
    expect(prioritizeWarnings([newer, original], context).map(({ alert }) => alert)).toEqual([newer]);
    expect(prioritizeWarnings([original, newer], context)[0].alert).toBe(newer);
  });

  test("conflicting duplicate copies with the same issue instant resolve consistently across refreshes", () => {
    const alpha = warning("same", { instruction: "Alpha official instruction" });
    const zulu = warning("same", { instruction: "Zulu official instruction" });
    const forward = prioritizeWarnings([alpha, zulu], context);
    const reversed = prioritizeWarnings([zulu, alpha], context);
    expect(forward).toEqual(reversed);
    expect(forward).toHaveLength(1);
    expect(forward[0].alert).toBe(alpha);
    expect(forward[0].explanation).toMatch(/conflicting.*issue time/i);
    expect(alpha.instruction).toBe("Alpha official instruction");
    expect(zulu.instruction).toBe("Zulu official instruction");
  });

  test("equivalent reference sets with different source array order do not reintroduce input-order ties", () => {
    const alpha = warning("same", { references: ["alpha", "zulu"] });
    const zulu = warning("same", { references: ["zulu", "alpha"] });
    const forward = prioritizeWarnings([alpha, zulu], context);
    const reverse = prioritizeWarnings([zulu, alpha], context);
    expect(forward).toEqual(reverse);
    expect(reverse[0].alert).toBe(alpha);
    expect(zulu.references).toEqual(["zulu", "alpha"]);
  });

  test("update references replace one warning without hiding an unrelated warning of the same event", () => {
    const old = warning("original");
    const unrelated = warning("unrelated");
    const update = warning("update", { sent: "2026-10-09T18:45:00Z", messageType: "Update", references: [old.sourceUrl!] });
    expect(ids([old, unrelated, update])).toEqual(["update", "unrelated"]);
  });

  test("issued cancellation removes only its reference even after the cancellation has expired", () => {
    const cancel = warning("cancel", { sent: "2026-10-09T18:45:00Z", expires: "2026-10-09T18:50:00Z", messageType: "Cancel", references: ["original"] });
    expect(ids([warning("original"), warning("unrelated"), cancel])).toEqual(["unrelated"]);
  });

  test.each(["Alert", "Update", "Cancel"] as const)("future issuance of %s cannot hide a warning that is current now", (messageType) => {
    const future = warning("future-issued", { sent: "2026-10-09T19:02:00Z", messageType, references: ["current"] });
    expect(ids([warning("current"), future])).toEqual(["current"]);
  });

  test("a future onset stays visible when its issuance is current and is described separately", () => {
    const futureOnset = warning("future-onset", { sent: "2026-10-09T18:30:00Z", onset: "2026-10-09T19:30:00Z", urgency: "Expected" });
    const output = prioritizeWarnings([futureOnset], context);
    expect(output.map(({ alert }) => alert.id)).toEqual(["future-onset"]);
    expect(output[0].explanation).toMatch(/onset.*future/i);
    expect(output[0].alert.onset).toBe("2026-10-09T19:30:00Z");
  });
});

describe("applicability and provenance boundaries", () => {
  test("a live point response retains warnings without geometry and names its applicability evidence", () => {
    const row = prioritizeWarnings([warning("no-polygon", { geometry: null })], context)[0];
    expect(row.alert.id).toBe("no-polygon");
    expect(row.explanation).toMatch(/NWS point response.*selected location/i);
  });

  test("unverified applicability stays explicit even with geometry covering the selected point", () => {
    const alert = warning("unverified", { geometry: { type: "Polygon", coordinates: [[[-97, 33], [-96, 33], [-96, 34], [-97, 34], [-97, 33]]] } });
    const row = prioritizeWarnings([alert], { ...context, applicability: "unverified" })[0];
    expect(row.alert).toBe(alert);
    expect(row.explanation).toMatch(/selected.location applicability.*unverified/i);
    expect(row.explanation).not.toMatch(/NWS point response/i);
  });

  test("cached point results cannot become confirmed live coverage through ordering", () => {
    const row = prioritizeWarnings([warning("cached")], { ...context, source: "cached" })[0];
    expect(row.explanation).toMatch(/cached.*point response/i);
    expect(row.explanation).toMatch(/current.*not.*verified/i);
    expect(row.explanation).not.toMatch(/live NWS|confirmed.*selected/i);
  });

  test("simulation never claims official selected-point applicability", () => {
    const row = prioritizeWarnings([warning("demo:warning", { sourceUrl: null })], { ...context, source: "demo" })[0];
    expect(row.explanation).toMatch(/simulated/i);
    expect(row.explanation).toMatch(/official.*applicability.*unverified/i);
    expect(row.explanation).not.toMatch(/NWS point response/i);
  });

  test("unavailable source leaves current official applicability unverified", () => {
    const row = prioritizeWarnings([warning("retained")], { ...context, source: "unavailable" })[0];
    expect(row.explanation).toMatch(/source unavailable/i);
    expect(row.explanation).toMatch(/applicability.*unverified/i);
    expect(row.explanation).not.toMatch(/NWS point response/i);
  });

  test.each(["live", "cached", "demo", "unavailable"] as const)("rejects mixed simulated and official records in a %s path", (source) => {
    expect(() => prioritizeWarnings([warning("official"), warning("demo:warning", { sourceUrl: null })], { ...context, source })).toThrow(/source|simulated/i);
  });

  test("missing official source URL alone does not imply simulation", () => {
    expect(ids([warning("no-source-link", { sourceUrl: null })])).toEqual(["no-source-link"]);
  });

  test.each([
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: 0, longitude: Infinity },
  ])("rejects invalid coordinates %j before claiming applicability", (point) => {
    expect(() => prioritizeWarnings([warning("warning")], { ...context, point })).toThrow(RangeError);
  });

  test.each([NaN, Infinity, -Infinity, 1e20])("rejects an invalid clock %s instead of producing a verified empty result", (now) => {
    expect(() => prioritizeWarnings([warning("warning")], { ...context, now })).toThrow(RangeError);
  });

  test.each([
    { source: undefined },
    { source: "unknown-source" },
    { applicability: undefined },
    { applicability: "regional" },
  ])("rejects absent or unsupported provenance %j", (invalid) => {
    expect(() => prioritizeWarnings([warning("warning")], { ...context, ...invalid } as PriorityContext)).toThrow(/source|applicability/i);
  });

  test("empty input returns an empty ordered collection", () => {
    expect(prioritizeWarnings([], context)).toEqual([]);
  });
});
