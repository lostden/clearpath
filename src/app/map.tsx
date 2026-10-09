import { useState } from "react";
import { Switch, View, StyleSheet, Text } from "react-native";
import {
  ActionButton,
  Body,
  Heading,
  Panel,
  Screen,
  SectionTitle,
  SourceBadge,
  openLink,
} from "@/ui/components";
import { useAlerts } from "@/hooks/useAlerts";
import MapCanvas from "@/components/MapCanvas";
import {
  AlertDetail,
  detailSource,
  type AlertSelection,
} from "@/components/AlertDetail";
import { colors } from "@/ui/tokens";
export default function MapScreen() {
  const feed = useAlerts();
  const [warnings, setWarnings] = useState(true);
  const [gauges, setGauges] = useState(true);
  const [selected, setSelected] = useState<AlertSelection | null>(null);
  const point = feed.selectedLocation?.coordinates;
  return (
    <>
      <Screen>
        <Heading>Around you</Heading>
        <Body>
          {feed.selectedLocation?.label || "Select a location on Home."}
        </Body>
        <SourceBadge source={feed.source} />
        {feed.offline && (
          <Body>
            {feed.source === "demo"
              ? "Simulated outage. Cached tiles may be unavailable."
              : "Offline. Map tiles may be unavailable; saved warning areas are unverified."}
          </Body>
        )}
        {point && (
          <MapCanvas
            point={point}
            alerts={feed.alerts}
            source={feed.source}
            showWarnings={warnings}
            showGauges={gauges}
            onSelectAlert={(alert) =>
              setSelected({
                alert,
                source: feed.source,
                fetchedAt: feed.snapshot?.fetchedAt ?? null,
              })
            }
          />
        )}
        <Panel>
          <SectionTitle>Map layers</SectionTitle>
          <View style={s.toggle}>
            <Text style={s.label}>Warning areas</Text>
            <Switch
              accessibilityLabel="Show warning areas"
              value={warnings}
              onValueChange={setWarnings}
            />
          </View>
          {feed.source === "demo" && (
            <View style={s.toggle}>
              <Text style={s.label}>Simulated observation</Text>
              <Switch
                accessibilityLabel="Show simulated observation"
                value={gauges}
                onValueChange={setGauges}
              />
            </View>
          )}
          <Body>
            Outlined areas come from{" "}
            {feed.source === "demo"
              ? "simulated geometry"
              : "NWS warning geometry"}
            . Missing polygons are never drawn.
          </Body>
        </Panel>
        {feed.snapshot && (
          <Body>
            Source snapshot:{" "}
            {new Date(feed.snapshot.fetchedAt).toLocaleString()}
          </Body>
        )}
        {feed.source === "demo" && (
          <Panel>
            <SectionTitle>Simulated river observation</SectionTitle>
            <Body>13.8 ft gage height · 3,750 ft³/s streamflow</Body>
            <Body>
              Fictional presentation values at a simulated station. No
              flood-stage classification is provided.
            </Body>
          </Panel>
        )}
        {feed.source !== "demo" && (
          <ActionButton
            title="Open official USGS river data"
            secondary
            onPress={() => void openLink("https://waterdata.usgs.gov/")}
          />
        )}
        <SectionTitle>Road & travel resources</SectionTitle>
        <ActionButton
          title="Open official DriveTexas"
          onPress={() => void openLink("https://drivetexas.org/")}
        />
        <Body>
          Official road reports may be incomplete or delayed. Standard
          directions do not verify evacuation routes, road passability, or flood
          safety.
        </Body>
        {point && (
          <ActionButton
            title="Open location in Google Maps"
            secondary
            onPress={() =>
              void openLink(
                `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`,
              )
            }
          />
        )}
        {point && (
          <ActionButton
            title="Standard Google Maps directions"
            secondary
            onPress={() =>
              void openLink(
                `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`,
              )
            }
          />
        )}
        <Body>
          Warning data: National Weather Service. Native map attribution is
          provided by Google Maps or Apple Maps.
        </Body>
      </Screen>
      <AlertDetail
        alert={selected?.alert ?? null}
        source={detailSource(
          selected,
          feed.source,
          feed.snapshot?.fetchedAt ?? null,
        )}
        fetchedAt={selected?.fetchedAt}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
const s = StyleSheet.create({
  toggle: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  label: { fontSize: 16, color: colors.ink, flexShrink: 1 },
});
