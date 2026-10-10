import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { ZoneAreaDetail } from "../src/components/ZoneAreaDetail";
import type { AlertSelection } from "../src/components/AlertDetail";
import { getNwsZoneBoundaries, type ZoneBoundaryResult } from "../src/services/nwsZones";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

jest.mock("../src/services/nwsZones", () => ({ getNwsZoneBoundaries: jest.fn(), NWS_ZONE_LIMITS: { cacheAgeMs: 24 * 60 * 60_000 } }));
jest.mock("../src/components/MapCanvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: (props: object) => React.createElement(View, { ...props, testID: "zone-map" }) };
});

const download = jest.mocked(getNwsZoneBoundaries);
const url = "https://api.weather.gov/zones/forecast/TXZ001";
const selection: AlertSelection = { alert: officialAlert({ affectedZones: [url] }), source: "live", fetchedAt: new Date(TEST_NOW).toISOString() };
const result: ZoneBoundaryResult = {
  requested: 1, loaded: 1, failed: 0, notLoaded: 0, failures: [], notLoadedUrls: [],
  boundaries: [{ url, id: "TXZ001", name: "Test linked zone", zoneType: "forecast", fetchedAt: new Date(TEST_NOW).toISOString(), cached: false,
    geometry: { type: "Polygon", coordinates: [[[-100, 30], [-99, 30], [-99, 31], [-100, 31], [-100, 30]]] } }],
};

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
  download.mockReset();
  download.mockResolvedValue(result);
});
afterEach(async () => { await cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

test("opening a linked-zone view is a preflight and never downloads until explicitly pressed", async () => {
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={jest.fn()} />);
  expect(download).not.toHaveBeenCalled();
  expect(screen.getByText("No zone boundaries downloaded.")).toBeTruthy();
  expect(screen.getByText(/Zone boundaries, not a supplied warning polygon or measured flood extent/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  expect(download).toHaveBeenCalledTimes(1);
  expect(download.mock.calls[0][0]).toEqual([url]);
  expect(screen.getByTestId("zone-map").props).toMatchObject({ alerts: [], showWarnings: false, pointIsSelection: false, zoneBoundaries: result.boundaries });
  expect(selection.alert.geometry).toBeNull();
  expect(screen.getByText("BOUNDARY / RETRIEVED NWS COPY")).toBeTruthy();
});

test("partial downloads expose failed and absent zones without implying full coverage", async () => {
  download.mockResolvedValue({ ...result, requested: 6, failed: 2, notLoaded: 3, reason: "Download limits reached." });
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  expect(screen.getByText("1 LOADED / 2 FAILED / 3 NOT LOADED / 6 REQUESTED")).toBeTruthy();
  expect(screen.getByText("PARTIAL COVERAGE")).toBeTruthy();
  expect(screen.getByText("Download limits reached.")).toBeTruthy();
});

test("changing or closing the selected alert aborts its request and rejects a late result", async () => {
  let resolve!: (value: ZoneBoundaryResult) => void;
  download.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  const signal = download.mock.calls[0][1]!;
  const replacement: AlertSelection = { ...selection, alert: officialAlert({ id: "replacement", affectedZones: [url] }) };
  await screen.rerender(<ZoneAreaDetail selection={replacement} enabled onClose={jest.fn()} />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(result));
  expect(screen.queryByTestId("zone-map")).toBeNull();
  expect(screen.getByText("No zone boundaries downloaded.")).toBeTruthy();
  expect(download).toHaveBeenCalledTimes(1);
});

test("losing the verified context closes and cancels the zone session", async () => {
  download.mockImplementation(() => new Promise(() => {}));
  const onClose = jest.fn();
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={onClose} />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  const signal = download.mock.calls[0][1]!;
  await screen.rerender(<ZoneAreaDetail selection={selection} enabled={false} onClose={onClose} />);
  expect(onClose).toHaveBeenCalled();
  expect(signal.aborted).toBe(true);
  expect(screen.queryByTestId("zone-map")).toBeNull();
});

test("backgrounding closes the parent-controlled modal and aborts its network request", async () => {
  let background!: (value: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
    background = callback;
    return { remove: jest.fn() };
  });
  download.mockImplementation(() => new Promise(() => {}));
  function Harness() {
    const [chosen, setChosen] = useState<AlertSelection | null>(selection);
    return <ZoneAreaDetail selection={chosen} enabled onClose={() => setChosen(null)} />;
  }
  const screen = await render(<Harness />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  const signal = download.mock.calls[0][1]!;
  await act(() => background("background"));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByText("Zone areas")).toBeNull();
  listener.mockRestore();
});

test("provider Retry-After prevents another download until its deadline", async () => {
  download.mockResolvedValue({ ...result, retryAfterMs: 60_000 });
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  expect(screen.getByRole("button", { name: "NWS download on cooldown" }).props.accessibilityState.disabled).toBe(true);
  await act(async () => { await jest.advanceTimersByTimeAsync(59_999); });
  expect(screen.queryByRole("button", { name: "Retry NWS boundaries" })).toBeNull();
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(screen.getByRole("button", { name: "Retry NWS boundaries" }).props.accessibilityState.disabled).toBe(false);
});

test("expiry closes the zone view even before another regional refresh", async () => {
  const onClose = jest.fn();
  const expiring = { ...selection, alert: { ...selection.alert, expires: new Date(TEST_NOW + 1_000).toISOString() } };
  await render(<ZoneAreaDetail selection={expiring} enabled onClose={onClose} />);
  await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(download).not.toHaveBeenCalled();
});

test("a loaded zone definition expires independently of the warning copy", async () => {
  download.mockResolvedValue({ ...result, boundaries: result.boundaries.map((boundary) => ({ ...boundary, expirationDate: new Date(TEST_NOW + 2_000).toISOString() })) });
  const onClose = jest.fn();
  const screen = await render(<ZoneAreaDetail selection={selection} enabled onClose={onClose} />);
  await fireEvent.press(screen.getByRole("button", { name: "Download NWS boundaries" }));
  await act(async () => { await jest.advanceTimersByTimeAsync(2_000); });
  expect(onClose).toHaveBeenCalledTimes(1);
});
