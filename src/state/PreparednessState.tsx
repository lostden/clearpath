import AsyncStorage from "@react-native-async-storage/async-storage";
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

export type Contact = { id: string; name: string; phone: string };
type SavedPreparation = {
  checked: Record<string, boolean>;
  contacts: Contact[];
  meetingPlace: string;
  outOfAreaContact: string;
};
const empty: SavedPreparation = {
  checked: {},
  contacts: [],
  meetingPlace: "",
  outOfAreaContact: "",
};
const key = "@clearpath/preparation/v1";
export function parsePreparation(raw: string | null): SavedPreparation {
  if (!raw) return empty;
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object")
    throw new Error("Invalid saved preparation");
  const record = data as Partial<SavedPreparation>;
  if (
    !record.checked ||
    typeof record.checked !== "object" ||
    Array.isArray(record.checked) ||
    !Object.values(record.checked).every(
      (value) => typeof value === "boolean",
    ) ||
    !Array.isArray(record.contacts) ||
    !record.contacts.every(
      (contact) =>
        contact &&
        typeof contact.id === "string" &&
        typeof contact.name === "string" &&
        typeof contact.phone === "string",
    ) ||
    typeof record.meetingPlace !== "string" ||
    typeof record.outOfAreaContact !== "string"
  )
    throw new Error("Invalid saved preparation");
  return record as SavedPreparation;
}
type PreparationState = {
  saved: SavedPreparation;
  ready: boolean;
  saveStatus: "loading" | "saving" | "saved" | "session";
  storageError: string | null;
  update: (change: Partial<SavedPreparation>) => void;
  toggle: (id: string) => void;
};
const Context = createContext<PreparationState | null>(null);
export function PreparednessProvider({ children }: PropsWithChildren) {
  const [saved, setSaved] = useState(empty);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PreparationState["saveStatus"]>("loading");
  const [storageError, setStorageError] = useState<string | null>(null);
  const writeQueue = useRef(Promise.resolve());
  const readFailed = useRef(false);
  const revision = useRef(0);
  const latestWrite = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!cancelled) {
          setSaved(parsePreparation(raw));
          setSaveStatus("saved");
        }
      })
      .catch(() => {
        if (!cancelled) {
          readFailed.current = true;
          setSaveStatus("session");
          setStorageError(
            "Saved preparation could not be loaded. Existing storage will not be overwritten.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || readFailed.current || revision.current === 0) return;
    const version = revision.current;
    const write = ++latestWrite.current;
    setSaveStatus("saving");
    const task = writeQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(saved)));
    // Keep writes ordered while allowing a later edit to retry a failed write.
    writeQueue.current = task.catch(() => {});
    const isLatest = () => mounted.current && version === revision.current && write === latestWrite.current;
    void task.then(() => {
      if (!isLatest()) return;
      setStorageError(null);
      setSaveStatus("saved");
    }, () => {
      if (!isLatest()) return;
      setSaveStatus("session");
      setStorageError(
        "Changes are available this session, but could not be saved on this device.",
      );
    });
  }, [saved, ready]);
  const edited = useCallback(() => {
    // Advance immediately, before React commits the new value, so an older
    // completion cannot claim that the newly edited preparation was saved.
    revision.current += 1;
    setSaveStatus(readFailed.current ? "session" : ready ? "saving" : "loading");
  }, [ready]);
  const value = useMemo(
    () => ({
      saved,
      ready,
      saveStatus,
      storageError,
      update: (change: Partial<SavedPreparation>) => {
        edited();
        setSaved((old) => ({ ...old, ...change }));
      },
      toggle: (id: string) => {
        edited();
        setSaved((old) => ({
          ...old,
          checked: { ...old.checked, [id]: !old.checked[id] },
        }));
      },
    }),
    [edited, saved, ready, saveStatus, storageError],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreparation() {
  const state = useContext(Context);
  if (!state) throw new Error("PreparednessProvider is required");
  return state;
}
