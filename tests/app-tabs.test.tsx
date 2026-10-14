import { cleanup, fireEvent, render, within } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import AppTabs from "../src/components/app-tabs";
import { useAppState } from "../src/state/AppState";
import { useAlerts } from "../src/hooks/useAlerts";
import { useFeedPreferences } from "../src/state/FeedPreferences";

jest.mock("../src/state/AppState", () => ({ useAppState: jest.fn() }));
jest.mock("../src/hooks/useAlerts", () => ({ useAlerts: jest.fn() }));
jest.mock("../src/state/FeedPreferences", () => ({ useFeedPreferences: jest.fn() }));
// Isolate the shared shell from Router's navigation machinery. Real scroll,
// layout and native font-scaling behavior remain separate browser/device QA.
jest.mock("expo-router/ui", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { ScrollView, Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const Route = React.createContext({ name: "home", select: (_name: string) => {} });
  return {
    Tabs: ({ children, ...props }: import("react").PropsWithChildren<import("react-native").ViewProps>) => {
      const [name, select] = React.useState("home");
      return React.createElement(Route.Provider, { value: { name, select } }, React.createElement(View, props, children));
    },
    TabSlot: () => {
      const { name } = React.useContext(Route);
      return React.createElement(ScrollView, { testID: "tab-scroll-content" }, React.createElement(Text, null, `${name} scrolling content`));
    },
    TabList: View,
    TabTrigger: ({ children, name }: { children: import("react").ReactElement<import("expo-router/ui").TabTriggerSlotProps>; name: string }) => {
      const route = React.useContext(Route);
      return React.cloneElement(children, {
        isFocused: route.name === name, onPress: () => route.select(name),
      });
    },
  };
});

const appState = jest.mocked(useAppState);
const alerts = jest.mocked(useAlerts);
const preferences = jest.mocked(useFeedPreferences);
let feed: ReturnType<typeof useAlerts>;
let settings: ReturnType<typeof useAppState>;
let showConfirmation: jest.SpyInstance;
let openDialer: jest.SpyInstance;

beforeEach(() => {
  showConfirmation = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  openDialer = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  feed = {
    source: "unavailable", displayTime: Date.parse("2026-10-13T12:00:00Z"), alerts: [], snapshot: null, selectedLocation: null,
    isLoading: false, isRefreshing: false, error: null, offline: false,
    expiredCount: 0, refresh: jest.fn().mockResolvedValue(undefined), canRefresh: false, storageError: null,
  };
  settings = {
    mode: "live", setMode: jest.fn(), scenario: "flood", setScenario: jest.fn(),
    location: null, locationReady: true, locationRevision: 0, setLocation: jest.fn(), locationError: null, setLocationError: jest.fn(),
  };
  appState.mockImplementation(() => settings);
  alerts.mockImplementation(() => feed);
  preferences.mockReturnValue({ automatic: true, ready: true, storageError: null, setAutomatic: jest.fn() });
});
afterEach(async () => { await cleanup(); });

test("one emergency control stays outside each tab's scroll content while changing Home, Map and Prepare", async () => {
  const screen = await render(<AppTabs />);
  for (const name of ["Home", "Map", "Prepare", "Home"]) {
    await fireEvent.press(screen.getByRole("tab", { name }));
    expect(screen.getByRole("tab", { name, selected: true })).toBeTruthy();
    expect(screen.getByText(`${name.toLowerCase()} scrolling content`)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Emergency? Call 911" })).toHaveLength(1);
    expect(within(screen.getByTestId("shared-status-strip")).getByRole("button", { name: "Emergency? Call 911" })).toBeTruthy();
    expect(within(screen.getByTestId("tab-scroll-content")).queryByRole("button", { name: "Emergency? Call 911" })).toBeNull();
  }
  expect(showConfirmation).not.toHaveBeenCalled();
  expect(openDialer).not.toHaveBeenCalled();
});

test.each([
  { source: "live" as const, loading: false, label: "POINT ALERTS / NWS VERIFIED COPY" },
  { source: "cached" as const, loading: false, label: "POINT ALERTS / CACHED · UNVERIFIED" },
  { source: "unavailable" as const, loading: true, label: "POINT ALERTS / CHECKING NWS…" },
  { source: "unavailable" as const, loading: false, label: "POINT ALERTS / UNVERIFIED" },
])("shared emergency access retains $label and saved manual mode", async ({ source, loading, label }) => {
  feed = { ...feed, source, isLoading: loading };
  preferences.mockReturnValue({ automatic: false, ready: true, storageError: null, setAutomatic: jest.fn() });
  const screen = await render(<AppTabs />);
  const strip = within(screen.getByTestId("shared-status-strip"));
  expect(strip.getByText(label)).toBeTruthy();
  expect(strip.getByText("FEEDS / MANUAL REFRESH")).toBeTruthy();
  expect(strip.getByRole("button", { name: "Emergency? Call 911" })).toBeTruthy();
  expect(screen.queryByText("SIMULATED DEMO")).toBeNull();
});

test("demo keeps its simulated label, explicit Exit and the same deliberate emergency confirmation", async () => {
  settings = { ...settings, mode: "demo" };
  const screen = await render(<AppTabs />);
  const strip = within(screen.getByTestId("shared-status-strip"));
  expect(strip.getByText("SIMULATED DEMO")).toBeTruthy();
  expect(screen.queryByText(/POINT ALERTS/)).toBeNull();
  expect(screen.getAllByRole("button", { name: "Emergency? Call 911" })).toHaveLength(1);
  await fireEvent.press(strip.getByRole("button", { name: "Emergency? Call 911" }));
  expect(showConfirmation).toHaveBeenCalledWith("Call 911?", expect.any(String), expect.any(Array));
  expect(openDialer).not.toHaveBeenCalled();
  const cancel = showConfirmation.mock.calls[0][2].find((item: { text: string }) => item.text === "Cancel");
  expect(cancel.style).toBe("cancel");
  cancel.onPress?.();
  expect(openDialer).not.toHaveBeenCalled();

  await fireEvent.press(strip.getByRole("button", { name: "Exit demo and return to live mode" }));
  expect(settings.setMode).toHaveBeenCalledWith("live");
  expect(showConfirmation).toHaveBeenCalledTimes(1);
  expect(openDialer).not.toHaveBeenCalled();
});

test("unresolved saved mode does not announce manual refresh prematurely or block the emergency action", async () => {
  preferences.mockReturnValue({ automatic: false, ready: false, storageError: null, setAutomatic: jest.fn() });
  const screen = await render(<AppTabs />);
  expect(screen.queryByText("FEEDS / MANUAL REFRESH")).toBeNull();
  expect(screen.getByRole("button", { name: "Emergency? Call 911" })).toBeEnabled();
});
