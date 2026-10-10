import { locationKey } from "../domain/alerts";
import type {
  AlertSnapshot,
  DemoScenario,
  OfficialAlert,
  SelectedLocation,
} from "../domain/types";

export const DEMO_LOCATION: SelectedLocation = {
  label: "Hunt · Guadalupe River, Texas",
  // Rounded USGS 08165495 location metadata; a scene anchor, not a user position.
  coordinates: { latitude: 30.0699, longitude: -99.3328 },
  kind: "manual",
};

/** Frozen presentation clock. Live/cached official warnings use the real clock. */
export const DEMO_TIMESTAMP = Date.parse("2025-07-04T05:15:00-05:00");
export const DEMO_DATE_LABEL = "JUL 04 2025 / 05:15 CDT";

/** Real geographic anchor, fictional observation: never an archived/live measurement. */
export const DEMO_GAUGE = {
  source: "demo" as const,
  coordinate: { latitude: 30.0699, longitude: -99.3217 },
  name: "SIMULATED / Guadalupe at Hunt",
  gageHeight: 18.6,
  gageHeightUnit: "ft",
  streamflow: 28_400,
  streamflowUnit: "ft³/s",
  observedAt: "2025-07-04T05:10:00-05:00",
  description: "SIMULATED: 18.6 ft gage height · 28,400 ft³/s streamflow. Invented presentation values; no flood-stage classification.",
};

const minutes = (now: number, offset: number) =>
  new Date(now + offset * 60_000).toISOString();

function simulatedFlood(now: number): OfficialAlert {
  return {
    id: "demo:flash-flood",
    event: "Flash Flood Warning",
    headline: "SIMULATED: Rapid flooding along the Guadalupe near Hunt",
    description:
      "SIMULATED DEMO — July 4, 2025. Fictional flash flooding along the upper Guadalupe near Hunt and Ingram. This scene is inspired by the Texas Hill Country floods. The warning text, issue times, and shaded areas are invented for the presentation. Read current official warnings in Live Mode.",
    instruction:
      "SIMULATED example instruction: Move away from rising water. Never drive through flooded roads.",
    severity: "Severe",
    urgency: "Immediate",
    certainty: "Observed",
    onset: minutes(now, -12),
    expires: minutes(now, 75),
    sent: minutes(now, -12),
    agency: "SIMULATED issuing agency — presentation fixture",
    sourceUrl: null,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-99.405, 30.095],
          [-99.367, 30.112],
          [-99.32, 30.107],
          [-99.277, 30.085],
          [-99.259, 30.053],
          [-99.282, 30.028],
          [-99.334, 30.021],
          [-99.373, 30.042],
          [-99.41, 30.063],
          [-99.405, 30.095],
        ],
      ],
    },
    messageType: "Alert",
    references: [],
  };
}

export function getDemoSnapshot(
  scenario: DemoScenario,
  now = DEMO_TIMESTAMP,
): AlertSnapshot {
  const flood = simulatedFlood(now);
  let alerts: OfficialAlert[] = [];
  if (scenario === "flood" || scenario === "offline") alerts = [flood];
  if (scenario === "flood") {
    alerts.push({
      ...flood,
      id: "demo:flood-watch",
      event: "Flood Watch",
      headline: "SIMULATED: Additional flooding concern in the upper Guadalupe basin",
      description: "SIMULATED DEMO — July 4, 2025. Fictional rainfall concern across the North and South Forks of the Guadalupe near Hunt. This broader shaded area is an invented warning-display example, not an official alert polygon, mapped watershed, or measured flood extent.",
      severity: "Moderate",
      urgency: "Expected",
      certainty: "Possible",
      instruction:
        "SIMULATED example instruction: Follow local emergency updates and prepare to act if an official warning is issued.",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-99.442, 30.155], [-99.357, 30.172], [-99.28, 30.139],
          [-99.235, 30.088], [-99.258, 30.016], [-99.362, 29.998],
          [-99.442, 30.058], [-99.442, 30.155],
        ]],
      },
      expires: minutes(now, 180),
      sent: minutes(now, -30),
    });
  }
  if (scenario === "tornado") {
    alerts = [
      {
        ...flood,
        id: "demo:tornado",
        event: "Tornado Warning",
        headline: "SIMULATED: Tornado warning for the selected location",
        description: "SIMULATED tornado exercise near Hunt. This alternate scenario demonstrates another warning type; it does not claim a tornado occurred during the July 4, 2025 flood disaster. Warning text and geometry are fictional.",
        instruction:
          "SIMULATED example instruction: Move to an interior room on the lowest floor of a sturdy building, away from windows.",
        severity: "Extreme",
        certainty: "Observed",
        expires: minutes(now, 25),
      },
    ];
  }
  if (scenario === "offline") {
    alerts[0] = { ...flood, sent: minutes(now, -30), onset: minutes(now, -30) };
    alerts.push({
      ...flood,
      id: "demo:expired",
      event: "Severe Thunderstorm Warning",
      headline:
        "SIMULATED: Expired warning retained in the demonstration cache",
      expires: minutes(now, -5),
      sent: minutes(now, -45),
      onset: minutes(now, -45),
      geometry: null,
    });
  }
  return {
    source: "demo",
    alerts,
    fetchedAt: minutes(now, scenario === "offline" ? -18 : 0),
    locationKey: locationKey(DEMO_LOCATION),
  };
}
