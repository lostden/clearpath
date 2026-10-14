import { View } from "react-native";
import { Body, Panel, SectionTitle } from "@/ui/components";
import { useFeedPreferences } from "@/state/FeedPreferences";
import { useLocationNotifications } from "@/state/LocationNotifications";

/** Operational diagnostics stay visible even when the settings controls are closed. */
export function FeedSettingsStatus() {
  const preferences = useFeedPreferences();
  const notices = useLocationNotifications();
  const showNotices = notices && (!notices.ready || notices.enabled || notices.busy || notices.error);
  return <>
    {(!preferences.ready || !preferences.automatic || preferences.storageError) && <Panel>
      <SectionTitle>FEED UPDATE STATUS</SectionTitle>
      <Body>{!preferences.ready ? "Loading saved update mode." : preferences.automatic ? "Automatic feed updates are on for this session." : "MANUAL MODE / Tap Refresh for each feed. New updates are not checked automatically."}</Body>
      {preferences.storageError && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Body>{preferences.storageError}</Body></View>}
    </Panel>}
    {showNotices && <Panel>
      <SectionTitle>LOCATION ALERTS / {notices.status}</SectionTitle>
      {notices.error && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Body>{notices.error}</Body></View>}
      <Body>GPS FOLLOW / APP OPEN ONLY</Body>
    </Panel>}
  </>;
}
