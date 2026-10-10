import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Panel, SectionTitle } from "@/ui/components";
import { useFeedPreferences } from "@/state/FeedPreferences";
import { colors, typography } from "@/ui/tokens";

export function FeedUpdateControl() {
  const { automatic, ready, storageError, setAutomatic } = useFeedPreferences();
  return <Panel>
    <View style={s.row}>
      <View style={s.title}><SectionTitle>Auto updates</SectionTitle></View>
      <Pressable accessibilityRole="switch" accessibilityLabel="Automatic feed updates" accessibilityState={{ checked: automatic, disabled: !ready }} aria-checked={automatic} disabled={!ready} onPress={() => setAutomatic(!automatic)} style={[s.switch, automatic && s.active]}>
        <Text style={[s.label, automatic && s.dark]}>{automatic ? "ON" : "OFF"}</Text>
      </Pressable>
    </View>
    {!ready ? <Body>Loading saved update mode.</Body> : automatic ?
      <Body>Weather and earthquakes: 60s. Rivers: 5min. Foreground only.</Body> :
      <Body>MANUAL MODE / Tap Refresh for each feed. New updates are not checked automatically.</Body>}
    <Body>Map tiles, zone downloads and links still use data.</Body>
    {storageError && <Body>{storageError}</Body>}
  </Panel>;
}
const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
  title: { flex: 1 },
  switch: { minHeight: 52, minWidth: 64, padding: 10, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: colors.orange, borderColor: colors.orange },
  label: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 15, lineHeight: 22 },
  dark: { color: colors.background },
});
