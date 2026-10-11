import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState as NativeAppState, Platform } from "react-native";
import { router } from "expo-router";
import { useAppState } from "./AppState";
import { useFeedPreferences } from "./FeedPreferences";
import { useAlertsContext } from "./AlertsProvider";
import { locationKey } from "@/domain/alerts";
import { acknowledgeNotificationDelivery, createNotificationLedger, evaluateNotificationSnapshot, restoreNotificationLedger, retargetNotificationLedger, type NotificationLedger } from "@/domain/notificationPolicy";
import { GPS_FOLLOW_MAX_AGE_MS, startForegroundFollow } from "@/services/foregroundFollow";
import { cancelNotification, initializeNotifications, listenNotificationResponses, readNotificationPermission, requestNotificationPermission, sendNwsNotification, sendTestNotification } from "@/services/notifications";

export const LOCATION_NOTIFICATIONS_KEY = "@clearpath/location-notifications/v1";
type Settings = { version: 1; enabled: boolean; generation: string; ledger: NotificationLedger | null };
type State = {
  ready: boolean; enabled: boolean; busy: boolean; supported: boolean;
  status: string; error: string | null; lastNotice: string | null;
  enable: () => Promise<void>; disable: () => void; test: () => Promise<void>;
};
const Context = createContext<State | null>(null);

export function LocationNotificationsProvider({ children }: PropsWithChildren) {
  const app = useAppState();
  const preferences = useFeedPreferences();
  const feed = useAlertsContext();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [foreground, setForeground] = useState(NativeAppState.currentState === "active");
  const [error, setError] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState<string | null>(null);
  const generation = useRef("");
  const ledger = useRef<NotificationLedger | null>(null);
  const selectionRevision = useRef(0);
  const operation = useRef(0);
  const permissionRead = useRef(0);
  const gpsError = useRef<string | null>(null);
  const lastGpsAt = useRef(0);
  const mounted = useRef(true);
  const optedIn = useRef(false);
  const writes = useRef(Promise.resolve());
  const deliveries = useRef(Promise.resolve());
  const latest = useRef({ app, preferences, feed, foreground, enabled, permission, tracking });
  useLayoutEffect(() => { latest.current = { app, preferences, feed, foreground, enabled, permission, tracking }; }, [app, preferences, feed, foreground, enabled, permission, tracking]);
  const supported = Platform.OS !== "web";

  const persist = useCallback(async (next: Settings) => {
    const task = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(LOCATION_NOTIFICATIONS_KEY, JSON.stringify(next)));
    writes.current = task;
    await task;
  }, []);
  const settings = useCallback((): Settings => ({ version: 1, enabled: optedIn.current, generation: generation.current, ledger: ledger.current }), []);
  const disable = useCallback(() => {
    ++operation.current;
    optedIn.current = false;
    ledger.current = null;
    setEnabled(false); setTracking(false); setBusy(false); setError(null);
    void persist(settings()).catch(() => { if (mounted.current) setError("OFF for this session. Could not save OFF; disable ClearPath notifications in Android settings before reopening."); });
  }, [persist, settings]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const initialSelection = latest.current.app.locationRevision;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOCATION_NOTIFICATIONS_KEY);
        const saved: unknown = raw === null ? null : JSON.parse(raw);
        if (saved !== null) {
          if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error();
          const value = saved as Partial<Settings>;
          if (value.version !== 1 || typeof value.enabled !== "boolean" || typeof value.generation !== "string" || value.generation.length > 100 || (value.enabled && !value.generation.trim())) throw new Error();
          if (value.ledger !== null && (!value.ledger?.watch || value.ledger.watch.generation !== value.generation)) throw new Error();
          if (cancelled) return;
          generation.current = value.generation;
          const manuallyChanged = latest.current.app.locationRevision !== initialSelection;
          ledger.current = !manuallyChanged && value.ledger?.watch ? restoreNotificationLedger(value.ledger, value.ledger.watch) : null;
          optedIn.current = value.enabled && supported && !manuallyChanged;
          selectionRevision.current = latest.current.app.locationRevision;
          setEnabled(optedIn.current);
          if (manuallyChanged && value.enabled) {
            setLastNotice("GPS FOLLOW STOPPED / MANUAL POINT SELECTED");
            await persist(settings());
          }
        }
        const permissionTicket = ++permissionRead.current;
        const current = await readNotificationPermission();
        if (!cancelled && permissionTicket === permissionRead.current) setPermission(current.granted);
      } catch { if (!cancelled) { optedIn.current = false; setEnabled(false); setError("Saved alert settings unavailable. Alerts are OFF; enable again."); } }
      finally { if (!cancelled) setReady(true); }
    })();
    const state = NativeAppState.addEventListener("change", (next) => {
      const permissionTicket = ++permissionRead.current;
      setForeground(next === "active");
      setPermission(false);
      if (next !== "active") setTracking(false);
      else void readNotificationPermission().then((current) => { if (!cancelled && permissionTicket === permissionRead.current) setPermission(current.granted); }).catch(() => { if (!cancelled && permissionTicket === permissionRead.current) { setPermission(false); setError("Cannot read notification permission. Alerts are paused."); } });
    });
    return () => { cancelled = true; mounted.current = false; state.remove(); };
  }, [persist, settings, supported]);

  useEffect(() => {
    if (!supported) return;
    void initializeNotifications().catch(() => { if (mounted.current) setError("Notification channel unavailable. Retry enabling alerts."); });
    return listenNotificationResponses(() => {
      // Reopen current official results. Never trust a payload URL or cached warning.
      latest.current.app.setMode("live");
      router.navigate("/");
      setLastNotice("NOTIFICATION OPENED / CHECK CURRENT NWS RESULTS");
    }, () => setLastNotice("TEST OPENED / NO EMERGENCY"));
  }, [supported]);

  useEffect(() => {
    if (enabled && app.locationRevision !== selectionRevision.current) {
      disable();
      setLastNotice("GPS FOLLOW STOPPED / MANUAL POINT SELECTED");
    }
  }, [app.locationRevision, disable, enabled]);

  const enable = useCallback(async () => {
    if (!ready || busy || optedIn.current || !supported || latest.current.app.mode !== "live" || !latest.current.preferences.ready || !latest.current.preferences.automatic) return;
    const ticket = ++operation.current;
    const initialSelection = latest.current.app.locationRevision;
    setBusy(true); setError(null);
    try {
      const granted = await requestNotificationPermission();
      if (!mounted.current || ticket !== operation.current || latest.current.app.mode !== "live" || !latest.current.preferences.automatic || latest.current.app.locationRevision !== initialSelection) return;
      ++permissionRead.current;
      setPermission(granted.granted);
      if (!granted.granted) throw new Error("Notifications denied. Allow ClearPath notifications in Android settings.");
      generation.current = `${Date.now()}-${ticket}`;
      ledger.current = null;
      selectionRevision.current = latest.current.app.locationRevision;
      // Persist explicit consent before starting GPS or claiming it survives restart.
      await persist({ version: 1, enabled: true, generation: generation.current, ledger: null });
      if (!mounted.current || ticket !== operation.current || latest.current.app.mode !== "live" || !latest.current.preferences.automatic || latest.current.app.locationRevision !== initialSelection) {
        await persist(settings());
        return;
      }
      optedIn.current = true;
      setEnabled(true); setLastNotice("FIRST NWS CHECK SETS BASELINE / LATER MESSAGES NOTIFY");
    } catch (cause) { if (mounted.current && ticket === operation.current) setError(cause instanceof Error ? cause.message : "Could not enable location alerts."); }
    finally { if (mounted.current && ticket === operation.current) setBusy(false); }
  }, [busy, persist, ready, settings, supported]);

  useEffect(() => {
    if (!ready || !enabled || !permission || !foreground || app.mode !== "live" || !preferences.ready || !preferences.automatic || app.locationRevision !== selectionRevision.current) {
      setTracking(false);
      return;
    }
    let cancelled = false;
    let stop = () => {};
    const ticket = operation.current;
    const isCurrent = () => !cancelled && mounted.current && optedIn.current && ticket === operation.current && latest.current.permission && latest.current.app.mode === "live" && latest.current.foreground && latest.current.preferences.automatic && latest.current.app.locationRevision === selectionRevision.current;
    setTracking(false);
    void startForegroundFollow((selected, observedAt) => {
      if (!isCurrent()) return;
      const point = locationKey(selected);
      ledger.current = ledger.current ? retargetNotificationLedger(ledger.current, point) : createNotificationLedger({ generation: generation.current, locationKey: point });
      lastGpsAt.current = observedAt;
      latest.current.app.setLocation(selected, "follow");
      setTracking(true);
      const recoveredError = gpsError.current;
      setError((current) => current === recoveredError ? null : current);
      gpsError.current = null;
    }, (message) => { if (isCurrent()) { gpsError.current = message; setError(message); setTracking(false); cancelled = true; stop(); } }, isCurrent)
      .then((remove) => { stop = remove; if (cancelled) remove(); })
      .catch((cause) => { if (isCurrent()) { setTracking(false); const message = cause instanceof Error ? cause.message : "GPS following unavailable."; gpsError.current = message; setError(message); } });
    return () => { cancelled = true; stop(); };
  }, [app.locationRevision, app.mode, enabled, foreground, permission, preferences.automatic, preferences.ready, ready]);

  useEffect(() => {
    const snapshot = feed.snapshot;
    if (!enabled || !tracking || !permission || feed.source !== "live" || !snapshot || !ledger.current) return;
    const ticket = operation.current;
    const snapshotIsCurrent = () => {
      const current = latest.current;
      return mounted.current && optedIn.current && ticket === operation.current && current.enabled && current.permission && current.tracking && current.foreground && Date.now() - lastGpsAt.current < GPS_FOLLOW_MAX_AGE_MS && lastGpsAt.current <= Date.now() + 5_000 && current.app.mode === "live" && current.preferences.automatic && current.app.locationRevision === selectionRevision.current && current.feed.source === "live" && current.feed.snapshot?.fetchedAt === snapshot.fetchedAt && current.feed.snapshot?.locationKey === snapshot.locationKey && ledger.current?.watch.locationKey === snapshot.locationKey;
    };
    deliveries.current = deliveries.current.catch(() => {}).then(async () => {
      if (!snapshotIsCurrent() || !ledger.current) return;
      const evaluation = evaluateNotificationSnapshot(ledger.current, snapshot);
      ledger.current = evaluation.ledger;
      await persist(settings());
      for (const candidate of evaluation.candidates) {
        if (!snapshotIsCurrent() || !ledger.current) return;
        const identifier = await sendNwsNotification(candidate.alert, snapshotIsCurrent);
        if (!snapshotIsCurrent() || !ledger.current) { await cancelNotification(identifier); return; }
        ledger.current = acknowledgeNotificationDelivery(ledger.current, [candidate]).ledger;
        await persist(settings());
        if (mounted.current) setLastNotice("NEW NWS MESSAGE / NOTIFICATION QUEUED");
      }
      if (evaluation.deferredCount && mounted.current) setError("Notification history is full. Some new messages were deferred; check Home.");
      else if (snapshotIsCurrent()) setError(null);
    }).catch(() => { if (snapshotIsCurrent()) setError("Notification or local save failed. Check Home for current warnings."); });
  }, [enabled, feed.snapshot, feed.source, permission, persist, settings, tracking]);

  const test = useCallback(async () => {
    if (busy || !supported || latest.current.app.mode !== "live") return;
    const ticket = operation.current;
    setBusy(true); setError(null);
    try {
      const granted = await requestNotificationPermission();
      if (!mounted.current || ticket !== operation.current || latest.current.app.mode !== "live") return;
      ++permissionRead.current;
      setPermission(granted.granted);
      if (!granted.granted) throw new Error("Notification permission denied.");
      const identifier = await sendTestNotification(() => mounted.current && ticket === operation.current && latest.current.app.mode === "live");
      if (!mounted.current || ticket !== operation.current || latest.current.app.mode !== "live") { await cancelNotification(identifier); return; }
      setLastNotice("TEST QUEUED / CHECK ANDROID NOTIFICATIONS");
    } catch { if (mounted.current && ticket === operation.current) setError("Test notification failed. Check Android notification settings."); }
    finally { if (mounted.current && ticket === operation.current) setBusy(false); }
  }, [busy, supported]);

  const status = !supported ? "NATIVE APP REQUIRED" : !ready ? "READING SETTINGS" : !enabled ? "OFF" : app.mode === "demo" ? "PAUSED / DEMO" : !preferences.automatic ? "PAUSED / MANUAL FEEDS" : !foreground ? "PAUSED / APP CLOSED" : !permission ? "PAUSED / OS PERMISSION" : tracking ? "ON / GPS FOLLOW / APP OPEN" : "WAITING FOR GPS";
  return <Context.Provider value={{ ready, enabled, busy, supported, status, error, lastNotice, enable, disable, test }}>{children}</Context.Provider>;
}

export function useLocationNotifications() { return useContext(Context); }
