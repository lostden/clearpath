import { ActionButton, Body, Panel, SectionTitle } from "@/ui/components";
import { useLocationNotifications } from "@/state/LocationNotifications";
import { useAppState } from "@/state/AppState";
import { useFeedPreferences } from "@/state/FeedPreferences";
import { View } from "react-native";

export function LocationAlertControls() {
  const notices = useLocationNotifications();
  return notices ? <ActiveLocationAlertControls notices={notices} /> : null;
}

function ActiveLocationAlertControls({ notices }: { notices: NonNullable<ReturnType<typeof useLocationNotifications>> }) {
  const { mode } = useAppState();
  const { automatic, ready } = useFeedPreferences();
  return <Panel>
    <SectionTitle>LOCATION ALERTS / {notices.status}</SectionTitle>
    <Body>GPS FOLLOW / APP OPEN ONLY</Body>
    <Body>NWS / NEW MESSAGES AFTER FIRST CHECK</Body>
    {notices.enabled ? <ActionButton title="STOP GPS + ALERTS" onPress={notices.disable} secondary /> : <ActionButton title={notices.busy ? "ENABLING…" : "ENABLE GPS + ALERTS"} disabled={!notices.ready || notices.busy || !notices.supported || mode === "demo" || !ready || !automatic} onPress={() => void notices.enable()} />}
    <ActionButton title="TEST NOTIFICATION" secondary disabled={!notices.ready || notices.busy || !notices.supported || mode === "demo"} onPress={() => void notices.test()} />
    <Body>PAUSE / DEMO · MANUAL FEEDS · APP CLOSED · GPS STALE (2 MIN)</Body>
    <Body>MANUAL POINT / STOPS FOLLOW</Body>
    <Body>CLOUD PUSH / NOT CONFIGURED. No closed-app alerts yet.</Body>
    {notices.lastNotice && <Body>{notices.lastNotice}</Body>}
    {notices.error && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Body>{notices.error}</Body></View>}
  </Panel>;
}
