import { locationKey } from '../domain/alerts';
import type { AlertSnapshot, DemoScenario, OfficialAlert, SelectedLocation } from '../domain/types';

export const DEMO_LOCATION: SelectedLocation = {
  label: 'Kerrville, Texas',
  coordinates: { latitude: 30.0474, longitude: -99.1403 },
  kind: 'manual',
};

const minutes = (now: number, offset: number) => new Date(now + offset * 60_000).toISOString();

function simulatedFlood(now: number): OfficialAlert {
  return {
    id: 'demo:flash-flood',
    event: 'Flash Flood Warning',
    headline: 'SIMULATED: Flash flooding in the Texas Hill Country',
    description: 'SIMULATED DEMO. This fictional warning illustrates how ClearPath displays an alert. It is not issued by an emergency authority and does not describe current conditions.',
    instruction: 'SIMULATED example instruction: Move away from rising water. Never drive through flooded roads. In live mode, this space preserves the issuing agency’s original instructions.',
    severity: 'Severe', urgency: 'Immediate', certainty: 'Observed',
    onset: minutes(now, -12), expires: minutes(now, 75), sent: minutes(now, -12),
    agency: 'SIMULATED issuing agency — presentation fixture',
    sourceUrl: null,
    geometry: { type: 'Polygon', coordinates: [[
      [-99.23, 30.11], [-99.08, 30.11], [-99.06, 29.99], [-99.21, 29.98], [-99.23, 30.11],
    ]] },
    messageType: 'Alert', references: [],
  };
}

export function getDemoSnapshot(scenario: DemoScenario, now = Date.now()): AlertSnapshot {
  const flood = simulatedFlood(now);
  let alerts: OfficialAlert[] = [];
  if (scenario === 'flood' || scenario === 'offline') alerts = [flood];
  if (scenario === 'flood') {
    alerts.push({
      ...flood, id: 'demo:flood-watch', event: 'Flood Watch',
      headline: 'SIMULATED: Additional rainfall may produce flooding',
      severity: 'Moderate', urgency: 'Expected', certainty: 'Possible',
      instruction: 'SIMULATED example instruction: Follow local emergency updates and prepare to act if an official warning is issued.',
      geometry: null, expires: minutes(now, 180), sent: minutes(now, -30),
    });
  }
  if (scenario === 'tornado') {
    alerts = [{
      ...flood, id: 'demo:tornado', event: 'Tornado Warning',
      headline: 'SIMULATED: Tornado warning for the selected location',
      instruction: 'SIMULATED example instruction: Move to an interior room on the lowest floor of a sturdy building, away from windows.',
      severity: 'Extreme', certainty: 'Observed', expires: minutes(now, 25),
    }];
  }
  if (scenario === 'offline') {
    alerts.push({
      ...flood, id: 'demo:expired', event: 'Severe Thunderstorm Warning',
      headline: 'SIMULATED: Expired warning retained in the demonstration cache',
      expires: minutes(now, -5), sent: minutes(now, -45), geometry: null,
    });
  }
  return {
    source: 'demo',
    alerts,
    fetchedAt: minutes(now, scenario === 'offline' ? -18 : 0),
    locationKey: locationKey(DEMO_LOCATION),
  };
}
