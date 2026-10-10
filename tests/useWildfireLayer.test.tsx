import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, Text, type AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWildfireLayer, type WildfireLayerState } from "../src/hooks/useWildfireLayer";
import { getWildfirePerimeters } from "../src/services/nifcWildfires";
import { ClearPathDataError } from "../src/data/http";
import type { OfficialWildfirePerimeter, WildfireCoverage, WildfireSnapshot } from "../src/services/wildfireTypes";

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock("@react-native-community/netinfo", () => ({ useNetInfo: () => mockNetwork }));
jest.mock("../src/services/nifcWildfires", () => ({ getWildfirePerimeters: jest.fn() }));
const fetchWildfires = jest.mocked(getWildfirePerimeters);
const NOW = Date.parse("2026-10-10T23:00:00Z");
const INTERVAL = 300_000;
const CAPTURED = "2026-09-30T08:00:00Z";
const fire: OfficialWildfirePerimeter = {
  id: "test:mapped-fire", objectId: 1, incidentId: null, name: "Test mapped fire",
  geometry: { type: "Polygon", coordinates: [[[-99, 30], [-98, 30], [-98, 31], [-99, 30]]] },
  capturedAt: CAPTURED, polygonUpdatedAt: new Date(NOW).toISOString(), incidentUpdatedAt: null,
  acres: 12, reportedAcres: 15, percentContained: null, state: "US-TX", mapMethod: "Hand Sketch",
  featureCategory: "Wildfire Daily Fire Perimeter",
  sourceUrl: "https://www.arcgis.com/home/item.html?id=d1c32af3212341869b3c810f1a215824",
};
function snapshot(coverage: WildfireCoverage = "TX", overrides: Partial<WildfireSnapshot> = {}): WildfireSnapshot {
  return { items: [fire], coverage, fetchedAt: new Date(Date.now()).toISOString(), available: 1,
    countedAt: new Date(Date.now()).toISOString(), returned: 1, omitted: 0, truncated: false, reason: null, ...overrides };
}
type Options = { coverage?: WildfireCoverage; enabled?: boolean; automatic?: boolean };
let state: WildfireLayerState;
let client: QueryClient;
let notifyState: (value: AppStateStatus) => void;
function Probe({ coverage = "TX", enabled, automatic }: Options) {
  const observed = useWildfireLayer(coverage, enabled, { automatic });
  useEffect(() => { state = observed; }, [observed]);
  return <Text>{observed.source}</Text>;
}
async function mount(options: Options = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const view = await render(<QueryClientProvider client={client}><Probe {...options} /></QueryClientProvider>);
  return { update: (next: Options) => view.rerender(<QueryClientProvider client={client}><Probe {...next} /></QueryClientProvider>) };
}
async function advance(milliseconds: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds); });
}
async function changeAppState(value: AppStateStatus) {
  Object.defineProperty(AppState, "currentState", { configurable: true, value });
  await act(() => notifyState(value));
}
function deferred() {
  let signal: AbortSignal | undefined;
  let finish!: (value: WildfireSnapshot) => void;
  fetchWildfires.mockImplementationOnce((_coverage, received) => {
    signal = received;
    return new Promise((resolve) => { finish = resolve; });
  });
  return { finish: (value: WildfireSnapshot) => finish(value), signal: () => signal };
}
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  fetchWildfires.mockReset().mockImplementation(async (coverage) => snapshot(coverage));
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    notifyState = listener as (value: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("wildfires default off; caller readiness and focus gating prevent requests and hide retained copies", async () => {
  const view = await mount();
  expect(state.items).toEqual([]);
  expect(state.source).toBe("unavailable");
  await act(() => state.refresh());
  await advance(INTERVAL * 2);
  expect(fetchWildfires).not.toHaveBeenCalled();
  await view.update({ enabled: true });
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.items).toEqual([fire]);
  await view.update({ enabled: false });
  expect(state.items).toEqual([]);
  expect(state.fetchedAt).toBeNull();
  expect(state.available).toBeNull();
  expect(state.canRefresh).toBe(false);
  expect(client.getQueryData(["nifc-wildfires", "TX"])).toMatchObject({ items: [fire] });
});

test("manual mode keeps initial, poll, resume, reconnect and coverage changes silent until explicitly refreshed", async () => {
  const view = await mount({ enabled: true, automatic: false });
  expect(state.canRefresh).toBe(true);
  expect(state.loading).toBe(false);
  await advance(INTERVAL * 2);
  await changeAppState("background");
  expect(state.canRefresh).toBe(false);
  await changeAppState("active");
  mockNetwork.isConnected = false;
  await view.update({ enabled: true, automatic: false });
  expect(state.canRefresh).toBe(false);
  mockNetwork.isConnected = true;
  await view.update({ enabled: true, automatic: false, coverage: "US" });
  expect(fetchWildfires).not.toHaveBeenCalled();
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchWildfires.mock.calls[0][0]).toBe("US");
  await advance(INTERVAL * 2);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test("automatic requests poll every five minutes and an early manual refresh cannot bypass the interval", async () => {
  await mount({ enabled: true });
  await waitFor(() => expect(state.source).toBe("live"));
  await act(() => state.refresh());
  await advance(NOW + INTERVAL - Date.now() - 1);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  expect(state.canRefresh).toBe(false);
  await advance(1);
  await waitFor(() => expect(fetchWildfires).toHaveBeenCalledTimes(2));
});

test.each(["background", "off", "offline", "manual"] as const)("%s cancels an in-flight request and discards its late result", async (transition) => {
  const pending = deferred();
  const view = await mount({ enabled: true });
  await waitFor(() => expect(fetchWildfires).toHaveBeenCalledTimes(1));
  if (transition === "background") await changeAppState("background");
  if (transition === "off") await view.update({ enabled: false });
  if (transition === "offline") {
    mockNetwork.isInternetReachable = false;
    await view.update({ enabled: true });
  }
  if (transition === "manual") await view.update({ enabled: true, automatic: false });
  expect(pending.signal()?.aborted).toBe(true);
  await act(() => pending.finish(snapshot()));
  await advance(INTERVAL * 2);
  expect(state.items).toEqual([]);
  expect(state.source).toBe("unavailable");
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test("manual requests are also aborted on background and cannot write a late copy", async () => {
  const pending = deferred();
  await mount({ enabled: true, automatic: false });
  await act(() => { void state.refresh(); });
  await waitFor(() => expect(fetchWildfires).toHaveBeenCalledTimes(1));
  await changeAppState("background");
  expect(pending.signal()?.aborted).toBe(true);
  await act(() => pending.finish(snapshot()));
  await changeAppState("active");
  await advance(INTERVAL * 2);
  expect(state.source).toBe("unavailable");
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test("coverage changes abort the old request and never expose one region's copy as the other", async () => {
  const pending = deferred();
  const view = await mount({ enabled: true });
  await waitFor(() => expect(fetchWildfires).toHaveBeenCalledTimes(1));
  await view.update({ coverage: "US", enabled: true, automatic: false });
  expect(pending.signal()?.aborted).toBe(true);
  expect(state.coverage).toBe("US");
  expect(state.items).toEqual([]);
  await act(() => pending.finish(snapshot("TX")));
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchWildfires.mock.calls[1][0]).toBe("US");
  expect(client.getQueryData(["nifc-wildfires", "TX"])).toBeUndefined();
  expect(client.getQueryData(["nifc-wildfires", "US"])).toMatchObject({ coverage: "US" });
  await view.update({ coverage: "TX", enabled: true, automatic: false });
  expect(state.source).toBe("unavailable");
  await advance(INTERVAL);
  await act(() => state.refresh());
  await waitFor(() => expect(state.coverage).toBe("TX"));
  await waitFor(() => expect(state.source).toBe("live"));
  await view.update({ coverage: "US", enabled: true, automatic: false });
  expect(state.source).toBe("live");
  expect(fetchWildfires).toHaveBeenCalledTimes(3);
});

test("two immediate manual taps make one request and one cooldown without cancelling its signal", async () => {
  const pending = deferred();
  await mount({ enabled: true, automatic: false });
  const refresh = state.refresh;
  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(async () => { first = refresh(); second = refresh(); await Promise.resolve(); });
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  expect(pending.signal()?.aborted).toBe(false);
  await act(async () => { pending.finish(snapshot()); await Promise.all([first, second]); });
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.canRefresh).toBe(false);
  await advance(NOW + INTERVAL - Date.now() - 1);
  expect(state.canRefresh).toBe(false);
  await advance(1);
  expect(state.canRefresh).toBe(true);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test("Retry-After on failure pauses both coverage scopes and does not cause automatic retries in manual mode", async () => {
  fetchWildfires.mockRejectedValueOnce(new ClearPathDataError("http", "Provider paused", { status: 429, retryAfterMs: 600_000 }));
  const view = await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.error?.message).toBe("Provider paused"));
  await view.update({ coverage: "US", enabled: true, automatic: false });
  await act(() => state.refresh());
  await advance(NOW + 600_000 - Date.now() - 1);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  expect(state.canRefresh).toBe(false);
  await advance(1);
  expect(state.canRefresh).toBe(true);
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchWildfires.mock.calls[1][0]).toBe("US");
});

test("a valid partial copy retains metadata while its Retry-After pauses later requests", async () => {
  fetchWildfires.mockResolvedValueOnce(snapshot("US", { available: 4, returned: 2, omitted: 3, truncated: true,
    reason: "Additional pages unavailable", retryAfterMs: 600_000 }));
  await mount({ coverage: "US", enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.items).toHaveLength(1));
  expect(state).toMatchObject({ source: "live", available: 4, returned: 2, omitted: 3, truncated: true, reason: "Additional pages unavailable" });
  await advance(INTERVAL);
  await act(() => state.refresh());
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  expect(state.canRefresh).toBe(false);
});

test("download freshness ages to cached without changing an old perimeter capture date", async () => {
  await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  const fetchedAt = state.fetchedAt;
  expect(state.items[0].capturedAt).toBe(CAPTURED);
  await advance(Date.parse(fetchedAt!) + 600_000 - Date.now());
  expect(state.source).toBe("cached");
  expect(state.fetchedAt).toBe(fetchedAt);
  expect(state.items[0].capturedAt).toBe(CAPTURED);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test.each(["focus", "foreground"] as const)("manual copy age catches up immediately on %s without a request", async (transition) => {
  const view = await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  if (transition === "focus") await view.update({ enabled: false, automatic: false });
  else await changeAppState("background");
  await advance(600_000);
  if (transition === "focus") await view.update({ enabled: true, automatic: false });
  else await changeAppState("active");
  await advance(1);
  expect(state.source).toBe("cached");
  expect(state.items[0].capturedAt).toBe(CAPTURED);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
});

test("failed verification and lost connection retain prior items with cached provenance", async () => {
  const view = await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  const fetchedAt = state.fetchedAt;
  mockNetwork.isConnected = false;
  await view.update({ enabled: true, automatic: false });
  expect(state.source).toBe("cached");
  expect(state.items).toEqual([fire]);
  mockNetwork.isConnected = true;
  await view.update({ enabled: true, automatic: false });
  await advance(INTERVAL);
  fetchWildfires.mockRejectedValueOnce(new ClearPathDataError("network", "Unavailable"));
  await act(() => state.refresh());
  await waitFor(() => expect(state.error).toBeTruthy());
  expect(state.source).toBe("cached");
  expect(state.fetchedAt).toBe(fetchedAt);
  expect(state.items).toEqual([fire]);
});

test("a successfully verified empty response removes former items rather than displaying stale fire geometry", async () => {
  await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.items).toHaveLength(1));
  await advance(INTERVAL);
  fetchWildfires.mockResolvedValueOnce(snapshot("TX", { items: [], available: 0, returned: 0, omitted: 0 }));
  await act(() => state.refresh());
  await waitFor(() => expect(state.available).toBe(0));
  expect(state.items).toEqual([]);
  expect(state.source).toBe("live");
  expect(state.fetchedAt).toBe(new Date(Date.now()).toISOString());
});

test("a callback captured before disabling the layer cannot make a hidden request", async () => {
  const view = await mount({ enabled: true, automatic: false });
  const oldRefresh = state.refresh;
  await view.update({ enabled: false, automatic: false });
  await act(() => oldRefresh());
  expect(fetchWildfires).not.toHaveBeenCalled();
});

test("a true Map remount retains its copy and minimum request interval in the same QueryClient", async () => {
  await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  const fetchedAt = state.fetchedAt;
  await cleanup();
  await render(<QueryClientProvider client={client}><Probe enabled automatic={false} /></QueryClientProvider>);
  expect(state.fetchedAt).toBe(fetchedAt);
  expect(state.items).toEqual([fire]);
  expect(state.canRefresh).toBe(false);
  await act(() => state.refresh());
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  await advance(NOW + INTERVAL - Date.now());
  expect(state.canRefresh).toBe(true);
  await act(() => state.refresh());
  expect(fetchWildfires).toHaveBeenCalledTimes(2);
});

test.each(["failure", "partial"] as const)("provider Retry-After from a %s survives remount and gates a new scope's automatic request", async (kind) => {
  if (kind === "failure") fetchWildfires.mockRejectedValueOnce(new ClearPathDataError("http", "Provider paused", { status: 429, retryAfterMs: 600_000 }));
  else fetchWildfires.mockResolvedValueOnce(snapshot("TX", { truncated: true, reason: "Later page paused", retryAfterMs: 600_000 }));
  await mount({ enabled: true, automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.canRefresh).toBe(false));
  await cleanup();
  await render(<QueryClientProvider client={client}><Probe coverage="US" enabled /></QueryClientProvider>);
  expect(state.items).toEqual([]);
  expect(state.canRefresh).toBe(false);
  await advance(NOW + 600_000 - Date.now() - 1);
  expect(fetchWildfires).toHaveBeenCalledTimes(1);
  await advance(1);
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchWildfires).toHaveBeenCalledTimes(2);
  expect(fetchWildfires.mock.calls[1][0]).toBe("US");
});
