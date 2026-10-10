import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle, openLink } from "@/ui/components";
import { colors } from "@/ui/tokens";
import type { OfficialEarthquake, RiverGauge, RiverMeasurement } from "@/services/usgsTypes";
import { isRiverObservationDelayed } from "@/services/usgsTypes";
import { magnitudeLabel } from "@/ui/format";

export type HazardSelection = {
  kind: "earthquake";
  item: OfficialEarthquake;
  fetchedAt: string | null;
} | {
  kind: "river";
  item: RiverGauge;
  fetchedAt: string | null;
};

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
      <Screen>
        <ActionButton title="Close observation" secondary onPress={onClose} />
        <SectionTitle>{source === "live" ? "USGS / LAST VERIFIED COPY" : "USGS / CACHED · UNVERIFIED"}</SectionTitle>
        <Heading>{selection.kind === "earthquake" ? "Earthquake" : "River station"}</Heading>
        <Body>{item.name}</Body>
        {selection.fetchedAt && <Body>Retrieved: {new Date(selection.fetchedAt).toLocaleString()}</Body>}
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
