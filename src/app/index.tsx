import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ActionButton,
  Brand,
  Body,
  Panel,
  Screen,
  SectionTitle,
  confirmCall,
} from "@/ui/components";
import { SituationPanel } from "@/components/SituationPanel";
import {
  AlertDetail,
  detailSource,
  type AlertSelection,
} from "@/components/AlertDetail";
import { DemoControls } from "@/components/DemoControls";
import MapCanvas from "@/components/MapCanvas";
import { useAlerts } from "@/hooks/useAlerts";
import { colors } from "@/ui/tokens";
import { LocationPicker } from "@/components/LocationPicker";
import { useAppState } from "@/state/AppState";
export default function HomeScreen() {
  const feed = useAlerts();
  const { locationError } = useAppState();
  const [showLocation, setShowLocation] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertSelection | null>(
    null,
  );
  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefreshing}
            onRefresh={() => void feed.refresh()}
            enabled={feed.canRefresh}
          />
        }
      >
        <View style={s.top}>
          <Brand />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency? Call 911"
            style={s.emergency}
            onPress={() => confirmCall("911")}
          >
            <Text style={s.linkText}>911</Text>
          </Pressable>
        </View>
        <Pressable
          testID="location-picker-button"
          accessibilityRole="button"
          accessibilityLabel="Choose GPS or manual location"
          style={s.location}
          onPress={() => setShowLocation(true)}
        >
          <Text style={s.locationTitle}>
            {feed.selectedLocation?.label || "Choose your location"} →
          </Text>
          <Text style={s.timestamp}>
            {feed.source === "demo"
              ? "Simulated location"
              : feed.selectedLocation?.kind === "gps"
                ? "GPS selection"
                : "Manual selection"}{" "}
            · change location
          </Text>
        </Pressable>
        {locationError && (
          <Panel>
            <Body>{locationError}</Body>
          </Panel>
        )}
        {feed.storageError && (
          <Panel>
            <Body>{feed.storageError}</Body>
          </Panel>
        )}
        {feed.snapshot && (
          <Text style={s.timestamp}>
            {feed.source === "demo"
              ? "Scenario snapshot"
              : "Last successful update"}
            : {new Date(feed.snapshot.fetchedAt).toLocaleString()}
          </Text>
        )}
        {feed.offline && (
          <Panel>
            <SectionTitle>
              {feed.source === "demo"
                ? "Simulated internet outage"
                : "Offline connection"}
            </SectionTitle>
            <Body>
              Current alerts cannot be verified. Preparedness and saved contacts
              remain available.
            </Body>
          </Panel>
        )}
        {feed.selectedLocation ? (
          <SituationPanel
            alerts={feed.alerts}
            source={feed.source}
            loading={feed.isLoading}
            error={!!feed.error}
            onOpenAlert={(alert) =>
              setSelectedAlert({
                alert,
                source: feed.source,
                fetchedAt: feed.snapshot?.fetchedAt ?? null,
              })
            }
          />
        ) : (
          <Panel>
            <SectionTitle>
              Choose a point to check official alerts.
            </SectionTitle>
            <Body>
              Allow foreground GPS or select a manual point. No current
              conditions have been verified yet.
            </Body>
            <ActionButton
              title="Choose location"
              onPress={() => setShowLocation(true)}
            />
          </Panel>
        )}
        {feed.source !== "demo" && feed.selectedLocation && (
          <ActionButton
            title={
              feed.isRefreshing
                ? "Updating alerts…"
                : feed.canRefresh
                  ? "Refresh official alerts"
                  : "Refresh available after request cooldown"
            }
            disabled={!feed.canRefresh}
            secondary
            onPress={() => void feed.refresh()}
          />
        )}
        {feed.expiredCount > 0 && (
          <Body>
            {feed.expiredCount} expired{" "}
            {feed.expiredCount === 1 ? "warning" : "warnings"} excluded from
            this display.
          </Body>
        )}
        <View style={s.divider} />
        <SectionTitle>Around your location</SectionTitle>
        {feed.selectedLocation && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open interactive map"
            onPress={() => router.navigate("/map")}
          >
            <MapCanvas
              compact
              point={feed.selectedLocation.coordinates}
              alerts={feed.alerts}
              source={feed.source}
            />
          </Pressable>
        )}
        <Body>
          Weather warnings take precedence over optional river and road
          information. Follow local emergency authorities.
        </Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open emergency resources"
          style={s.link}
          onPress={() => router.navigate("/prepare")}
        >
          <Text style={s.linkText}>Emergency resources & preparation →</Text>
        </Pressable>
        <View style={s.divider} />
        <SectionTitle>Presentation scenarios</SectionTitle>
        <DemoControls />
        <Body>
          ClearPath cannot verify personal safety or guarantee emergency
          notification delivery.
        </Body>
      </Screen>
      <AlertDetail
        alert={selectedAlert?.alert ?? null}
        source={detailSource(
          selectedAlert,
          feed.source,
          feed.snapshot?.fetchedAt ?? null,
        )}
        fetchedAt={selectedAlert?.fetchedAt}
        onClose={() => setSelectedAlert(null)}
      />
      <LocationPicker
        visible={showLocation}
        onClose={() => setShowLocation(false)}
      />
    </>
  );
}
const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emergency: {
    minWidth: 60,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },
  location: { minHeight: 48, justifyContent: "center", gap: 4 },
  locationTitle: { color: colors.ink, fontSize: 18, fontWeight: "600" },
  timestamp: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginVertical: 4,
  },
  link: { minHeight: 48, justifyContent: "center" },
  linkText: { color: colors.navy, fontSize: 16, fontWeight: "600" },
});
