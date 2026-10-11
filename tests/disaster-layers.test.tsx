import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, Text, type AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { layerSource, useDisasterLayers, type DisasterLayers, type DisasterLayerOptions } from "../src/hooks/useDisasterLayers";
import { getEarthquakes } from "../src/services/usgsEarthquakes";
import { getNearbyRiverGauges } from "../src/services/usgsRivers";
import type { Coordinates } from "../src/domain/types";
import { ClearPathDataError } from "../src/data/http";

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
async function mount(enabled = true, options?: DisasterLayerOptions) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><Probe enabled={enabled} options={options} /></QueryClientProvider>);
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

test("manual USGS mode allows explicit independent refreshes while mount, polling, resume and reconnect stay silent", async () => {
  const view = await mount(true, { automatic: false });
  expect(state.earthquakes.canRefresh).toBe(true);
  expect(state.rivers.canRefresh).toBe(true);
  expect(state.earthquakes.loading).toBe(false);
  await advance(600_000);
  await act(() => notifyState("background"));
  await act(() => notifyState("active"));
  mockNetwork.isConnected = false;
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.earthquakes.canRefresh).toBe(false);
  mockNetwork.isConnected = true;
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(earthquakes).not.toHaveBeenCalled();
  expect(rivers).not.toHaveBeenCalled();
  await act(() => state.earthquakes.refresh());
  await waitFor(() => expect(state.earthquakes.source).toBe("live"));
  expect(rivers).not.toHaveBeenCalled();
  await act(() => state.rivers.refresh());
  await waitFor(() => expect(state.rivers.source).toBe("live"));
  await act(() => state.rivers.refresh());
  expect(rivers).toHaveBeenCalledTimes(1);
  const earthTime = state.earthquakes.fetchedAt;
  const riverTime = state.rivers.fetchedAt;
  await advance(90_000);
  expect(state.earthquakes.source).toBe("cached");
  expect(state.earthquakes.fetchedAt).toBe(earthTime);
  await advance(510_000);
  expect(state.rivers.source).toBe("cached");
  expect(state.rivers.fetchedAt).toBe(riverTime);
  expect(earthquakes).toHaveBeenCalledTimes(1);
  expect(rivers).toHaveBeenCalledTimes(1);
});

test("switching USGS to manual cancels pending automatic work and ignores its late response", async () => {
  let signal: AbortSignal | undefined;
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  earthquakes.mockImplementationOnce((received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  const view = await mount();
  await waitFor(() => expect(earthquakes).toHaveBeenCalledTimes(1));
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(signal?.aborted).toBe(true);
  await act(() => finish(snapshot()));
  await advance(60_000);
  expect(state.earthquakes.source).toBe("unavailable");
  expect(earthquakes).toHaveBeenCalledTimes(1);
  await act(() => state.earthquakes.refresh());
  await waitFor(() => expect(state.earthquakes.source).toBe("live"));
  expect(earthquakes).toHaveBeenCalledTimes(2);
});

test("manual river point changes do not reuse prior observations or fetch until pressed", async () => {
  const view = await mount(true, { automatic: false });
  await act(() => state.rivers.refresh());
  await waitFor(() => expect(state.rivers.source).toBe("live"));
  const next = { latitude: 30.2, longitude: -99.2 };
  await view.rerender(<QueryClientProvider client={client}><Probe selected={next} options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.rivers.source).toBe("unavailable");
  expect(state.rivers.items).toEqual([]);
  await advance(300_000);
  expect(rivers).toHaveBeenCalledTimes(1);
  await act(() => state.rivers.refresh());
  await waitFor(() => expect(state.rivers.source).toBe("live"));
  expect(rivers.mock.calls[1][0]).toEqual(next);
});

test("manual USGS snapshots catch up their age clock immediately when Map regains focus", async () => {
  const view = await mount(true, { automatic: false });
  await act(() => state.earthquakes.refresh());
  await waitFor(() => expect(state.earthquakes.source).toBe("live"));
  await view.rerender(<QueryClientProvider client={client}><Probe enabled={false} options={{ automatic: false }} /></QueryClientProvider>);
  await advance(120_000);
  await view.rerender(<QueryClientProvider client={client}><Probe enabled options={{ automatic: false }} /></QueryClientProvider>);
  await advance(1);
  expect(state.earthquakes.source).toBe("cached");
  expect(earthquakes).toHaveBeenCalledTimes(1);
});

test("manual USGS requests abort on backgrounding even though automatic queries were disabled already", async () => {
  let signal: AbortSignal | undefined;
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  earthquakes.mockImplementationOnce((received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  await mount(true, { automatic: false });
  await act(() => { void state.earthquakes.refresh(); });
  await waitFor(() => expect(earthquakes).toHaveBeenCalledTimes(1));
  await act(() => notifyState("background"));
  expect(signal?.aborted).toBe(true);
  await act(() => finish(snapshot()));
  await act(() => notifyState("active"));
  await advance(60_000);
  expect(state.earthquakes.source).toBe("unavailable");
  expect(earthquakes).toHaveBeenCalledTimes(1);
});

test.each(["earthquakes", "rivers"] as const)("two immediate %s refreshes join one manual request without restarting its cooldown", async (layer) => {
  await mount(true, { automatic: false });
  await act(() => state[layer].refresh());
  await waitFor(() => expect(state[layer].source).toBe("live"));
  const interval = layer === "earthquakes" ? 60_000 : 300_000;
  await advance(interval);
  const request = layer === "earthquakes" ? earthquakes : rivers;
  let signal: AbortSignal | undefined;
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  if (layer === "earthquakes") {
    earthquakes.mockImplementationOnce((received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  } else {
    rivers.mockImplementationOnce((_point, received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  }
  // Use the same render's callback to model a second press before isFetching
  // has disabled the button. No clock time elapses between these calls.
  const refresh = state[layer].refresh;
  const startedAt = Date.now();
  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(async () => {
    first = refresh();
    await Promise.resolve();
    second = refresh();
    await Promise.resolve();
  });
  expect(request).toHaveBeenCalledTimes(2); // Initial copy plus one manual update.
  expect(signal?.aborted).toBe(false);
  const fetchedAt = new Date(Date.now()).toISOString();
  await act(async () => { finish(snapshot()); await Promise.all([first, second]); });
  await waitFor(() => expect(state[layer].fetchedAt).toBe(fetchedAt));
  expect(state[layer].canRefresh).toBe(false);
  await advance(startedAt + interval - Date.now() - 1);
  expect(request).toHaveBeenCalledTimes(2);
  expect(state[layer].canRefresh).toBe(false);
  await advance(1);
  expect(state[layer].canRefresh).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
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

test.each(["disabled", "layer-off", "offline", "background", "unmounted"] as const)(
  "captured USGS refreshes cannot request after their context becomes %s", async (change) => {
    const view = await mount(true, { automatic: false });
    const heldEarth = state.earthquakes.refresh;
    const heldRiver = state.rivers.refresh;
    if (change === "disabled") await view.rerender(<QueryClientProvider client={client}><Probe enabled={false} options={{ automatic: false }} /></QueryClientProvider>);
    if (change === "layer-off") await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false, earthquakes: false, rivers: false }} /></QueryClientProvider>);
    if (change === "offline") {
      mockNetwork.isInternetReachable = false;
      await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
    }
    if (change === "background") await act(() => notifyState("background"));
    if (change === "unmounted") await view.unmount();
    await act(async () => { await Promise.all([heldEarth(), heldRiver()]); });
    expect(earthquakes).not.toHaveBeenCalled();
    expect(rivers).not.toHaveBeenCalled();
  },
);

test("an obsolete river callback cannot request the old point, even after returning to it", async () => {
  const view = await mount(true, { automatic: false });
  const held = state.rivers.refresh;
  await view.rerender(<QueryClientProvider client={client}><Probe selected={{ latitude: 30.2, longitude: -99.2 }} options={{ automatic: false }} /></QueryClientProvider>);
  await act(() => held());
  expect(rivers).not.toHaveBeenCalled();
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  await act(() => held());
  expect(rivers).not.toHaveBeenCalled();
  await act(() => state.rivers.refresh());
  expect(rivers.mock.calls[0][0]).toEqual(point);
});

test.each(["earthquakes", "rivers"] as const)("the %s cadence survives an observer remount with its existing copy", async (layer) => {
  const view = await mount(true, { automatic: false });
  const started = Date.now();
  const held = state[layer].refresh;
  await act(() => state[layer].refresh());
  const fetchedAt = state[layer].fetchedAt;
  await view.unmount();
  await render(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(state[layer].fetchedAt).toBe(fetchedAt);
  expect(state[layer].canRefresh).toBe(false);
  await act(async () => { await Promise.all([held(), state[layer].refresh()]); });
  const request = layer === "earthquakes" ? earthquakes : rivers;
  expect(request).toHaveBeenCalledTimes(1);
  const interval = layer === "earthquakes" ? 60_000 : 300_000;
  await advance(started + interval - Date.now());
  await act(() => state[layer].refresh());
  expect(request).toHaveBeenCalledTimes(2);
});

test("a river provider pause survives remount and point change without delaying earthquake requests", async () => {
  rivers.mockRejectedValueOnce(new ClearPathDataError("http", "limited", { status: 429, retryAfterMs: 600_000 }));
  const view = await mount(true, { automatic: false });
  const started = Date.now();
  await act(() => state.rivers.refresh());
  await view.unmount();
  const next = { latitude: 30.2, longitude: -99.2 };
  await render(<QueryClientProvider client={client}><Probe selected={next} options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.rivers.source).toBe("unavailable");
  expect(state.rivers.canRefresh).toBe(false);
  expect(state.earthquakes.canRefresh).toBe(true);
  await act(() => state.earthquakes.refresh());
  expect(earthquakes).toHaveBeenCalledTimes(1);
  await act(() => state.rivers.refresh());
  expect(rivers).toHaveBeenCalledTimes(1);
  await advance(started + 600_000 - Date.now());
  await act(() => state.rivers.refresh());
  expect(rivers.mock.calls[1][0]).toEqual(next);
});

test("earthquake Retry-After survives a remount without delaying the river service", async () => {
  earthquakes.mockRejectedValueOnce(new ClearPathDataError("http", "limited", { status: 429, retryAfterMs: 120_000 }));
  const view = await mount(true, { automatic: false });
  const started = Date.now();
  await act(() => state.earthquakes.refresh());
  await view.unmount();
  await render(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.earthquakes.canRefresh).toBe(false);
  await act(() => state.rivers.refresh());
  expect(rivers).toHaveBeenCalledTimes(1);
  await act(() => state.earthquakes.refresh());
  expect(earthquakes).toHaveBeenCalledTimes(1);
  await advance(started + 120_000 - Date.now());
  await act(() => state.earthquakes.refresh());
  expect(earthquakes).toHaveBeenCalledTimes(2);
});

test("changing back to a river point keeps its original gate without borrowing the other point's copy", async () => {
  const view = await mount(true, { automatic: false });
  await act(() => state.rivers.refresh());
  const fetchedAt = state.rivers.fetchedAt;
  await view.rerender(<QueryClientProvider client={client}><Probe selected={{ latitude: 30.2, longitude: -99.2 }} options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.rivers.source).toBe("unavailable");
  expect(state.rivers.canRefresh).toBe(true);
  await act(() => state.rivers.refresh());
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ automatic: false }} /></QueryClientProvider>);
  expect(state.rivers.fetchedAt).toBe(fetchedAt);
  expect(state.rivers.canRefresh).toBe(false);
  await act(() => state.rivers.refresh());
  expect(rivers).toHaveBeenCalledTimes(2);
});

test("a disabled USGS layer cancels an already waiting request slot before download", async () => {
  const view = await mount();
  await waitFor(() => expect(state.earthquakes.source).toBe("live"));
  await act(() => { void client.invalidateQueries({ queryKey: ["usgs-earthquakes", "last-day"], exact: true }); });
  await waitFor(() => expect(state.earthquakes.refreshing).toBe(true));
  await view.rerender(<QueryClientProvider client={client}><Probe options={{ earthquakes: false }} /></QueryClientProvider>);
  await advance(60_000);
  expect(earthquakes).toHaveBeenCalledTimes(1);
});
