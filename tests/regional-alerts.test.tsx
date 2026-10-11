import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState, Text, type AppStateStatus } from "react-native";
import {
  useRegionalAlerts,
  type RegionalAlertsState,
} from "../src/hooks/useRegionalAlerts";
import { getRegionalAlerts, type WeatherCoverage } from "../src/data/nws";
import { ClearPathDataError } from "../src/data/http";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockNetwork,
}));
jest.mock("../src/data/nws", () => ({
  ...jest.requireActual("../src/data/nws"),
  getRegionalAlerts: jest.fn(),
}));

const fetchAlerts = jest.mocked(getRegionalAlerts);
type Options = { enabled: boolean; coverage: WeatherCoverage; automatic?: boolean };
let state: RegionalAlertsState;
let client: QueryClient;
let notifyAppState: (state: AppStateStatus) => void;

function Probe(options: Options) {
  const observed = useRegionalAlerts(options);
  useEffect(() => {
    state = observed;
  }, [observed]);
  return <Text>{observed.source}</Text>;
}

async function mount(options: Options = { enabled: true, coverage: "TX" }) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <Probe {...options} />
    </QueryClientProvider>,
  );
  return {
    unmount: screen.unmount,
    update: async (next: Options) =>
      screen.rerender(
        <QueryClientProvider client={client}>
          <Probe {...next} />
        </QueryClientProvider>,
      ),
  };
}

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  jest.clearAllMocks();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
  fetchAlerts.mockResolvedValue([]);
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    value: "active",
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    notifyAppState = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const polygon = officialAlert({
  geometry: {
    type: "Polygon",
    coordinates: [[[-99.1, 30.1], [-98.9, 30.1], [-99, 29.9], [-99.1, 30.1]]],
  },
});

test("manual regional updates do not fetch on mount, coverage change, foreground resume, or reconnect", async () => {
  const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
  expect(state.canRefresh).toBe(true);
  expect(state.isLoading).toBe(false);
  await advance(120_000);
  await act(() => notifyAppState("background"));
  await act(() => notifyAppState("active"));
  mockNetwork.isConnected = false;
  await screen.update({ enabled: true, coverage: "TX", automatic: false });
  expect(state.canRefresh).toBe(false);
  mockNetwork.isConnected = true;
  await screen.update({ enabled: true, coverage: "US", automatic: false });
  expect(fetchAlerts).not.toHaveBeenCalled();
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchAlerts.mock.calls[0][0]).toBe("US");
  const fetchedAt = state.fetchedAt;
  await advance(30_000);
  await advance(60_000);
  expect(state.source).toBe("cached");
  expect(state.fetchedAt).toBe(fetchedAt);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("manual regional refresh keeps cooldowns, filters exact expiry, and never retries a failure", async () => {
  fetchAlerts.mockResolvedValueOnce([officialAlert({ expires: new Date(TEST_NOW + 10_000).toISOString() })]);
  await mount({ enabled: true, coverage: "TX", automatic: false });
  await act(() => state.refresh());
  await waitFor(() => expect(state.alerts).toHaveLength(1));
  await act(() => state.refresh());
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await advance(TEST_NOW + 10_000 - Date.now());
  expect(state.alerts).toEqual([]);
  await advance(20_000);
  fetchAlerts.mockRejectedValueOnce(new ClearPathDataError("network", "unavailable"));
  await act(() => state.refresh());
  await advance(120_000);
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
  expect(state.source).toBe("cached");
});

test("disabling automatic regional updates aborts its pending request but allows a later explicit refresh", async () => {
  let signal: AbortSignal | undefined;
  let finish!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts.mockImplementationOnce((_coverage, received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  const screen = await mount();
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  await screen.update({ enabled: true, coverage: "TX", automatic: false });
  expect(signal?.aborted).toBe(true);
  await act(() => finish([polygon]));
  await advance(60_000);
  expect(state.alerts).toEqual([]);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await act(() => state.refresh());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
});

test("a manual coverage switch cannot reuse a prior region snapshot", async () => {
  const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
  fetchAlerts.mockResolvedValueOnce([polygon]);
  await act(() => state.refresh());
  await waitFor(() => expect(state.alerts).toHaveLength(1));
  await screen.update({ enabled: true, coverage: "US", automatic: false });
  expect(state.source).toBe("unavailable");
  expect(state.alerts).toEqual([]);
  await advance(60_000);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("manual regional requests are cancelled when connectivity is lost", async () => {
  let signal: AbortSignal | undefined;
  let finish!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts.mockImplementationOnce((_coverage, received) => { signal = received; return new Promise((resolve) => { finish = resolve; }); });
  const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
  await act(() => { void state.refresh(); });
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  mockNetwork.isConnected = false;
  await screen.update({ enabled: true, coverage: "TX", automatic: false });
  expect(signal?.aborted).toBe(true);
  await act(() => finish([polygon]));
  mockNetwork.isConnected = true;
  await screen.update({ enabled: true, coverage: "TX", automatic: false });
  await advance(60_000);
  expect(state.alerts).toEqual([]);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("a disabled or offline layer makes no request; enabling keeps advisories and counts unmapped text", async () => {
  const advisory = officialAlert({
    id: "urn:test:advisory",
    event: "Heat Advisory",
    severity: "Moderate",
    geometry: null,
  });
  fetchAlerts.mockResolvedValue([polygon, advisory]);
  const screen = await mount({ enabled: false, coverage: "TX" });
  expect(state.source).toBe("unavailable");
  expect(state.isLoading).toBe(false);
  expect(fetchAlerts).not.toHaveBeenCalled();
  mockNetwork.isConnected = false;
  await screen.update({ enabled: true, coverage: "TX" });
  expect(fetchAlerts).not.toHaveBeenCalled();
  mockNetwork.isConnected = true;
  await screen.update({ enabled: true, coverage: "TX" });
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  expect(fetchAlerts.mock.calls[0][0]).toBe("TX");
  expect(state.alerts).toEqual([polygon, advisory]);
  expect(state.unmappedCount).toBe(1);
  expect(state.fetchedAt).toBe(new Date(TEST_NOW).toISOString());
});

test("60-second polling replaces official geometry and a verified empty response removes old overlays", async () => {
  const updated = officialAlert({
    ...polygon,
    id: "urn:test:updated",
    messageType: "Update",
    references: [polygon.id],
    geometry: {
      type: "Polygon",
      coordinates: [[[-99.2, 30.2], [-98.8, 30.2], [-99, 29.8], [-99.2, 30.2]]],
    },
  });
  fetchAlerts
    .mockResolvedValueOnce([polygon])
    .mockResolvedValueOnce([updated])
    .mockResolvedValueOnce([]);
  await mount();
  await waitFor(() => expect(state.alerts).toEqual([polygon]));
  const originalTime = state.fetchedAt;
  await advance(60_000);
  await waitFor(() => expect(state.alerts).toEqual([updated]));
  expect(state.source).toBe("live");
  expect(state.fetchedAt).not.toBe(originalTime);
  await advance(60_000);
  await waitFor(() => expect(state.alerts).toEqual([]));
  expect(state.source).toBe("live");
  expect(state.unmappedCount).toBe(0);
  expect(fetchAlerts).toHaveBeenCalledTimes(3);
});

test("failed verification retains cached geometry and its original retrieval time until a successful empty check", async () => {
  fetchAlerts
    .mockResolvedValueOnce([polygon])
    .mockRejectedValueOnce(new ClearPathDataError("invalid-response", "Cannot verify updates"))
    .mockResolvedValueOnce([]);
  const screen = await mount();
  await waitFor(() => expect(state.source).toBe("live"));
  const originalTime = state.fetchedAt;
  await advance(60_000);
  await waitFor(() => expect(state.error).toBeTruthy());
  expect(state.source).toBe("cached");
  expect(state.alerts).toEqual([polygon]);
  expect(state.fetchedAt).toBe(originalTime);
  mockNetwork.isConnected = false;
  await screen.update({ enabled: true, coverage: "TX" });
  await advance(30_000);
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
  mockNetwork.isConnected = true;
  await screen.update({ enabled: true, coverage: "TX" });
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.alerts).toEqual([]);
  expect(state.error).toBeNull();
  expect(state.fetchedAt).not.toBe(originalTime);
});

test("a polling request still pending at 90 seconds cannot keep the prior snapshot labeled live", async () => {
  let resolveUpdate!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts
    .mockResolvedValueOnce([polygon])
    .mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
  await mount();
  await waitFor(() => expect(state.source).toBe("live"));
  const fetchedAt = state.fetchedAt;
  await advance(TEST_NOW + 60_000 - Date.now());
  expect(state.isRefreshing).toBe(true);
  expect(state.source).toBe("live");
  await advance(30_000);
  expect(state.source).toBe("cached");
  expect(state.error).toBeNull();
  expect(state.alerts).toEqual([polygon]);
  expect(state.fetchedAt).toBe(fetchedAt);
  await act(() => resolveUpdate([]));
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.alerts).toEqual([]);
  expect(state.fetchedAt).not.toBe(fetchedAt);
});

test("manual refresh and a short foreground resume share the same 30-second gate", async () => {
  const starts: number[] = [];
  fetchAlerts.mockImplementation(async () => {
    starts.push(Date.now());
    return [];
  });
  await mount();
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.canRefresh).toBe(false);
  await act(() => state.refresh());
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await advance(5_000);
  await act(() => notifyAppState("background"));
  expect(state.source).toBe("cached");
  await advance(5_000);
  await act(() => notifyAppState("active"));
  await advance(starts[0] + 30_000 - Date.now() - 1);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await advance(1);
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(2));
  expect(starts[1] - starts[0]).toBe(30_000);
  expect(state.source).toBe("live");
});

test("coverage changes abort obsolete work, keep point-query data separate, and reject late results", async () => {
  let oldSignal: AbortSignal | undefined;
  let resolveOld!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  let firstStart = 0;
  fetchAlerts
    .mockImplementationOnce((_coverage, signal) => {
      firstStart = Date.now();
      oldSignal = signal;
      return new Promise((resolve) => { resolveOld = resolve; });
    })
    .mockResolvedValueOnce([]);
  const screen = await mount();
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  client.setQueryData(["nws-alerts", "30,-99"], {
    source: "live",
    locationKey: "30,-99",
    alerts: [polygon],
    fetchedAt: new Date(TEST_NOW).toISOString(),
  });
  await screen.update({ enabled: true, coverage: "US" });
  expect(oldSignal?.aborted).toBe(true);
  expect(state.source).toBe("unavailable");
  expect(state.alerts).toEqual([]);
  expect(state.fetchedAt).toBeNull();
  await act(() => resolveOld([polygon]));
  expect(state.alerts).toEqual([]);
  await advance(firstStart + 30_000 - Date.now());
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchAlerts.mock.calls.map(([coverage]) => coverage)).toEqual(["TX", "US"]);
  expect(state.alerts).toEqual([]);
  expect(client.getQueryData(["nws-regional-alerts", "TX"])).toBeUndefined();
});

test("turning a layer off aborts its pending request and stops polling without accepting the late result", async () => {
  let signal: AbortSignal | undefined;
  let resolveRequest!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts.mockImplementation((_coverage, requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => { resolveRequest = resolve; });
  });
  const screen = await mount();
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  await screen.update({ enabled: false, coverage: "TX" });
  expect(signal?.aborted).toBe(true);
  await act(() => resolveRequest([polygon]));
  await advance(120_000);
  expect(state.source).toBe("unavailable");
  expect(state.alerts).toEqual([]);
  expect(state.isRefreshing).toBe(false);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("provider Retry-After survives cancellation and a coverage change", async () => {
  const starts: number[] = [];
  fetchAlerts.mockImplementation(async () => {
    starts.push(Date.now());
    if (starts.length === 1)
      throw new ClearPathDataError("http", "Rate limited", {
        status: 429,
        retryAfterMs: 120_000,
      });
    return [];
  });
  const screen = await mount();
  await waitFor(() => expect(state.error).toBeTruthy());
  await screen.update({ enabled: false, coverage: "TX" });
  await advance(60_000);
  await screen.update({ enabled: true, coverage: "US" });
  await advance(starts[0] + 120_000 - Date.now() - 1);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  expect(state.canRefresh).toBe(false);
  await advance(1);
  await waitFor(() => expect(state.source).toBe("live"));
  expect(starts[1] - starts[0]).toBe(120_000);
  expect(fetchAlerts.mock.calls[1][0]).toBe("US");
});

test("expiration removes cached overlays and unmapped records while the layer is disabled", async () => {
  const shortLived = officialAlert({
    ...polygon,
    expires: new Date(TEST_NOW + 10_000).toISOString(),
  });
  const textOnly = officialAlert({
    id: "urn:test:text",
    expires: new Date(TEST_NOW + 20_000).toISOString(),
  });
  fetchAlerts.mockResolvedValue([shortLived, textOnly]);
  const screen = await mount();
  await waitFor(() => expect(state.alerts).toHaveLength(2));
  const fetchedAt = state.fetchedAt;
  await screen.update({ enabled: false, coverage: "TX" });
  expect(state.source).toBe("cached");
  await advance(TEST_NOW + 10_000 - Date.now());
  expect(state.alerts).toEqual([textOnly]);
  expect(state.unmappedCount).toBe(1);
  await advance(10_000);
  expect(state.alerts).toEqual([]);
  expect(state.unmappedCount).toBe(0);
  expect(state.fetchedAt).toBe(fetchedAt);
  expect(state.source).toBe("cached");
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test.each(["disabled", "coverage", "offline", "background", "unmounted"] as const)(
  "a captured regional refresh cannot request after its context becomes %s", async (change) => {
    const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
    const held = state.refresh;
    if (change === "disabled") await screen.update({ enabled: false, coverage: "TX", automatic: false });
    if (change === "coverage") await screen.update({ enabled: true, coverage: "US", automatic: false });
    if (change === "offline") {
      mockNetwork.isConnected = false;
      await screen.update({ enabled: true, coverage: "TX", automatic: false });
    }
    if (change === "background") await act(() => notifyAppState("background"));
    if (change === "unmounted") await screen.unmount();
    await act(() => held());
    expect(fetchAlerts).not.toHaveBeenCalled();
  },
);

test("an obsolete regional callback stays blocked after returning to its original coverage", async () => {
  const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
  const held = state.refresh;
  await screen.update({ enabled: true, coverage: "US", automatic: false });
  await screen.update({ enabled: true, coverage: "TX", automatic: false });
  await act(() => held());
  expect(fetchAlerts).not.toHaveBeenCalled();
  await act(() => state.refresh());
  expect(fetchAlerts.mock.calls.map(([coverage]) => coverage)).toEqual(["TX"]);
});

test.each([30_000, 120_000])("regional's %i ms deadline survives remount and coverage switching", async (delay) => {
  if (delay > 30_000) fetchAlerts.mockRejectedValueOnce(new ClearPathDataError("http", "limited", { status: 429, retryAfterMs: delay }));
  const screen = await mount({ enabled: true, coverage: "TX", automatic: false });
  const started = Date.now();
  await act(() => state.refresh());
  await screen.unmount();
  await render(<QueryClientProvider client={client}><Probe enabled coverage="US" automatic={false} /></QueryClientProvider>);
  expect(state.source).toBe("unavailable");
  expect(state.canRefresh).toBe(false);
  await act(() => state.refresh());
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await advance(started + delay - Date.now() - 1);
  expect(state.canRefresh).toBe(false);
  await advance(1);
  await act(() => state.refresh());
  expect(fetchAlerts.mock.calls.map(([coverage]) => coverage)).toEqual(["TX", "US"]);
});

test("two immediate regional manual presses share the pending request", async () => {
  let finish!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await mount({ enabled: true, coverage: "TX", automatic: false });
  const refresh = state.refresh;
  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(async () => { first = refresh(); second = refresh(); await Promise.resolve(); });
  expect(first).toBe(second);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await act(async () => { finish([]); await Promise.all([first, second]); });
  expect(state.canRefresh).toBe(false);
});

test("disabling regional coverage cancels a scheduled slot before any download starts", async () => {
  const screen = await mount();
  await waitFor(() => expect(state.source).toBe("live"));
  await screen.update({ enabled: true, coverage: "US" });
  expect(state.isRefreshing).toBe(true);
  await screen.update({ enabled: false, coverage: "US" });
  await advance(30_000);
  expect(fetchAlerts.mock.calls.map(([coverage]) => coverage)).toEqual(["TX"]);
  expect(state.source).toBe("unavailable");
});
