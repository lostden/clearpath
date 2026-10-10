import { useId, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { MapCanvasProps } from "./MapCanvas";
import type { Coordinates, GeoPosition } from "@/domain/types";
import { geometryIntersectsRegion, pointInRegion, type MapRegion } from "@/domain/mapBounds";
import { DEMO_DATE_LABEL, DEMO_GAUGE } from "@/data/demo";
import { ActionButton } from "@/ui/components";
import { colors, typography } from "@/ui/tokens";
import { CoordinateArea, CoordinateAreaGroup, CoordinateHitRect } from "./CoordinateTargets";

const PLOT = { x: 96, y: 26, width: 208, height: 164 };
const MIN_SPAN = 0.002;
const MAX_SPAN = 360;
const GRAY = "#B0B0B0";
const wrapLongitude = (value: number) => ((value + 540) % 360) - 180;
const clampSpan = (value: number) => Math.max(MIN_SPAN, Math.min(MAX_SPAN, Number.isFinite(value) && value > 0 ? value : 0.18));
function viewport(center: Coordinates, span: number) {
  const limit = 90 - Math.min(180, span) / 2;
  return {
    center: { latitude: Math.max(-limit, Math.min(limit, center.latitude)), longitude: wrapLongitude(center.longitude) },
    span,
  };
}

/** Linear latitude/longitude plotting only; this never evaluates personal alert applicability. */
export function projectCoordinate(point: Coordinates, region: MapRegion): { x: number; y: number } {
  return {
    x: PLOT.x + PLOT.width * (0.5 + wrapLongitude(point.longitude - region.longitude) / region.longitudeDelta),
    y: PLOT.y + PLOT.height * (0.5 - (point.latitude - region.latitude) / region.latitudeDelta),
  };
}

function sourceLabel(source: MapCanvasProps["source"]): string {
  return source === "live" ? "VERIFIED COPY" : source === "cached" ? "CACHED / UNVERIFIED" : source === "demo" ? "SIMULATED" : "DATA UNAVAILABLE";
}

function polygonPaths(rings: GeoPosition[][], region: MapRegion): string[] {
  const anchor = rings[0]?.[0];
  if (!anchor) return [];
  const latitudes = rings[0].map((position) => position[1]);
  if (Math.max(...latitudes) < region.latitude - region.latitudeDelta / 2 ||
      Math.min(...latitudes) > region.latitude + region.latitudeDelta / 2) return [];
  const firstOffset = wrapLongitude(anchor[0] - region.longitude);
  // Unwrap consecutive vertices together, preserving a narrow dateline area.
  // Holes use the outer ring's longitude branch rather than crossing the plot.
  const unwrapped = rings.map((ring) => {
    let previous = firstOffset;
    return ring.map(([longitude, latitude]) => {
      let offset = wrapLongitude(longitude - region.longitude);
      while (offset - previous > 180) offset -= 360;
      while (offset - previous < -180) offset += 360;
      previous = offset;
      return [offset, latitude] as const;
    });
  });
  const outerOffsets = unwrapped[0].map(([offset]) => offset);
  const minimum = Math.min(...outerOffsets);
  const maximum = Math.max(...outerOffsets);
  // A world window may show the same dateline polygon at both plot edges.
  return [-360, 0, 360].filter((shift) => maximum + shift >= -region.longitudeDelta / 2 && minimum + shift <= region.longitudeDelta / 2).map((shift) =>
    unwrapped.map((ring) => ring.map(([offset, latitude], index) => {
      const x = PLOT.x + PLOT.width * (0.5 + (offset + shift) / region.longitudeDelta);
      const y = PLOT.y + PLOT.height * (0.5 - (latitude - region.latitude) / region.latitudeDelta);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z").join(" "),
  );
}

export default function CoordinateMap(props: MapCanvasProps) {
  return <CoordinatePlot key={`${props.point.latitude},${props.point.longitude},${props.initialSpan ?? 0.18}`} {...props} />;
}

function CoordinatePlot({
  point, alerts, source, compact = false, pointIsSelection = true,
  initialSpan = 0.18, showWarnings = true, showGauges = false,
  showEarthquakes = false, earthquakes = [], rivers = [],
  earthquakeSource = "unavailable", riverSource = "unavailable",
  zoneBoundaries = [],
  wildfirePerimeters = [], wildfireSource = "unavailable", showWildfires = false,
  onSelectAlert, onSelectEarthquake, onSelectRiver, onSelectWildfire,
}: MapCanvasProps) {
  const [{ center, span }, setViewport] = useState(() => viewport(point, clampSpan(initialSpan)));
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clip = `coordinate-window-${id}`;
  const latitudeDelta = Math.min(180, span);
  const region: MapRegion = {
    ...center, latitudeDelta, longitudeDelta: span,
  };
  const latitudeLimit = 90 - latitudeDelta / 2;
  const pan = (north: number, east: number) => setViewport((current) => viewport({
    latitude: current.center.latitude + north * Math.min(180, current.span) / 2,
    longitude: current.center.longitude + east * current.span / 2,
  }, current.span));
  const zoom = (scale: number) => setViewport((current) => viewport(current.center, clampSpan(current.span * scale)));
  const mapped = showWarnings ? alerts.filter((alert) => alert.geometry !== null) : [];
  const drawings = mapped.flatMap((alert) => {
    const geometry = alert.geometry!;
    if (!geometryIntersectsRegion(geometry, region)) return [];
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const paths = polygons.flatMap((rings, polygonIndex) => polygonPaths(rings, region).map((d, copyIndex) => ({ d, polygonIndex, copyIndex })));
    return paths.length ? [{ alert, paths }] : [];
  });
  const outside = mapped.length - drawings.length;
  const realZones = source === "demo" ? [] : zoneBoundaries;
  const zoneDrawings = realZones.flatMap((boundary) => {
    if (!geometryIntersectsRegion(boundary.geometry, region)) return [];
    const polygons = boundary.geometry.type === "Polygon" ? [boundary.geometry.coordinates] : boundary.geometry.coordinates;
    const paths = polygons.flatMap((rings, polygonIndex) => polygonPaths(rings, region).map((d, copyIndex) => ({ d, polygonIndex, copyIndex })));
    return paths.length ? [{ boundary, paths }] : [];
  });
  const outsideZones = realZones.length - zoneDrawings.length;
  const realWildfires = source !== "demo" && showWildfires ? wildfirePerimeters : [];
  const wildfireDrawings = realWildfires.flatMap((perimeter) => {
    if (!geometryIntersectsRegion(perimeter.geometry, region)) return [];
    const polygons = perimeter.geometry.type === "Polygon" ? [perimeter.geometry.coordinates] : perimeter.geometry.coordinates;
    const paths = polygons.flatMap((rings) => polygonPaths(rings, region));
    return paths.length ? [{ perimeter, paths }] : [];
  });
  const outsideWildfires = realWildfires.length - wildfireDrawings.length;
  const realEarthquakes = source !== "demo" && showEarthquakes ? earthquakes.filter((event) => pointInRegion(event.coordinates, region)) : [];
  const realRivers = source !== "demo" && showGauges ? rivers.filter((gauge) => pointInRegion(gauge.coordinates, region)) : [];
  const showDemoGauge = source === "demo" && showGauges && pointInRegion(DEMO_GAUGE.coordinate, region);
  const selection = projectCoordinate(point, region);
  const selectionOutside = selection.x < PLOT.x - 1e-6 || selection.x > PLOT.x + PLOT.width + 1e-6 ||
    selection.y < PLOT.y - 1e-6 || selection.y > PLOT.y + PLOT.height + 1e-6;
  const decimals = span < 1 ? 4 : 1;
  const axisText = { fill: colors.secondary, fontSize: 17, fontFamily: typography.body };
  return <View testID="coordinate-map" style={s.container}>
    <Text style={s.title}>NO BASEMAP / COORDINATE VIEW</Text>
    <Text style={s.note}>SCHEMATIC / NOT NAVIGATION</Text>
    <Text style={s.provenance}>{!showWarnings ? "WEATHER / OFF" : source === "demo" ? `WEATHER / SIMULATED / ${DEMO_DATE_LABEL}` : `WEATHER / NWS / ${sourceLabel(source)}`}</Text>
    {source === "demo" && !showWarnings && <Text style={s.provenance}>SIMULATED SCENE / {DEMO_DATE_LABEL}</Text>}
    {source !== "demo" && showEarthquakes && <Text style={s.provenance}>EARTHQUAKES / USGS / {sourceLabel(earthquakeSource)}</Text>}
    {source !== "demo" && showGauges && <Text style={s.provenance}>RIVERS / USGS / {sourceLabel(riverSource)}</Text>}
    {source !== "demo" && showWildfires && <Text style={s.provenance}>WILDFIRE / NIFC / {sourceLabel(wildfireSource)}</Text>}
    {source === "demo" && showGauges && <Text style={s.provenance}>RIVER / SIMULATED / TRAINING ONLY</Text>}
    {realZones.length > 0 && <>
      <Text style={s.provenance}>NWS / ZONE BOUNDARIES / OUTLINES ONLY</Text>
      <Text style={s.note}>Official zone boundaries are not warning polygons or measured hazard extent.</Text>
    </>}
    <View style={s.plot}>
      <Svg testID="coordinate-svg" width="100%" height="100%" viewBox="0 0 320 240" accessibilityLabel="Schematic longitude and latitude plot. No roads or navigation information.">
        <Defs><ClipPath id={clip}><Rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height} /></ClipPath></Defs>
        <Rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height} fill={colors.background} stroke={colors.ink} strokeWidth={2} />
        {[0.25, 0.5, 0.75].map((fraction) => <G key={fraction}>
          <Line x1={PLOT.x + PLOT.width * fraction} x2={PLOT.x + PLOT.width * fraction} y1={PLOT.y} y2={PLOT.y + PLOT.height} stroke="#444444" strokeWidth={1} />
          <Line x1={PLOT.x} x2={PLOT.x + PLOT.width} y1={PLOT.y + PLOT.height * fraction} y2={PLOT.y + PLOT.height * fraction} stroke="#444444" strokeWidth={1} />
        </G>)}
        <G clipPath={`url(#${clip})`}>
          {drawings.map(({ alert, paths }) => {
            const severe = alert.severity === "Severe" || alert.severity === "Extreme";
            const gray = source === "cached" || source === "unavailable";
            return <CoordinateAreaGroup key={alert.id} testID={`coordinate-area-${alert.id}`}
              onActivate={!compact && onSelectAlert ? () => onSelectAlert(alert) : undefined}
              label={`${sourceLabel(source)} warning area: ${alert.event}`}>
              {paths.map(({ d, polygonIndex, copyIndex }) => <Path
                key={`${polygonIndex}-${copyIndex}`} testID={`coordinate-area-${alert.id}-${polygonIndex}-${copyIndex}`}
                d={d}
                fill={gray ? "rgba(176,176,176,0.20)" : severe ? "rgba(255,90,0,0.24)" : "rgba(255,212,0,0.18)"}
                stroke={gray ? GRAY : severe ? colors.orange : colors.yellow} strokeWidth={2}
                fillRule="evenodd" clipRule="evenodd"
              />)}
            </CoordinateAreaGroup>;
          })}
          {zoneDrawings.flatMap(({ boundary, paths }) => paths.map(({ d, polygonIndex, copyIndex }) => <Path
            key={`zone-${boundary.url}-${polygonIndex}-${copyIndex}`} testID={`coordinate-zone-${boundary.zoneType}-${boundary.id}-${polygonIndex}-${copyIndex}`}
            d={d} fill="none" stroke={boundary.cached ? GRAY : colors.ink} strokeWidth={2}
            fillRule="evenodd" clipRule="evenodd"
          />))}
          {wildfireDrawings.map(({ perimeter, paths }) => {
            const capture = perimeter.capturedAt ? `Captured: ${perimeter.capturedAt}.` : "CAPTURE UNKNOWN";
            // Keep every closed outer/hole/dateline subpath, with one accessible
            // action for the published record instead of one per polygon part.
            return <CoordinateArea
              key={`wildfire-${perimeter.id}`} testID={`coordinate-wildfire-${perimeter.id}`}
              d={paths.join(" ")} fill="none" stroke={wildfireSource === "live" ? colors.ink : GRAY} strokeWidth={3}
              onActivate={!compact && onSelectWildfire ? () => onSelectWildfire(perimeter) : undefined}
              label={`${sourceLabel(wildfireSource)} published wildfire perimeter: ${perimeter.name}. ${capture}`}
            />;
          })}
          {pointIsSelection && <Path testID="coordinate-selected-point" d={`M${selection.x - 7} ${selection.y} L${selection.x + 7} ${selection.y} M${selection.x} ${selection.y - 7} L${selection.x} ${selection.y + 7}`} stroke={colors.orange} strokeWidth={3} accessibilityLabel="Selected point, not a current device position" />}
          {realEarthquakes.map((event) => {
            const projected = projectCoordinate(event.coordinates, region);
            return <G key={event.id} testID={`coordinate-earthquake-${event.id}`} transform={`translate(${projected.x},${projected.y})`}>
              <Rect x={-9} y={-10} width={18} height={20} fill={colors.background} stroke={earthquakeSource === "live" ? colors.ink : GRAY} strokeWidth={2} />
              <SvgText x={0} y={6} fill={earthquakeSource === "live" ? colors.ink : GRAY} textAnchor="middle" fontSize={16} fontFamily={typography.bodyStrong}>E</SvgText>
              <CoordinateHitRect testID={`coordinate-earthquake-hit-${event.id}`} x={-32} y={-32} width={64} height={64} onActivate={!compact && onSelectEarthquake ? () => onSelectEarthquake(event) : undefined} label={`USGS ${sourceLabel(earthquakeSource)} earthquake epicenter: ${event.name}`} />
            </G>;
          })}
          {realRivers.map((gauge) => {
            const projected = projectCoordinate(gauge.coordinates, region);
            return <G key={gauge.id} testID={`coordinate-river-${gauge.id}`} transform={`translate(${projected.x},${projected.y})`}>
              <Rect x={-9} y={-10} width={18} height={20} fill={colors.background} stroke={riverSource === "live" ? colors.yellow : GRAY} strokeWidth={2} />
              <SvgText x={0} y={6} fill={riverSource === "live" ? colors.yellow : GRAY} textAnchor="middle" fontSize={16} fontFamily={typography.bodyStrong}>R</SvgText>
              <CoordinateHitRect testID={`coordinate-river-hit-${gauge.id}`} x={-32} y={-32} width={64} height={64} onActivate={!compact && onSelectRiver ? () => onSelectRiver(gauge) : undefined} label={`USGS ${sourceLabel(riverSource)} river station: ${gauge.name}`} />
            </G>;
          })}
          {showDemoGauge && <G testID="coordinate-demo-gauge" transform={`translate(${projectCoordinate(DEMO_GAUGE.coordinate, region).x},${projectCoordinate(DEMO_GAUGE.coordinate, region).y})`}>
            <Rect x={-9} y={-10} width={18} height={20} fill={colors.background} stroke={colors.yellow} strokeWidth={2} />
            <SvgText x={0} y={6} fill={colors.yellow} textAnchor="middle" fontSize={16} fontFamily={typography.bodyStrong}>R</SvgText>
          </G>}
        </G>
        {[0, 0.5, 1].map((fraction) => <G key={`axis-${fraction}`}>
          <SvgText x={88} y={PLOT.y + PLOT.height * fraction + 5} textAnchor="end" {...axisText}>{(region.latitude + latitudeDelta * (0.5 - fraction)).toFixed(decimals)}</SvgText>
          {fraction !== 0.5 && <SvgText x={PLOT.x + PLOT.width * fraction} y={212} textAnchor={fraction === 0 ? "start" : "end"} {...axisText}>{wrapLongitude(region.longitude + span * (fraction - 0.5)).toFixed(decimals)}</SvgText>}
        </G>)}
        <SvgText x={304} y={18} textAnchor="end" fill={colors.ink} fontSize={17} fontFamily={typography.bodyStrong}>N ↑</SvgText>
        <SvgText x={160} y={237} textAnchor="middle" fill={colors.secondary} fontSize={17} fontFamily={typography.body}>LATITUDE ↑ / LONGITUDE →</SvgText>
      </Svg>
    </View>
    <Text style={s.note}>{[pointIsSelection && "+ SELECTED POINT", source !== "demo" && showEarthquakes && "E EPICENTER", showGauges && "R STATION"].filter(Boolean).join(" / ")}</Text>
    {realZones.length > 0 && <Text style={s.note}>WHITE OUTLINE / NWS ZONE{realZones.some((boundary) => boundary.cached) ? " / GRAY OUTLINE / CACHED NWS ZONE" : ""}</Text>}
    {source !== "demo" && showWildfires && <>
      <Text style={s.note}>{wildfireSource === "live" ? "WHITE" : "GRAY"} OUTLINE / PUBLISHED WILDFIRE PERIMETER / NO AREA FILL</Text>
      <Text style={s.note}>{realWildfires.length} PUBLISHED WILDFIRE PERIMETER RECORDS / {wildfireDrawings.length} IN VIEW</Text>
      <Text style={s.note}>Capture dates describe reported perimeter geometry. A fresh download does not establish the current fire edge, heat or an evacuation area.</Text>
      {realWildfires.length === 0 && <Text style={s.note}>{wildfireSource === "live" ? "No published wildfire perimeters in this copy. Unreported fire conditions remain unknown." : wildfireSource === "cached" ? "No wildfire perimeters retained in this copy. Current coverage is unverified." : "Wildfire perimeter data unavailable."}</Text>}
    </>}
    {outside > 0 && <Text style={s.note}>{outside} mapped warning {outside === 1 ? "record is" : "records are"} outside this view.{compact ? " Open the full map to inspect." : " Zoom out to inspect."}</Text>}
    {outsideZones > 0 && <Text style={s.note}>{outsideZones} NWS zone {outsideZones === 1 ? "boundary is" : "boundaries are"} outside this view.{compact ? " Open the full map to inspect." : " Zoom out to inspect."}</Text>}
    {outsideWildfires > 0 && <Text style={s.note}>{outsideWildfires} published wildfire perimeter {outsideWildfires === 1 ? "record is" : "records are"} outside this view.{compact ? " Open the full map to inspect." : " Pan or zoom out to inspect."}</Text>}
    {showWarnings && mapped.length === 0 && <Text style={s.note}>{source === "unavailable" ? "Warning data unavailable." : source === "demo" ? "SIMULATED: No supplied warning areas in this exercise." : "No warning areas were supplied in this copy. Read the warning list."}</Text>}
    {!compact && <>
      <Text testID="coordinate-view-center" style={s.note}>VIEW CENTER / {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)} / VIEWPORT ONLY</Text>
      <Text style={s.note}>VIEW SPAN / {latitudeDelta.toFixed(4)}° latitude × {span.toFixed(4)}° longitude</Text>
      {pointIsSelection && selectionOutside && <Text style={s.note}>Selected point is outside this view.</Text>}
      <Text style={s.note}>Linear coordinate plot. Areas may extend outside the window. Shading is supplied warning geometry, not measured flood extent. An empty view does not establish safety.</Text>
      <View style={s.controls}>
        <View style={s.control}><ActionButton title="Pan north" secondary disabled={latitudeDelta >= 180 || center.latitude >= latitudeLimit} onPress={() => pan(1, 0)} /></View>
        <View style={s.control}><ActionButton title="Pan south" secondary disabled={latitudeDelta >= 180 || center.latitude <= -latitudeLimit} onPress={() => pan(-1, 0)} /></View>
      </View>
      <View style={s.controls}>
        <View style={s.control}><ActionButton title="Pan west" secondary disabled={span >= MAX_SPAN} onPress={() => pan(0, -1)} /></View>
        <View style={s.control}><ActionButton title="Pan east" secondary disabled={span >= MAX_SPAN} onPress={() => pan(0, 1)} /></View>
      </View>
      <View style={s.controls}>
        <View style={s.control}><ActionButton title="Zoom in" secondary disabled={span <= MIN_SPAN} onPress={() => zoom(0.5)} /></View>
        <View style={s.control}><ActionButton title="Zoom out" secondary disabled={span >= MAX_SPAN} onPress={() => zoom(2)} /></View>
      </View>
      <ActionButton title="Recenter coordinate view" secondary onPress={() => setViewport(viewport(point, clampSpan(initialSpan)))} />
    </>}
  </View>;
}

const s = StyleSheet.create({
  container: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.background, padding: 12, gap: 10, width: "100%" },
  title: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  provenance: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  note: { color: colors.secondary, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  plot: { width: "100%", aspectRatio: 4 / 3 },
  controls: { flexDirection: "row", gap: 10 },
  control: { flex: 1 },
});
