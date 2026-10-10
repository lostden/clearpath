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
  setLocation: (location: SelectedLocation) => void;
  locationError: string | null;
  setLocationError: (error: string | null) => void;
};
const Context = createContext<AppState | null>(null);
const locationStorageKey = "@clearpath/selected-location/v1";
export function AppProvider({ children }: PropsWithChildren) {
  const [mode, changeMode] = useState<"demo" | "live">("live");
  const [scenario, changeScenario] = useState<DemoScenario>("flood");
  const [location, changeLocation] = useState<SelectedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(locationStorageKey)
      .then((raw) => {
        if (!raw || cancelled || changed.current) return;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return;
        const saved = parsed as Partial<SelectedLocation>;
        if (
          !validCoordinates(saved.coordinates) ||
          typeof saved.label !== "string" ||
          (saved.kind !== "gps" && saved.kind !== "manual")
        )
          return;
        changeLocation({
          coordinates: saved.coordinates,
          kind: saved.kind,
          label:
            saved.kind === "gps"
              ? "Saved GPS point · last selection"
              : saved.label,
        });
        changeMode("live");
      })
      .catch(() => {
        if (!cancelled)
          setLocationError(
            "The last selected point could not be restored. Select a location again.",
          );
      });
    return () => {
      cancelled = true;
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
    changeLocation(next);
    writes.current = writes.current
      .then(() =>
        AsyncStorage.setItem(locationStorageKey, JSON.stringify(next)),
      )
      .catch(() =>
        setLocationError(
          "This location is available this session but could not be saved for reopening offline.",
        ),
      );
  }, []);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      scenario,
      setScenario,
      location,
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
