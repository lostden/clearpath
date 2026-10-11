import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Coordinates } from "../domain/types";
import { ClearPathDataError } from "../data/http";
import { EARTHQUAKE_WINDOW_MS, getEarthquakes } from "../services/usgsEarthquakes";
import { getNearbyRiverGauges } from "../services/usgsRivers";
import type { OfficialEarthquake, RiverGauge, UsgsSnapshot } from "../services/usgsTypes";
import { checkRequestContext, claimFeedSlot, pauseFeedProvider, useFeedDeadline, useManualFeedRefresh, useRequestContext } from "../state/feedRequestGate";

export type DisasterLayer<T> = {
  items: T[];
  source: "live" | "cached" | "unavailable";
  fetchedAt: string | null;
  generatedAt: string | null;
  coverage: string;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  canRefresh: boolean;
  refresh: () => Promise<void>;
};
export type DisasterLayers = {
  earthquakes: DisasterLayer<OfficialEarthquake>;
  rivers: DisasterLayer<RiverGauge>;
};
export type DisasterLayerOptions = { earthquakes?: boolean; rivers?: boolean; automatic?: boolean };

/** Cached here means retained in React Query memory; these layers do not promise offline disk storage. */
export function layerSource(
  snapshot: UsgsSnapshot<unknown> | undefined,
  offline: boolean,
  error: Error | null,
  now: number,
  maxAge: number,
): DisasterLayer<unknown>["source"] {
  if (!snapshot) return "unavailable";
  const age = now - Date.parse(snapshot.fetchedAt);
  const generatedAge = snapshot.generatedAt === null ? 0 : now - Date.parse(snapshot.generatedAt);
  return offline || error || !Number.isFinite(age) || age < -5 * 60_000 || age >= maxAge ||
    !Number.isFinite(generatedAge) || generatedAge < -5 * 60_000 || generatedAge >= maxAge
    ? "cached" : "live";
}

function useLayer<T>(
  key: readonly string[],
  request: (signal: AbortSignal) => Promise<UsgsSnapshot<T>>,
  enabled: boolean,
  automatic: boolean,
  visible: boolean,
  offline: boolean,
  interval: number,
  maxAge: number,
  now: number,
  coverage: string,
): DisasterLayer<T> {
  const client = useQueryClient();
  const keyString = JSON.stringify(key);
  const provider = key[0] === "usgs-earthquakes" ? "usgs-earthquakes" : "usgs-rivers";
  const nextAllowed = useFeedDeadline(client, provider, keyString);
  const isCurrent = useRequestContext(enabled, keyString, automatic);
  const requestFn = useCallback(async ({ signal }: { signal: AbortSignal }) => {
    await claimFeedSlot(client, provider, keyString, interval, signal, isCurrent);
    checkRequestContext(signal, isCurrent);
    try {
      const snapshot = await request(signal);
      checkRequestContext(signal, isCurrent);
      return snapshot;
    } catch (error) {
      if (!signal.aborted && isCurrent() && error instanceof ClearPathDataError)
        pauseFeedProvider(client, provider, error.retryAfterMs);
      throw error;
    }
  }, [client, interval, isCurrent, keyString, provider, request]);
  const query = useQuery<UsgsSnapshot<T>, Error>({
    queryKey: key,
    enabled: enabled && automatic,
    staleTime: interval,
    gcTime: 30 * 60_000,
    refetchInterval: enabled && automatic ? interval : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    queryFn: requestFn,
  });
  useEffect(() => {
    if (!enabled || !automatic) void client.cancelQueries({ queryKey: key, exact: true });
    // The serialized key changes only when the actual query identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatic, client, enabled, keyString]);
  const canRefresh = enabled && !query.isFetching && now >= nextAllowed;
  const refresh = useManualFeedRefresh(client, provider, keyString, key, isCurrent, query.refetch);
  const snapshot = visible ? query.data : undefined;
  const error = visible ? query.error : null;
  return {
    items: snapshot?.items ?? [],
    source: layerSource(snapshot, offline, error, now, maxAge),
    fetchedAt: snapshot?.fetchedAt ?? null,
    generatedAt: snapshot?.generatedAt ?? null,
    coverage: snapshot?.coverage ?? coverage,
    loading: visible && enabled && query.isPending && query.isFetching,
    refreshing: visible && query.isFetching,
    error,
    canRefresh,
    refresh,
  };
}

/** Call with enabled=false in demo mode; real events are never mixed with fictional fixtures. */
export function useDisasterLayers(point: Coordinates | null, enabled = true, options: DisasterLayerOptions = {}): DisasterLayers {
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!enabled || !foreground) return;
    // A Map focus change can resume presentation without a feed request in
    // manual mode. Catch up its age/window clock immediately in that case.
    const resume = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(resume); clearInterval(timer); };
  }, [enabled, foreground]);
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const selectedPoint = useMemo(() => latitude === undefined || longitude === undefined ? null : { latitude, longitude }, [latitude, longitude]);
  const requestRivers = useCallback((signal: AbortSignal) => {
    if (!selectedPoint) throw new Error("Select a point for nearby river observations.");
    return getNearbyRiverGauges(selectedPoint, signal);
  }, [selectedPoint]);
  const earth = useLayer(["usgs-earthquakes", "last-day"], getEarthquakes,
    enabled && options.earthquakes !== false && foreground && !offline, options.automatic !== false, enabled, offline, 60_000, 90_000, now,
    "USGS reported earthquakes worldwide in the past 24 hours; epicenters are not impact areas.");
  const rivers = useLayer(["usgs-rivers", selectedPoint ? `${selectedPoint.latitude},${selectedPoint.longitude}` : "none"], requestRivers,
    enabled && options.rivers !== false && !!selectedPoint && foreground && !offline, options.automatic !== false, enabled && !!selectedPoint, offline,
    5 * 60_000, 10 * 60_000, now,
    "Up to 12 nearest USGS Texas stream stations within 50 km. Missing readings are unavailable.");
  return {
    earthquakes: { ...earth, items: earth.items.filter((event) => Date.parse(event.observedAt) >= now - EARTHQUAKE_WINDOW_MS) },
    rivers,
  };
}
