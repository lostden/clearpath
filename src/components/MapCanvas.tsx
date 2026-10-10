import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapView, {
  Marker,
  Polygon,
  PROVIDER_GOOGLE,
  type MapViewProps,
} from "react-native-maps";
import type { Coordinates, OfficialAlert } from "@/domain/types";
import { ActionButton, Body, Panel, SectionTitle } from "@/ui/components";
import { colors } from "@/ui/tokens";
export type MapCanvasProps = {
  point: Coordinates;
  alerts: OfficialAlert[];
  source: "live" | "cached" | "demo" | "unavailable";
  showWarnings?: boolean;
  showGauges?: boolean;
  compact?: boolean;
  onSelectAlert?: (alert: OfficialAlert) => void;
};
export default function MapCanvas(props: MapCanvasProps) {
  const [attempt, setAttempt] = useState(0);
  const inGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const extra = Constants.expoConfig?.extra as
    | { hasAndroidMapsKey?: boolean; hasIosMapsKey?: boolean }
    | undefined;
  if (Platform.OS === "android" && !inGo && !extra?.hasAndroidMapsKey)
    return (
      <Panel>
        <Body>
          The map needs a configured Google Maps key in this Android build.
          Alerts and preparedness remain available.
        </Body>
      </Panel>
    );
  const provider =
    Platform.OS === "android" || (!inGo && extra?.hasIosMapsKey)
      ? PROVIDER_GOOGLE
      : undefined;
  return (
    <NativeMapCanvas
      key={`${provider}-${props.point.latitude}-${props.point.longitude}-${attempt}`}
      {...props}
      provider={provider}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function NativeMapCanvas({
  point,
  alerts,
  source,
  showWarnings = true,
  showGauges = false,
  compact = false,
  onSelectAlert,
  provider,
  onRetry,
}: MapCanvasProps & {
  provider: MapViewProps["provider"];
  onRetry: () => void;
}) {
  const ref = useRef<MapView>(null);
  // MapKit does not emit onMapLoaded; preserve its native map presentation.
  const tracksTileCompletion = provider === PROVIDER_GOOGLE;
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!tracksTileCompletion || loaded) return;
    const timer = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, [loaded, tracksTileCompletion]);
  const showStatus = tracksTileCompletion && !loaded;
  const needsSpaceForFailure = showStatus && timedOut && !compact;
  const region = { ...point, latitudeDelta: 0.18, longitudeDelta: 0.18 };
  return (
    <View
      style={[
        s.container,
        { minHeight: compact ? 180 : 380 },
        !needsSpaceForFailure && { height: compact ? 180 : 380 },
      ]}
    >
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={region}
        onMapLoaded={
          tracksTileCompletion ? () => setLoaded(true) : undefined
        }
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        rotateEnabled={!compact}
        showsUserLocation={false}
        toolbarEnabled={false}
        importantForAccessibility={showStatus ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={showStatus}
        accessibilityLabel="Map of selected location and source warning areas"
      >
        <Marker
          coordinate={point}
          title="Selected location"
          description={`${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}
          pinColor={colors.navy}
        />
        {showWarnings &&
          alerts.flatMap((alert) => {
            const geometry = alert.geometry;
            if (!geometry) return [];
            const polygons =
              geometry.type === "Polygon"
                ? [geometry.coordinates]
                : geometry.coordinates;
            const severe =
              alert.severity === "Severe" || alert.severity === "Extreme";
            return polygons.map((rings, index) => (
              <Polygon
                key={`${alert.id}-${index}`}
                coordinates={(rings[0] || []).map(([longitude, latitude]) => ({
                  latitude,
                  longitude,
                }))}
                holes={rings
                  .slice(1)
                  .map((ring) =>
                    ring.map(([longitude, latitude]) => ({
                      latitude,
                      longitude,
                    })),
                  )}
                fillColor={
                  severe ? "rgba(167,40,50,0.10)" : "rgba(128,83,26,0.10)"
                }
                strokeColor={severe ? colors.danger : colors.caution}
                strokeWidth={2}
                tappable
                onPress={() => onSelectAlert?.(alert)}
              />
            ));
          })}
        {source === "demo" && showGauges && (
          <Marker
            coordinate={{ latitude: 30.031, longitude: -99.153 }}
            pinColor={colors.navy}
            title="SIMULATED river observation"
            description="13.8 ft gage height · 3,750 ft³/s streamflow. Fictional measurements; no flood-stage classification."
          />
        )}
      </MapView>
      {showStatus && (
        <View
          style={[s.status, needsSpaceForFailure && s.failureStatus]}
          pointerEvents={compact || !timedOut ? "none" : "auto"}
          accessibilityLiveRegion="polite"
        >
          {timedOut ? (
            compact ? (
              <Body>Map unavailable</Body>
            ) : (
              <>
                <SectionTitle>Map did not finish loading</SectionTitle>
                <Body>
                  Check your internet connection and retry. Alerts and
                  preparedness remain available.
                </Body>
                <Body>
                  You can open the selected location in Google Maps below.
                </Body>
                <ActionButton title="Retry map" secondary onPress={onRetry} />
              </>
            )
          ) : (
            <>
              <ActivityIndicator color={colors.navy} />
              <Body>Loading map…</Body>
            </>
          )}
        </View>
      )}
      {!compact && !showStatus && (
        <View style={s.recenter}>
          <ActionButton
            title="Recenter"
            secondary
            onPress={() => ref.current?.animateToRegion(region, 350)}
          />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  status: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    padding: 20,
    gap: 12,
    justifyContent: "center",
  },
  failureStatus: { position: "relative", minHeight: 380 },
  recenter: { position: "absolute", right: 12, bottom: 28 },
});
