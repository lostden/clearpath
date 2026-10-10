import { useCallback, useState } from "react";
import { Pressable, View, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle, SourceBadge, openLink } from "@/ui/components";
import { useAlerts } from "@/hooks/useAlerts";
import { useRegionalAlerts } from "@/hooks/useRegionalAlerts";
import { useDisasterLayers } from "@/hooks/useDisasterLayers";
import MapCanvas from "@/components/MapCanvas";
import { AlertDetail, detailSource, type AlertSelection } from "@/components/AlertDetail";
import { HazardDetail, type HazardSelection } from "@/components/HazardDetail";
import { DEMO_DATE_LABEL, DEMO_GAUGE } from "@/data/demo";
import { colors, typography } from "@/ui/tokens";
import { isRiverObservationDelayed } from "@/services/usgsTypes";
import { ZoneAreaDetail } from "@/components/ZoneAreaDetail";

function LayerToggle({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={s.toggle}><Text style={s.label}>{title}</Text><Pressable accessibilityRole="switch" accessibilityLabel={`Show ${title.toLowerCase()}`} accessibilityState={{ checked: value }} aria-checked={value} onPress={() => onChange(!value)} style={[s.switch, value && s.active]}><Text style={[s.switchText, value && s.darkText]}>{value ? "ON" : "OFF"}</Text></Pressable></View>;
}
function FeedStamp({ label, source, fetchedAt, loading }: { label: string; source: string; fetchedAt: string | null; loading?: boolean }) {
  return <View style={s.feedStamp}>
    <Text style={s.stampTitle}>{label} / {loading ? "CHECKING" : source === "live" ? "VERIFIED COPY" : source === "cached" ? "CACHED · UNVERIFIED" : "UNAVAILABLE"}</Text>
    {fetchedAt && <Text style={s.metadata}>{new Date(fetchedAt).toLocaleString()}</Text>}
  </View>;
}
export default function MapScreen() {
  const feed = useAlerts();
  const demo = feed.source === "demo";
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [coverage, setCoverage] = useState<"TX" | "US">("TX");
  const [warnings, setWarnings] = useState(true);
  const [gauges, setGauges] = useState(true);
  const [earthquakes, setEarthquakes] = useState(true);
  const [warningLimit, setWarningLimit] = useState(8);
  const [selected, setSelected] = useState<AlertSelection | null>(null);
  const [hazard, setHazard] = useState<HazardSelection | null>(null);
  const [zoneSelection, setZoneSelection] = useState<AlertSelection | null>(null);
  const closeZoneAreas = useCallback(() => setZoneSelection(null), []);
  const point = feed.selectedLocation?.coordinates ?? null;
  const regional = useRegionalAlerts({ enabled: !demo && focused && warnings, coverage });
  const layers = useDisasterLayers(point, !demo && focused, { earthquakes, rivers: gauges });
  const alerts = demo ? feed.alerts : regional.alerts;
  const warningSource = demo ? "demo" : regional.source;
  const warningTime = demo ? feed.snapshot?.fetchedAt ?? null : regional.fetchedAt;
  const unmapped = alerts.filter((alert) => !alert.geometry).length;
  const selectAlert = (alert: typeof alerts[number]) => setSelected({ alert, source: warningSource, fetchedAt: warningTime });
  const currentHazardLayer = hazard?.kind === "river" ? layers.rivers : layers.earthquakes;
  const hazardSource = hazard?.fetchedAt === currentHazardLayer.fetchedAt ? currentHazardLayer.source : "cached";
  const zoneAlert = zoneSelection ? alerts.find((alert) => alert.id === zoneSelection.alert.id && alert.sent === zoneSelection.alert.sent) : null;
  const zoneEnabled = !demo && focused && warnings && !feed.offline && warningSource === "live" && !!zoneAlert && JSON.stringify(zoneAlert.affectedZones) === JSON.stringify(zoneSelection?.alert.affectedZones);
  return <>
    <Screen>
      <Text style={s.kicker}>OPERATIONS / MAP</Text>
      <Heading>Hazard map</Heading>
      <Body>{feed.selectedLocation?.label || `${coverage === "TX" ? "Texas" : "U.S."} overview · set your location on Home`}</Body>
      {point && <Text style={s.metadata}>{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)} / SELECTED POINT</Text>}
      {demo ? <><SourceBadge source="demo" /><Text style={s.stampTitle}>{DEMO_DATE_LABEL} / FROZEN SCENE</Text><Body>Hill Country flood exercise. Warning areas and readings are fictional.</Body></> : <View style={s.coverage}>
        {(["TX", "US"] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: coverage === value }} accessibilityLabel={value === "TX" ? "Texas weather coverage" : "U.S. weather coverage"} onPress={() => { setCoverage(value); setWarningLimit(8); setZoneSelection(null); }} style={[s.coverageButton, coverage === value && s.active]}><Text style={[s.label, coverage === value && s.darkText]}>{value === "TX" ? "TEXAS" : "U.S."}</Text></Pressable>)}
      </View>}
      {feed.offline && <Body>{demo ? "SIMULATED OUTAGE / map tiles require a connection." : "OFFLINE / retained layers are unverified. Map tiles may be unavailable."}</Body>}
      <MapCanvas key={`${demo}-${coverage}`} point={point ?? (coverage === "TX" ? { latitude: 31.1, longitude: -100 } : { latitude: 39, longitude: -98 })} pointIsSelection={!!point} initialSpan={point ? 0.18 : coverage === "TX" ? 14 : 55} alerts={alerts} source={warningSource} showWarnings={warnings} showGauges={gauges} showEarthquakes={earthquakes} earthquakes={layers.earthquakes.items} rivers={layers.rivers.items} earthquakeSource={layers.earthquakes.source} riverSource={layers.rivers.source} onSelectAlert={selectAlert} onSelectEarthquake={(item) => setHazard({ kind: "earthquake", item, fetchedAt: layers.earthquakes.fetchedAt })} onSelectRiver={(item) => setHazard({ kind: "river", item, fetchedAt: layers.rivers.fetchedAt })} />
      <View style={s.legend}>
        {warnings && <><Text style={[s.legendText, { color: colors.orange }]}>▰ SEVERE AREA</Text><Text style={[s.legendText, { color: colors.yellow }]}>▰ OTHER AREA</Text></>}
        {gauges && <Text style={[s.legendText, { color: colors.yellow }]}>R / RIVER STATION</Text>}
        {!demo && earthquakes && <Text style={s.legendText}>E / EPICENTER</Text>}
        {!demo && <Text style={[s.legendText, { color: "#B0B0B0" }]}>GRAY = CACHED</Text>}
      </View>
      <Panel>
        <SectionTitle>Layers</SectionTitle>
        <LayerToggle title="Warning areas" value={warnings} onChange={setWarnings} />
        <LayerToggle title={demo ? "Simulated observation" : "River observations"} value={gauges} onChange={setGauges} />
        {!demo && <LayerToggle title="Earthquakes" value={earthquakes} onChange={setEarthquakes} />}
        <Body>Warning polygons show issued areas, not measured flood extent. An empty map does not establish safety.</Body>
      </Panel>
      {warnings && <>
        <SectionTitle>{demo ? "Simulated warnings" : `${coverage === "TX" ? "Texas" : "U.S."} / Regional alerts`}</SectionTitle>
        <SourceBadge source={warningSource} />
        {!demo && <><FeedStamp label="NWS" source={regional.source} fetchedAt={regional.fetchedAt} loading={regional.isLoading} /><Body>Regional records may not apply to your selected point. Home checks that point separately.</Body><ActionButton title={regional.isRefreshing ? "Updating weather" : regional.canRefresh ? "Refresh weather" : "Weather refresh on cooldown"} disabled={!regional.canRefresh} secondary onPress={() => void regional.refresh()} /></>}
        <Text style={s.metadata}>{alerts.length} RECORDS / {alerts.length - unmapped} MAPPED / {unmapped} WITHOUT SUPPLIED GEOMETRY</Text>
        {!alerts.length && <Body>{demo ? "No active warnings in this simulated snapshot." : warningSource === "live" ? "No active records returned for this region. This does not verify safety." : "Current regional alerts are unverified."}</Body>}
        {alerts.slice(0, warningLimit).map((alert) => <Pressable key={alert.id} accessibilityRole="button" accessibilityLabel={`Read ${alert.event}`} onPress={() => selectAlert(alert)} style={s.record}>
          <Text style={s.recordTitle}>{alert.event}</Text><Text style={s.metadata}>{alert.severity.toUpperCase()} / {alert.geometry ? "AREA SUPPLIED" : "NO MAPPED AREA SUPPLIED"}</Text><Text style={s.metadata}>{alert.headline || alert.agency}</Text><Text style={s.open}>READ WARNING →</Text>
        </Pressable>)}
        {alerts.length > warningLimit && <ActionButton title="Show more regional alerts" secondary onPress={() => setWarningLimit((limit) => limit + 20)} />}
      </>}
      {gauges && (demo ? <Panel><SectionTitle>SIMULATED / RIVER</SectionTitle><Heading>{DEMO_GAUGE.gageHeight} ft</Heading><Body>Gage height · {DEMO_GAUGE.streamflow.toLocaleString()} ft³/s streamflow</Body><Body>Simulated observation: {new Date(DEMO_GAUGE.observedAt).toLocaleString()}</Body><Body>{DEMO_GAUGE.description}</Body></Panel> : <>
        <SectionTitle>USGS / Nearby rivers</SectionTitle><FeedStamp label="RIVERS" source={layers.rivers.source} fetchedAt={layers.rivers.fetchedAt} loading={layers.rivers.loading} /><Body>{layers.rivers.coverage}</Body>
        {!point && <Body>SET LOCATION / needed for nearby river stations.</Body>}
        {layers.rivers.error && <Body>River readings could not be verified. Retained readings may have changed.</Body>}
        {point && !layers.rivers.loading && !layers.rivers.items.length && <Body>{layers.rivers.source === "live" ? "No reporting stations returned in this search. Flood conditions remain unverified." : "River observations unavailable."}</Body>}
        {layers.rivers.items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Read river station ${item.name}`} onPress={() => setHazard({ kind: "river", item, fetchedAt: layers.rivers.fetchedAt })} style={s.record}><Text style={s.recordTitle}>{item.name}</Text><Text style={s.metadata}>{item.distanceKm.toFixed(1)} KM / {item.gageHeight ? `${item.gageHeight.displayValue} ${item.gageHeight.units} GAGE HEIGHT` : "GAGE HEIGHT UNAVAILABLE"}</Text><Text style={s.metadata}>{item.gageHeight ? `${isRiverObservationDelayed(item.gageHeight) ? "DELAYED / " : ""}Observed ${new Date(item.gageHeight.observedAt).toLocaleString()}` : "OPEN STATION FOR AVAILABLE READINGS"}</Text></Pressable>)}
        <Body>Gage height is not flood depth. Observations can be delayed and provisional.</Body>
        <ActionButton title={layers.rivers.refreshing ? "Updating rivers" : "Refresh river observations"} disabled={!layers.rivers.canRefresh} secondary onPress={() => void layers.rivers.refresh()} />
      </>)}
      {!demo && earthquakes && <>
        <SectionTitle>USGS / Earthquakes</SectionTitle><FeedStamp label="EARTHQUAKES" source={layers.earthquakes.source} fetchedAt={layers.earthquakes.fetchedAt} loading={layers.earthquakes.loading} /><Body>{layers.earthquakes.coverage}</Body>
        {layers.earthquakes.error && <Body>Earthquake reports could not be verified.</Body>}
        {layers.earthquakes.items.slice(0, 6).map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Read earthquake ${item.name}`} onPress={() => setHazard({ kind: "earthquake", item, fetchedAt: layers.earthquakes.fetchedAt })} style={s.record}><Text style={s.recordTitle}>M {item.magnitude ?? "?"} / {item.name}</Text><Text style={s.metadata}>{new Date(item.observedAt).toLocaleString()}</Text></Pressable>)}
        <Text style={s.metadata}>{layers.earthquakes.items.length} GLOBAL EVENTS / LATEST 6 LISTED</Text><Body>Pan to see epicenters. Markers do not show impact areas.</Body>
        <ActionButton title={layers.earthquakes.refreshing ? "Updating earthquakes" : "Refresh earthquakes"} disabled={!layers.earthquakes.canRefresh} secondary onPress={() => void layers.earthquakes.refresh()} />
      </>}
      <SectionTitle>Road reports</SectionTitle><ActionButton title="Open DriveTexas" secondary onPress={() => void openLink("https://drivetexas.org/")} /><Body>Road reports may be delayed. Map directions do not verify an evacuation route or flood safety.</Body>
      {point && <ActionButton title="Open point in Google Maps" secondary onPress={() => void openLink(`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`)} />}
      <Body>Coverage: NWS weather alerts, USGS earthquakes and nearby Texas stream stations. Wildfire perimeters, shelter occupancy and evacuation orders are not integrated.</Body>
    </Screen>
    <AlertDetail alert={selected?.alert ?? null} source={detailSource(selected, warningSource, warningTime)} fetchedAt={selected?.fetchedAt} onClose={() => setSelected(null)} onViewZoneAreas={selected && selected.source !== "demo" ? () => { setZoneSelection(selected); setSelected(null); } : undefined} />
    <ZoneAreaDetail key={`${coverage}-${demo}`} selection={zoneSelection} enabled={zoneEnabled} onClose={closeZoneAreas} />
    <HazardDetail selection={hazard} source={hazardSource} onClose={() => setHazard(null)} />
  </>;
}
const s = StyleSheet.create({
  kicker: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 13, lineHeight: 20, letterSpacing: 0.5 },
  coverage: { flexDirection: "row", gap: 12 },
  coverageButton: { flex: 1, minHeight: 52, borderWidth: 2, borderColor: colors.line, justifyContent: "center", alignItems: "center", padding: 12 },
  active: { backgroundColor: colors.orange, borderColor: colors.orange },
  darkText: { color: colors.background },
  switch: { minHeight: 52, minWidth: 64, padding: 10, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  switchText: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 15, lineHeight: 22 },
  toggle: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  label: { fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24, color: colors.ink, flexShrink: 1, textTransform: "uppercase" },
  metadata: { fontFamily: typography.body, fontSize: 13, lineHeight: 20, color: colors.secondary },
  stampTitle: { fontFamily: typography.bodyStrong, fontSize: 13, lineHeight: 20, color: colors.ink },
  feedStamp: { borderLeftWidth: 4, borderLeftColor: colors.orange, paddingLeft: 12, gap: 6 },
  record: { minHeight: 64, borderWidth: 2, borderColor: colors.line, padding: 14, gap: 8, backgroundColor: colors.surface },
  recordTitle: { fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24, color: colors.ink },
  open: { fontFamily: typography.bodyStrong, fontSize: 13, lineHeight: 20, color: colors.orange },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendText: { fontFamily: typography.bodyStrong, fontSize: 12, lineHeight: 18, color: colors.ink },
});
