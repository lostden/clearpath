import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AppState as NativeAppState,
  Text,
  type AppStateStatus,
} from "react-native";
import {
  AlertsProvider,
  alertRetryDelay,
  shouldRetryAlerts,
  useAlertsContext,
  type AlertsState,
} from "../src/state/AlertsProvider";
import { AppProvider, useAppState } from "../src/state/AppState";
import { getActiveAlerts } from "../src/data/nws";
import { readAlertCache, writeAlertCache } from "../src/data/alertCache";
import { ClearPathDataError } from "../src/data/http";
import { officialAlert, TEST_NOW } from "./fixtures/alerts";
import type { SelectedLocation } from "../src/domain/types";

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockNetwork,
}));
jest.mock("../src/data/nws", () => ({ getActiveAlerts: jest.fn() }));
jest.mock("../src/data/alertCache", () => ({
  readAlertCache: jest.fn(),
  writeAlertCache: jest.fn(),
}));

const fetchAlerts = jest.mocked(getActiveAlerts);
const readCache = jest.mocked(readAlertCache);
const writeCache = jest.mocked(writeAlertCache);
const point: SelectedLocation = {
  label: "Kerrville",
  kind: "manual",
  coordinates: { latitude: 30, longitude: -99 },
};
let state: AlertsState;
let settings: ReturnType<typeof useAppState>;
let client: QueryClient;
let notifyAppState: (state: AppStateStatus) => void;

function Probe({ duplicate = false }: { duplicate?: boolean }) {
  const observed = useAlertsContext();
  const appSettings = useAppState();
  useEffect(() => {
    state = observed;
    settings = appSettings;
  }, [appSettings, observed]);
  return <Text>{duplicate ? "second" : observed.source}</Text>;
}

async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <AppProvider>
        <AlertsProvider>
          <Probe />
          <Probe duplicate />
        </AlertsProvider>
      </AppProvider>
    </QueryClientProvider>,
  );
  // Scenario tests choose demo explicitly; the product's fresh-launch default
  // is independent of this provider test fixture.
  await act(() => settings.setMode("demo"));
}

async function selectLive(location = point) {
  await act(() => {
    settings.setLocation(location);
    settings.setMode("live");
  });
}

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(async () => {
  // The provider deliberately schedules zero-delay clock updates. Control all
  // timers so those updates run inside RNTL waitFor/act, never between assertions.
  jest.useFakeTimers({ now: TEST_NOW });
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
  readCache.mockResolvedValue(null);
  writeCache.mockResolvedValue();
  fetchAlerts.mockResolvedValue([]);
  Object.defineProperty(NativeAppState, "currentState", {
    configurable: true,
    value: "active",
  });
  jest
    .spyOn(NativeAppState, "addEventListener")
    .mockImplementation((_event, listener) => {
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

test("demo mode never reads or writes the real cache and shares one feed across consumers", async () => {
  await mount();
  expect(state.source).toBe("demo");
  expect(fetchAlerts).not.toHaveBeenCalled();
  expect(readCache).not.toHaveBeenCalled();
  expect(writeCache).not.toHaveBeenCalled();
  await selectLive();
  await waitFor(() => expect(state.source).toBe("live"));
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("historical demo warnings and expired counts use the frozen presentation clock", async () => {
  await mount();
  await act(() => settings.setScenario("offline"));
  expect(state.source).toBe("demo");
  expect(state.alerts).toHaveLength(1);
  expect(state.expiredCount).toBe(1);
  expect(state.snapshot?.fetchedAt).toBe("2025-07-04T09:57:00.000Z");
  const displayed = state.alerts;
  await advance(24 * 60 * 60_000);
  expect(state.alerts).toEqual(displayed);
  expect(state.expiredCount).toBe(1);
  expect(fetchAlerts).not.toHaveBeenCalled();
  expect(readCache).not.toHaveBeenCalled();
  expect(writeCache).not.toHaveBeenCalled();
});

test("a successful empty live response remains distinct from a cached empty response", async () => {
  mockNetwork.isConnected = false;
  readCache.mockResolvedValue({
    source: "cached",
    alerts: [],
    locationKey: "30,-99",
    fetchedAt: new Date(TEST_NOW).toISOString(),
  });
  await mount();
  await selectLive();
  await waitFor(() => expect(state.source).toBe("cached"));
  expect(state.alerts).toEqual([]);
  expect(state.offline).toBe(true);
  expect(fetchAlerts).not.toHaveBeenCalled();
  mockNetwork.isConnected = true;
  await act(() =>
    settings.setLocation({ ...point, label: "Kerrville, Texas" }),
  );
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.alerts).toEqual([]);
  expect(state.offline).toBe(false);
});

test("failed verification preserves a cached warning and a storage failure preserves loaded live data", async () => {
  const alert = officialAlert({
    expires: new Date(Date.now() + 60_000).toISOString(),
    sent: new Date(Date.now() - 60_000).toISOString(),
  });
  readCache.mockResolvedValue({
    source: "cached",
    alerts: [alert],
    locationKey: "30,-99",
    fetchedAt: new Date().toISOString(),
  });
  fetchAlerts.mockRejectedValue(
    new ClearPathDataError("invalid-response", "Cannot verify alerts"),
  );
  await mount();
  await selectLive();
  await waitFor(() => expect(state.error).toBeTruthy());
  expect(state.source).toBe("cached");
  expect(state.alerts).toEqual([alert]);
  expect(state.snapshot?.source).toBe("cached");
});

test("storage errors do not discard a successfully verified empty response", async () => {
  writeCache.mockRejectedValue(new Error("disk full"));
  await mount();
  await selectLive();
  await waitFor(() => expect(state.storageError).toMatch(/could not save/));
  expect(state.source).toBe("live");
  expect(state.alerts).toEqual([]);
});

test("location changes abort the old request and never display or persist its results at the new point", async () => {
  let oldSignal: AbortSignal | undefined;
  let resolveOld!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts
    .mockImplementationOnce((_location, signal) => {
      oldSignal = signal;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    })
    .mockResolvedValueOnce([]);
  await mount();
  await selectLive();
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  const next: SelectedLocation = {
    ...point,
    label: "Other city",
    coordinates: { latitude: 31, longitude: -99 },
  };
  await act(() => settings.setLocation(next));
  await waitFor(() => expect(state.source).toBe("live"));
  expect(oldSignal?.aborted).toBe(true);
  expect(state.snapshot?.locationKey).toBe("31,-99");
  await act(() => resolveOld([officialAlert()]));
  expect(state.alerts).toEqual([]);
  expect(
    writeCache.mock.calls.every(
      ([snapshot]) => snapshot.locationKey === "31,-99",
    ),
  ).toBe(true);
});

test("expired warnings disappear exactly at their boundary and offline data retains cached provenance", async () => {
  jest.useFakeTimers({ now: TEST_NOW });
  fetchAlerts.mockResolvedValue([
    officialAlert({ expires: new Date(TEST_NOW + 10_000).toISOString() }),
  ]);
  await mount();
  await selectLive();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(state.source).toBe("live");
  expect(state.alerts).toHaveLength(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(9_999);
  });
  expect(state.alerts).toHaveLength(0);
  expect(state.expiredCount).toBe(1);
  // Disconnection immediately changes provenance even before the age deadline.
  mockNetwork.isConnected = false;
  await act(() => settings.setLocation({ ...point, label: "Same point" }));
  expect(state.source).toBe("cached");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(90_000);
  });
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
});

test("backgrounding suspends requests and data ages into cached provenance after 90 seconds", async () => {
  jest.useFakeTimers({ now: TEST_NOW });
  await mount();
  await selectLive();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(state.source).toBe("live");
  await act(() => notifyAppState("background"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(90_000);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(state.offline).toBe(false);
  expect(state.source).toBe("cached");
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await act(() => notifyAppState("active"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
  expect(state.source).toBe("live");
});

test("switching to demo cancels pending live work and does not persist its late response", async () => {
  let oldSignal: AbortSignal | undefined;
  let resolveOld!: (alerts: ReturnType<typeof officialAlert>[]) => void;
  fetchAlerts.mockImplementation((_location, signal) => {
    oldSignal = signal;
    return new Promise((resolve) => {
      resolveOld = resolve;
    });
  });
  await mount();
  await selectLive();
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));
  await act(() => settings.setMode("demo"));
  expect(oldSignal?.aborted).toBe(true);
  await act(() => resolveOld([officialAlert()]));
  expect(state.source).toBe("demo");
  expect(state.snapshot?.source).toBe("demo");
  expect(writeCache).not.toHaveBeenCalled();
});

test("manual refresh uses the shared 30-second request gate", async () => {
  jest.useFakeTimers({ now: TEST_NOW });
  await mount();
  await selectLive();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(state.canRefresh).toBe(false);
  await act(() => state.refresh());
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(29_999);
  });
  expect(state.canRefresh).toBe(true);
  await act(() => state.refresh());
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
});

test("foreground polling replaces supplied warning geometry and removes overlays after a verified empty response", async () => {
  const first = officialAlert({
    geometry: {
      type: "Polygon",
      coordinates: [[[-99.1, 30.1], [-98.9, 30.1], [-99, 29.9], [-99.1, 30.1]]],
    },
  });
  const updated = officialAlert({
    id: "urn:test:updated",
    sourceUrl: "https://api.weather.gov/alerts/urn:test:updated",
    messageType: "Update",
    references: [first.id],
    sent: new Date(TEST_NOW + 60_000).toISOString(),
    geometry: {
      type: "Polygon",
      coordinates: [[[-99.2, 30.2], [-98.8, 30.2], [-99, 29.8], [-99.2, 30.2]]],
    },
  });
  fetchAlerts
    .mockResolvedValueOnce([first])
    .mockResolvedValueOnce([updated])
    .mockResolvedValueOnce([]);
  await mount();
  await selectLive();
  await waitFor(() => expect(state.alerts).toEqual([first]));
  const firstRetrievedAt = state.snapshot!.fetchedAt;

  await advance(60_000);
  await waitFor(() => expect(state.alerts).toEqual([updated]));
  expect(fetchAlerts).toHaveBeenCalledTimes(2);
  expect(state.source).toBe("live");
  expect(state.snapshot?.fetchedAt).not.toBe(firstRetrievedAt);
  expect(state.alerts[0].geometry).toEqual(updated.geometry);

  await advance(60_000);
  await waitFor(() => expect(state.alerts).toEqual([]));
  expect(fetchAlerts).toHaveBeenCalledTimes(3);
  expect(state.source).toBe("live");
  expect(state.snapshot?.locationKey).toBe("30,-99");
});

test("a short background pause rechecks the same point without waiting for a new polling interval", async () => {
  await mount();
  await selectLive();
  await waitFor(() => expect(state.source).toBe("live"));
  await advance(10_000);
  await act(() => notifyAppState("background"));
  await advance(25_000);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);

  await act(() => notifyAppState("active"));
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(2));
  expect(Date.now() - TEST_NOW).toBeLessThan(60_000);
  expect(state.snapshot?.locationKey).toBe("30,-99");
});

test("a quick reconnection rechecks through the shared request gate rather than duplicating early requests", async () => {
  const starts: number[] = [];
  fetchAlerts.mockImplementation(async () => {
    starts.push(Date.now());
    return [];
  });
  await mount();
  await selectLive();
  await waitFor(() => expect(state.source).toBe("live"));
  await advance(5_000);
  mockNetwork.isConnected = false;
  await act(() => settings.setLocation({ ...point, label: "Disconnected" }));
  expect(state.source).toBe("cached");
  const savedRetrieval = state.snapshot?.fetchedAt;
  await advance(5_000);
  mockNetwork.isConnected = true;
  await act(() => settings.setLocation({ ...point, label: "Reconnected" }));

  await advance(starts[0] + 30_000 - Date.now() - 1);
  expect(fetchAlerts).toHaveBeenCalledTimes(1);
  expect(state.snapshot?.fetchedAt).toBe(savedRetrieval);
  await advance(1);
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(2));
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(30_000);
  expect(starts[1] - starts[0]).toBeLessThan(60_000);
  expect(state.source).toBe("live");
});

test("a failed automatic verification retains supplied geometry as cached until a successful check clears it", async () => {
  const warning = officialAlert({
    geometry: {
      type: "Polygon",
      coordinates: [[[-99.1, 30.1], [-98.9, 30.1], [-99, 29.9], [-99.1, 30.1]]],
    },
  });
  fetchAlerts
    .mockResolvedValueOnce([warning])
    .mockRejectedValueOnce(new ClearPathDataError("invalid-response", "Cannot verify updates"))
    .mockResolvedValueOnce([]);
  await mount();
  await selectLive();
  await waitFor(() => expect(state.alerts).toEqual([warning]));
  const savedRetrieval = state.snapshot?.fetchedAt;

  await advance(60_000);
  await waitFor(() => expect(state.error).toBeTruthy());
  expect(state.source).toBe("cached");
  expect(state.snapshot?.source).toBe("cached");
  expect(state.snapshot?.fetchedAt).toBe(savedRetrieval);
  expect(state.alerts[0].geometry).toEqual(warning.geometry);

  await advance(60_000);
  await waitFor(() => expect(state.source).toBe("live"));
  expect(state.error).toBeNull();
  expect(state.alerts).toEqual([]);
  expect(state.snapshot?.fetchedAt).not.toBe(savedRetrieval);
});

test("retry policy excludes invalid/ordinary 4xx data and respects provider backoff", () => {
  expect(
    shouldRetryAlerts(0, new ClearPathDataError("invalid-response", "invalid")),
  ).toBe(false);
  expect(
    shouldRetryAlerts(
      0,
      new ClearPathDataError("http", "bad request", { status: 400 }),
    ),
  ).toBe(false);
  expect(
    shouldRetryAlerts(
      0,
      new ClearPathDataError("http", "limited", { status: 429 }),
    ),
  ).toBe(true);
  expect(
    shouldRetryAlerts(2, new ClearPathDataError("network", "offline")),
  ).toBe(false);
  expect(alertRetryDelay(0, new ClearPathDataError("network", "offline"))).toBe(
    30_000,
  );
  expect(
    alertRetryDelay(
      1,
      new ClearPathDataError("http", "limited", {
        status: 429,
        retryAfterMs: 120_000,
      }),
    ),
  ).toBe(120_000);
});
