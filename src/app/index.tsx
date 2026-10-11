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
import { colors, typography } from "@/ui/tokens";
import { LocationPicker } from "@/components/LocationPicker";
import { useAppState } from "@/state/AppState";
import { ShareLocation } from "@/components/ShareLocation";
import { FeedUpdateControl } from "@/components/FeedUpdateControl";
export default function HomeScreen() {
  const feed = useAlerts();
  const { locationError, locationReady } = useAppState();
  const restoringLocation = feed.source !== "demo" && !locationReady && !feed.selectedLocation;
  const [showLocation, setShowLocation] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertSelection | null>(
    null,
  );
  return (
    <>
      <Screen
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefreshing}
            onRefresh={() => void feed.refresh()}
            enabled={feed.canRefresh}
            tintColor={colors.orange}
            colors={[colors.orange]}
          />
        }
      >
        <View style={s.top}>
          <Brand />
          <Text accessibilityRole="header" style={s.kicker}>FIELD STATUS</Text>
        </View>
        <Pressable
          testID="location-picker-button"
          accessibilityRole="button"
          accessibilityLabel="Choose GPS or manual location"
          style={s.location}
          onPress={() => setShowLocation(true)}
        >
          <View style={s.locationRow}>
            <Text style={s.locationTitle}>{feed.selectedLocation?.label || (restoringLocation ? "RESTORING POINT" : "SET LOCATION")}</Text>
            <Text style={s.locationArrow}>→</Text>
          </View>
          <Text style={s.timestamp}>
            {feed.source === "demo"
              ? "Simulated location"
              : restoringLocation
                ? "SAVED POINT / CHECKING"
              : !feed.selectedLocation
                ? "GPS OR MANUAL"
                : feed.selectedLocation.kind === "gps"
                ? "GPS selection"
                : "Manual selection"}{" "}
            · CHANGE
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
              {restoringLocation ? "RESTORING SAVED POINT" : "Set location"}
            </SectionTitle>
            <Body>
              {restoringLocation
                ? "Reading the last selected point from this phone. Alerts are unverified."
                : "Use GPS or enter a point. Current alerts are unverified."}
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
        <ShareLocation selectedLocation={feed.selectedLocation} source={feed.source} />
        <View style={s.divider} />
        {feed.source !== "demo" && <FeedUpdateControl />}
        <SectionTitle>02 / HAZARD MAP</SectionTitle>
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
          Open the map for regional warnings, earthquakes and river observations.
        </Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open emergency resources"
          style={s.link}
          onPress={() => router.navigate("/prepare")}
        >
          <Text style={s.linkText}>GET RESOURCES →</Text>
        </Pressable>
        <View style={s.divider} />
        <SectionTitle>03 / TRAINING DEMO</SectionTitle>
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
  content: { gap: 12 },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 12, lineHeight: 18, flexShrink: 1, maxWidth: "100%" },
  location: { minHeight: 52, justifyContent: "center", gap: 4, borderWidth: 2, borderColor: colors.line, padding: 10 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  locationTitle: { flex: 1, color: colors.ink, fontSize: 17, lineHeight: 25, fontFamily: typography.bodyStrong },
  locationArrow: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 20 },
  timestamp: { color: colors.secondary, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  divider: {
    borderTopWidth: 2,
    borderTopColor: colors.line,
    marginVertical: 4,
  },
  link: { minHeight: 52, justifyContent: "center", borderWidth: 2, borderColor: colors.orange, padding: 14 },
  linkText: { color: colors.orange, fontSize: 16, fontFamily: typography.bodyStrong },
});
