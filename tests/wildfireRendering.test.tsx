import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Platform, processColor } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapCanvas, { type MapCanvasProps } from "../src/components/MapCanvas";
import CoordinateMap from "../src/components/CoordinateMap";
import type { Coordinates, GeoPosition } from "../src/domain/types";
import type { OfficialZoneBoundary } from "../src/services/nwsZones";
import type { OfficialWildfirePerimeter } from "../src/services/wildfireTypes";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "storeClient", expoConfig: { extra: {} } },
  ExecutionEnvironment: {
    StoreClient: "storeClient", Standalone: "standalone", Bare: "bare",
  },
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  type MockProps = { children?: import("react").ReactNode; testID?: string };
  const NativeMap = React.forwardRef<unknown, MockProps>(function NativeMap({ children, ...props }, ref) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, { ...props, testID: "native-map" }, children);
  });
  function Polygon({ children, testID = "map-polygon", ...props }: MockProps) {
    return React.createElement(View, { ...props, testID }, children);
  }
  function Marker({ children, ...props }: MockProps) {
    return React.createElement(View, { ...props, testID: "map-marker" }, children);
  }
  return { __esModule: true, default: NativeMap, Polygon, Marker, PROVIDER_GOOGLE: "google" };
});

const runtime = Constants as unknown as {
  executionEnvironment: ExecutionEnvironment;
  expoConfig: { extra: { hasAndroidMapsKey?: boolean } };
};
const point: Coordinates = { latitude: 30, longitude: -99 };
const outer: GeoPosition[] = [
  [-99.05, 29.95], [-98.95, 29.95], [-98.95, 30.05], [-99.05, 30.05], [-99.05, 29.95],
];
const hole: GeoPosition[] = [
  [-99.01, 29.99], [-99.01, 30.01], [-98.99, 30.01], [-98.99, 29.99], [-99.01, 29.99],
];
const secondOuter: GeoPosition[] = [
  [-99.08, 30.02], [-99.06, 30.02], [-99.06, 30.04], [-99.08, 30.04], [-99.08, 30.02],
];
const secondHole: GeoPosition[] = [
  [-99.075, 30.025], [-99.065, 30.025], [-99.065, 30.035], [-99.075, 30.035], [-99.075, 30.025],
];
const capturedAt = "2026-10-08T16:00:00.000Z";
const perimeter: OfficialWildfirePerimeter = {
  id: "nifc:101", objectId: 101, incidentId: "incident-101", name: "Published test fire",
  geometry: { type: "Polygon", coordinates: [outer, hole] }, capturedAt,
  polygonUpdatedAt: "2026-10-09T17:00:00.000Z", incidentUpdatedAt: "2026-10-09T18:00:00.000Z",
  acres: 420, reportedAcres: 500, percentContained: 30, state: "US-TX",
  mapMethod: "GPS", featureCategory: "Wildfire Daily Fire Perimeter",
  sourceUrl: "https://data-nifc.opendata.arcgis.com/",
};
const multipart: OfficialWildfirePerimeter = {
  ...perimeter, geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [secondOuter, secondHole]] },
};
const remote: OfficialWildfirePerimeter = {
  ...perimeter, id: "nifc:remote", objectId: 102, name: "Outside test fire",
  geometry: { type: "Polygon", coordinates: [[
    [-98.86, 29.99], [-98.84, 29.99], [-98.84, 30.01], [-98.86, 30.01], [-98.86, 29.99],
  ]] },
};
const crossing: OfficialWildfirePerimeter = {
  ...perimeter, geometry: { type: "MultiPolygon", coordinates: [
    [
      [[179, -1], [-179, -1], [-179, 1], [179, 1], [179, -1]],
      [[179.5, -0.5], [179.5, 0.5], [-179.5, 0.5], [-179.5, -0.5], [179.5, -0.5]],
    ],
    [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]],
  ] },
};
// Matching IDs exercise separate layer identities and selection callbacks.
const warning = officialAlert({ id: perimeter.id, geometry: perimeter.geometry });
const zone: OfficialZoneBoundary = {
  url: "https://api.weather.gov/zones/forecast/TXZ173", id: "TXZ173", name: "Official test zone",
  zoneType: "forecast", geometry: perimeter.geometry, fetchedAt: new Date(TEST_NOW).toISOString(), cached: false,
};
const base: MapCanvasProps = {
  point, initialSpan: 0.2, pointIsSelection: false, alerts: [], source: "live",
  wildfirePerimeters: [perimeter], wildfireSource: "live", showWildfires: true,
};
type Renderer = "native" | "coordinate";
const renderers = ["native", "coordinate"] as const;
const firstPath = "M148.00 149.00 L252.00 149.00 L252.00 67.00 L148.00 67.00 L148.00 149.00 Z M189.60 116.20 L189.60 99.80 L210.40 99.80 L210.40 116.20 L189.60 116.20 Z";
const secondPath = "M116.80 91.60 L137.60 91.60 L137.60 75.20 L116.80 75.20 L116.80 91.60 Z M122.00 87.50 L132.40 87.50 L132.40 79.30 L122.00 79.30 L122.00 87.50 Z";

function fireId(renderer: Renderer, id = perimeter.id, part = 0) {
  return renderer === "native" ? `wildfire-perimeter-${id}-${part}` : `coordinate-wildfire-${id}`;
}

async function renderLayer(renderer: Renderer, overrides: Partial<MapCanvasProps> = {}) {
  const Component = renderer === "native" ? MapCanvas : CoordinateMap;
  const screen = await render(<Component {...base} {...overrides} />);
  if (renderer === "native") {
    await fireEvent(screen.getByTestId("native-map", { includeHiddenElements: true }), "mapLoaded");
  }
  return screen;
}

function expectOutline(renderer: Renderer, props: Record<string, unknown>, color: string) {
  expect(props.strokeWidth).toBe(3);
  if (renderer === "native") {
    expect(props.fillColor).toBe("transparent");
    expect(props.strokeColor).toBe(color);
  } else {
    // Installed SVG native primitives extract no fill and native color payloads.
    expect(props.fill).toBeNull();
    expect(props.stroke).toEqual({ type: 0, payload: processColor(color) });
    expect(props.fillRule).toBe(0);
    expect(props.clipRule).toBe(0);
  }
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

test("native Polygon preserves exact longitude-first outer and hole rings", async () => {
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("native", { onSelectWildfire });
  const polygon = screen.getByTestId(fireId("native"));
  expect(polygon.props.coordinates).toEqual([
    { latitude: 29.95, longitude: -99.05 }, { latitude: 29.95, longitude: -98.95 },
    { latitude: 30.05, longitude: -98.95 }, { latitude: 30.05, longitude: -99.05 },
    { latitude: 29.95, longitude: -99.05 },
  ]);
  expect(polygon.props.holes).toEqual([[
    { latitude: 29.99, longitude: -99.01 }, { latitude: 30.01, longitude: -99.01 },
    { latitude: 30.01, longitude: -98.99 }, { latitude: 29.99, longitude: -98.99 },
    { latitude: 29.99, longitude: -99.01 },
  ]]);
  expectOutline("native", polygon.props, "#FFFFFF");
  expect(polygon.props.tappable).toBe(true);
  await fireEvent.press(polygon);
  expect(onSelectWildfire).toHaveBeenCalledTimes(1);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(perimeter);
});

test("native MultiPolygon retains both original parts and each part's holes", async () => {
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("native", { wildfirePerimeters: [multipart], onSelectWildfire });
  const first = screen.getByTestId(fireId("native"));
  const second = screen.getByTestId(fireId("native", multipart.id, 1));
  expect(first.props.coordinates).toEqual(outer.map(([longitude, latitude]) => ({ latitude, longitude })));
  expect(first.props.holes).toEqual([hole.map(([longitude, latitude]) => ({ latitude, longitude }))]);
  expect(second.props.coordinates).toEqual(secondOuter.map(([longitude, latitude]) => ({ latitude, longitude })));
  expect(second.props.holes).toEqual([secondHole.map(([longitude, latitude]) => ({ latitude, longitude }))]);
  await fireEvent.press(second);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(multipart);
});

test("native dateline culling preserves supplied positions when the perimeter enters the view", async () => {
  const screen = await renderLayer("native", {
    // Native culling deliberately retains ambiguous wrapped bounds. At 90°
    // both supplied parts have unambiguously offscreen longitude bounds.
    point: { latitude: 0, longitude: 90 }, initialSpan: 4, wildfirePerimeters: [crossing],
  });
  expect(screen.queryByTestId(fireId("native"))).toBeNull();
  expect(screen.getByText("0 PERIMETER RECORDS IN VIEW / 1 IN THIS COPY")).toBeTruthy();
  await fireEvent(screen.getByTestId("native-map"), "regionChangeComplete", {
    latitude: 0, longitude: -180, latitudeDelta: 4, longitudeDelta: 4,
  });
  const polygon = screen.getByTestId(fireId("native"));
  expect(polygon.props.coordinates).toEqual([
    { latitude: -1, longitude: 179 }, { latitude: -1, longitude: -179 },
    { latitude: 1, longitude: -179 }, { latitude: 1, longitude: 179 },
    { latitude: -1, longitude: 179 },
  ]);
  expect(polygon.props.holes).toEqual([[
    { latitude: -0.5, longitude: 179.5 }, { latitude: 0.5, longitude: 179.5 },
    { latitude: 0.5, longitude: -179.5 }, { latitude: -0.5, longitude: -179.5 },
    { latitude: -0.5, longitude: 179.5 },
  ]]);
  expect(screen.getByText("1 PERIMETER RECORDS IN VIEW / 1 IN THIS COPY")).toBeTruthy();
  await fireEvent(screen.getByTestId("native-map"), "regionChangeComplete", {
    latitude: 0, longitude: 90, latitudeDelta: 4, longitudeDelta: 4,
  });
  expect(screen.queryByTestId(fireId("native"))).toBeNull();
});

test("coordinate MultiPolygon retains every exact outer and hole path in one accessible action", async () => {
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("coordinate", { wildfirePerimeters: [multipart], onSelectWildfire });
  const target = screen.getByTestId(fireId("coordinate"));
  expect(target.props.d).toBe(`${firstPath} ${secondPath}`);
  expectOutline("coordinate", target.props, "#FFFFFF");
  expect(target.props.accessible).toBe(true);
  expect(screen.getAllByLabelText(/published wildfire perimeter:/)).toHaveLength(1);
  expect(screen.getAllByTestId(/^coordinate-wildfire-/)).toHaveLength(1);
  await fireEvent.press(target);
  expect(onSelectWildfire).toHaveBeenCalledTimes(1);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(multipart);
  expect(screen.getByText("1 PUBLISHED WILDFIRE PERIMETER RECORDS / 1 IN VIEW")).toBeTruthy();
});

test("two logical perimeters have distinct named actions regardless of how many parts they contain", async () => {
  const manyParts: OfficialWildfirePerimeter = {
    ...multipart, geometry: { type: "MultiPolygon", coordinates: [
      [outer, hole], [secondOuter, secondHole],
      [[[-98.98, 30.06], [-98.97, 30.06], [-98.97, 30.07], [-98.98, 30.06]]],
    ] },
  };
  const other: OfficialWildfirePerimeter = {
    ...perimeter, id: "nifc:other", objectId: 103, name: "Another published fire",
    geometry: { type: "Polygon", coordinates: [secondOuter, secondHole] },
  };
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("coordinate", { wildfirePerimeters: [manyParts, other], onSelectWildfire });
  const first = screen.getByLabelText(`VERIFIED COPY published wildfire perimeter: ${manyParts.name}. Captured: ${capturedAt}.`);
  const second = screen.getByLabelText(`VERIFIED COPY published wildfire perimeter: ${other.name}. Captured: ${capturedAt}.`);
  expect(first.props.testID).toBe(fireId("coordinate", manyParts.id));
  expect(second.props.testID).toBe(fireId("coordinate", other.id));
  expect(first.props.d).toBe(`${firstPath} ${secondPath} M220.80 58.80 L231.20 58.80 L231.20 50.60 L220.80 58.80 Z`);
  expect(second.props.d).toBe(secondPath);
  expect(first.props.accessible).toBe(true);
  expect(second.props.accessible).toBe(true);
  expect(screen.getAllByLabelText(/published wildfire perimeter:/)).toHaveLength(2);
  expect(screen.getAllByTestId(/^coordinate-wildfire-/)).toHaveLength(2);
  await fireEvent.press(first);
  await fireEvent.press(second);
  expect(onSelectWildfire).toHaveBeenCalledTimes(2);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(manyParts);
  expect(onSelectWildfire.mock.calls[1][0]).toBe(other);
  expect(screen.getByText("2 PUBLISHED WILDFIRE PERIMETER RECORDS / 2 IN VIEW")).toBeTruthy();
});

test("coordinate dateline paths unwrap their own holes and cull remote MultiPolygon parts", async () => {
  const screen = await renderLayer("coordinate", {
    point: { latitude: 0, longitude: 0 }, initialSpan: 4, wildfirePerimeters: [crossing],
  });
  expect(screen.queryByTestId(fireId("coordinate"))).toBeNull();
  expect(screen.getByText("1 published wildfire perimeter record is outside this view. Pan or zoom out to inspect.")).toBeTruthy();
  expect(screen.queryByText(/mapped warning record/)).toBeNull();
  await screen.rerender(<CoordinateMap {...base} point={{ latitude: 0, longitude: -180 }} initialSpan={4} wildfirePerimeters={[crossing]} />);
  expect(screen.getByTestId(fireId("coordinate")).props.d).toBe(
    "M148.00 149.00 L252.00 149.00 L252.00 67.00 L148.00 67.00 L148.00 149.00 Z M174.00 128.50 L174.00 87.50 L226.00 87.50 L226.00 128.50 L174.00 128.50 Z",
  );
  expect(screen.getAllByTestId(/^coordinate-wildfire-/)).toHaveLength(1);
  expect(screen.queryByText(/outside this view/)).toBeNull();
});

test("world coordinate view retains both dateline edge copies in one named perimeter action", async () => {
  const datelineOnly: OfficialWildfirePerimeter = {
    ...crossing, geometry: { type: "Polygon", coordinates: crossing.geometry.type === "MultiPolygon" ? crossing.geometry.coordinates[0] : [] },
  };
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("coordinate", {
    point: { latitude: 0, longitude: 0 }, initialSpan: 360, wildfirePerimeters: [datelineOnly], onSelectWildfire,
  });
  const target = screen.getByTestId(fireId("coordinate"));
  expect(target.props.d).toBe(
    "M95.42 108.91 L96.58 108.91 L96.58 107.09 L95.42 107.09 L95.42 108.91 Z M95.71 108.46 L95.71 107.54 L96.29 107.54 L96.29 108.46 L95.71 108.46 Z M303.42 108.91 L304.58 108.91 L304.58 107.09 L303.42 107.09 L303.42 108.91 Z M303.71 108.46 L303.71 107.54 L304.29 107.54 L304.29 108.46 L303.71 108.46 Z",
  );
  expect(target.props.accessible).toBe(true);
  expect(screen.getAllByLabelText(/published wildfire perimeter:/)).toHaveLength(1);
  expect(screen.getAllByTestId(/^coordinate-wildfire-/)).toHaveLength(1);
  await fireEvent.press(target);
  expect(onSelectWildfire).toHaveBeenCalledTimes(1);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(datelineOnly);
  expect(screen.getByText("1 PUBLISHED WILDFIRE PERIMETER RECORDS / 1 IN VIEW")).toBeTruthy();
});

test("coordinate pan reveals a supplied perimeter without moving the selected point or altering geometry", async () => {
  const onSelectWildfire = jest.fn();
  const screen = await renderLayer("coordinate", { wildfirePerimeters: [remote], pointIsSelection: true, onSelectWildfire });
  expect(screen.queryByTestId(fireId("coordinate", remote.id))).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Pan east" }));
  expect(screen.getByText("VIEW CENTER / 30.0000, -98.9000 / VIEWPORT ONLY")).toBeTruthy();
  const path = screen.getByTestId(fireId("coordinate", remote.id));
  expect(path.props.d).toBe("M241.60 116.20 L262.40 116.20 L262.40 99.80 L241.60 99.80 L241.60 116.20 Z");
  const cross = screen.getByTestId("coordinate-selected-point").props.d.match(/^M([^ ]+) ([^ ]+)/);
  expect(Number(cross[1])).toBeCloseTo(89);
  expect(Number(cross[2])).toBeCloseTo(108);
  await fireEvent.press(path);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(remote);
  expect(point).toEqual({ latitude: 30, longitude: -99 });
  await fireEvent.press(screen.getByRole("button", { name: "Recenter coordinate view" }));
  expect(screen.queryByTestId(fireId("coordinate", remote.id))).toBeNull();
});

describe.each(renderers)("%s independent wildfire layer", (renderer) => {
  test.each([
    ["live", "cached", "#FFFFFF", "VERIFIED COPY"],
    ["cached", "live", "#B0B0B0", "CACHED / UNVERIFIED"],
    ["unavailable", "live", "#B0B0B0", "DATA UNAVAILABLE"],
  ] as const)("%s wildfire outlines retain their own provenance beside %s NWS", async (wildfireSource, source, color, copy) => {
    const onSelectWildfire = jest.fn();
    const screen = await renderLayer(renderer, { source, wildfireSource, alerts: [warning], zoneBoundaries: [zone], onSelectWildfire });
    const fire = screen.getByTestId(fireId(renderer));
    expectOutline(renderer, fire.props, color);
    expect(fire.props.accessibilityLabel).toBe(`${copy} published wildfire perimeter: ${perimeter.name}. Captured: ${capturedAt}.`);
    if (renderer === "coordinate") {
      expect(screen.getByText(`WILDFIRE / NIFC / ${copy}`)).toBeTruthy();
      expect(screen.getByText(`WEATHER / NWS / ${source === "cached" ? "CACHED / UNVERIFIED" : "VERIFIED COPY"}`)).toBeTruthy();
      expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`).props.stroke).toEqual({ type: 0, payload: processColor(source === "cached" ? "#B0B0B0" : "#FF5A00") });
      expect(screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0").props.strokeWidth).toBe(2);
    } else {
      expect(screen.getByText(`NIFC / PUBLISHED WILDFIRE PERIMETERS / ${copy}`)).toBeTruthy();
      const otherPolygons = screen.getAllByTestId("map-polygon");
      expect(otherPolygons).toHaveLength(2);
      expect(otherPolygons[0].props.strokeColor).toBe(source === "cached" ? "#B0B0B0" : "#FF5A00");
      expect(otherPolygons[1].props.strokeWidth).toBe(2);
    }
  });

  test("weather OFF retains supplied wildfire and NWS zone geometry without manufacturing warnings", async () => {
    const screen = await renderLayer(renderer, { alerts: [warning], showWarnings: false, zoneBoundaries: [zone] });
    expect(screen.getByTestId(fireId(renderer))).toBeTruthy();
    if (renderer === "coordinate") {
      expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
      expect(screen.getByText("WILDFIRE / NIFC / VERIFIED COPY")).toBeTruthy();
      expect(screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeTruthy();
      expect(screen.queryByTestId(`coordinate-area-${warning.id}-0-0`)).toBeNull();
      expect(screen.queryByText(/mapped warning/)).toBeNull();
    } else {
      expect(screen.getAllByTestId("map-polygon")).toHaveLength(1);
      expect(screen.getByTestId("map-polygon").props.strokeWidth).toBe(2);
    }
  });

  test("wildfire defaults OFF, and toggling it does not remove NWS polygons or zones", async () => {
    const Component = renderer === "native" ? MapCanvas : CoordinateMap;
    const screen = await renderLayer(renderer, { showWildfires: undefined, alerts: [warning], zoneBoundaries: [zone] });
    expect(screen.queryByTestId(fireId(renderer))).toBeNull();
    expect(screen.queryByText(/WILDFIRE \/ NIFC|NIFC \/ PUBLISHED WILDFIRE/)).toBeNull();
    await screen.rerender(<Component {...base} alerts={[warning]} zoneBoundaries={[zone]} />);
    expect(screen.getByTestId(fireId(renderer))).toBeTruthy();
    await screen.rerender(<Component {...base} alerts={[warning]} zoneBoundaries={[zone]} showWildfires={false} />);
    expect(screen.queryByTestId(fireId(renderer))).toBeNull();
    if (renderer === "coordinate") {
      expect(screen.getByTestId(`coordinate-area-${warning.id}-0-0`)).toBeTruthy();
      expect(screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeTruthy();
    } else {
      expect(screen.getAllByTestId("map-polygon")).toHaveLength(2);
    }
  });

  test("demo suppresses accidentally supplied real perimeters and all wildfire provenance", async () => {
    const onSelectWildfire = jest.fn();
    const screen = await renderLayer(renderer, { source: "demo", onSelectWildfire });
    expect(screen.queryByTestId(fireId(renderer))).toBeNull();
    expect(screen.queryByText(/WILDFIRE \/ NIFC|NIFC \/ PUBLISHED WILDFIRE|PUBLISHED WILDFIRE PERIMETER RECORDS|PERIMETER RECORDS IN VIEW/)).toBeNull();
    expect(screen.queryByText(/Capture dates describe/)).toBeNull();
    if (renderer === "native") {
      expect(screen.getByTestId("native-map").props.accessibilityLabel).toBe("Regional map of source warning areas");
    } else {
      expect(screen.getByText("WEATHER / SIMULATED / JUL 04 2025 / 05:15 CDT")).toBeTruthy();
    }
    expect(onSelectWildfire).not.toHaveBeenCalled();
  });

  test("compact perimeters are static even when a selection callback was supplied", async () => {
    const onSelectWildfire = jest.fn();
    const screen = await renderLayer(renderer, { compact: true, onSelectWildfire });
    const fire = screen.getByTestId(fireId(renderer));
    expectOutline(renderer, fire.props, "#FFFFFF");
    expect(fire.props.onPress).toBeUndefined();
    if (renderer === "native") expect(fire.props.tappable).toBe(false);
    else expect(fire.props.accessible).toBeFalsy();
    await fireEvent.press(fire);
    expect(onSelectWildfire).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("missing capture time stays unknown despite newer polygon and incident edit times", async () => {
    const unknown = { ...perimeter, capturedAt: null };
    const screen = await renderLayer(renderer, { wildfirePerimeters: [unknown] });
    const label = screen.getByTestId(fireId(renderer)).props.accessibilityLabel;
    expect(label).toBe(`VERIFIED COPY published wildfire perimeter: ${perimeter.name}. CAPTURE UNKNOWN`);
    expect(label).not.toContain(perimeter.polygonUpdatedAt);
    expect(label).not.toContain(perimeter.incidentUpdatedAt);
  });

  test("record counts remain separate from NWS warnings and empty updates retain the other layers", async () => {
    const outsideWarning = officialAlert({ id: "outside-warning", geometry: remote.geometry });
    const Component = renderer === "native" ? MapCanvas : CoordinateMap;
    const screen = await renderLayer(renderer, { wildfirePerimeters: [perimeter, remote], alerts: [outsideWarning], zoneBoundaries: [zone] });
    expect(screen.getByTestId(fireId(renderer))).toBeTruthy();
    expect(screen.queryByTestId(fireId(renderer, remote.id))).toBeNull();
    if (renderer === "coordinate") {
      expect(screen.getByText("2 PUBLISHED WILDFIRE PERIMETER RECORDS / 1 IN VIEW")).toBeTruthy();
      expect(screen.getByText("1 mapped warning record is outside this view. Zoom out to inspect.")).toBeTruthy();
      expect(screen.getByText("1 published wildfire perimeter record is outside this view. Pan or zoom out to inspect.")).toBeTruthy();
    } else {
      expect(screen.getByText("1 PERIMETER RECORDS IN VIEW / 2 IN THIS COPY")).toBeTruthy();
    }
    await screen.rerender(<Component {...base} wildfirePerimeters={[]} alerts={[outsideWarning]} zoneBoundaries={[zone]} />);
    expect(screen.queryByTestId(fireId(renderer))).toBeNull();
    if (renderer === "coordinate") {
      expect(screen.getByText("0 PUBLISHED WILDFIRE PERIMETER RECORDS / 0 IN VIEW")).toBeTruthy();
      expect(screen.getByText("1 mapped warning record is outside this view. Zoom out to inspect.")).toBeTruthy();
      expect(screen.getByTestId("coordinate-zone-forecast-TXZ173-0-0")).toBeTruthy();
      expect(screen.getByText("No published wildfire perimeters in this copy. Unreported fire conditions remain unknown.")).toBeTruthy();
    } else {
      expect(screen.getByText("0 PERIMETER RECORDS IN VIEW / 0 IN THIS COPY")).toBeTruthy();
      expect(screen.getByTestId("map-polygon").props.strokeWidth).toBe(2);
    }
  });
});

test.each(["missing key", "tile timeout"] as const)("%s fallback forwards wildfire geometry, own provenance, toggle and original selection", async (reason) => {
  const onSelectWildfire = jest.fn();
  if (reason === "missing key") runtime.executionEnvironment = ExecutionEnvironment.Standalone;
  const fallbackProps: MapCanvasProps = {
    ...base, source: "live", showWarnings: false, wildfireSource: "cached",
    wildfirePerimeters: [multipart], onSelectWildfire,
  };
  const screen = await render(<MapCanvas {...fallbackProps} />);
  if (reason === "tile timeout") {
    expect(screen.queryByTestId("coordinate-map")).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText("Map did not finish loading")).toBeTruthy();
    expect(screen.queryByTestId("coordinate-map")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "View areas without basemap" }));
  } else {
    expect(screen.getByText(/The map needs a configured Google Maps key/)).toBeTruthy();
  }
  expect(screen.queryByTestId("native-map", { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText("WEATHER / OFF")).toBeTruthy();
  expect(screen.getByText("WILDFIRE / NIFC / CACHED / UNVERIFIED")).toBeTruthy();
  const target = screen.getByTestId(fireId("coordinate"));
  expect(target.props.d).toBe(`${firstPath} ${secondPath}`);
  expectOutline("coordinate", target.props, "#B0B0B0");
  expect(screen.getAllByLabelText(/published wildfire perimeter:/)).toHaveLength(1);
  await fireEvent.press(target);
  expect(onSelectWildfire).toHaveBeenCalledTimes(1);
  expect(onSelectWildfire.mock.calls[0][0]).toBe(multipart);
  await screen.rerender(<MapCanvas {...fallbackProps} showWildfires={false} />);
  expect(screen.queryByTestId(fireId("coordinate"))).toBeNull();
  expect(screen.queryByText("WILDFIRE / NIFC / CACHED / UNVERIFIED")).toBeNull();
});
