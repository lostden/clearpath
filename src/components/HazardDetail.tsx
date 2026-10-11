import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle, openLink } from "@/ui/components";
import { colors } from "@/ui/tokens";
import type { OfficialEarthquake, RiverGauge, RiverMeasurement } from "@/services/usgsTypes";
import { isRiverObservationDelayed } from "@/services/usgsTypes";
import { magnitudeLabel } from "@/ui/format";

type HazardSource = "live" | "cached" | "unavailable";
type HazardCopy<T> = {
  items: readonly T[];
  source: HazardSource;
  fetchedAt: string | null;
  generatedAt: string | null;
};
export type HazardSelection = {
  source: HazardSource;
  fetchedAt: string | null;
  generatedAt: string | null;
} & ({
  kind: "earthquake";
  item: OfficialEarthquake;
} | {
  kind: "river";
  item: RiverGauge;
});

function sameReading(a: RiverMeasurement | null, b: RiverMeasurement | null): boolean {
  return a === null || b === null ? a === b : a.observedAt === b.observedAt &&
    a.value === b.value && a.displayValue === b.displayValue && a.units === b.units &&
    a.approvalStatus === b.approvalStatus && a.qualifier === b.qualifier;
}
function sameStation(a: RiverGauge, b: RiverGauge): boolean {
  return a.id === b.id && a.name === b.name && a.sourceUrl === b.sourceUrl &&
    a.coordinates.latitude === b.coordinates.latitude && a.coordinates.longitude === b.coordinates.longitude &&
    a.distanceKm === b.distanceKm && sameReading(a.gageHeight, b.gageHeight) && sameReading(a.streamflow, b.streamflow);
}
function sameEarthquake(a: OfficialEarthquake, b: OfficialEarthquake): boolean {
  return a.id === b.id && a.name === b.name && a.sourceUrl === b.sourceUrl &&
    a.coordinates.latitude === b.coordinates.latitude && a.coordinates.longitude === b.coordinates.longitude &&
    a.observedAt === b.observedAt && a.updatedAt === b.updatedAt && a.magnitude === b.magnitude &&
    a.depthKm === b.depthKm && a.reviewStatus === b.reviewStatus;
}

/** Reconnection cannot upgrade a detail opened from an unverified copy. */
export function hazardDetailSource(selection: HazardSelection | null, layers: {
  earthquakes: HazardCopy<OfficialEarthquake>;
  rivers: HazardCopy<RiverGauge>;
}): "live" | "cached" {
  if (!selection || selection.source !== "live" || !selection.fetchedAt) return "cached";
  const current = selection.kind === "earthquake" ? layers.earthquakes : layers.rivers;
  if (current.source !== "live" || current.fetchedAt !== selection.fetchedAt || current.generatedAt !== selection.generatedAt)
    return "cached";
  const included = selection.kind === "earthquake"
    ? layers.earthquakes.items.some((item) => sameEarthquake(item, selection.item))
    : layers.rivers.items.some((item) => sameStation(item, selection.item));
  return included ? "live" : "cached";
}

export function RiverReading({ label, reading }: { label: string; reading: RiverMeasurement | null }) {
  return <Panel>
    <SectionTitle>{label}</SectionTitle>
    {reading ? <>
      <Heading>{reading.displayValue} {reading.units}</Heading>
      <Body>Observed: {new Date(reading.observedAt).toLocaleString()}</Body>
      <Body>{reading.approvalStatus.toUpperCase()}{isRiverObservationDelayed(reading) ? " · DELAYED OBSERVATION" : ""}</Body>
      {reading.qualifier && <Body>Qualifier: {reading.qualifier}</Body>}
    </> : <Body>READING UNAVAILABLE</Body>}
  </Panel>;
}

export function HazardDetail({ selection, source, onClose }: {
  selection: HazardSelection | null;
  source: "live" | "cached" | "unavailable";
  onClose: () => void;
}) {
  const item = selection?.item;
  return <Modal visible={!!selection} animationType="none" presentationStyle="fullScreen" onRequestClose={onClose}>
    {selection && item && <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen header={<ActionButton title="Close observation" secondary onPress={onClose} />}>
        <SectionTitle>{source === "live" ? "USGS / LAST VERIFIED COPY" : "USGS / CACHED · UNVERIFIED"}</SectionTitle>
        <Heading>{selection.kind === "earthquake" ? "Earthquake" : "River station"}</Heading>
        <Body>{item.name}</Body>
        {selection.fetchedAt && <Body>Retrieved: {new Date(selection.fetchedAt).toLocaleString()}</Body>}
        {selection.kind === "earthquake" && selection.generatedAt && <Body>Feed generated: {new Date(selection.generatedAt).toLocaleString()}</Body>}
        {selection.kind === "earthquake" ? <Panel>
          <Heading>M {selection.item.magnitude === null ? "UNAVAILABLE" : magnitudeLabel(selection.item.magnitude)}</Heading>
          <Body>Observed: {new Date(selection.item.observedAt).toLocaleString()}</Body>
          <Body>Updated: {new Date(selection.item.updatedAt).toLocaleString()}</Body>
          <Body>Seismic depth: {selection.item.depthKm} km</Body>
          <Body>Review: {selection.item.reviewStatus}</Body>
          <Body>This point marks an epicenter. It does not show damage or an impact area.</Body>
        </Panel> : <>
          <Body>{selection.item.distanceKm.toFixed(1)} km from the selected point</Body>
          <RiverReading label="Gage height" reading={selection.item.gageHeight} />
          <RiverReading label="Streamflow" reading={selection.item.streamflow} />
          <Body>Gage height is relative to the station datum. It is not flood depth, flood stage or road passability.</Body>
        </>}
        <ActionButton title="Open official USGS source" onPress={() => void openLink(item.sourceUrl)} />
      </Screen>
    </SafeAreaView>}
  </Modal>;
}
