import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppTabs from "@/components/app-tabs";
import { AppProvider } from "@/state/AppState";
import { PreparednessProvider } from "@/state/PreparednessState";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/state/queryClient";
import { AlertsProvider } from "@/state/AlertsProvider";

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AlertsProvider>
            <PreparednessProvider>
              <AppTabs />
            </PreparednessProvider>
          </AlertsProvider>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
