import type { OfficialAlert } from "../../src/domain/types";

/** Fixed official-shaped input, never a response from a current live request. */
export const officialAlert: OfficialAlert = {
  id: "test-alert-1",
  event: "Flash Flood Warning",
  headline: "Test warning headline",
  description: "Original test warning description. Preserve every sentence.",
  instruction: "Original test agency instruction. Move to higher ground.",
  severity: "Severe",
  urgency: "Immediate",
  certainty: "Observed",
  onset: "2026-10-09T18:00:00Z",
  sent: "2026-10-09T18:00:00Z",
  expires: "2026-10-09T21:00:00Z",
  agency: "Test NWS office",
  sourceUrl: "https://api.weather.gov/alerts/test-alert-1",
  geometry: null,
  messageType: "Alert",
  references: [],
};
