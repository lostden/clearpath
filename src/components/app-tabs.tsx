import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "@/ui/tokens";
import { useAppState } from "@/state/AppState";
import { useAlerts } from "@/hooks/useAlerts";
import { useFeedPreferences } from "@/state/FeedPreferences";
import { EmergencyControl } from "@/ui/components";

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      aria-selected={!!isFocused}
      style={[styles.button, isFocused && styles.activeButton]}
    >
      <Text style={[styles.label, isFocused && styles.selected]}>
        {children}
      </Text>
    </Pressable>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useAppState();
  const feed = useAlerts();
  const { automatic, ready } = useFeedPreferences();
  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.content} />
      <View testID="shared-status-strip" style={[styles.statusStrip, mode === "demo" && styles.demoStrip]}>
        <View style={[styles.statusCopy, mode === "demo" && styles.demoCopy]}>
        {mode === "demo" ? <Text style={[styles.demoLabel, styles.darkText]}>SIMULATED DEMO</Text> : <>
          {ready && !automatic && <Text style={[styles.demoLabel, styles.manual]}>FEEDS / MANUAL REFRESH</Text>}
          <Text style={styles.demoLabel}>
            {feed.source === "cached"
              ? "POINT ALERTS / CACHED · UNVERIFIED"
              : feed.source === "live"
                ? "POINT ALERTS / NWS VERIFIED COPY"
                : feed.isLoading
                  ? "POINT ALERTS / CHECKING NWS…"
                  : "POINT ALERTS / UNVERIFIED"}
          </Text>
        </>}
        </View>
        {mode === "demo" && <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit demo and return to live mode"
          onPress={() => setMode("live")}
          style={styles.exit}
        >
          <Text style={styles.exitText}>EXIT →</Text>
        </Pressable>}
        <EmergencyControl />
      </View>
      <TabList
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <TabTrigger name="home" href="/" asChild>
          <TabButton>Home</TabButton>
        </TabTrigger>
        <TabTrigger name="map" href="/map" asChild>
          <TabButton>Map</TabButton>
        </TabTrigger>
        <TabTrigger name="prepare" href="/prepare" asChild>
          <TabButton>Prepare</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.line,
    flexDirection: "row",
    paddingTop: 0,
  },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "stretch",
  },
  activeButton: { backgroundColor: colors.orange },
  label: {
    fontSize: 15,
    fontFamily: typography.bodyStrong,
    color: colors.ink,
    alignSelf: "stretch",
    textAlign: "center",
    flexShrink: 0,
    textTransform: "uppercase",
  },
  selected: {
    color: colors.background,
  },
  statusStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: colors.blueWash,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
  statusCopy: { flexBasis: 140, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: "100%" },
  demoCopy: { flexBasis: 96 },
  demoStrip: { backgroundColor: colors.yellow },
  demoLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.bodyStrong,
    letterSpacing: 0.1,
  },
  darkText: { color: colors.background },
  manual: { color: colors.orange, marginBottom: 4 },
  exit: { minHeight: 52, minWidth: 52, maxWidth: "100%", justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  exitText: { color: colors.background, fontSize: 13, fontFamily: typography.bodyStrong, flexShrink: 1 },
});
