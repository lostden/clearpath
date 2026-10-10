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
import { DEMO_GAUGE } from "@/data/demo";
import type { OfficialEarthquake, RiverGauge } from "@/services/usgsTypes";
import { isRiverObservationDelayed } from "@/services/usgsTypes";
import { fieldMapStyle } from "@/data/mapStyle";
import { geometryIntersectsRegion, pointInRegion, type MapRegion } from "@/domain/mapBounds";
import CoordinateMap from "./CoordinateMap";
import type { OfficialZoneBoundary } from "@/services/nwsZones";
export type MapCanvasProps = {
  point: Coordinates;
  alerts: OfficialAlert[];
  source: "live" | "cached" | "demo" | "unavailable";
  showWarnings?: boolean;
  showGauges?: boolean;
  compact?: boolean;
  onSelectAlert?: (alert: OfficialAlert) => void;
  earthquakes?: OfficialEarthquake[];
  rivers?: RiverGauge[];
  earthquakeSource?: "live" | "cached" | "unavailable";
  riverSource?: "live" | "cached" | "unavailable";
  showEarthquakes?: boolean;
  onSelectEarthquake?: (event: OfficialEarthquake) => void;
  onSelectRiver?: (gauge: RiverGauge) => void;
  pointIsSelection?: boolean;
  initialSpan?: number;
  /** Optional on-demand zone outlines; never substituted for an alert polygon. */
  zoneBoundaries?: OfficialZoneBoundary[];
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
      <>
      <Panel>
        <Body>
          The map needs a configured Google Maps key in this Android build.
          Alerts and preparedness remain available.
        </Body>
      </Panel>
      <CoordinateMap {...props} />
      </>
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
  earthquakes = [],
  rivers = [],
  earthquakeSource = "unavailable",
  riverSource = "unavailable",
  showEarthquakes = false,
  onSelectEarthquake,
  onSelectRiver,
  pointIsSelection = true,
  initialSpan = 0.18,
  zoneBoundaries = [],
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
  const [coordinateView, setCoordinateView] = useState(false);
  useEffect(() => {
    if (!tracksTileCompletion || loaded) return;
    const timer = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, [loaded, tracksTileCompletion]);
  const showStatus = tracksTileCompletion && !loaded;
  const needsSpaceForFailure = showStatus && timedOut && !compact;
  const region = { ...point, latitudeDelta: initialSpan, longitudeDelta: initialSpan };
  const [viewport, setViewport] = useState<MapRegion>(region);
  if (coordinateView) return <View style={{ gap: 12 }}>
    <CoordinateMap point={point} alerts={alerts} source={source} compact={compact}
      showWarnings={showWarnings} showGauges={showGauges} showEarthquakes={showEarthquakes}
      earthquakes={earthquakes} rivers={rivers} earthquakeSource={earthquakeSource} riverSource={riverSource}
      onSelectAlert={onSelectAlert} onSelectEarthquake={onSelectEarthquake} onSelectRiver={onSelectRiver}
      pointIsSelection={pointIsSelection} initialSpan={initialSpan} zoneBoundaries={zoneBoundaries} />
    {!compact && <ActionButton title="Retry Google Maps" secondary onPress={onRetry} />}
  </View>;
  return (
    <View
      style={[
        s.container,
        { minHeight: compact ? 180 : 420 },
        !needsSpaceForFailure && { height: compact ? 180 : 420 },
      ]}
    >
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={region}
        customMapStyle={provider === PROVIDER_GOOGLE ? fieldMapStyle : undefined}
        userInterfaceStyle="dark"
        onRegionChangeComplete={setViewport}
        onMapLoaded={
          tracksTileCompletion ? () => setLoaded(true) : undefined
        }
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        rotateEnabled={false}
        pitchEnabled={false}
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterests={false}
        showsScale
        showsUserLocation={false}
        toolbarEnabled={false}
        importantForAccessibility={showStatus ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={showStatus}
        accessibilityLabel={source !== "demo" && zoneBoundaries.length ? "Map of NWS affected zone outlines. Not warning polygons or measured hazard extent." : pointIsSelection ? "Map of selected point and source warning areas" : "Regional map of source warning areas"}
      >
        {pointIsSelection && <Marker
          coordinate={point}
          title="Selected location"
          description={`${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}
          pinColor={colors.navy}
        />}
        {showWarnings &&
          alerts.flatMap((alert) => {
            const geometry = alert.geometry;
            if (!geometry) return [];
            if (!geometryIntersectsRegion(geometry, viewport)) return [];
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
                fillColor={source === "cached" ? "rgba(176,176,176,0.20)" : severe ? "rgba(255,90,0,0.22)" : "rgba(255,212,0,0.16)"}
                strokeColor={source === "cached" ? "#B0B0B0" : severe ? colors.orange : colors.yellow}
                strokeWidth={3}
                tappable
                onPress={() => onSelectAlert?.(alert)}
              />
            ));
          })}
        {source !== "demo" && zoneBoundaries.flatMap((boundary) => {
          if (!geometryIntersectsRegion(boundary.geometry, viewport)) return [];
          const polygons = boundary.geometry.type === "Polygon" ? [boundary.geometry.coordinates] : boundary.geometry.coordinates;
          return polygons.map((rings, index) => <Polygon key={`zone-${boundary.url}-${index}`}
            coordinates={rings[0].map(([longitude, latitude]) => ({ latitude, longitude }))}
            holes={rings.slice(1).map((ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude })))}
            fillColor="transparent" strokeColor={boundary.cached ? "#B0B0B0" : colors.ink} strokeWidth={2} />);
        })}
        {source !== "demo" && showEarthquakes && earthquakes.filter((event) => pointInRegion(event.coordinates, viewport)).map((event) => (
          <Marker key={`earth-${event.id}`} coordinate={event.coordinates}
            pinColor={earthquakeSource === "cached" ? "#B0B0B0" : colors.ink}
            title={`${earthquakeSource === "cached" ? "CACHED / " : "USGS / "}M ${event.magnitude ?? "?"} · ${event.name}`}
            description={`Observed ${new Date(event.observedAt).toLocaleString()}. Epicenter; not an impact area.`}
            onPress={() => onSelectEarthquake?.(event)} />
        ))}
        {source !== "demo" && showGauges && rivers.filter((gauge) => pointInRegion(gauge.coordinates, viewport)).map((gauge) => (
          <Marker key={`river-${gauge.id}`} coordinate={gauge.coordinates}
            pinColor={riverSource === "cached" ? "#B0B0B0" : colors.yellow}
            title={`${riverSource === "cached" ? "CACHED / " : "USGS / "}${gauge.name}`}
            description={gauge.gageHeight ? `${isRiverObservationDelayed(gauge.gageHeight) ? "DELAYED / " : ""}${gauge.gageHeight.displayValue} ${gauge.gageHeight.units} gage height. Observed ${new Date(gauge.gageHeight.observedAt).toLocaleString()}; not flood depth.` : "Gage height unavailable."}
            onPress={() => onSelectRiver?.(gauge)} />
        ))}
        {source === "demo" && showGauges && (
          <Marker
            coordinate={DEMO_GAUGE.coordinate}
            pinColor={colors.yellow}
            title="SIMULATED river observation"
            description={DEMO_GAUGE.description}
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
                  {pointIsSelection ? "Open the selected point in Google Maps below, or view supplied areas without a basemap." : "View supplied areas without a basemap. Set a location on Home for nearby river observations."}
                </Body>
                <ActionButton title="Retry map" secondary onPress={onRetry} />
                <ActionButton title="View areas without basemap" onPress={() => setCoordinateView(true)} />
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
            onPress={() => ref.current?.animateToRegion(region, 0)}
          />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 0,
    borderWidth: 2,
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
  failureStatus: { position: "relative", minHeight: 420 },
  recenter: { position: "absolute", right: 12, bottom: 28 },
});
