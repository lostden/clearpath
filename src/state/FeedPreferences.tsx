import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

type FeedPreferences = {
  automatic: boolean;
  ready: boolean;
  storageError: string | null;
  setAutomatic: (automatic: boolean) => void;
};
const Context = createContext<FeedPreferences | null>(null);
export const FEED_PREFERENCES_KEY = "@clearpath/feed-preferences/v1";

export function FeedPreferencesProvider({ children }: PropsWithChildren) {
  const [automatic, changeAutomatic] = useState(true);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void AsyncStorage.getItem(FEED_PREFERENCES_KEY).then((raw) => {
      if (cancelled) return;
      if (raw !== null) {
        const saved: unknown = JSON.parse(raw);
        if (!saved || typeof saved !== "object" || Array.isArray(saved) ||
          typeof (saved as { automatic?: unknown }).automatic !== "boolean") {
          throw new Error("Invalid feed preference");
        }
        changeAutomatic((saved as { automatic: boolean }).automatic);
      }
    }).catch(() => {
      if (cancelled) return;
      // A saved manual choice must not silently become automatic after a read failure.
      changeAutomatic(false);
      setStorageError("Saved update preference could not be read. Automatic updates are off for this session.");
    }).finally(() => {
      if (!cancelled) { hydrated.current = true; setReady(true); }
    });
    return () => { cancelled = true; mounted.current = false; };
  }, []);
  const setAutomatic = useCallback((next: boolean) => {
    if (!hydrated.current) return;
    changeAutomatic(next);
    const change = ++generation.current;
    writes.current = writes.current.catch(() => {}).then(() =>
      AsyncStorage.setItem(FEED_PREFERENCES_KEY, JSON.stringify({ automatic: next })),
    ).then(() => {
      if (mounted.current && generation.current === change) setStorageError(null);
    }).catch(() => {
      if (mounted.current && generation.current === change)
        setStorageError("Update mode changed for this session, but could not be saved for reopening.");
    });
  }, []);
  const value = useMemo(() => ({ automatic, ready, storageError, setAutomatic }), [automatic, ready, storageError, setAutomatic]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFeedPreferences(): FeedPreferences {
  const value = useContext(Context);
  if (!value) throw new Error("FeedPreferencesProvider is required");
  return value;
}
