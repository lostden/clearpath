import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { DemoScenario, SelectedLocation } from '@/domain/types';

type AppState = {
  mode: 'demo' | 'live'; setMode: (mode: 'demo' | 'live') => void;
  scenario: DemoScenario; setScenario: (scenario: DemoScenario) => void;
  location: SelectedLocation | null; setLocation: (location: SelectedLocation) => void;
  locationError: string | null; setLocationError: (error: string | null) => void;
};
const Context = createContext<AppState | null>(null);
export function AppProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [scenario, setScenario] = useState<DemoScenario>('flood');
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const value = useMemo(() => ({ mode, setMode, scenario, setScenario, location, setLocation, locationError, setLocationError }), [mode, scenario, location, locationError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppState() {
  const state = useContext(Context);
  if (!state) throw new Error('AppProvider is required');
  return state;
}
