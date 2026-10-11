import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { ClearPathDataError } from "@/data/http";

type FeedProvider = "nws" | "usgs-earthquakes" | "usgs-rivers";
type RequestGate = {
  deadlines: Map<string, number>;
  blockedUntil: number;
  listeners: Set<() => void>;
};
// Scheduling shares the query cache's lifetime. It contains deadlines only,
// never snapshots, location labels, or persistent location history.
const clients = new WeakMap<QueryClient, Map<FeedProvider, RequestGate>>();

function gateFor(client: QueryClient, provider: FeedProvider): RequestGate {
  let providers = clients.get(client);
  if (!providers) {
    providers = new Map();
    clients.set(client, providers);
  }
  let gate = providers.get(provider);
  if (!gate) {
    gate = { deadlines: new Map(), blockedUntil: 0, listeners: new Set() };
    providers.set(provider, gate);
  }
  return gate;
}

export function feedDeadline(client: QueryClient, provider: FeedProvider, key: string): number {
  const gate = clients.get(client)?.get(provider);
  return Math.max(gate?.deadlines.get(key) ?? 0, gate?.blockedUntil ?? 0);
}

export function useFeedDeadline(client: QueryClient, provider: FeedProvider, key: string): number {
  const subscribe = useCallback((listener: () => void) => {
    const gate = gateFor(client, provider);
    gate.listeners.add(listener);
    return () => { gate.listeners.delete(listener); };
  }, [client, provider]);
  const snapshot = useCallback(() => feedDeadline(client, provider, key), [client, key, provider]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function pauseFeedProvider(client: QueryClient, provider: FeedProvider, milliseconds: number | undefined) {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
  const gate = gateFor(client, provider);
  gate.blockedUntil = Math.max(gate.blockedUntil, Date.now() + milliseconds);
  gate.listeners.forEach((listener) => listener());
}

export function checkRequestContext(signal: AbortSignal, isCurrent: () => boolean) {
  if (signal.aborted || !isCurrent())
    throw new ClearPathDataError("cancelled", "The request was cancelled.");
}

export function waitForRequestSlot(milliseconds: number, signal: AbortSignal): Promise<void> {
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

/** Recheck after every wait; another observer may have claimed or paused this gate. */
export async function claimFeedSlot(
  client: QueryClient, provider: FeedProvider, key: string, interval: number,
  signal: AbortSignal, isCurrent: () => boolean,
): Promise<void> {
  checkRequestContext(signal, isCurrent);
  while (feedDeadline(client, provider, key) > Date.now()) {
    await waitForRequestSlot(feedDeadline(client, provider, key) - Date.now(), signal);
    checkRequestContext(signal, isCurrent);
  }
  checkRequestContext(signal, isCurrent);
  const gate = gateFor(client, provider);
  const now = Date.now();
  // Expired entries no longer constrain requests and need no retained identity.
  gate.deadlines.forEach((deadline, identity) => { if (deadline <= now) gate.deadlines.delete(identity); });
  gate.deadlines.set(key, now + interval);
  gate.listeners.forEach((listener) => listener());
}

/** A callback from a previous committed context never regains authorization. */
export function useRequestContext(allowed: boolean, identity: string, automatic: boolean): () => boolean {
  const token = useMemo(() => ({ allowed, automatic, identity }), [allowed, automatic, identity]);
  const current = useRef<object | null>(token);
  useLayoutEffect(() => {
    current.current = token;
    return () => { current.current = null; };
  }, [token]);
  return useCallback(() => current.current === token && token.allowed && AppState.currentState === "active", [token]);
}

/** Duplicate explicit presses share one promise and cannot cancel/restart a fetch. */
export function useManualFeedRefresh(
  client: QueryClient, provider: FeedProvider, key: string, queryKey: readonly (string | null)[],
  isCurrent: () => boolean, refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>,
): () => Promise<void> {
  const pending = useRef<{ context: () => boolean; promise: Promise<void> } | null>(null);
  return useCallback(() => {
    if (!isCurrent()) return Promise.resolve();
    if (pending.current?.context === isCurrent) return pending.current.promise;
    if (client.getQueryState(queryKey)?.fetchStatus === "fetching" ||
      Date.now() < feedDeadline(client, provider, key)) return Promise.resolve();
    const promise = refetch({ cancelRefetch: false }).then(() => {});
    pending.current = { context: isCurrent, promise };
    void promise.finally(() => { if (pending.current?.promise === promise) pending.current = null; }).catch(() => {});
    return promise;
  }, [client, isCurrent, key, provider, queryKey, refetch]);
}
