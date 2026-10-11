import { cleanup, fireEvent, render } from "@testing-library/react-native";
import HomeScreen from "../src/app/index";
import { useAlerts } from "../src/hooks/useAlerts";
import { useAppState } from "../src/state/AppState";
import type { MapCanvasProps } from "../src/components/MapCanvas";
import type { SelectedLocation } from "../src/domain/types";
import { DEMO_LOCATION, getDemoSnapshot } from "../src/data/demo";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("../src/hooks/useAlerts", () => ({ useAlerts: jest.fn() }));
jest.mock("../src/state/AppState", () => ({ useAppState: jest.fn() }));
jest.mock("../src/components/FeedUpdateControl", () => ({ FeedUpdateControl: () => null }));
jest.mock("../src/components/DemoControls", () => ({ DemoControls: () => null }));
jest.mock("../src/components/SituationPanel", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SituationPanel: (props: import("react").ComponentProps<typeof import("../src/components/SituationPanel").SituationPanel>) =>
      React.createElement(View, { ...props, testID: "situation-panel" }),
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
jest.mock("../src/components/MapCanvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: (props: import("../src/components/MapCanvas").MapCanvasProps) =>
      React.createElement(View, { ...props, testID: "map-canvas" }),
  };
});
jest.mock("../src/components/LocationPicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    LocationPicker: (props: import("react").ComponentProps<typeof import("../src/components/LocationPicker").LocationPicker>) =>
      React.createElement(View, { ...props, testID: "home-location-picker" }),
  };
});
jest.mock("../src/components/ShareLocation", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ShareLocation: (props: import("react").ComponentProps<typeof import("../src/components/ShareLocation").ShareLocation>) =>
      React.createElement(View, { ...props, testID: "share-location" }),
  };
});

const alertsHook = jest.mocked(useAlerts);
const settingsHook = jest.mocked(useAppState);
const restoringCopy = "Reading the last selected point from this phone. Alerts are unverified.";
const savedGps: SelectedLocation = {
  kind: "gps",
  label: "Saved GPS point · last selection",
  coordinates: { latitude: 30.04741, longitude: -99.14039 },
};
let feed: ReturnType<typeof useAlerts>;
let settings: ReturnType<typeof useAppState>;

beforeEach(() => {
  feed = {
    source: "unavailable", alerts: [], snapshot: null, selectedLocation: null,
    isLoading: false, isRefreshing: false, error: null, offline: false,
    expiredCount: 0, refresh: jest.fn().mockResolvedValue(undefined),
    canRefresh: false, storageError: null,
  };
  settings = {
    mode: "live", setMode: jest.fn(), scenario: "flood", setScenario: jest.fn(),
    location: null, locationReady: false, setLocation: jest.fn(),
    locationError: null, setLocationError: jest.fn(),
  };
  alertsHook.mockImplementation(() => feed);
  settingsHook.mockImplementation(() => settings);
});

afterEach(async () => {
  await cleanup();
});

function expectNoRestoration(screen: Awaited<ReturnType<typeof render>>) {
  expect(screen.queryByText("RESTORING POINT")).toBeNull();
  expect(screen.queryByText("SAVED POINT / CHECKING · CHANGE")).toBeNull();
  expect(screen.queryByText("RESTORING SAVED POINT")).toBeNull();
  expect(screen.queryByText(restoringCopy)).toBeNull();
}

test.each(["live", "cached", "unavailable"] as const)(
  "%s without a selected point explains pending restoration and leaves manual selection immediately usable",
  async (source) => {
    feed = { ...feed, source };
    const screen = await render(<HomeScreen />);
    expect(screen.getByText("RESTORING POINT")).toBeTruthy();
    expect(screen.getByText("SAVED POINT / CHECKING · CHANGE")).toBeTruthy();
    expect(screen.getByText("RESTORING SAVED POINT")).toBeTruthy();
    expect(screen.getByText(restoringCopy)).toBeTruthy();
    expect(screen.queryByText("SET LOCATION")).toBeNull();
    expect(screen.queryByText("Set location")).toBeNull();
    expect(screen.queryByTestId("map-canvas")).toBeNull();
    expect(screen.queryByTestId("situation-panel")).toBeNull();
    expect(screen.getByTestId("home-location-picker").props.visible).toBe(false);

    const chooseLocation = screen.getByRole("button", { name: "Choose location" });
    expect(chooseLocation).toBeEnabled();
    expect(screen.getByRole("button", { name: "Choose GPS or manual location" })).toBeEnabled();
    await fireEvent.press(chooseLocation);
    expect(screen.getByTestId("home-location-picker").props.visible).toBe(true);
  },
);

test("settled restoration without a saved point returns to the existing location prompt", async () => {
  const screen = await render(<HomeScreen />);
  expect(screen.getByText(restoringCopy)).toBeTruthy();

  settings = { ...settings, locationReady: true };
  await screen.rerender(<HomeScreen />);
  expectNoRestoration(screen);
  expect(screen.getByText("SET LOCATION")).toBeTruthy();
  expect(screen.getByText("GPS OR MANUAL · CHANGE")).toBeTruthy();
  expect(screen.getByText("Set location")).toBeTruthy();
  expect(screen.getByText("Use GPS or enter a point. Current alerts are unverified.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Choose location" })).toBeEnabled();
  expect(screen.queryByTestId("map-canvas")).toBeNull();
});

test("a restored GPS selection takes precedence over a pending flag and reaches child views with exact coordinates", async () => {
  const screen = await render(<HomeScreen />);
  expect(screen.getByText("RESTORING POINT")).toBeTruthy();

  settings = { ...settings, location: savedGps };
  feed = { ...feed, selectedLocation: savedGps };
  await screen.rerender(<HomeScreen />);
  expect(settings.locationReady).toBe(false);
  expectNoRestoration(screen);
  expect(screen.getByText("Saved GPS point · last selection")).toBeTruthy();
  expect(screen.getByText("GPS selection · CHANGE")).toBeTruthy();
  expect(screen.queryByText("Set location")).toBeNull();
  expect(screen.queryByRole("button", { name: "Choose location" })).toBeNull();
  expect(screen.getByTestId("situation-panel").props.source).toBe("unavailable");
  const map = screen.getByTestId("map-canvas").props as MapCanvasProps;
  expect(map.point).toBe(savedGps.coordinates);
  expect(map.point).toEqual({ latitude: 30.04741, longitude: -99.14039 });
  expect(map.compact).toBe(true);
  expect(screen.getByTestId("share-location").props.selectedLocation).toBe(savedGps);
  expect(screen.getByRole("button", { name: "Choose GPS or manual location" })).toBeEnabled();
});

test("demo uses its simulated point and snapshot while saved-location restoration is still pending", async () => {
  const snapshot = getDemoSnapshot("flood");
  settings = { ...settings, mode: "demo" };
  feed = {
    ...feed, source: "demo", selectedLocation: DEMO_LOCATION,
    alerts: snapshot.alerts, snapshot,
  };
  const screen = await render(<HomeScreen />);
  expect(settings.locationReady).toBe(false);
  expectNoRestoration(screen);
  expect(screen.getByText(DEMO_LOCATION.label)).toBeTruthy();
  expect(screen.getByText("Simulated location · CHANGE")).toBeTruthy();
  expect(screen.getByText(`Scenario snapshot: ${new Date(snapshot.fetchedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.queryByText("SET LOCATION")).toBeNull();
  const map = screen.getByTestId("map-canvas").props as MapCanvasProps;
  expect(map.point).toBe(DEMO_LOCATION.coordinates);
  expect(map.source).toBe("demo");
  expect(map.alerts).toBe(snapshot.alerts);
  expect(screen.getByTestId("situation-panel").props).toMatchObject({ source: "demo", alerts: snapshot.alerts });
});

test.each(["live", "cached", "demo"] as const)("%s warning reaches the situation before sharing while preserving its source copy and point details", async (source) => {
  const snapshot = getDemoSnapshot("flood");
  const selectedLocation = source === "demo" ? DEMO_LOCATION : savedGps;
  const alerts = snapshot.alerts;
  feed = {
    ...feed, source, selectedLocation, alerts,
    snapshot: { ...snapshot, source, locationKey: `${selectedLocation.coordinates.latitude},${selectedLocation.coordinates.longitude}` },
  };
  settings = { ...settings, locationReady: true };
  const screen = await render(<HomeScreen />);
  expect(screen.getAllByTestId(/^(situation-panel|share-location)$/).map((item) => item.props.testID)).toEqual(["situation-panel", "share-location"]);
  const situation = screen.getByTestId("situation-panel").props;
  expect(situation.source).toBe(source);
  expect(situation.alerts).toBe(alerts);
  expect(situation.alerts[0].instruction).toBe(alerts[0].instruction);
  expect(situation.alerts[0].description).toBe(alerts[0].description);
  expect(screen.getByText(selectedLocation.label)).toBeTruthy();
  expect(screen.getByText(source === "demo" ? "Simulated location · CHANGE" : "GPS selection · CHANGE")).toBeTruthy();
  expect(screen.getByText(`${source === "demo" ? "Scenario snapshot" : "Last successful update"}: ${new Date(snapshot.fetchedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText("FIELD STATUS")).toBeTruthy();
  expect(screen.queryByText("Check alerts")).toBeNull();
  expect(screen.queryByRole("button", { name: "Emergency? Call 911" })).toBeNull();
});

test("compacting Home retains offline, location and persistence error cues before the saved warning", async () => {
  settings = { ...settings, locationReady: true, locationError: "The selected point could not be saved." };
  feed = { ...feed, source: "cached", selectedLocation: savedGps, offline: true, storageError: "Offline alert copy could not be saved." };
  const screen = await render(<HomeScreen />);
  expect(screen.getByText(settings.locationError!)).toBeTruthy();
  expect(screen.getByText(feed.storageError!)).toBeTruthy();
  expect(screen.getByText("Offline connection")).toBeTruthy();
  expect(screen.getByText("Current alerts cannot be verified. Preparedness and saved contacts remain available.")).toBeTruthy();
  expect(screen.getByTestId("situation-panel").props.source).toBe("cached");
  expect(screen.getByRole("button", { name: "Choose GPS or manual location" })).toBeEnabled();
});
