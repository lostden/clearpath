import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validCoordinates } from "@/domain/alerts";
import type { DemoScenario, SelectedLocation } from "@/domain/types";

type AppState = {
  mode: "demo" | "live";
  setMode: (mode: "demo" | "live") => void;
  scenario: DemoScenario;
  setScenario: (scenario: DemoScenario) => void;
  location: SelectedLocation | null;
  /** Saved-point hydration has settled, or a point was explicitly selected. */
  locationReady: boolean;
  setLocation: (location: SelectedLocation) => void;
  locationError: string | null;
  setLocationError: (error: string | null) => void;
};
const Context = createContext<AppState | null>(null);
const locationStorageKey = "@clearpath/selected-location/v1";
const restoreError = "The last selected point could not be restored. Select a location again.";
const saveError = "This location is available this session but could not be saved for reopening offline.";
export function AppProvider({ children }: PropsWithChildren) {
  const [mode, changeMode] = useState<"demo" | "live">("live");
  const [scenario, changeScenario] = useState<DemoScenario>("flood");
  const [location, changeLocation] = useState<SelectedLocation | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const changed = useRef(false);
  const mounted = useRef(true);
  const writeGeneration = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void AsyncStorage.getItem(locationStorageKey)
      .then((raw) => {
        if (cancelled || changed.current || raw === null) return;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("Invalid saved point");
        const saved = parsed as Partial<SelectedLocation>;
        if (
          !validCoordinates(saved.coordinates) ||
          typeof saved.label !== "string" ||
          !saved.label.trim() ||
          (saved.kind !== "gps" && saved.kind !== "manual")
        )
          throw new Error("Invalid saved point");
        changeLocation({
          coordinates: { latitude: saved.coordinates.latitude, longitude: saved.coordinates.longitude },
          kind: saved.kind,
          label:
            saved.kind === "gps"
              ? "Saved GPS point · last selection"
              : saved.label,
        });
        changeMode("live");
      })
      .catch(() => {
        if (!cancelled && !changed.current) setLocationError(restoreError);
      })
      .finally(() => { if (!cancelled) setLocationReady(true); });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);
  const setMode = useCallback((next: "demo" | "live") => {
    changed.current = true;
    changeMode(next);
  }, []);
  const setScenario = useCallback((next: DemoScenario) => {
    changed.current = true;
    changeScenario(next);
  }, []);
  const setLocation = useCallback((next: SelectedLocation) => {
    if (!validCoordinates(next.coordinates)) {
      setLocationError("Please choose valid coordinates.");
      return;
    }
    changed.current = true;
    const selected: SelectedLocation = {
      label: next.label,
      kind: next.kind,
      coordinates: { latitude: next.coordinates.latitude, longitude: next.coordinates.longitude },
    };
    const generation = ++writeGeneration.current;
    const serialized = JSON.stringify(selected);
    changeLocation(selected);
    setLocationReady(true);
    setLocationError(null);
    writes.current = writes.current
      .then(async () => {
        // Skip obsolete writes that have not started; in-flight writes remain
        // serialized so the newest selected point is always written last.
        if (!mounted.current || generation !== writeGeneration.current) return;
        await AsyncStorage.setItem(locationStorageKey, serialized);
        if (mounted.current && generation === writeGeneration.current)
          setLocationError((current) => current === saveError ? null : current);
      })
      .catch(() => {
        if (mounted.current && generation === writeGeneration.current)
          setLocationError(saveError);
      });
  }, []);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      scenario,
      setScenario,
      location,
      locationReady,
      setLocation,
      locationError,
      setLocationError,
    }),
    [
      mode,
      setMode,
      scenario,
      setScenario,
      location,
      locationReady,
      setLocation,
      locationError,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppState() {
  const state = useContext(Context);
  if (!state) throw new Error("AppProvider is required");
  return state;
}
