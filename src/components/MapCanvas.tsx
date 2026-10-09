import { useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import type { Coordinates, OfficialAlert } from "@/domain/types";
import { ActionButton, Body, Panel } from "@/ui/components";
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
export default function MapCanvas({
  point,
  alerts,
  source,
  showWarnings = true,
  showGauges = false,
  compact = false,
  onSelectAlert,
}: MapCanvasProps) {
  const ref = useRef<MapView>(null);
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
  const region = { ...point, latitudeDelta: 0.18, longitudeDelta: 0.18 };
  return (
    <View style={[s.container, { height: compact ? 180 : 380 }]}>
      <MapView
        key={`${provider}-${point.latitude}-${point.longitude}`}
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={region}
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        rotateEnabled={!compact}
        showsUserLocation={false}
        toolbarEnabled={false}
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
      {!compact && (
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
  },
  recenter: { position: "absolute", right: 12, bottom: 28 },
});
