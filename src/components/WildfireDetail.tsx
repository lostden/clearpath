import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle, openLink } from "@/ui/components";
import { colors } from "@/ui/tokens";
import type { OfficialWildfirePerimeter } from "@/services/wildfireTypes";

export type WildfireSelection = {
  item: OfficialWildfirePerimeter;
  source: "live" | "cached" | "unavailable";
  fetchedAt: string | null;
  coverage: "TX" | "US";
  available: number | null;
  omitted: number | null;
  truncated: boolean;
  reason: string | null;
};

export const WILDFIRE_LIMIT_COPY = "Published perimeters may lag fire conditions. Some fires have no mapped perimeter. These outlines do not show evacuation areas or verify safety. Follow local emergency officials.";

export function wildfireCaptureLabel(capturedAt: string | null): string {
  return capturedAt ? `Captured: ${new Date(capturedAt).toLocaleString()}` : "CAPTURE DATE UNKNOWN";
}

/** A selection retains the source copy and its capture date even after the feed changes. */
export function wildfireDetailSource(selection: WildfireSelection | null, current: {
  source: "live" | "cached" | "unavailable";
  fetchedAt: string | null;
  coverage: "TX" | "US";
  items: OfficialWildfirePerimeter[];
}): "live" | "cached" {
  return selection && selection.source === "live" && current.source === "live" && current.coverage === selection.coverage &&
    current.fetchedAt === selection.fetchedAt && current.items.some((item) =>
      item.id === selection.item.id && item.capturedAt === selection.item.capturedAt &&
      item.polygonUpdatedAt === selection.item.polygonUpdatedAt)
    ? "live" : "cached";
}

export function WildfireDetail({ selection, source, onClose }: {
  selection: WildfireSelection | null;
  source: "live" | "cached";
  onClose: () => void;
}) {
  const item = selection?.item;
  return <Modal visible={!!selection} animationType="none" presentationStyle="fullScreen" onRequestClose={onClose}>
    {selection && item && <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen header={<ActionButton title="Close perimeter" secondary onPress={onClose} />}>
        <SectionTitle>{source === "live" ? "NIFC / LAST VERIFIED COPY" : "NIFC / CACHED · UNVERIFIED"}</SectionTitle>
        <Heading>Published perimeter</Heading>
        <Body>{item.name}</Body>
        <Panel>
          <SectionTitle>Capture / mapping</SectionTitle>
          <Body>{wildfireCaptureLabel(item.capturedAt)}</Body>
          <Body>Mapping method: {item.mapMethod || "NOT SUPPLIED"}</Body>
          <Body>Mapped footprint: {item.acres === null ? "NOT SUPPLIED" : `${item.acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres`}</Body>
          <Body>A new download or record edit does not establish a current fire edge. The footprint does not show where fire is actively burning.</Body>
        </Panel>
        <SectionTitle>Record / incident</SectionTitle>
        <Body>Polygon record edited: {item.polygonUpdatedAt ? new Date(item.polygonUpdatedAt).toLocaleString() : "NOT SUPPLIED"}</Body>
        <Body>Incident record edited: {item.incidentUpdatedAt ? new Date(item.incidentUpdatedAt).toLocaleString() : "NOT SUPPLIED"}</Body>
        <Body>Reported incident state: {item.state || "NOT SUPPLIED"}</Body>
        <Body>Reported incident size: {item.reportedAcres === null ? "NOT SUPPLIED" : `${item.reportedAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres`}</Body>
        <Body>Reported containment: {item.percentContained === null ? "NOT SUPPLIED" : `${item.percentContained}%`}. This does not verify a location.</Body>
        <Body>Record ID: {item.id}</Body>
        <SectionTitle>Retrieved copy / coverage</SectionTitle>
        <Body>Copy retrieved: {selection.fetchedAt ? new Date(selection.fetchedAt).toLocaleString() : "UNKNOWN"}</Body>
        <Body>{selection.coverage === "TX" ? "Incidents reported in Texas. This is not a geographic intersection search." : "U.S. current-perimeter service. Some incidents have no published perimeter."}</Body>
        <Body>{selection.available === null ? "MATCHING RECORD COUNT UNVERIFIED" : `${selection.available} matching mapped records at count time`}</Body>
        {selection.truncated && <Body>PARTIAL COPY / {selection.omitted === null ? "omitted count unknown" : `${selection.omitted} mapped records not included`}{selection.reason ? `. ${selection.reason}` : ""}</Body>}
        <Body>{WILDFIRE_LIMIT_COPY}</Body>
        <ActionButton title="Open official NIFC record" onPress={() => void openLink(item.sourceUrl)} />
      </Screen>
    </SafeAreaView>}
  </Modal>;
}
