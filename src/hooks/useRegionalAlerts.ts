import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClearPathDataError } from "@/data/http";
import { getRegionalAlerts, type WeatherCoverage } from "@/data/nws";
import { currentAlerts, MAX_ISSUANCE_SKEW_MS } from "@/domain/alerts";
import type { OfficialAlert } from "@/domain/types";
import {
  alertRetryDelay,
  shouldRetryAlerts,
} from "@/state/AlertsProvider";
import { checkRequestContext, claimFeedSlot, pauseFeedProvider, useFeedDeadline, useManualFeedRefresh, useRequestContext } from "@/state/feedRequestGate";

const REQUEST_INTERVAL = 30_000;
const VERIFIED_AGE = 90_000;
type RegionalSnapshot = {
  coverage: WeatherCoverage;
  alerts: OfficialAlert[];
  fetchedAt: string;
};
export type RegionalAlertsState = {
  alerts: OfficialAlert[];
  source: "live" | "cached" | "unavailable";
  fetchedAt: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  canRefresh: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  unmappedCount: number;
};

/** Memory-only regional layers never borrow the selected-point snapshot or its provenance. */
export function useRegionalAlerts({
  enabled: requested,
  coverage,
  automatic = true,
}: {
  enabled: boolean;
  coverage: WeatherCoverage;
  automatic?: boolean;
}): RegionalAlertsState {
  const client = useQueryClient();
  const network = useNetInfo();
  const offline =
    network.isConnected === false || network.isInternetReachable === false;
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(Date.now);
  const requestAllowed = requested && foreground && !offline;
  const enabled = requestAllowed && automatic;
  const availability = useRef({ enabled, coverage });
  // Regional TX/US requests retain their shared cadence across observer remounts.
  const nextAllowed = useFeedDeadline(client, "nws", "regional");
  const isCurrent = useRequestContext(requestAllowed, coverage, automatic);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const query = useQuery<RegionalSnapshot, Error>({
    queryKey: ["nws-regional-alerts", coverage],
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
      await claimFeedSlot(client, "nws", "regional", REQUEST_INTERVAL, signal, isCurrent);
      checkRequestContext(signal, isCurrent);
      const started = Date.now();
      setNow(started);
      let alerts: OfficialAlert[];
      try {
        alerts = await getRegionalAlerts(coverage, signal);
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
      return { coverage, alerts, fetchedAt: new Date().toISOString() };
    },
  });

  useEffect(
    () => () => {
      void client.cancelQueries({
        queryKey: ["nws-regional-alerts", coverage],
        exact: true,
      });
    },
    [client, coverage],
  );
  useEffect(() => {
    if (!requestAllowed || !automatic)
      void client.cancelQueries({
        queryKey: ["nws-regional-alerts", coverage],
        exact: true,
      });
  }, [automatic, client, coverage, requestAllowed]);
  useEffect(() => {
    const previous = availability.current;
    availability.current = { enabled, coverage };
    if (enabled && !previous.enabled && previous.coverage === coverage)
      void client.invalidateQueries(
        { queryKey: ["nws-regional-alerts", coverage], exact: true },
        { cancelRefetch: false },
      );
  }, [client, coverage, enabled]);

  const snapshot = query.data?.coverage === coverage ? query.data : null;
  const error = query.failureReason ?? query.error;
  // A rolled-back phone clock cannot establish current verification.
  const snapshotAge = snapshot ? now - Date.parse(snapshot.fetchedAt) : NaN;
  const verified =
    snapshot !== null &&
    requestAllowed &&
    !error &&
    snapshotAge >= 0 &&
    snapshotAge < VERIFIED_AGE;
  const source = snapshot ? (verified ? "live" : "cached") : "unavailable";

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [foreground, offline, snapshot]);
  useEffect(() => {
    const clock = Date.now();
    const boundaries = [
      ...(snapshot?.alerts.flatMap((alert) => [Date.parse(alert.expires), Date.parse(alert.sent) - MAX_ISSUANCE_SKEW_MS]) ?? []),
      ...(snapshot ? [Date.parse(snapshot.fetchedAt), Date.parse(snapshot.fetchedAt) + VERIFIED_AGE] : []),
      nextAllowed,
    ].filter(Number.isFinite);
    if (boundaries.some((deadline) => deadline > now && deadline <= clock)) {
      const timer = setTimeout(() => setNow(Date.now()), 0);
      return () => clearTimeout(timer);
    }
    const deadlines = boundaries.filter((deadline) => deadline > clock);
    if (!deadlines.length) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2_147_483_647, Math.max(1, Math.min(...deadlines) - clock)),
    );
    return () => clearTimeout(timer);
  }, [nextAllowed, now, snapshot]);

  const canRefresh = requestAllowed && !query.isFetching && now >= nextAllowed;
  const refresh = useManualFeedRefresh(client, "nws", "regional", ["nws-regional-alerts", coverage], isCurrent, query.refetch);
  const alerts = snapshot ? currentAlerts(snapshot.alerts, now) : [];
  return {
    alerts,
    source,
    fetchedAt: snapshot?.fetchedAt ?? null,
    isLoading: requestAllowed && query.isPending && query.isFetching,
    isRefreshing: query.isFetching,
    canRefresh,
    error,
    refresh,
    unmappedCount: alerts.filter((alert) => alert.geometry === null).length,
  };
}
