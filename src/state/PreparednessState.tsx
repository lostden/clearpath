import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

export type Contact = { id: string; name: string; phone: string };
type SavedPreparation = { checked: Record<string, boolean>; contacts: Contact[]; meetingPlace: string; outOfAreaContact: string };
const empty: SavedPreparation = { checked: {}, contacts: [], meetingPlace: '', outOfAreaContact: '' };
const key = '@clearpath/preparation/v1';
export function parsePreparation(raw: string | null): SavedPreparation {
  if (!raw) return empty;
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid saved preparation');
  const record = data as Partial<SavedPreparation>;
  if (!record.checked || typeof record.checked !== 'object' || Array.isArray(record.checked) || !Object.values(record.checked).every(value => typeof value === 'boolean') || !Array.isArray(record.contacts) || !record.contacts.every(contact => contact && typeof contact.id === 'string' && typeof contact.name === 'string' && typeof contact.phone === 'string') || typeof record.meetingPlace !== 'string' || typeof record.outOfAreaContact !== 'string') throw new Error('Invalid saved preparation');
  return record as SavedPreparation;
}
type PreparationState = { saved: SavedPreparation; ready: boolean; storageError: string | null; update: (change: Partial<SavedPreparation>) => void; toggle: (id: string) => void };
const Context = createContext<PreparationState | null>(null);
export function PreparednessProvider({ children }: PropsWithChildren) {
  const [saved, setSaved] = useState(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const writeQueue = useRef(Promise.resolve());
  const readFailed = useRef(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key).then(raw => { if (!cancelled) setSaved(parsePreparation(raw)); }).catch(() => { readFailed.current = true; if (!cancelled) setStorageError('Saved preparation could not be loaded. Existing storage will not be overwritten.'); }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready || readFailed.current) return;
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(key, JSON.stringify(saved))).then(() => setStorageError(null)).catch(() => setStorageError('Changes are available this session, but could not be saved on this device.'));
  }, [saved, ready]);
  const value = useMemo(() => ({ saved, ready, storageError, update: (change: Partial<SavedPreparation>) => setSaved(old => ({ ...old, ...change })), toggle: (id: string) => setSaved(old => ({ ...old, checked: { ...old.checked, [id]: !old.checked[id] } })) }), [saved, ready, storageError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreparation() { const state = useContext(Context); if (!state) throw new Error('PreparednessProvider is required'); return state; }
