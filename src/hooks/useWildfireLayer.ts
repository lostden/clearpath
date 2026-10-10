import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ClearPathDataError } from "../data/http";
import { getWildfirePerimeters } from "../services/nifcWildfires";
import type { WildfireCoverage, WildfireSnapshot } from "../services/wildfireTypes";

const REQUEST_INTERVAL = 5 * 60_000;
const VERIFIED_AGE = 10 * 60_000;
type RequestGate = { deadlines: Map<WildfireCoverage, number>; blockedUntil: number };
// Two coverage deadlines and one provider pause share the lifetime of their
// in-memory query cache, including a true Map unmount/remount. Nothing persists.
const requestGates = new WeakMap<QueryClient, RequestGate>();
function gateFor(client: QueryClient): RequestGate {
  let gate = requestGates.get(client);
  if (!gate) {
    gate = { deadlines: new Map(), blockedUntil: 0 };
    requestGates.set(client, gate);
  }
  return gate;
}
function nextDeadline(client: QueryClient, coverage: WildfireCoverage): number {
  const gate = requestGates.get(client);
  return Math.max(gate?.deadlines.get(coverage) ?? 0, gate?.blockedUntil ?? 0);
}
function claimSlot(client: QueryClient, coverage: WildfireCoverage, deadline: number) {
  gateFor(client).deadlines.set(coverage, deadline);
}
function pauseGate(client: QueryClient, milliseconds: number | undefined) {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
  const gate = gateFor(client);
  gate.blockedUntil = Math.max(gate.blockedUntil, Date.now() + milliseconds);
}

export type WildfireLayerState = Pick<WildfireSnapshot,
  "items" | "coverage" | "available" | "countedAt" | "returned" | "omitted" | "truncated" | "reason"
> & {
  source: "live" | "cached" | "unavailable";
  fetchedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  canRefresh: boolean;
  refresh: () => Promise<void>;
};

function waitForSlot(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new ClearPathDataError("cancelled", "The request was cancelled."));
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new ClearPathDataError("cancelled", "The request was cancelled."));
    };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

/** Opt in only when Map is live, focused, hydrated and its wildfire switch is on.
 * Copies stay in React Query memory. A recent download does not date the fire edge.
 */
export function useWildfireLayer(
  coverage: WildfireCoverage,
  requested = false,
  { automatic = true }: { automatic?: boolean } = {},
): WildfireLayerState {
  const client = useQueryClient();
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(Date.now);
  const requestAllowed = requested && foreground && !offline;
  const enabled = requestAllowed && automatic;
  const settings = useRef({ coverage, requestAllowed });
  const mounted = useRef(true);
  const manualBusy = useRef(false);
  const [, notifyGateChange] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setNow(Date.now());
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);
  useEffect(() => { settings.current = { coverage, requestAllowed }; }, [coverage, requestAllowed]);
  const pauseProvider = useCallback((milliseconds: number | undefined) => {
    pauseGate(client, milliseconds);
    if (mounted.current) notifyGateChange((previous) => previous + 1);
  }, [client]);

  const query = useQuery<WildfireSnapshot, Error>({
    queryKey: ["nifc-wildfires", coverage],
    enabled,
    staleTime: REQUEST_INTERVAL,
    gcTime: 30 * 60_000,
    networkMode: "always",
    refetchInterval: enabled ? REQUEST_INTERVAL : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    queryFn: async ({ signal }) => {
      await waitForSlot(nextDeadline(client, coverage) - Date.now(), signal);
      if (signal.aborted) throw new ClearPathDataError("cancelled", "The request was cancelled.");
      const deadline = Date.now() + REQUEST_INTERVAL;
      claimSlot(client, coverage, deadline);
      if (mounted.current) {
        notifyGateChange((previous) => previous + 1);
        setNow(Date.now());
      }
      try {
        const snapshot = await getWildfirePerimeters(coverage, signal);
        if (signal.aborted) throw new ClearPathDataError("cancelled", "The request was cancelled.");
        if (snapshot.coverage !== coverage) throw new ClearPathDataError("invalid-response", "The wildfire copy has different coverage.");
        pauseProvider(snapshot.retryAfterMs);
        return snapshot;
      } catch (error) {
        if (!signal.aborted && error instanceof ClearPathDataError) pauseProvider(error.retryAfterMs);
        throw error;
      }
    },
  });

  // Cancel the old scope even if its adapter has not resolved yet. Consuming
  // the query signal also prevents a late response from repopulating that copy.
  useEffect(() => () => {
    void client.cancelQueries({ queryKey: ["nifc-wildfires", coverage], exact: true });
  }, [client, coverage]);
  useEffect(() => {
    if (!requestAllowed || !automatic) void client.cancelQueries({ queryKey: ["nifc-wildfires", coverage], exact: true });
  }, [automatic, client, coverage, requestAllowed]);

  const snapshot = requested && query.data?.coverage === coverage ? query.data : null;
  const error = requested ? query.failureReason ?? query.error : null;
  const fetchedAge = snapshot ? now - Date.parse(snapshot.fetchedAt) : NaN;
  const verified = requestAllowed && !error && Number.isFinite(fetchedAge) && fetchedAge >= -5 * 60_000 && fetchedAge < VERIFIED_AGE;
  const source = snapshot ? verified ? "live" : "cached" : "unavailable";
  const nextAllowed = nextDeadline(client, coverage);

  useEffect(() => {
    if (!requested || !foreground) return;
    const catchup = setTimeout(() => setNow(Date.now()), 0);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(catchup); clearInterval(clock); };
  }, [requested, foreground, offline, coverage, snapshot]);
  useEffect(() => {
    if (!requested || !foreground) return;
    const boundaries = [nextAllowed, snapshot ? Date.parse(snapshot.fetchedAt) + VERIFIED_AGE : NaN];
    const deadline = Math.min(...boundaries.filter((value) => Number.isFinite(value) && value > now));
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [foreground, nextAllowed, now, requested, snapshot]);

  const canRefresh = requestAllowed && !query.isFetching && now >= nextAllowed;
  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    // Check synchronous refs/query state too: two presses can share one render,
    // and a saved callback may outlive the selected coverage or visibility.
    const current = settings.current;
    if (!current.requestAllowed || current.coverage !== coverage || AppState.currentState !== "active" || manualBusy.current ||
      client.getQueryState(["nifc-wildfires", coverage])?.fetchStatus === "fetching" ||
      Date.now() < nextDeadline(client, coverage)) return;
    manualBusy.current = true;
    try { await refetch({ cancelRefetch: false }); }
    finally { manualBusy.current = false; }
  }, [client, coverage, refetch]);

  return {
    items: snapshot?.items ?? [], source, coverage,
    fetchedAt: snapshot?.fetchedAt ?? null,
    loading: requested && requestAllowed && query.isPending && query.isFetching,
    refreshing: requested && query.isFetching,
    error, canRefresh, refresh,
    available: snapshot?.available ?? null, countedAt: snapshot?.countedAt ?? null,
    returned: snapshot?.returned ?? 0, omitted: snapshot?.omitted ?? null,
    truncated: snapshot?.truncated ?? false, reason: snapshot?.reason ?? null,
  };
}
