import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, Text, type AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { layerSource, useDisasterLayers, type DisasterLayers, type DisasterLayerOptions } from "../src/hooks/useDisasterLayers";
import { getEarthquakes } from "../src/services/usgsEarthquakes";
import { getNearbyRiverGauges } from "../src/services/usgsRivers";
import type { Coordinates } from "../src/domain/types";

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock("@react-native-community/netinfo", () => ({ useNetInfo: () => mockNetwork }));
jest.mock("../src/services/usgsEarthquakes", () => ({
  EARTHQUAKE_WINDOW_MS: 24 * 60 * 60_000, getEarthquakes: jest.fn(),
}));
jest.mock("../src/services/usgsRivers", () => ({ getNearbyRiverGauges: jest.fn() }));
const earthquakes = jest.mocked(getEarthquakes);
const rivers = jest.mocked(getNearbyRiverGauges);
const NOW = Date.parse("2026-10-10T20:00:00Z");
const point: Coordinates = { latitude: 30, longitude: -99 };
const snapshot = () => ({ items: [], fetchedAt: new Date(Date.now()).toISOString(), generatedAt: null, coverage: "Official test coverage" });
let state: DisasterLayers;
let client: QueryClient;
let notifyState: (state: AppStateStatus) => void;
function Probe({ selected = point, enabled = true, options }: { selected?: Coordinates | null; enabled?: boolean; options?: DisasterLayerOptions }) {
  const layers = useDisasterLayers(selected, enabled, options);
  useEffect(() => { state = layers; }, [layers]);
  return <Text>{layers.earthquakes.source}</Text>;
}
async function mount(enabled = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><Probe enabled={enabled} /></QueryClientProvider>);
}
async function advance(milliseconds: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds); });
}
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
  earthquakes.mockImplementation(async () => snapshot());
  rivers.mockImplementation(async () => snapshot());
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    notifyState = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("demo-disabled layers never fetch or expose previous real query data", async () => {
  await mount(false);
  expect(state.earthquakes.source).toBe("unavailable");
  expect(state.rivers.items).toEqual([]);
  expect(earthquakes).not.toHaveBeenCalled();
  expect(rivers).not.toHaveBeenCalled();
});

test("polls earthquakes at 60 seconds and rivers at five minutes without early manual refreshes", async () => {
  await mount();
  await waitFor(() => expect(state.rivers.source).toBe("live"));
  await act(() => state.rivers.refresh());
  expect(rivers).toHaveBeenCalledTimes(1);
  await advance(60_000);
  await waitFor(() => expect(earthquakes).toHaveBeenCalledTimes(2));
  expect(rivers).toHaveBeenCalledTimes(1);
  await advance(240_000);
  await waitFor(() => expect(rivers).toHaveBeenCalledTimes(2));
  expect(earthquakes).toHaveBeenCalledTimes(6);
});

test("offline and failed verification preserve prior items with cached labels; reconnection cannot fetch early", async () => {
  const view = await mount();
  await waitFor(() => expect(state.earthquakes.source).toBe("live"));
  const fetchedAt = state.earthquakes.fetchedAt;
  mockNetwork.isConnected = false;
  await view.rerender(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  expect(state.earthquakes.source).toBe("cached");
  await advance(30_000);
  mockNetwork.isConnected = true;
  await view.rerender(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  expect(earthquakes).toHaveBeenCalledTimes(1);
  earthquakes.mockRejectedValue(new Error("USGS temporarily unavailable"));
  await advance(60_000);
  await waitFor(() => expect(state.earthquakes.error).toBeTruthy());
  expect(state.earthquakes.source).toBe("cached");
  expect(state.earthquakes.fetchedAt).toBe(fetchedAt);
});

test("backgrounding cancels a pending request and suspends both polling streams", async () => {
  let signal: AbortSignal | undefined;
  earthquakes.mockImplementation((received) => { signal = received; return new Promise(() => {}); });
  await mount();
  await waitFor(() => expect(earthquakes).toHaveBeenCalledTimes(1));
  await act(() => notifyState("background"));
  expect(signal?.aborted).toBe(true);
  await advance(600_000);
  expect(earthquakes).toHaveBeenCalledTimes(1);
  expect(rivers).toHaveBeenCalledTimes(1);
});

test("turning a layer off cancels its polling and manual requests while preserving the independently enabled layer", async () => {
  const view = await mount();
  await waitFor(() => expect(state.rivers.source).toBe("live"));
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ earthquakes: false }} /></QueryClientProvider>);
  await act(() => state.earthquakes.refresh());
  await advance(300_000);
  expect(earthquakes).toHaveBeenCalledTimes(1);
  expect(state.earthquakes.canRefresh).toBe(false);
  expect(state.earthquakes.source).toBe("cached");
  await waitFor(() => expect(rivers).toHaveBeenCalledTimes(2));
});

test("source freshness considers failed verification, retrieval age and stale generated feed timestamps", () => {
  const data = snapshot();
  expect(layerSource(undefined, false, null, NOW, 90_000)).toBe("unavailable");
  expect(layerSource(data, false, null, NOW, 90_000)).toBe("live");
  expect(layerSource(data, false, null, NOW + 90_000, 90_000)).toBe("cached");
  expect(layerSource(data, false, new Error("failed"), NOW, 90_000)).toBe("cached");
  expect(layerSource({ ...data, generatedAt: new Date(NOW - 120_000).toISOString() }, false, null, NOW, 90_000)).toBe("cached");
});
