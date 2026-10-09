import type { OfficialAlert } from "../../src/domain/types";

export const TEST_NOW = Date.parse("2026-10-09T19:00:00Z");

export function officialAlert(
  overrides: Partial<OfficialAlert> = {},
): OfficialAlert {
  return {
    id: "urn:test:1",
    event: "Flash Flood Warning",
    headline: "Official headline",
    description: "Official description.\nOriginal line breaks.",
    instruction: "Original official instruction.\nSecond line.",
    severity: "Severe",
    urgency: "Immediate",
    certainty: "Observed",
    onset: "2026-10-09T18:30:00Z",
    expires: "2026-10-09T20:00:00Z",
    sent: "2026-10-09T18:30:00Z",
    agency: "NWS Austin/San Antonio TX",
    sourceUrl: "https://api.weather.gov/alerts/urn:test:1",
    geometry: null,
    messageType: "Alert",
    references: [],
    ...overrides,
  };
}

export function nwsFeature(overrides: Record<string, unknown> = {}) {
  const alert = officialAlert();
  return {
    type: "Feature",
    id: alert.sourceUrl,
    geometry: null,
    properties: {
      id: alert.id,
      event: alert.event,
      headline: alert.headline,
      description: alert.description,
      instruction: alert.instruction,
      severity: alert.severity,
      urgency: alert.urgency,
      certainty: alert.certainty,
      onset: alert.onset,
      expires: alert.expires,
      sent: alert.sent,
      senderName: alert.agency,
      status: "Actual",
      scope: "Public",
      messageType: alert.messageType,
      references: [],
      ...overrides,
    },
  };
}

export const nwsCollection = (...features: unknown[]) => ({
  type: "FeatureCollection",
  features,
});
