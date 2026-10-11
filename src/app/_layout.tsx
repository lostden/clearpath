import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppTabs from "@/components/app-tabs";
import { AppProvider } from "@/state/AppState";
import { PreparednessProvider } from "@/state/PreparednessState";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/state/queryClient";
import { AlertsProvider } from "@/state/AlertsProvider";
import { useFonts } from "expo-font";
import { FeedPreferencesProvider } from "@/state/FeedPreferences";
import { LocationNotificationsProvider } from "@/state/LocationNotifications";

export default function TabLayout() {
  // Bundled static faces work in Expo Go and installed builds. Rendering stays
  // available in system fallback fonts during loading or an asset failure.
  useFonts({
    ArchivoBlack: require("../../assets/fonts/ArchivoBlack.ttf"),
    RobotoMono: require("../../assets/fonts/RobotoMono.ttf"),
    RobotoMonoBold: require("../../assets/fonts/RobotoMonoBold.ttf"),
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <FeedPreferencesProvider>
            <AlertsProvider>
              <LocationNotificationsProvider>
                <PreparednessProvider>
                  <AppTabs />
                </PreparednessProvider>
              </LocationNotificationsProvider>
            </AlertsProvider>
          </FeedPreferencesProvider>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
