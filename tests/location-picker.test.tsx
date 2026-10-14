import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LocationPicker } from "../src/components/LocationPicker";
import { requestDeviceLocation, texasLocations } from "../src/services/location";
import { AppProvider, useAppState } from "../src/state/AppState";

jest.mock("../src/services/location", () => ({
  ...jest.requireActual("../src/services/location"),
  requestDeviceLocation: jest.fn(),
}));

function SelectedPoint() {
  const state = useAppState();
  return (
    <><Text testID="selected-point">
      {state.mode}:{state.location?.label || "none"}
    </Text><Text testID="selected-coordinates">{JSON.stringify(state.location?.coordinates ?? null)}</Text>
    <Text testID="location-error">{JSON.stringify(state.locationError)}</Text></>
  );
}
const gps = jest.mocked(requestDeviceLocation);
beforeEach(async () => {
  await AsyncStorage.clear();
});

test("the Frisco preset selects its public Census reference point without GPS or citywide coverage", async () => {
  const screen = await render(<AppProvider><LocationPicker visible onClose={() => {}} /><SelectedPoint /></AppProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Select Frisco, Texas · Census reference point" }));
  expect(screen.getByTestId("selected-point")).toHaveTextContent("live:Frisco, Texas · Census reference point");
  expect(screen.getByTestId("selected-coordinates")).toHaveTextContent(JSON.stringify({ latitude: 33.155424, longitude: -96.8225927 }));
  expect(gps).not.toHaveBeenCalled();
});

test("opening the selector does not ask permission before deliberate GPS interaction", async () => {
  const screen = await render(
    <AppProvider>
      <LocationPicker visible onClose={jest.fn()} />
    </AppProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Use foreground GPS" }),
  ).toBeTruthy();
  expect(gps).not.toHaveBeenCalled();
});

test("denied GPS shows its explanation and manual coordinates remain usable", async () => {
  gps.mockRejectedValueOnce(
    new Error(
      "Location permission denied. Choose a city center or enter coordinates instead.",
    ),
  );
  const onClose = jest.fn();
  const screen = await render(
    <AppProvider>
      <LocationPicker visible onClose={onClose} />
      <SelectedPoint />
    </AppProvider>,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Use foreground GPS" }),
  );
  await waitFor(() =>
    expect(
      screen.getByText(
        "Location permission denied. Choose a city center or enter coordinates instead.",
      ),
    ).toBeTruthy(),
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.queryByTestId("location-manual-error")).toBeNull();

  await fireEvent.changeText(screen.getByLabelText("Latitude"), "30.0474");
  await fireEvent.changeText(screen.getByLabelText("Longitude"), "-99.1403");
  await fireEvent.changeText(
    screen.getByLabelText("Location label"),
    "Manual test point",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Use these coordinates" }),
  );
  expect(screen.getByTestId("selected-point")).toHaveTextContent(
    "live:Manual test point",
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("invalid manual coordinates keep the selector open without changing mode/location", async () => {
  const onClose = jest.fn();
  const screen = await render(
    <AppProvider>
      <LocationPicker visible onClose={onClose} />
      <SelectedPoint />
    </AppProvider>,
  );
  await fireEvent.changeText(screen.getByLabelText("Latitude"), "300");
  await fireEvent.changeText(screen.getByLabelText("Longitude"), "-99");
  await fireEvent.press(
    screen.getByRole("button", { name: "Use these coordinates" }),
  );
  expect(
    screen.getByText(
      "Latitude must be between −90 and 90; longitude between −180 and 180.",
    ),
  ).toBeTruthy();
  expect(screen.getByTestId("selected-point")).toHaveTextContent("live:none");
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId("location-manual-error").props.accessibilityLiveRegion).toBe("polite");
  expect(screen.getAllByText("Latitude must be between −90 and 90; longitude between −180 and 180.")).toHaveLength(1);
});

test("a late GPS completion after the selector closes cannot switch location or enter live mode", async () => {
  let resolveGps!: (
    location: Awaited<ReturnType<typeof requestDeviceLocation>>,
  ) => void;
  gps.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveGps = resolve;
    }),
  );
  const onClose = jest.fn();
  const screen = await render(
    <AppProvider>
      <LocationPicker visible onClose={onClose} />
      <SelectedPoint />
    </AppProvider>,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Use foreground GPS" }),
  );
  await screen.rerender(
    <AppProvider>
      <LocationPicker visible={false} onClose={onClose} />
      <SelectedPoint />
    </AppProvider>,
  );
  await act(() =>
    resolveGps({
      label: "Late GPS point",
      coordinates: { latitude: 30, longitude: -99 },
      kind: "gps",
    }),
  );
  expect(screen.getByTestId("selected-point")).toHaveTextContent("live:none");
  expect(onClose).not.toHaveBeenCalled();
});

test("fixed Close stays outside the keyboard-aware coordinate form and rejects a pending GPS result", async () => {
  let resolveGps!: (
    location: Awaited<ReturnType<typeof requestDeviceLocation>>,
  ) => void;
  gps.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveGps = resolve;
    }),
  );
  const onClose = jest.fn();
  const screen = await render(
    <AppProvider>
      <LocationPicker visible onClose={onClose} />
      <SelectedPoint />
    </AppProvider>,
  );
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const form = scrollViews[0];
  expect(within(form).getByLabelText("Latitude")).toBeTruthy();
  expect(within(form).getByLabelText("Longitude")).toBeTruthy();
  expect(within(form).queryByRole("button", { name: "Close location selector" })).toBeNull();
  expect(form.props.automaticallyAdjustKeyboardInsets).toBe(true);
  await fireEvent(within(form).getByLabelText("Latitude"), "focus");
  await fireEvent.changeText(within(form).getByLabelText("Latitude"), "30.0474");
  await fireEvent.press(
    screen.getByRole("button", { name: "Use foreground GPS" }),
  );
  expect(screen.getByRole("button", { name: "Close location selector" })).toBeEnabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Close location selector" }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Use foreground GPS" }),
  ).toBeEnabled();
  await act(() =>
    resolveGps({
      label: "Cancelled GPS point",
      coordinates: { latitude: 30, longitude: -99 },
      kind: "gps",
    }),
  );
  expect(screen.getByTestId("selected-point")).toHaveTextContent("live:none");
  expect(within(form).getByLabelText("Latitude").props.value).toBe("30.0474");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("hiding and reopening during GPS resets busy controls and cannot apply the old request", async () => {
  let resolveGps!: (location: Awaited<ReturnType<typeof requestDeviceLocation>>) => void;
  gps.mockReturnValueOnce(new Promise((resolve) => { resolveGps = resolve; }));
  const onClose = jest.fn();
  const picker = (visible: boolean) => <AppProvider><LocationPicker visible={visible} onClose={onClose} /><SelectedPoint /></AppProvider>;
  const screen = await render(picker(true));
  await fireEvent.press(screen.getByRole("button", { name: "Use foreground GPS" }));
  expect(screen.getByRole("button", { name: "Finding your GPS point…" })).toBeDisabled();
  await screen.rerender(picker(false));
  expect(screen.queryByTestId("location-picker")).toBeNull();
  await screen.rerender(picker(true));
  expect(screen.getByRole("button", { name: "Use foreground GPS" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Use these coordinates" })).toBeEnabled();
  const city = texasLocations[0];
  expect(screen.getByRole("button", { name: `Select ${city.label}` })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: `Select ${city.label}` }));
  await act(() => resolveGps({ label: "Obsolete GPS result", kind: "gps", coordinates: { latitude: 31, longitude: -98 } }));
  expect(screen.getByTestId("selected-point")).toHaveTextContent(`live:${city.label}`);
  expect(screen.getByTestId("selected-coordinates")).toHaveTextContent(JSON.stringify(city.coordinates));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("cancelling GPS keeps the selector open for manual entry and rejects a later GPS success", async () => {
  let resolveGps!: (location: Awaited<ReturnType<typeof requestDeviceLocation>>) => void;
  gps.mockReturnValueOnce(new Promise((resolve) => { resolveGps = resolve; }));
  const onClose = jest.fn();
  const screen = await render(<AppProvider><LocationPicker visible onClose={onClose} /><SelectedPoint /></AppProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Use foreground GPS" }));
  expect(screen.getByRole("button", { name: "Use these coordinates" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel GPS request" }));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId("location-picker")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cancel GPS request" })).toBeNull();
  expect(screen.getByRole("button", { name: "Use foreground GPS" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Use these coordinates" })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText("Latitude"), "30.0474");
  await fireEvent.changeText(screen.getByLabelText("Longitude"), "-99.1403");
  await fireEvent.changeText(screen.getByLabelText("Location label"), "Selected manual alternative");
  await fireEvent.press(screen.getByRole("button", { name: "Use these coordinates" }));
  await act(() => resolveGps({ label: "Cancelled GPS result", kind: "gps", coordinates: { latitude: 31, longitude: -98 } }));
  expect(screen.getByTestId("selected-point")).toHaveTextContent("live:Selected manual alternative");
  expect(screen.getByTestId("selected-coordinates")).toHaveTextContent(JSON.stringify({ latitude: 30.0474, longitude: -99.1403 }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("location-error")).toHaveTextContent(/^null$/);
});

test("cancelling GPS enables city selection and ignores its later failure without displaying an error", async () => {
  let rejectGps!: (error: Error) => void;
  gps.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectGps = reject; }));
  const onClose = jest.fn();
  const screen = await render(<AppProvider><LocationPicker visible onClose={onClose} /><SelectedPoint /></AppProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Use foreground GPS" }));
  const city = texasLocations[1];
  expect(screen.getByRole("button", { name: `Select ${city.label}` })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel GPS request" }));
  await fireEvent.press(screen.getByRole("button", { name: `Select ${city.label}` }));
  await act(() => rejectGps(new Error("Cancelled GPS failure")));
  expect(screen.queryByText("Cancelled GPS failure")).toBeNull();
  expect(screen.getByTestId("location-error")).toHaveTextContent(/^null$/);
  expect(screen.getByTestId("selected-point")).toHaveTextContent(`live:${city.label}`);
  expect(screen.getByTestId("selected-coordinates")).toHaveTextContent(JSON.stringify(city.coordinates));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the displayed longitude example can be used directly as a negative manual coordinate", async () => {
  const onClose = jest.fn();
  const screen = await render(<AppProvider><LocationPicker visible onClose={onClose} /><SelectedPoint /></AppProvider>);
  const example = String(screen.getByLabelText("Longitude").props.placeholder).replace("Longitude, for example ", "");
  await fireEvent.changeText(screen.getByLabelText("Latitude"), "30.0474");
  await fireEvent.changeText(screen.getByLabelText("Longitude"), example);
  await fireEvent.press(screen.getByRole("button", { name: "Use these coordinates" }));
  expect(screen.getByTestId("selected-coordinates")).toHaveTextContent(JSON.stringify({ latitude: 30.0474, longitude: -99.1403 }));
  expect(screen.queryByTestId("location-manual-error")).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});
