import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LocationPicker } from "../src/components/LocationPicker";
import { requestDeviceLocation } from "../src/services/location";
import { AppProvider, useAppState } from "../src/state/AppState";

jest.mock("../src/services/location", () => ({
  ...jest.requireActual("../src/services/location"),
  requestDeviceLocation: jest.fn(),
}));

function SelectedPoint() {
  const state = useAppState();
  return (
    <Text testID="selected-point">
      {state.mode}:{state.location?.label || "none"}
    </Text>
  );
}
const gps = jest.mocked(requestDeviceLocation);
beforeEach(async () => {
  await AsyncStorage.clear();
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
  expect(screen.getByTestId("selected-point")).toHaveTextContent("demo:none");
  expect(onClose).not.toHaveBeenCalled();
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
  expect(screen.getByTestId("selected-point")).toHaveTextContent("demo:none");
  expect(onClose).not.toHaveBeenCalled();
});

test("closing a pending GPS request cancels its UI result and restores the selectable controls", async () => {
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
  expect(screen.getByTestId("selected-point")).toHaveTextContent("demo:none");
  expect(onClose).toHaveBeenCalledTimes(1);
});
