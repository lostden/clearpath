import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Platform, processColor } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapCanvas from "../src/components/MapCanvas";
import { DEMO_GAUGE, DEMO_LOCATION } from "../src/data/demo";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";
import type { Coordinates, GeoPosition } from "../src/domain/types";
import type { OfficialEarthquake, RiverGauge } from "../src/services/usgsTypes";
import type { OfficialZoneBoundary } from "../src/services/nwsZones";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "storeClient",
    expoConfig: { extra: {} },
  },
  ExecutionEnvironment: {
    StoreClient: "storeClient",
    Standalone: "standalone",
    Bare: "bare",
  },
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  let nextMount = 0;
  type MockProps = {
    children?: import("react").ReactNode;
    onMapReady?: () => void;
    onMapLoaded?: () => void;
  };
  const NativeMap = React.forwardRef<unknown, MockProps>(
    function NativeMap({ children, ...props }, ref) {
      const [mount] = React.useState(() => ++nextMount);
      React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
      const nativeProps = {
        ...props,
        // The real MapView always handles native readiness internally, even
        // when the application has no onMapReady callback.
        onMapReady: props.onMapReady ?? (() => {}),
        testID: "native-map",
        nativeID: `map-mount-${mount}`,
      };
      return React.createElement(View, nativeProps, children);
    },
  );
  function Marker({ children, ...props }: MockProps) {
    return React.createElement(View, { ...props, testID: "map-marker" }, children);
  }
  function Polygon({ children, ...props }: MockProps) {
    return React.createElement(View, { ...props, testID: "map-polygon" }, children);
  }
  return {
    __esModule: true,
    default: NativeMap,
    Marker,
    Polygon,
    PROVIDER_GOOGLE: "google",
  };
});

const runtime = Constants as unknown as {
  executionEnvironment: ExecutionEnvironment;
  expoConfig: { extra: { hasAndroidMapsKey?: boolean } };
};
const point = DEMO_LOCATION.coordinates;
const props = { point, alerts: [], source: "demo" as const };

function nativeMap(screen: Awaited<ReturnType<typeof render>>) {
  // Tile callbacks still arrive while the unfinished map is hidden from
  // accessibility; query that mounted native surface explicitly.
  return screen.getByTestId("native-map", { includeHiddenElements: true });
}

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  jest.replaceProperty(Platform, "OS", "android");
  runtime.executionEnvironment = ExecutionEnvironment.StoreClient;
  runtime.expoConfig = { extra: {} };
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

test("native readiness alone does not mean the map tiles finished loading", async () => {
  const screen = await render(<MapCanvas {...props} />);
  expect(screen.getByText("Loading map…")).toBeTruthy();

  await fireEvent(nativeMap(screen), "mapReady");
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("completed tiles clear loading and cannot later become a timed-out failure", async () => {
  const screen = await render(<MapCanvas {...props} />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(screen.queryByText("Loading map…")).toBeNull();

  await advance(30_000);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();
});

test("the timeout offers recovery without removing the native map or alleging a specific cause", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const mount = nativeMap(screen).props.nativeID;
  await advance(15_000);

  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry map" })).toBeTruthy();
  expect(nativeMap(screen).props.nativeID).toBe(mount);
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByText(/expired (Google Maps )?(API )?key/i)).toBeNull();
});

test("retry remounts the native map and gives the replacement a fresh loading deadline", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMount = nativeMap(screen).props.nativeID;
  await advance(15_000);
  await fireEvent.press(screen.getByRole("button", { name: "Retry map" }));

  expect(nativeMap(screen).props.nativeID).not.toBe(originalMount);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("late tile completion clears a timeout without requiring a retry", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMount = nativeMap(screen).props.nativeID;
  await advance(15_000);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();

  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(nativeMap(screen).props.nativeID).toBe(originalMount);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
});

test("changing the selected point resets readiness and ignores completion from the previous map", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMap = nativeMap(screen);
  const previousCompletion = originalMap.props.onMapLoaded as () => void;
  const originalMount = originalMap.props.nativeID;
  await fireEvent(originalMap, "mapLoaded");
  await advance(10_000);

  await screen.rerender(
    <MapCanvas
      {...props}
      point={{ latitude: point.latitude + 0.1, longitude: point.longitude }}
    />,
  );
  expect(nativeMap(screen).props.nativeID).not.toBe(originalMount);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await act(async () => previousCompletion());
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("an Android standalone build without a map key presents supplied coordinate areas and the key explanation", async () => {
  runtime.executionEnvironment = ExecutionEnvironment.Standalone;
  const screen = await render(<MapCanvas point={overlayPoint} alerts={[nearbyArea]} source="cached" />);
  expect(
    screen.getByText(/The map needs a configured Google Maps key in this Android build/),
  ).toBeTruthy();
  expect(
    screen.queryByTestId("native-map", { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(screen.getByTestId("coordinate-map")).toBeTruthy();
  expect(screen.getByTestId(`coordinate-area-${nearbyArea.id}-0-0`)).toBeTruthy();
  expect(screen.getByText("SCHEMATIC / NOT NAVIGATION")).toBeTruthy();
  expect(screen.getByText("WEATHER / NWS / CACHED / UNVERIFIED")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry Google Maps" })).toBeNull();
});

test("a compact timeout leaves a status without a nested retry or recenter action", async () => {
  const screen = await render(<MapCanvas {...props} compact />);
  await advance(15_000);
  expect(screen.getByText("Map unavailable")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Recenter" })).toBeNull();
  expect(screen.queryByRole("button", { name: "View areas without basemap" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry Google Maps" })).toBeNull();
  expect(screen.queryByTestId("coordinate-map")).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();
});

test("coordinate fallback opens only after deliberate selection and keeps supplied areas with their cached provenance", async () => {
  const onSelectAlert = jest.fn();
  const screen = await render(<MapCanvas point={overlayPoint} alerts={[nearbyArea]} source="cached" onSelectAlert={onSelectAlert} />);
  expect(screen.queryByTestId("coordinate-map")).toBeNull();
  expect(screen.queryByRole("button", { name: "View areas without basemap" })).toBeNull();
  await advance(15_000);
  expect(screen.queryByTestId("coordinate-map")).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "View areas without basemap" }));
  expect(screen.getByTestId("coordinate-map")).toBeTruthy();
  expect(screen.queryByTestId("native-map", { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText("NO BASEMAP / COORDINATE VIEW")).toBeTruthy();
  expect(screen.getByText("SCHEMATIC / NOT NAVIGATION")).toBeTruthy();
  expect(screen.getByText("WEATHER / NWS / CACHED / UNVERIFIED")).toBeTruthy();
  const area = screen.getByTestId(`coordinate-area-${nearbyArea.id}-0-0`);
  await fireEvent.press(area);
  expect(onSelectAlert).toHaveBeenCalledWith(nearbyArea);
});

test("Retry Google Maps leaves the coordinate fallback and remounts native tiles with a fresh deadline", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMount = nativeMap(screen).props.nativeID;
  await advance(15_000);
  await fireEvent.press(screen.getByRole("button", { name: "View areas without basemap" }));
  await advance(5_000);
  await fireEvent.press(screen.getByRole("button", { name: "Retry Google Maps" }));

  expect(screen.queryByTestId("coordinate-map")).toBeNull();
  expect(nativeMap(screen).props.nativeID).not.toBe(originalMount);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("the compact standalone coordinate fallback contains no nested action buttons", async () => {
  runtime.executionEnvironment = ExecutionEnvironment.Standalone;
  const screen = await render(<MapCanvas point={overlayPoint} alerts={[nearbyArea]} source="cached" compact />);
  expect(screen.getByTestId("coordinate-map")).toBeTruthy();
  expect(screen.getByTestId(`coordinate-area-${nearbyArea.id}-0-0`)).toBeTruthy();
  expect(screen.queryByTestId("native-map", { includeHiddenElements: true })).toBeNull();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

test("iOS Expo Go retains Apple Maps without a Google-only tile completion deadline", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const screen = await render(<MapCanvas {...props} />);
  expect(nativeMap(screen).props.provider).toBeUndefined();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.getByRole("button", { name: "Recenter" })).toBeTruthy();

  await advance(30_000);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(screen.getByRole("button", { name: "Recenter" })).toBeTruthy();
});

const overlayPoint: Coordinates = { latitude: 30, longitude: -99 };
const outer: GeoPosition[] = [
  [-99.04, 29.98], [-98.97, 29.98], [-98.97, 30.04], [-99.04, 30.04], [-99.04, 29.98],
];
const hole: GeoPosition[] = [
  [-99.02, 30], [-99.005, 30], [-99.005, 30.015], [-99.02, 30],
];
const nearbyArea = officialAlert({ geometry: { type: "Polygon", coordinates: [outer, hole] } });
const earthquake: OfficialEarthquake = {
  id: "usgs:quake",
  name: "Official epicenter",
  coordinates: { latitude: 30.01, longitude: -99.02 },
  magnitude: 3.2,
  depthKm: 7,
  observedAt: new Date(TEST_NOW).toISOString(),
  updatedAt: new Date(TEST_NOW).toISOString(),
  sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/test",
  reviewStatus: "reviewed",
};
const river: RiverGauge = {
  id: "usgs:river",
  name: "Official river station",
  coordinates: { latitude: 30.02, longitude: -99.01 },
  distanceKm: 3,
  sourceUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-test/",
  gageHeight: {
    value: 6.25,
    displayValue: "6.25",
    units: "ft",
    observedAt: new Date(TEST_NOW).toISOString(),
    approvalStatus: "Provisional",
    qualifier: null,
  },
  streamflow: null,
};

test("official Polygon rings preserve holes and convert longitude-first positions to native coordinates", async () => {
  const onSelectAlert = jest.fn();
  const screen = await render(<MapCanvas point={overlayPoint} alerts={[nearbyArea]} source="live" onSelectAlert={onSelectAlert} />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  const polygon = screen.getByTestId("map-polygon");
  expect(polygon.props.coordinates).toEqual([
    { latitude: 29.98, longitude: -99.04 },
    { latitude: 29.98, longitude: -98.97 },
    { latitude: 30.04, longitude: -98.97 },
    { latitude: 30.04, longitude: -99.04 },
    { latitude: 29.98, longitude: -99.04 },
  ]);
  expect(polygon.props.holes).toEqual([[
    { latitude: 30, longitude: -99.02 },
    { latitude: 30, longitude: -99.005 },
    { latitude: 30.015, longitude: -99.005 },
    { latitude: 30, longitude: -99.02 },
  ]]);
  await fireEvent.press(polygon);
  expect(onSelectAlert).toHaveBeenCalledWith(nearbyArea);
});

test("a MultiPolygon keeps its separate supplied areas and each area's holes", async () => {
  const second: GeoPosition[] = [
    [-99.03, 30.05], [-99.01, 30.05], [-99.01, 30.07], [-99.03, 30.05],
  ];
  const warning = officialAlert({
    geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [second]] },
  });
  const onSelectAlert = jest.fn();
  const screen = await render(<MapCanvas point={overlayPoint} alerts={[warning]} source="cached" onSelectAlert={onSelectAlert} />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  const polygons = screen.getAllByTestId("map-polygon");
  expect(polygons).toHaveLength(2);
  expect(polygons[0].props.holes).toHaveLength(1);
  expect(polygons[1].props.holes).toEqual([]);
  expect(polygons[1].props.coordinates).toEqual([
    { latitude: 30.05, longitude: -99.03 },
    { latitude: 30.05, longitude: -99.01 },
    { latitude: 30.07, longitude: -99.01 },
    { latitude: 30.05, longitude: -99.03 },
  ]);
  await fireEvent.press(polygons[1]);
  expect(onSelectAlert).toHaveBeenCalledWith(warning);
});

test("panning reveals nearby official polygons and point observations without creating areas for unmapped alerts or markers", async () => {
  const remote: Coordinates = { latitude: 34, longitude: -100 };
  const remoteRing: GeoPosition[] = [
    [-100.04, 33.98], [-99.97, 33.98], [-99.97, 34.04], [-100.04, 33.98],
  ];
  const remoteWarning = officialAlert({ id: "remote-warning", geometry: { type: "Polygon", coordinates: [remoteRing] } });
  const textOnly = officialAlert({ id: "text-only", geometry: null });
  const remoteEarthquake = { ...earthquake, coordinates: remote };
  const remoteRiver = { ...river, coordinates: remote };
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[remoteWarning, textOnly]} source="live"
    earthquakes={[remoteEarthquake]} earthquakeSource="live" showEarthquakes
    rivers={[remoteRiver]} riverSource="live" showGauges
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(screen.queryAllByTestId("map-polygon")).toHaveLength(0);
  expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);

  await fireEvent(nativeMap(screen), "regionChangeComplete", { ...remote, latitudeDelta: 0.18, longitudeDelta: 0.18 });
  expect(screen.getAllByTestId("map-polygon")).toHaveLength(1);
  expect(screen.getByTestId("map-polygon").props.coordinates).toEqual(remoteRing.map(([longitude, latitude]) => ({ latitude, longitude })));
  const markers = screen.getAllByTestId("map-marker");
  expect(markers).toHaveLength(2);
  expect(markers.map((marker) => marker.props.coordinate)).toEqual([remote, remote]);
  expect(markers[0].props.description).toMatch(/Epicenter; not an impact area/);
  expect(markers[1].props.description).toMatch(/6\.25 ft gage height.*not flood depth/);

  await fireEvent(nativeMap(screen), "regionChangeComplete", { ...overlayPoint, latitudeDelta: 0.18, longitudeDelta: 0.18 });
  expect(screen.queryAllByTestId("map-polygon")).toHaveLength(0);
  expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
});

test("USGS markers retain independent cached/live labels and deliver the original observations on selection", async () => {
  const onSelectEarthquake = jest.fn();
  const onSelectRiver = jest.fn();
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea]} source="live"
    earthquakes={[earthquake]} earthquakeSource="cached" showEarthquakes onSelectEarthquake={onSelectEarthquake}
    rivers={[river]} riverSource="live" showGauges onSelectRiver={onSelectRiver}
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  const markers = screen.getAllByTestId("map-marker");
  expect(markers[0].props.title).toBe("CACHED / M 3.2 · Official epicenter");
  expect(markers[1].props.title).toBe("USGS / Official river station");
  await fireEvent.press(markers[0]);
  await fireEvent.press(markers[1]);
  expect(onSelectEarthquake).toHaveBeenCalledWith(earthquake);
  expect(onSelectRiver).toHaveBeenCalledWith(river);
});

test("demo source suppresses accidentally supplied real USGS markers and keeps only the explicitly simulated observation", async () => {
  const onSelectEarthquake = jest.fn();
  const onSelectRiver = jest.fn();
  const screen = await render(<MapCanvas
    {...props} pointIsSelection={false} showEarthquakes showGauges
    earthquakes={[{ ...earthquake, coordinates: point }]} earthquakeSource="live" onSelectEarthquake={onSelectEarthquake}
    rivers={[{ ...river, coordinates: point }]} riverSource="cached" onSelectRiver={onSelectRiver}
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  const markers = screen.getAllByTestId("map-marker");
  expect(markers).toHaveLength(1);
  expect(markers[0].props.title).toBe("SIMULATED river observation");
  expect(markers[0].props.coordinate).toEqual(DEMO_GAUGE.coordinate);
  expect(markers[0].props.description).toBe(DEMO_GAUGE.description);
  await fireEvent.press(markers[0]);
  expect(onSelectEarthquake).not.toHaveBeenCalled();
  expect(onSelectRiver).not.toHaveBeenCalled();
});

test("layer flags remove warning areas and observation pins without adding placeholder geometry", async () => {
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea, officialAlert()]} source="live"
    earthquakes={[earthquake]} earthquakeSource="live" showEarthquakes
    rivers={[river]} riverSource="live" showGauges
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(screen.getAllByTestId("map-polygon")).toHaveLength(1);
  expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
  await screen.rerender(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea, officialAlert()]} source="live"
    earthquakes={[earthquake]} earthquakeSource="live" showEarthquakes={false}
    rivers={[river]} riverSource="live" showGauges={false} showWarnings={false}
  />);
  expect(screen.queryAllByTestId("map-polygon")).toHaveLength(0);
  expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
});

const zone: OfficialZoneBoundary = {
  url: "https://api.weather.gov/zones/forecast/TXZ173",
  id: "TXZ173",
  name: "NWS forecast zone",
  zoneType: "forecast",
  geometry: { type: "Polygon", coordinates: [outer, hole] },
  fetchedAt: new Date(TEST_NOW).toISOString(),
  cached: false,
};
const secondZoneRing: GeoPosition[] = [
  [-99.06, 30.045], [-99.035, 30.045], [-99.035, 30.075], [-99.06, 30.075], [-99.06, 30.045],
];
const secondZoneHole: GeoPosition[] = [
  [-99.055, 30.05], [-99.045, 30.05], [-99.045, 30.06], [-99.055, 30.06], [-99.055, 30.05],
];
const multipartZone: OfficialZoneBoundary = {
  ...zone,
  url: "https://api.weather.gov/zones/county/TXC265",
  id: "TXC265",
  name: "NWS county zone",
  zoneType: "county",
  geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [secondZoneRing, secondZoneHole]] },
  cached: true,
};
const expectedZoneOuter = [
  { latitude: 29.98, longitude: -99.04 },
  { latitude: 29.98, longitude: -98.97 },
  { latitude: 30.04, longitude: -98.97 },
  { latitude: 30.04, longitude: -99.04 },
  { latitude: 29.98, longitude: -99.04 },
];
const expectedZoneHole = [
  { latitude: 30, longitude: -99.02 },
  { latitude: 30, longitude: -99.005 },
  { latitude: 30.015, longitude: -99.005 },
  { latitude: 30, longitude: -99.02 },
];

test("an NWS zone Polygon preserves the supplied outer ring and hole as longitude-first native coordinates", async () => {
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[]} source="live"
    zoneBoundaries={[zone]}
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");

  const outline = screen.getByTestId("map-polygon");
  expect(outline.props.coordinates).toEqual(expectedZoneOuter);
  expect(outline.props.holes).toEqual([expectedZoneHole]);
  expect(outline.props.fillColor).toBe("transparent");
  expect(outline.props.onPress).toBeUndefined();
  expect(nativeMap(screen).props.accessibilityLabel).toBe(
    "Map of NWS affected zone outlines. Not warning polygons or measured hazard extent.",
  );
});

test("an NWS zone MultiPolygon keeps each separate part and its own hole without merging the areas", async () => {
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[]} source="live"
    zoneBoundaries={[multipartZone]}
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");

  const outlines = screen.getAllByTestId("map-polygon");
  expect(outlines).toHaveLength(2);
  expect(outlines[0].props.coordinates).toEqual(expectedZoneOuter);
  expect(outlines[0].props.holes).toEqual([expectedZoneHole]);
  expect(outlines[1].props.coordinates).toEqual([
    { latitude: 30.045, longitude: -99.06 },
    { latitude: 30.045, longitude: -99.035 },
    { latitude: 30.075, longitude: -99.035 },
    { latitude: 30.075, longitude: -99.06 },
    { latitude: 30.045, longitude: -99.06 },
  ]);
  expect(outlines[1].props.holes).toEqual([[
    { latitude: 30.05, longitude: -99.055 },
    { latitude: 30.05, longitude: -99.045 },
    { latitude: 30.06, longitude: -99.045 },
    { latitude: 30.06, longitude: -99.055 },
    { latitude: 30.05, longitude: -99.055 },
  ]]);
  for (const outline of outlines) expect(outline.props.fillColor).toBe("transparent");
});

test("zone outlines use their own retrieved or cached styling and remain visible with warnings switched off", async () => {
  const cachedZone = { ...multipartZone, geometry: zone.geometry };
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea]} source="cached"
    zoneBoundaries={[zone, cachedZone]}
  />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  const initial = screen.getAllByTestId("map-polygon");
  expect(initial).toHaveLength(3);
  expect(initial[0].props.fillColor).toBe("rgba(176,176,176,0.20)");
  expect(initial[1].props).toMatchObject({ fillColor: "transparent", strokeColor: "#FFFFFF", strokeWidth: 2 });
  expect(initial[2].props).toMatchObject({ fillColor: "transparent", strokeColor: "#B0B0B0", strokeWidth: 2 });

  await screen.rerender(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea]} source="live" showWarnings={false}
    zoneBoundaries={[zone, cachedZone]}
  />);
  const outlines = screen.getAllByTestId("map-polygon");
  expect(outlines).toHaveLength(2);
  expect(outlines[0].props).toMatchObject({ fillColor: "transparent", strokeColor: "#FFFFFF", strokeWidth: 2 });
  expect(outlines[1].props).toMatchObject({ fillColor: "transparent", strokeColor: "#B0B0B0", strokeWidth: 2 });
  for (const outline of outlines) {
    expect(outline.props.onPress).toBeUndefined();
    expect(outline.props.tappable).toBeUndefined();
  }
});

test("demo suppresses accidentally supplied official zones on both native and deliberate coordinate views", async () => {
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[]} source="demo"
    zoneBoundaries={[zone, multipartZone]}
  />);
  expect(screen.queryAllByTestId("map-polygon", { includeHiddenElements: true })).toHaveLength(0);
  expect(nativeMap(screen).props.accessibilityLabel).toBe("Regional map of source warning areas");
  await advance(15_000);
  await fireEvent.press(screen.getByRole("button", { name: "View areas without basemap" }));

  expect(screen.getByTestId("coordinate-map")).toBeTruthy();
  expect(screen.queryByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeNull();
  expect(screen.queryByTestId("coordinate-zone-county-TXC265-0-0")).toBeNull();
  expect(screen.queryByTestId("coordinate-zone-county-TXC265-1-0")).toBeNull();
  expect(screen.queryByText("NWS / ZONE BOUNDARIES / OUTLINES ONLY")).toBeNull();
  expect(screen.queryByText(/WHITE OUTLINE \/ NWS ZONE/)).toBeNull();
});

test("deliberate fallback after a tile timeout preserves zone parts, holes, schematic labeling, and independent outline provenance", async () => {
  const screen = await render(<MapCanvas
    point={overlayPoint} pointIsSelection={false} alerts={[nearbyArea]} source="cached" showWarnings={false}
    zoneBoundaries={[zone, multipartZone]}
  />);
  await advance(15_000);
  expect(screen.queryByTestId("coordinate-map")).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "View areas without basemap" }));

  expect(screen.queryByTestId("native-map", { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
  expect(screen.getByText("SCHEMATIC / NOT NAVIGATION")).toBeTruthy();
  expect(screen.getByText("NWS / ZONE BOUNDARIES / OUTLINES ONLY")).toBeTruthy();
  expect(screen.getByText("Official zone boundaries are not warning polygons or measured hazard extent.")).toBeTruthy();
  expect(screen.getByText("WHITE OUTLINE / NWS ZONE / GRAY OUTLINE / CACHED NWS ZONE")).toBeTruthy();
  expect(screen.queryByTestId(`coordinate-area-${nearbyArea.id}-0-0`)).toBeNull();

  const retrieved = screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0");
  const cachedFirst = screen.getByTestId("coordinate-zone-county-TXC265-0-0");
  const cachedSecond = screen.getByTestId("coordinate-zone-county-TXC265-1-0");
  expect(retrieved.props.stroke).toEqual({ type: 0, payload: processColor("#FFFFFF") });
  expect(screen.getByTestId("coordinate-svg").props.accessibilityLabel).toBe(
    "Schematic longitude and latitude plot. No roads or navigation information.",
  );
  for (const outline of [retrieved, cachedFirst, cachedSecond]) {
    expect(outline.props.fill).toBeNull();
    expect(outline.props.fillRule).toBe(0);
    expect(outline.props.d.match(/M/g)).toHaveLength(2);
    expect(outline.props.d.match(/Z/g)).toHaveLength(2);
    expect(outline.props.onPress).toBeUndefined();
  }
  for (const outline of [cachedFirst, cachedSecond]) {
    expect(outline.props.stroke).toEqual({ type: 0, payload: processColor("#B0B0B0") });
  }
  expect(cachedSecond.props.d).not.toBe(cachedFirst.props.d);
});
