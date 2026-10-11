import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState as NativeAppState } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readAlertCache, writeAlertCache } from "@/data/alertCache";
import { DEMO_LOCATION, DEMO_TIMESTAMP, getDemoSnapshot } from "@/data/demo";
import { ClearPathDataError } from "@/data/http";
import { getActiveAlerts } from "@/data/nws";
import { currentAlerts, locationKey } from "@/domain/alerts";
import type {
  AlertSnapshot,
  OfficialAlert,
  SelectedLocation,
} from "@/domain/types";
import { useAppState } from "./AppState";
import { useFeedPreferences } from "./FeedPreferences";
import { checkRequestContext, claimFeedSlot, pauseFeedProvider, useFeedDeadline, useManualFeedRefresh, useRequestContext } from "./feedRequestGate";
export { waitForRequestSlot } from "./feedRequestGate";

const MIN_REQUEST_INTERVAL = 30_000;
const MAX_VERIFIED_AGE = 90_000;

export type AlertsState = {
  source: AlertSnapshot["source"] | "unavailable";
  alerts: OfficialAlert[];
  snapshot: AlertSnapshot | null;
  selectedLocation: SelectedLocation | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  offline: boolean;
  expiredCount: number;
  refresh: () => Promise<void>;
  canRefresh: boolean;
  storageError: string | null;
};

const Context = createContext<AlertsState | null>(null);

export function shouldRetryAlerts(attempt: number, error: Error): boolean {
  if (attempt >= 2) return false;
  if (!(error instanceof ClearPathDataError)) return false;
  return (
    error.kind === "network" ||
    error.kind === "timeout" ||
    (error.kind === "http" &&
      (error.status === 429 || (error.status ?? 0) >= 500))
  );
}

export function alertRetryDelay(attempt: number, error: Error): number {
  const providerDelay =
    error instanceof ClearPathDataError ? (error.retryAfterMs ?? 0) : 0;
  return Math.max(MIN_REQUEST_INTERVAL * 2 ** attempt, providerDelay);
}

/** One observer, connectivity subscription, and display clock are shared by every tab. */
export function AlertsProvider({ children }: PropsWithChildren) {
  const { mode, scenario, location } = useAppState();
  const { automatic, ready } = useFeedPreferences();
  const client = useQueryClient();
  const network = useNetInfo();
  const offline =
    network.isConnected === false || network.isInternetReachable === false;
  const [foreground, setForeground] = useState(
    NativeAppState.currentState === "active",
  );
  const [now, setNow] = useState(Date.now);
  const [cached, setCached] = useState<AlertSnapshot | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const persisted = useRef<string | null>(null);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const pointKey = location ? locationKey(location) : null;
  const requestAllowed =
    ready && mode === "live" && pointKey !== null && !offline && foreground;
  const enabled = requestAllowed && automatic;
  const gateKey = `point:${pointKey}`;
  const nextAllowed = useFeedDeadline(client, "nws", gateKey);
  const isCurrent = useRequestContext(requestAllowed, gateKey, automatic);
  const availability = useRef({ enabled, pointKey });
  const selectedLocation = mode === "demo" ? DEMO_LOCATION : location;
  const demo = useMemo(
    () => (mode === "demo" ? getDemoSnapshot(scenario) : null),
    [mode, scenario],
  );

  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const query = useQuery<AlertSnapshot, Error>({
    queryKey: ["nws-alerts", pointKey],
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    networkMode: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: automatic ? shouldRetryAlerts : false,
    retryDelay: alertRetryDelay,
    queryFn: async ({ signal }) => {
      if (!location || !pointKey)
        throw new Error("Select a location to retrieve alerts.");
      await claimFeedSlot(client, "nws", gateKey, MIN_REQUEST_INTERVAL, signal, isCurrent);
      checkRequestContext(signal, isCurrent);
      setNow(Date.now());
      let alerts: OfficialAlert[];
      try {
        alerts = await getActiveAlerts(location, signal);
      } catch (error) {
        if (
          error instanceof ClearPathDataError &&
          !signal.aborted && isCurrent()
        ) {
          pauseFeedProvider(client, "nws", error.retryAfterMs);
        }
        throw error;
      }
      checkRequestContext(signal, isCurrent);
      return {
        source: "live",
        alerts,
        fetchedAt: new Date().toISOString(),
        locationKey: pointKey,
      };
    },
  });

  // Disabling a query does not cancel it. Cancel obsolete point/mode work explicitly.
  useEffect(() => {
    if (mode !== "live" || !pointKey) return;
    return () => {
      void client.cancelQueries({
        queryKey: ["nws-alerts", pointKey],
        exact: true,
      });
    };
  }, [client, mode, pointKey]);

  // Stop retrying or polling when the app is backgrounded or connectivity is lost.
  useEffect(() => {
    if (mode === "live" && pointKey && (!requestAllowed || !automatic)) {
      void client.cancelQueries({
        queryKey: ["nws-alerts", pointKey],
        exact: true,
      });
    }
  }, [automatic, client, mode, pointKey, requestAllowed]);

  // A short interruption can leave Query's cached response within staleTime.
  // Recheck when this point becomes available again; the query function still
  // enforces the request interval and provider backoff, and joins any active fetch.
  useEffect(() => {
    const previous = availability.current;
    availability.current = { enabled, pointKey };
    if (
      !enabled ||
      previous.enabled ||
      !pointKey ||
      previous.pointKey !== pointKey
    )
      return;
    void client.invalidateQueries(
      { queryKey: ["nws-alerts", pointKey], exact: true },
      { cancelRefetch: false },
    );
  }, [client, enabled, pointKey]);

  useEffect(() => {
    if (mode !== "live" || !location || !pointKey) return;
    let obsolete = false;
    void readAlertCache(location).then((snapshot) => {
      if (!obsolete) {
        setCached(snapshot);
        setStorageError(null);
      }
    });
    return () => {
      obsolete = true;
    };
    // The exact point identity avoids reads when GPS/manual labels alone change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pointKey]);

  const liveSnapshot = query.data?.locationKey === pointKey ? query.data : null;
  const savedSnapshot = cached?.locationKey === pointKey ? cached : null;
  const knownSnapshot = liveSnapshot ?? savedSnapshot;
  const verificationError = query.failureReason ?? query.error;
  const verified =
    knownSnapshot !== null &&
    knownSnapshot.source === "live" &&
    !offline &&
    !verificationError &&
    now - Date.parse(knownSnapshot.fetchedAt) < MAX_VERIFIED_AGE;
  const source =
    mode === "demo"
      ? "demo"
      : knownSnapshot
        ? verified
          ? "live"
          : "cached"
        : "unavailable";
  const snapshot = useMemo(
    () =>
      mode === "demo"
        ? demo
        : knownSnapshot
          ? {
              ...knownSnapshot,
              source: verified ? ("live" as const) : ("cached" as const),
            }
          : null,
    [demo, knownSnapshot, mode, verified],
  );
  const canRefresh = requestAllowed && !query.isFetching && now >= nextAllowed;

  useEffect(() => {
    if (mode !== "live" || !liveSnapshot) return;
    const identifier = `${liveSnapshot.locationKey}:${liveSnapshot.fetchedAt}`;
    if (persisted.current === identifier) return;
    persisted.current = identifier;
    let obsolete = false;
    // Serialize writes so a delayed old-point write cannot overwrite a newer point.
    const task = persistenceQueue.current
      .catch(() => {})
      .then(async () => {
        if (obsolete) return;
        await writeAlertCache(liveSnapshot);
        if (!obsolete) setStorageError(null);
      });
    persistenceQueue.current = task;
    void task.catch(() => {
      if (!obsolete)
        setStorageError(
          "Current alerts loaded, but this device could not save an offline copy.",
        );
    });
    return () => {
      obsolete = true;
      if (persisted.current === identifier) persisted.current = null;
    };
  }, [liveSnapshot, mode]);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [demo, foreground, knownSnapshot, offline]);

  // Schedule the next meaningful boundary, including expiration while a screen stays open.
  useEffect(() => {
    // Presentation snapshots use their fixed historical clock, never the
    // current phone clock or real-time expiration timers.
    if (mode !== "live") return;
    const clock = Date.now();
    const boundaries = [
      ...(snapshot?.alerts.map((alert) => Date.parse(alert.expires)) ?? []),
      ...(mode === "live" && knownSnapshot
        ? [Date.parse(knownSnapshot.fetchedAt) + MAX_VERIFIED_AGE]
        : []),
      nextAllowed,
    ].filter(Number.isFinite);
    // Native timers may resume late after background suspension. Advance the
    // display clock before skipping boundaries that passed during suspension.
    if (boundaries.some((deadline) => deadline > now && deadline <= clock)) {
      const timer = setTimeout(() => setNow(Date.now()), 0);
      return () => clearTimeout(timer);
    }
    const deadlines = boundaries.filter((deadline) => deadline > clock);
    if (deadlines.length === 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(1, Math.min(...deadlines) - clock),
    );
    return () => clearTimeout(timer);
  }, [knownSnapshot, mode, nextAllowed, now, snapshot]);

  const refresh = useManualFeedRefresh(client, "nws", gateKey, ["nws-alerts", pointKey], isCurrent, query.refetch);
  const displayNow = mode === "demo" ? DEMO_TIMESTAMP : now;
  const alerts = snapshot ? currentAlerts(snapshot.alerts, displayNow) : [];
  const value: AlertsState = {
    source,
    alerts,
    snapshot,
    selectedLocation,
    isLoading: mode === "live" && requestAllowed && query.isPending && query.isFetching,
    isRefreshing: mode === "live" && query.isFetching,
    error: mode === "live" ? verificationError : null,
    offline: mode === "demo" ? scenario === "offline" : offline,
    expiredCount: snapshot
      ? snapshot.alerts.filter((alert) => Date.parse(alert.expires) <= displayNow)
          .length
      : 0,
    refresh,
    canRefresh,
    storageError,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAlertsContext(): AlertsState {
  const value = useContext(Context);
  if (!value) throw new Error("AlertsProvider is required");
  return value;
}
