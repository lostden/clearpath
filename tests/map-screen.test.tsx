import { act, cleanup, fireEvent, render, within } from "@testing-library/react-native";
import MapScreen from "../src/app/map";
import { useAlerts } from "../src/hooks/useAlerts";
import { useRegionalAlerts, type RegionalAlertsState } from "../src/hooks/useRegionalAlerts";
import { useDisasterLayers, type DisasterLayers } from "../src/hooks/useDisasterLayers";
import type { MapCanvasProps } from "../src/components/MapCanvas";
import type { AlertSelection } from "../src/components/AlertDetail";
import type { OfficialEarthquake, RiverGauge } from "../src/services/usgsTypes";
import { DEMO_LOCATION, getDemoSnapshot } from "../src/data/demo";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

let mockBlurMap: (() => void) | undefined;
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(() => {
    const blur = callback();
    mockBlurMap = typeof blur === "function" ? blur : undefined;
    return () => { mockBlurMap = undefined; if (typeof blur === "function") blur(); };
  }, [callback]) };
});
jest.mock("../src/hooks/useAlerts", () => ({ useAlerts: jest.fn() }));
jest.mock("../src/hooks/useRegionalAlerts", () => ({ useRegionalAlerts: jest.fn() }));
jest.mock("../src/hooks/useDisasterLayers", () => ({ useDisasterLayers: jest.fn() }));
jest.mock("../src/components/MapCanvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: (props: import("../src/components/MapCanvas").MapCanvasProps) =>
      React.createElement(View, { ...props, testID: "map-canvas" }),
  };
});
jest.mock("../src/components/AlertDetail", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ...jest.requireActual("../src/components/AlertDetail"),
    AlertDetail: (props: import("react").ComponentProps<typeof import("../src/components/AlertDetail").AlertDetail>) =>
      React.createElement(View, { ...props, testID: "alert-detail" }),
  };
});
jest.mock("../src/components/HazardDetail", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    HazardDetail: (props: import("react").ComponentProps<typeof import("../src/components/HazardDetail").HazardDetail>) =>
      React.createElement(View, { ...props, testID: "hazard-detail" }),
  };
});
jest.mock("../src/components/ZoneAreaDetail", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ZoneAreaDetail: (props: import("react").ComponentProps<typeof import("../src/components/ZoneAreaDetail").ZoneAreaDetail>) =>
      React.createElement(View, { ...props, testID: "zone-area-detail" }),
  };
});

const pointFeed = jest.mocked(useAlerts);
const regionalFeed = jest.mocked(useRegionalAlerts);
const disasterFeed = jest.mocked(useDisasterLayers);
const location = { coordinates: { latitude: 30, longitude: -99 }, label: "Selected test point", kind: "manual" as const };
const pointWarning = officialAlert({ id: "point-warning", event: "Tornado Warning", headline: "Applies to point query" });
const regionalWarning = officialAlert({
  id: "regional-warning", event: "Flood Watch", headline: "Regional official record",
  geometry: { type: "Polygon", coordinates: [[[-99.1, 29.9], [-98.9, 29.9], [-98.9, 30.1], [-99.1, 29.9]]] },
});
const zoneWarning = officialAlert({
  ...regionalWarning, geometry: null,
  affectedZones: ["https://api.weather.gov/zones/forecast/TXZ173", "https://api.weather.gov/zones/forecast/TXZ191"],
});
const regionalTime = new Date(TEST_NOW - 2 * 60_000).toISOString();
const verifiedRegionalTime = new Date(TEST_NOW - 15_000).toISOString();
const earthquakeTime = new Date(TEST_NOW - 60_000).toISOString();
const riverTime = new Date(TEST_NOW - 5 * 60_000).toISOString();
const quake: OfficialEarthquake = {
  id: "quake", name: "USGS test epicenter", magnitude: 3.2, depthKm: 8,
  coordinates: location.coordinates, observedAt: new Date(TEST_NOW).toISOString(),
  updatedAt: new Date(TEST_NOW).toISOString(), sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/test", reviewStatus: "reviewed",
};
const river: RiverGauge = {
  id: "river", name: "USGS test station", coordinates: location.coordinates, distanceKm: 3,
  sourceUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-test/", gageHeight: null, streamflow: null,
};
let feed: ReturnType<typeof useAlerts>;
let regional: RegionalAlertsState;
let layers: DisasterLayers;

function mapProps(screen: Awaited<ReturnType<typeof render>>): MapCanvasProps {
  return screen.getByTestId("map-canvas").props as MapCanvasProps;
}
function zoneProps(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByTestId("zone-area-detail").props as {
    selection: AlertSelection | null; enabled: boolean; onClose: () => void;
  };
}
async function openVerifiedZoneAreas() {
  regional = { ...regional, source: "live", fetchedAt: verifiedRegionalTime, alerts: [zoneWarning] };
  const screen = await render(<MapScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Read Flood Watch" }));
  const detail = screen.getByTestId("alert-detail");
  expect(detail.props.onViewZoneAreas).toEqual(expect.any(Function));
  await act(() => detail.props.onViewZoneAreas());
  expect(zoneProps(screen)).toMatchObject({
    enabled: true, selection: { alert: zoneWarning, source: "live", fetchedAt: verifiedRegionalTime },
  });
  return screen;
}

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  mockBlurMap = undefined;
  feed = {
    source: "live", alerts: [pointWarning], selectedLocation: location,
    snapshot: { source: "live", alerts: [pointWarning], locationKey: "30,-99", fetchedAt: new Date(TEST_NOW - 30_000).toISOString() },
    isLoading: false, isRefreshing: false, error: null, offline: false,
    expiredCount: 0, refresh: jest.fn().mockResolvedValue(undefined), canRefresh: true, storageError: null,
  };
  regional = {
    alerts: [regionalWarning, officialAlert({ id: "unmapped", event: "Heat Advisory" })], source: "cached",
    fetchedAt: regionalTime, isLoading: false, isRefreshing: false,
    canRefresh: true, error: null, unmappedCount: 1, refresh: jest.fn().mockResolvedValue(undefined),
  };
  layers = {
    earthquakes: {
      items: [quake], source: "live", fetchedAt: earthquakeTime, generatedAt: earthquakeTime,
      coverage: "Past 24 hours worldwide", loading: false, refreshing: false,
      error: null, canRefresh: true, refresh: jest.fn().mockResolvedValue(undefined),
    },
    rivers: {
      items: [river], source: "cached", fetchedAt: riverTime, generatedAt: null,
      coverage: "Nearby Texas stream stations", loading: false, refreshing: false,
      error: null, canRefresh: true, refresh: jest.fn().mockResolvedValue(undefined),
    },
  };
  pointFeed.mockImplementation(() => feed);
  regionalFeed.mockImplementation(() => regional);
  disasterFeed.mockImplementation((_point, enabled) => enabled ? layers : {
    earthquakes: { ...layers.earthquakes, items: [], source: "unavailable", fetchedAt: null },
    rivers: { ...layers.rivers, items: [], source: "unavailable", fetchedAt: null },
  });
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

test("regional records remain separate from selected-point alerts and each official layer keeps its own source and retrieval time", async () => {
  const screen = await render(<MapScreen />);
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: true, coverage: "TX" });
  expect(mapProps(screen).alerts).toEqual(regional.alerts);
  expect(mapProps(screen).alerts).not.toContain(pointWarning);
  expect(mapProps(screen).source).toBe("cached");
  expect(mapProps(screen).earthquakeSource).toBe("live");
  expect(mapProps(screen).riverSource).toBe("cached");
  expect(screen.getByText("Regional records may not apply to your selected point. Home checks that point separately.")).toBeTruthy();
  expect(screen.queryByText("Applies to point query")).toBeNull();
  expect(screen.getByText("2 RECORDS / 1 MAPPED / 1 WITHOUT SUPPLIED GEOMETRY")).toBeTruthy();
  for (const [stamp, timestamp] of [
    ["NWS / CACHED · UNVERIFIED", regionalTime],
    ["EARTHQUAKES / VERIFIED COPY", earthquakeTime],
    ["RIVERS / CACHED · UNVERIFIED", riverTime],
  ]) {
    const container = screen.getByText(stamp).parent!;
    expect(within(container).getByText(new Date(timestamp).toLocaleString())).toBeTruthy();
  }
});

test("Texas/U.S. coverage changes the regional query and map records without changing the point feed", async () => {
  const usWarning = officialAlert({ id: "us-warning", event: "Winter Storm Warning" });
  regionalFeed.mockImplementation(({ coverage }) => coverage === "US" ? { ...regional, alerts: [usWarning] } : regional);
  const screen = await render(<MapScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "U.S. weather coverage" }));
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: true, coverage: "US" });
  expect(mapProps(screen).alerts).toEqual([usWarning]);
  expect(mapProps(screen).point).toEqual(location.coordinates);
  expect(feed.alerts).toEqual([pointWarning]);
  expect(screen.getByRole("button", { name: "U.S. weather coverage", selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Texas weather coverage" }));
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: true, coverage: "TX" });
  expect(mapProps(screen).alerts).toEqual(regional.alerts);
});

test("a warning selection captures regional provenance and becomes cached when a newer response replaces its copy", async () => {
  const screen = await render(<MapScreen />);
  regional = { ...regional, source: "live" };
  await screen.rerender(<MapScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Read Flood Watch" }));
  expect(screen.getByTestId("alert-detail").props).toMatchObject({ alert: regionalWarning, source: "live", fetchedAt: regionalTime });
  regional = { ...regional, fetchedAt: new Date(TEST_NOW).toISOString(), alerts: [] };
  await screen.rerender(<MapScreen />);
  expect(screen.getByTestId("alert-detail").props).toMatchObject({ alert: regionalWarning, source: "cached", fetchedAt: regionalTime });
  expect(mapProps(screen).alerts).toEqual([]);
});

test("layer switches independently disable queries and visible overlays; refresh actions target their own layer", async () => {
  const screen = await render(<MapScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Refresh weather" }));
  await fireEvent.press(screen.getByRole("button", { name: "Refresh river observations" }));
  await fireEvent.press(screen.getByRole("button", { name: "Refresh earthquakes" }));
  expect(regional.refresh).toHaveBeenCalledTimes(1);
  expect(layers.rivers.refresh).toHaveBeenCalledTimes(1);
  expect(layers.earthquakes.refresh).toHaveBeenCalledTimes(1);
  expect(feed.refresh).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("switch", { name: "Show warning areas" }));
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: false, coverage: "TX" });
  expect(mapProps(screen).showWarnings).toBe(false);
  expect(screen.queryByRole("button", { name: "Read Flood Watch" })).toBeNull();
  await fireEvent.press(screen.getByRole("switch", { name: "Show river observations" }));
  expect(disasterFeed).toHaveBeenLastCalledWith(location.coordinates, true, { earthquakes: true, rivers: false });
  expect(mapProps(screen).showGauges).toBe(false);
  await fireEvent.press(screen.getByRole("switch", { name: "Show earthquakes" }));
  expect(disasterFeed).toHaveBeenLastCalledWith(location.coordinates, true, { earthquakes: false, rivers: false });
  expect(mapProps(screen).showEarthquakes).toBe(false);
  expect(screen.queryByRole("button", { name: "Read earthquake USGS test epicenter" })).toBeNull();
});

test("demo uses the frozen fictional warning snapshot and disables real regional and USGS layers", async () => {
  const snapshot = getDemoSnapshot("flood");
  feed = { ...feed, source: "demo", alerts: snapshot.alerts, snapshot, selectedLocation: DEMO_LOCATION };
  const screen = await render(<MapScreen />);
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: false, coverage: "TX" });
  expect(disasterFeed).toHaveBeenLastCalledWith(DEMO_LOCATION.coordinates, false, { earthquakes: true, rivers: true });
  expect(mapProps(screen).source).toBe("demo");
  expect(mapProps(screen).alerts).toEqual(snapshot.alerts);
  expect(mapProps(screen).earthquakes).toEqual([]);
  expect(mapProps(screen).rivers).toEqual([]);
  expect(screen.queryByText("USGS test station")).toBeNull();
  expect(screen.queryByText("M 3.2 / USGS test epicenter")).toBeNull();
  expect(screen.queryByRole("button", { name: "U.S. weather coverage" })).toBeNull();
  expect(screen.getByText("Hill Country flood exercise. Warning areas and readings are fictional.")).toBeTruthy();
  await act(() => mapProps(screen).onSelectAlert?.(snapshot.alerts[0]));
  expect(screen.getByTestId("alert-detail").props).toMatchObject({ source: "demo", fetchedAt: snapshot.fetchedAt });
});

test("regional coverage stays usable without a selected point and does not fabricate a personal location", async () => {
  feed = { ...feed, source: "unavailable", alerts: [], snapshot: null, selectedLocation: null };
  const screen = await render(<MapScreen />);
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: true, coverage: "TX" });
  expect(mapProps(screen).pointIsSelection).toBe(false);
  expect(mapProps(screen).point).toEqual({ latitude: 31.1, longitude: -100 });
  expect(mapProps(screen).initialSpan).toBe(14);
  expect(mapProps(screen).alerts).toEqual(regional.alerts);
  expect(disasterFeed).toHaveBeenLastCalledWith(null, true, { earthquakes: true, rivers: true });
  expect(screen.getByText("SET LOCATION / needed for nearby river stations.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Open point in Google Maps" })).toBeNull();
});

test("zone areas retain the chosen alert copy and clear the warning modal, while a same-alert revalidation stays enabled", async () => {
  const screen = await openVerifiedZoneAreas();
  const selection = zoneProps(screen).selection!;
  expect(selection.alert).toBe(zoneWarning);
  expect(screen.getByTestId("alert-detail").props.alert).toBeNull();
  expect(mapProps(screen).alerts).toEqual([zoneWarning]);
  expect(mapProps(screen).alerts).not.toContain(pointWarning);

  regional = { ...regional, fetchedAt: new Date(TEST_NOW).toISOString(), alerts: [{ ...zoneWarning }] };
  await screen.rerender(<MapScreen />);
  expect(zoneProps(screen).selection).toBe(selection);
  expect(zoneProps(screen).selection?.fetchedAt).toBe(verifiedRegionalTime);
  expect(zoneProps(screen).enabled).toBe(true);
  await act(() => zoneProps(screen).onClose());
  expect(zoneProps(screen)).toMatchObject({ selection: null, enabled: false });
});

test.each([
  ["cached source", () => { regional = { ...regional, source: "cached" }; }],
  ["removed record", () => { regional = { ...regional, alerts: [] }; }],
  ["a new sent time", () => { regional = { ...regional, alerts: [{ ...zoneWarning, sent: new Date(TEST_NOW - 60_000).toISOString() }] }; }],
  ["changed affected zones", () => { regional = { ...regional, alerts: [{ ...zoneWarning, affectedZones: ["https://api.weather.gov/zones/forecast/TXZ173"] }] }; }],
  ["offline point state", () => { feed = { ...feed, offline: true }; }],
] as const)("zone downloads are disabled after %s without substituting the selected copy", async (_reason, changeContext) => {
  const screen = await openVerifiedZoneAreas();
  const frozen = zoneProps(screen).selection;
  changeContext();
  await screen.rerender(<MapScreen />);
  expect(zoneProps(screen).enabled).toBe(false);
  expect(zoneProps(screen).selection).toBe(frozen);
  // The real zone modal closes on this disabled prop; its callback clears route state.
  await act(() => zoneProps(screen).onClose());
  expect(zoneProps(screen)).toMatchObject({ selection: null, enabled: false });
});

test("leaving the map or disabling warnings prevents further zone downloads", async () => {
  const screen = await openVerifiedZoneAreas();
  await act(() => mockBlurMap?.());
  expect(zoneProps(screen).enabled).toBe(false);
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: false, coverage: "TX" });
  await act(() => zoneProps(screen).onClose());
  expect(zoneProps(screen).selection).toBeNull();

  await screen.unmount();
  const active = await openVerifiedZoneAreas();
  await fireEvent.press(active.getByRole("switch", { name: "Show warning areas" }));
  expect(zoneProps(active).enabled).toBe(false);
  await act(() => zoneProps(active).onClose());
  expect(zoneProps(active).selection).toBeNull();
});

test("coverage changes clear zone selection before using another regional query", async () => {
  const screen = await openVerifiedZoneAreas();
  await fireEvent.press(screen.getByRole("button", { name: "U.S. weather coverage" }));
  expect(regionalFeed).toHaveBeenLastCalledWith({ enabled: true, coverage: "US" });
  expect(zoneProps(screen)).toMatchObject({ selection: null, enabled: false });
});

test("entering demo disables the previous real zone view and fictional warnings cannot open one", async () => {
  const screen = await openVerifiedZoneAreas();
  const snapshot = getDemoSnapshot("flood");
  feed = { ...feed, source: "demo", alerts: snapshot.alerts, snapshot, selectedLocation: DEMO_LOCATION };
  await screen.rerender(<MapScreen />);
  expect(zoneProps(screen).enabled).toBe(false);
  await act(() => zoneProps(screen).onClose());
  expect(zoneProps(screen).selection).toBeNull();
  await act(() => mapProps(screen).onSelectAlert?.(snapshot.alerts[0]));
  expect(screen.getByTestId("alert-detail").props.onViewZoneAreas).toBeUndefined();
  expect(zoneProps(screen)).toMatchObject({ selection: null, enabled: false });
});
