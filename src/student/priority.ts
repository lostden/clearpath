/**
 * AI-assisted display policy, implemented at the user's explicit authorization.
 * This is not independently student-written code or a personal danger prediction.
 * Lifecycle resolution precedes ordering; every remaining warning stays visible.
 */
import { currentAlerts, validCoordinates } from "@/domain/alerts";
import type { Coordinates, OfficialAlert } from "@/domain/types";

export type PriorityContext = {
  point: Coordinates;
  now: number;
  source: "live" | "cached" | "demo" | "unavailable";
  /** Supplied only for the exact selected point's NWS endpoint, never a region. */
  applicability: "nws-point" | "unverified";
};
export type OrderedWarning = { alert: OfficialAlert; explanation: string };
export type StudentPrioritizer = (
  alerts: readonly OfficialAlert[],
  context: PriorityContext,
) => readonly OrderedWarning[];

// Ordinal source classifications, not additive scores or probabilities.
const URGENCY = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
const SEVERITY = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;
const CERTAINTY = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;

function classification(value: unknown, values: readonly string[]): string {
  return typeof value === "string" && values.includes(value) ? value : "Unknown";
}

function compareText(left: string, right: string): number {
  // Code-point order avoids locale/device-dependent identifier ordering.
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * An equal-id/equal-time conflict has no trustworthy "newer" copy. Select by a
 * fixed source-field order, disclose the conflict, and leave each source intact.
 * Explicit geometry fields avoid provider object-key insertion order as a tie.
 */
function sourceFields(alert: OfficialAlert): string {
  return JSON.stringify([
    alert.event, alert.headline, alert.description, alert.instruction,
    alert.severity, alert.urgency, alert.certainty, alert.onset, alert.expires,
    alert.agency, alert.sourceUrl, alert.sent, alert.messageType,
    alert.references,
    alert.geometry ? [alert.geometry.type, alert.geometry.coordinates] : alert.geometry,
    alert.affectedZones,
  ], (_key, value) => value === undefined ? { missing: true } : value);
}

function compareClassification(left: OfficialAlert, right: OfficialAlert): number {
  return URGENCY.indexOf(classification(left.urgency, URGENCY) as typeof URGENCY[number]) -
      URGENCY.indexOf(classification(right.urgency, URGENCY) as typeof URGENCY[number]) ||
    SEVERITY.indexOf(classification(left.severity, SEVERITY) as typeof SEVERITY[number]) -
      SEVERITY.indexOf(classification(right.severity, SEVERITY) as typeof SEVERITY[number]) ||
    CERTAINTY.indexOf(classification(left.certainty, CERTAINTY) as typeof CERTAINTY[number]) -
      CERTAINTY.indexOf(classification(right.certainty, CERTAINTY) as typeof CERTAINTY[number]);
}

function compareWarnings(left: OfficialAlert, right: OfficialAlert): number {
  return compareClassification(left, right) ||
    Date.parse(right.sent) - Date.parse(left.sent) ||
    compareText(left.id, right.id) ||
    compareText(left.sourceUrl ?? "", right.sourceUrl ?? "");
}

function provenance(context: PriorityContext): string {
  if (context.source === "demo")
    return "Simulated warning; official selected-location applicability is unverified.";
  if (context.source === "unavailable")
    return "Source unavailable; current selected-location applicability is unverified.";
  if (context.source === "cached")
    return context.applicability === "nws-point"
      ? "Cached NWS point response; current selected-location coverage is not verified."
      : "Cached warning; current selected-location applicability is unverified.";
  return context.applicability === "nws-point"
    ? "NWS point response for the selected location."
    : "Selected-location applicability is unverified.";
}

function leadingReason(first: OfficialAlert, next: OfficialAlert | undefined): string {
  if (!next) return "Only current warning in this feed.";
  if (classification(first.urgency, URGENCY) !== classification(next.urgency, URGENCY))
    return "Shown first by urgency.";
  if (classification(first.severity, SEVERITY) !== classification(next.severity, SEVERITY))
    return "Shown first by severity after equal urgency.";
  if (classification(first.certainty, CERTAINTY) !== classification(next.certainty, CERTAINTY))
    return "Shown first by certainty after equal urgency and severity.";
  if (Date.parse(first.sent) !== Date.parse(next.sent))
    return "Shown first by newer issue time after equal classifications.";
  return "Shown first by stable identifier after equal classifications and issue time.";
}

/**
 * The caller owns source isolation and exact-point evidence. Geometry absence
 * cannot disqualify an NWS point result; geometry alone does not establish point
 * applicability here. Future onset is retained; future issuance is resolved by
 * currentAlerts with the supplied clock. No network, GPS, storage or wall clock.
 */
export function prioritizeWarnings(
  alerts: readonly OfficialAlert[],
  context: PriorityContext,
): readonly OrderedWarning[] {
  if (!validCoordinates(context.point))
    throw new RangeError("A valid selected latitude and longitude are required.");
  if (!Number.isFinite(context.now) || !Number.isFinite(new Date(context.now).getTime()))
    throw new RangeError("A valid explicit clock is required.");
  if (!["live", "cached", "demo", "unavailable"].includes(context.source))
    throw new TypeError("An explicit warning source is required.");
  if (context.applicability !== "nws-point" && context.applicability !== "unverified")
    throw new TypeError("Explicit selected-point applicability evidence is required.");
  // The app reserves demo: identifiers for its generated simulation fixtures.
  // A missing source URL is not evidence of simulation.
  if (alerts.some((alert) => alert.id.startsWith("demo:") !== (context.source === "demo")))
    throw new TypeError("Simulated warning identifiers do not match the supplied source.");

  const copies = alerts.map((alert) => ({ alert, fields: sourceFields(alert) }));
  copies.sort((left, right) =>
    compareText(left.alert.id, right.alert.id) || compareText(left.fields, right.fields));
  const conflicting = new Set<string>();
  const seen = new Map<string, string>();
  for (const { alert, fields } of copies) {
    const key = JSON.stringify([alert.id, Date.parse(alert.sent)]);
    const previous = seen.get(key);
    if (previous !== undefined && previous !== fields) conflicting.add(key);
    seen.set(key, fields);
  }
  const ordered = currentAlerts(copies.map(({ alert }) => alert), context.now).sort(compareWarnings);
  const source = provenance(context);
  return ordered.map((alert, index) => {
    const urgency = classification(alert.urgency, URGENCY);
    const severity = classification(alert.severity, SEVERITY);
    const certainty = classification(alert.certainty, CERTAINTY);
    const explanation = [
      index === 0 ? leadingReason(alert, ordered[1]) : "Order uses urgency, then severity, then certainty.",
      `Urgency ${urgency}; severity ${severity}; certainty ${certainty}.`,
      source,
    ];
    if ([urgency, severity, certainty].includes("Unknown"))
      explanation.push("Unknown classifications follow known values; unknown does not mean low danger.");
    if (alert.onset && Date.parse(alert.onset) > context.now)
      explanation.push("Reported onset is in the future; issue time is separate.");
    if (conflicting.has(JSON.stringify([alert.id, Date.parse(alert.sent)])))
      explanation.push("Conflicting copies share an issue time; stable source-field order selects one.");
    explanation.push("Display order does not predict personal danger.");
    return { alert, explanation: explanation.join(" ") };
  });
}
