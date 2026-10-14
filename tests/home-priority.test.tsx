import { fireEvent, render, cleanup } from "@testing-library/react-native";
import HomeScreen from "../src/app/index";
import { useAlerts } from "../src/hooks/useAlerts";
import { useAppState } from "../src/state/AppState";
import { useFeedPreferences } from "../src/state/FeedPreferences";
import { useLocationNotifications } from "../src/state/LocationNotifications";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("../src/hooks/useAlerts", () => ({ useAlerts: jest.fn() }));
jest.mock("../src/state/AppState", () => ({ useAppState: jest.fn() }));
jest.mock("../src/state/FeedPreferences", () => ({ useFeedPreferences: jest.fn() }));
jest.mock("../src/state/LocationNotifications", () => ({ useLocationNotifications: jest.fn() }));
jest.mock("../src/components/MapCanvas", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/LocationPicker", () => ({ LocationPicker: () => null }));
jest.mock("../src/components/FeedUpdateControl", () => ({ FeedUpdateControl: () => null }));
jest.mock("../src/components/DemoControls", () => ({ DemoControls: () => null }));

const later = officialAlert({ id: "watch", event: "Flood Watch", headline: "Prepare for possible flooding", urgency: "Expected", severity: "Severe" });
const first = officialAlert({ id: "immediate", event: "Tornado Warning", headline: "Current tornado instruction", urgency: "Immediate", severity: "Moderate" });
const location = { kind: "manual" as const, label: "Public test point", coordinates: { latitude: 33.15, longitude: -96.82 } };

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  jest.mocked(useFeedPreferences).mockReturnValue({ automatic: true, ready: true, storageError: null, setAutomatic: jest.fn() });
  jest.mocked(useLocationNotifications).mockReturnValue(null);
  jest.mocked(useAppState).mockReturnValue({ mode: "live", locationReady: true, locationError: null } as ReturnType<typeof useAppState>);
  jest.mocked(useAlerts).mockReturnValue({
    source: "live", displayTime: TEST_NOW, alerts: [later, first], selectedLocation: location,
    snapshot: { source: "live", fetchedAt: new Date(TEST_NOW).toISOString(), locationKey: "33.15,-96.82", alerts: [later, first] },
    isLoading: false, isRefreshing: false, error: null, offline: false,
    expiredCount: 0, refresh: jest.fn(), canRefresh: true, storageError: null,
  });
});
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

test("Home visibly explains urgency ordering and retains the other warning and original instructions", async () => {
  const screen = await render(<HomeScreen />);
  expect(screen.getByText("Current tornado instruction")).toBeTruthy();
  expect(screen.getByText(/Shown first by urgency/)).toBeTruthy();
  expect(screen.getByText(first.instruction!)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Read Flood Watch" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "Read full original warning" }));
  await fireEvent.press(screen.getByRole("button", { name: "Why this warning is shown here" }));
  expect(screen.getByText(/NWS point response for the selected location/)).toBeTruthy();
});

test("a cached warning's explanation stays cached in its details", async () => {
  const feed = jest.mocked(useAlerts).getMockImplementation()!();
  jest.mocked(useAlerts).mockReturnValue({ ...feed, source: "cached" });
  const screen = await render(<HomeScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Read full original warning" }));
  await fireEvent.press(screen.getByRole("button", { name: "Why this warning is shown here" }));
  expect(screen.getByText(/Cached NWS point response; current selected-location coverage is not verified/)).toBeTruthy();
});

test("Home keeps feed failures and paused GPS diagnostics visible when settings close", async () => {
  const storageError = "Saved update preference could not be read. Automatic updates are off for this session.";
  const gpsError = "GPS fix expired; location alerts are paused.";
  jest.mocked(useFeedPreferences).mockReturnValue({ automatic: false, ready: true, storageError, setAutomatic: jest.fn() });
  jest.mocked(useLocationNotifications).mockReturnValue({
    ready: true, enabled: true, busy: false, supported: true,
    status: "PAUSED / GPS ERROR", error: gpsError, lastNotice: null,
    enable: jest.fn(), disable: jest.fn(), test: jest.fn(),
  });
  const screen = await render(<HomeScreen />);
  const settings = screen.getByRole("button", { name: "Feed settings and GPS alerts" });
  expect(settings.props.accessibilityState.expanded).toBe(false);
  expect(screen.getByText(storageError)).toBeTruthy();
  expect(screen.getByText(gpsError)).toBeTruthy();
  expect(screen.getByText("LOCATION ALERTS / PAUSED / GPS ERROR")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "STOP GPS + ALERTS" })).toBeNull();
  await fireEvent.press(settings);
  expect(screen.getByRole("button", { name: "STOP GPS + ALERTS" })).toBeEnabled();
  await fireEvent.press(settings);
  expect(screen.getByText(storageError)).toBeTruthy();
  expect(screen.getByText(gpsError)).toBeTruthy();
  expect(screen.getByText("Current tornado instruction")).toBeTruthy();
});

test("a preference save failure reports the actual session mode outside settings", async () => {
  jest.mocked(useFeedPreferences).mockReturnValue({ automatic: true, ready: true, storageError: "Update mode changed for this session, but could not be saved for reopening.", setAutomatic: jest.fn() });
  const screen = await render(<HomeScreen />);
  expect(screen.getByText("Automatic feed updates are on for this session.")).toBeTruthy();
  expect(screen.getByText("Update mode changed for this session, but could not be saved for reopening.")).toBeTruthy();
  expect(screen.queryByText(/MANUAL MODE/)).toBeNull();
});
