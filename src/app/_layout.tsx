import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppTabs from '@/components/app-tabs';
import { AppProvider } from '@/state/AppState';
import { PreparednessProvider } from '@/state/PreparednessState';

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider><PreparednessProvider><AppTabs /></PreparednessProvider></AppProvider>
    </SafeAreaProvider>
  );
}
