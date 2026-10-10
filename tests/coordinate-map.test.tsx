import { fireEvent, render } from "@testing-library/react-native";
import CoordinateMap, { projectCoordinate } from "../src/components/CoordinateMap";
import { DEMO_LOCATION, getDemoSnapshot } from "../src/data/demo";
import type { OfficialAlert } from "../src/domain/types";
import type { OfficialEarthquake, RiverGauge } from "../src/services/usgsTypes";
import type { OfficialZoneBoundary } from "../src/services/nwsZones";
import { officialAlert } from "./fixtures/officialAlert";

// Retain SVG drawing/touch properties as host props for behavior assertions.
jest.mock("react-native-svg", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  function Shape({ children, ...props }: { children?: import("react").ReactNode }) {
    return React.createElement(View, props, children);
  }
  function Label({ children, ...props }: { children?: import("react").ReactNode }) {
    return React.createElement(Text, props, children);
  }
  return { __esModule: true, default: Shape, ClipPath: Shape, Defs: Shape, G: Shape, Line: Shape, Path: Shape, Rect: Shape, Text: Label };
});

const point = { latitude: 30, longitude: -99 };
const warning: OfficialAlert = {
  ...officialAlert,
  geometry: {
    type: "Polygon",
    coordinates: [
      [[-99.05, 29.95], [-98.95, 29.95], [-98.95, 30.05], [-99.05, 30.05], [-99.05, 29.95]],
      [[-99.01, 29.99], [-99.01, 30.01], [-98.99, 30.01], [-98.99, 29.99], [-99.01, 29.99]],
    ],
  },
};
const quake: OfficialEarthquake = {
  id: "earth-1", name: "Test epicenter", coordinates: point, magnitude: 2, depthKm: 4,
  observedAt: "2026-10-10T20:00:00Z", updatedAt: "2026-10-10T20:01:00Z",
  reviewStatus: "reviewed", sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/earth-1",
};
const river: RiverGauge = {
  id: "USGS-test", name: "Test river station", coordinates: { latitude: 30.02, longitude: -99.02 },
  distanceKm: 3, sourceUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-test/",
  gageHeight: null, streamflow: null,
};
const zone: OfficialZoneBoundary = {
  url: "https://api.weather.gov/zones/forecast/TXZ173", id: "TXZ173", name: "Official test zone",
  zoneType: "forecast", geometry: warning.geometry!, fetchedAt: "2026-10-10T20:00:00Z", cached: false,
};

test("plots outer rings and holes with evenodd and forwards the original warning unchanged", async () => {
  const onSelectAlert = jest.fn();
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="live" onSelectAlert={onSelectAlert} />);
  const path = screen.getByTestId(`coordinate-area-${warning.id}-0-0`);
  expect(path.props.fillRule).toBe("evenodd");
  expect(path.props.clipRule).toBe("evenodd");
  expect(path.props.d.match(/M/g)).toHaveLength(2);
  expect(path.props.d.match(/Z/g)).toHaveLength(2);
  await fireEvent.press(path);
  expect(onSelectAlert).toHaveBeenCalledWith(warning);
  expect(warning.instruction).toBe(officialAlert.instruction);
  expect(screen.getByText("NO BASEMAP / COORDINATE VIEW")).toBeTruthy();
  expect(screen.getByText("SCHEMATIC / NOT NAVIGATION")).toBeTruthy();
});

test("MultiPolygon parts retain independent holes and supplied coordinates", async () => {
  const multi: OfficialAlert = { ...warning, geometry: { type: "MultiPolygon", coordinates: [warning.geometry!.type === "Polygon" ? warning.geometry!.coordinates : [], [[[ -99.07, 30.02], [-99.06, 30.02], [-99.06, 30.03], [-99.07, 30.02]]]] } };
  const screen = await render(<CoordinateMap point={point} alerts={[multi]} source="live" />);
  expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`).props.d.match(/M/g)).toHaveLength(2);
  expect(screen.getByTestId(`coordinate-area-${warning.id}-1-0`).props.d.match(/M/g)).toHaveLength(1);
});

test("cached fills and outlines are gray and USGS provenance stays separate from NWS", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="cached" showEarthquakes earthquakes={[quake]} earthquakeSource="live" showGauges rivers={[river]} riverSource="cached" />);
  const path = screen.getByTestId(`coordinate-area-${warning.id}-0-0`);
  expect(path.props.stroke).toBe("#B0B0B0");
  expect(path.props.fill).toBe("rgba(176,176,176,0.20)");
  expect(screen.getByText("WEATHER / NWS / CACHED / UNVERIFIED")).toBeTruthy();
  expect(screen.getByText("EARTHQUAKES / USGS / VERIFIED COPY")).toBeTruthy();
  expect(screen.getByText("RIVERS / USGS / CACHED / UNVERIFIED")).toBeTruthy();
  expect(screen.queryByText("LIVE · OFFICIAL NWS")).toBeNull();
});

test("demo suppresses accidentally supplied real USGS items and draws only the fictional station", async () => {
  const screen = await render(<CoordinateMap point={DEMO_LOCATION.coordinates} alerts={getDemoSnapshot("flood").alerts} source="demo" showGauges showEarthquakes earthquakes={[{ ...quake, coordinates: DEMO_LOCATION.coordinates }]} rivers={[{ ...river, coordinates: DEMO_LOCATION.coordinates }]} earthquakeSource="live" riverSource="live" />);
  expect(screen.queryByTestId(`coordinate-earthquake-${quake.id}`)).toBeNull();
  expect(screen.queryByTestId(`coordinate-river-${river.id}`)).toBeNull();
  expect(screen.getByTestId("coordinate-demo-gauge")).toBeTruthy();
  expect(screen.getByText("WEATHER / SIMULATED / JUL 04 2025 / 05:15 CDT")).toBeTruthy();
  expect(screen.getByText("RIVER / SIMULATED / TRAINING ONLY")).toBeTruthy();
});

test("linear projection keeps north upward and wraps a nearby dateline point", () => {
  const region = { ...point, latitudeDelta: 0.2, longitudeDelta: 0.2 };
  expect(projectCoordinate(point, region)).toEqual({ x: 200, y: 108 });
  expect(projectCoordinate({ latitude: 30.05, longitude: -98.95 }, region).x).toBeGreaterThan(200);
  expect(projectCoordinate({ latitude: 30.05, longitude: -98.95 }, region).y).toBeLessThan(108);
  const east = projectCoordinate({ latitude: 0, longitude: -179 }, { latitude: 0, longitude: 179, latitudeDelta: 8, longitudeDelta: 8 });
  expect(east.x).toBe(252);
});

test("zoom changes plotted positions and recenter returns to the initial view", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="live" showGauges rivers={[river]} riverSource="live" initialSpan={0.2} />);
  const before = screen.getByTestId(`coordinate-river-${river.id}`).props.transform;
  await fireEvent.press(screen.getByRole("button", { name: "Zoom in" }));
  const zoomed = screen.getByTestId(`coordinate-river-${river.id}`).props.transform;
  expect(zoomed).not.toBe(before);
  await fireEvent.press(screen.getByRole("button", { name: "Recenter coordinate view" }));
  expect(screen.getByTestId(`coordinate-river-${river.id}`).props.transform).toBe(before);
});

test("remote supplied areas are reported as outside the view and zooming out reveals them", async () => {
  const remote: OfficialAlert = { ...warning, geometry: { type: "Polygon", coordinates: [[[-99.3, 30], [-99.2, 30], [-99.2, 30.03], [-99.3, 30.03], [-99.3, 30]]] } };
  const screen = await render(<CoordinateMap point={point} alerts={[remote]} source="live" initialSpan={0.2} />);
  expect(screen.queryByTestId(`coordinate-area-${warning.id}-0-0`)).toBeNull();
  expect(screen.getByText("1 mapped warning record is outside this view. Zoom out to inspect.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Zoom out" }));
  await fireEvent.press(screen.getByRole("button", { name: "Zoom out" }));
  expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`)).toBeTruthy();
});

test("compact mode contains no nested buttons or interactive shapes", async () => {
  const callback = jest.fn();
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="live" compact showGauges rivers={[river]} riverSource="live" onSelectAlert={callback} onSelectRiver={callback} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`).props.onPress).toBeUndefined();
  expect(screen.getByTestId(`coordinate-river-hit-${river.id}`).props.onPress).toBeUndefined();
});

test("overview coordinates are not rendered as a selected point and unavailable data is explicit", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[]} source="unavailable" pointIsSelection={false} />);
  expect(screen.queryByTestId("coordinate-selected-point")).toBeNull();
  expect(screen.getByText("WEATHER / NWS / DATA UNAVAILABLE")).toBeTruthy();
  expect(screen.getByText("Warning data unavailable.")).toBeTruthy();
  expect(screen.getByText(/An empty view does not establish safety/)).toBeTruthy();
  expect(screen.queryByText(/No active alerts|Safe|All clear/)).toBeNull();
});

test("symbolic observation targets forward the original records rather than imply impact areas", async () => {
  const onSelectEarthquake = jest.fn();
  const onSelectRiver = jest.fn();
  const screen = await render(<CoordinateMap point={point} alerts={[]} source="live" showGauges rivers={[river]} riverSource="live" showEarthquakes earthquakes={[quake]} earthquakeSource="live" onSelectEarthquake={onSelectEarthquake} onSelectRiver={onSelectRiver} />);
  await fireEvent.press(screen.getByTestId(`coordinate-earthquake-hit-${quake.id}`));
  await fireEvent.press(screen.getByTestId(`coordinate-river-hit-${river.id}`));
  expect(onSelectEarthquake).toHaveBeenCalledWith(quake);
  expect(onSelectRiver).toHaveBeenCalledWith(river);
  expect(screen.queryByTestId("coordinate-demo-gauge")).toBeNull();
});

test("a dateline warning is not drawn across unrelated longitudes and stays continuous in a dateline view", async () => {
  const crossing: OfficialAlert = { ...warning, geometry: { type: "Polygon", coordinates: [
    [[170, -2], [-170, -2], [-170, 2], [170, 2], [170, -2]],
  ] } };
  const screen = await render(<CoordinateMap point={{ latitude: 0, longitude: 0 }} initialSpan={4} alerts={[crossing]} source="live" />);
  expect(screen.queryByTestId(`coordinate-area-${warning.id}-0-0`)).toBeNull();
  expect(screen.getByText("1 mapped warning record is outside this view. Zoom out to inspect.")).toBeTruthy();
  await screen.rerender(<CoordinateMap point={{ latitude: 0, longitude: -180 }} initialSpan={4} alerts={[crossing]} source="live" />);
  expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`)).toBeTruthy();
  expect(screen.queryByText(/outside this view/)).toBeNull();
});

test("installed SVG primitives render the viewBox, clipping and evenodd path with the SDK native mocks", async () => {
  const Actual = jest.requireActual<typeof import("react-native-svg")>("react-native-svg");
  const screen = await render(<Actual.default testID="real-svg" width="100%" height={240} viewBox="0 0 320 240">
    <Actual.Defs><Actual.ClipPath id="real-window"><Actual.Rect x={0} y={0} width={320} height={240} /></Actual.ClipPath></Actual.Defs>
    <Actual.G clipPath="url(#real-window)"><Actual.Path testID="real-path" d="M0 0 L100 0 L100 100 Z M20 20 L40 20 L40 40 Z" fillRule="evenodd" clipRule="evenodd" fill="rgba(176,176,176,0.20)" stroke="#B0B0B0" /></Actual.G>
  </Actual.default>);
  expect(screen.getByTestId("real-svg")).toBeTruthy();
  expect(screen.getByTestId("real-path")).toBeTruthy();
});

test("a disabled weather layer says OFF while independent USGS glyphs retain their own provenance", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="live" showWarnings={false} pointIsSelection={false} showEarthquakes earthquakes={[quake]} earthquakeSource="cached" />);
  expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
  expect(screen.getByText("EARTHQUAKES / USGS / CACHED / UNVERIFIED")).toBeTruthy();
  expect(screen.getByTestId(`coordinate-earthquake-${quake.id}`)).toBeTruthy();
  expect(screen.queryByTestId(`coordinate-area-${warning.id}-0-0`)).toBeNull();
  expect(screen.queryByText(/SELECTED POINT/)).toBeNull();
  expect(screen.queryByText(/R STATION/)).toBeNull();
});

test("official zone rings and holes remain unfilled outlines when weather is off or unavailable", async () => {
  const screen = await render(<CoordinateMap point={point} initialSpan={0.2} alerts={[warning]} source="unavailable" showWarnings={false} pointIsSelection={false} zoneBoundaries={[zone]} />);
  const outline = screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0");
  expect(outline.props.d).toBe("M148.00 149.00 L252.00 149.00 L252.00 67.00 L148.00 67.00 L148.00 149.00 Z M189.60 116.20 L189.60 99.80 L210.40 99.80 L210.40 116.20 L189.60 116.20 Z");
  expect(outline.props.fill).toBe("none");
  expect(outline.props.stroke).toBe("#FFFFFF");
  expect(outline.props.fillRule).toBe("evenodd");
  expect(outline.props.clipRule).toBe("evenodd");
  expect(outline.props.onPress).toBeUndefined();
  expect(screen.queryByTestId(`coordinate-area-${warning.id}-0-0`)).toBeNull();
  expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
  expect(screen.getByText("NWS / ZONE BOUNDARIES / OUTLINES ONLY")).toBeTruthy();
  expect(screen.getByText("WHITE OUTLINE / NWS ZONE")).toBeTruthy();
  expect(screen.getByText("Official zone boundaries are not warning polygons or measured hazard extent.")).toBeTruthy();
  expect(screen.queryByText(/mapped warning/)).toBeNull();
  expect(zone.geometry).toBe(warning.geometry);
});

test("cached zone outlines use their own cache status rather than the warning source", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[warning]} source="live" zoneBoundaries={[{ ...zone, cached: true }]} />);
  const outline = screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0");
  expect(outline.props.fill).toBe("none");
  expect(outline.props.stroke).toBe("#B0B0B0");
  expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`).props.stroke).not.toBe("#B0B0B0");
  expect(screen.getByText("WEATHER / NWS / VERIFIED COPY")).toBeTruthy();
  expect(screen.getByText("WHITE OUTLINE / NWS ZONE / GRAY OUTLINE / CACHED NWS ZONE")).toBeTruthy();
});

test("zone MultiPolygon parts are culled separately from warnings and unwrap dateline holes", async () => {
  const crossing: OfficialZoneBoundary = { ...zone, geometry: { type: "MultiPolygon", coordinates: [
    [
      [[179, -1], [-179, -1], [-179, 1], [179, 1], [179, -1]],
      [[179.5, -0.5], [179.5, 0.5], [-179.5, 0.5], [-179.5, -0.5], [179.5, -0.5]],
    ],
    [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]],
  ] } };
  const screen = await render(<CoordinateMap point={{ latitude: 0, longitude: 0 }} initialSpan={4} alerts={[]} source="live" zoneBoundaries={[crossing]} />);
  expect(screen.queryByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeNull();
  expect(screen.getByText("1 NWS zone boundary is outside this view. Zoom out to inspect.")).toBeTruthy();
  expect(screen.queryByText(/mapped warning/)).toBeNull();
  await screen.rerender(<CoordinateMap point={{ latitude: 0, longitude: -180 }} initialSpan={4} alerts={[]} source="live" zoneBoundaries={[crossing]} />);
  const outline = screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0");
  expect(outline.props.d).toBe("M148.00 149.00 L252.00 149.00 L252.00 67.00 L148.00 67.00 L148.00 149.00 Z M174.00 128.50 L174.00 87.50 L226.00 87.50 L226.00 128.50 L174.00 128.50 Z");
  expect(screen.queryByTestId("coordinate-zone-forecast-TXZ173-1-0")).toBeNull();
  expect(screen.queryByText(/outside this view/)).toBeNull();
});

test("demo excludes accidentally supplied real zone boundaries even with weather off", async () => {
  const screen = await render(<CoordinateMap point={point} alerts={[]} source="demo" showWarnings={false} zoneBoundaries={[zone]} />);
  expect(screen.queryByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeNull();
  expect(screen.queryByText("NWS / ZONE BOUNDARIES / OUTLINES ONLY")).toBeNull();
  expect(screen.queryByText(/OUTLINE \/ NWS ZONE/)).toBeNull();
  expect(screen.queryByText(/NWS zone boundary/)).toBeNull();
  expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
  expect(screen.getByText("SIMULATED SCENE / JUL 04 2025 / 05:15 CDT")).toBeTruthy();
});
