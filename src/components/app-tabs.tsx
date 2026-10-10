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
  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.content} />
      {mode === "demo" && (
        <View style={styles.demoBar}>
          <Text style={[styles.demoLabel, styles.darkText]}>SIMULATED DEMO</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit demo and return to live mode"
            onPress={() => setMode("live")}
            style={styles.exit}
          >
            <Text style={styles.exitText}>EXIT →</Text>
          </Pressable>
        </View>
      )}
      {mode === "live" && (
        <View style={styles.liveBar}>
          <Text style={styles.demoLabel}>
            {feed.source === "cached"
              ? "POINT ALERTS / CACHED · UNVERIFIED"
              : feed.source === "live"
                ? "POINT ALERTS / NWS VERIFIED COPY"
                : feed.isLoading
                  ? "POINT ALERTS / CHECKING NWS…"
                  : "POINT ALERTS / UNVERIFIED"}
          </Text>
        </View>
      )}
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
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  activeButton: { backgroundColor: colors.orange },
  label: {
    fontSize: 15,
    fontFamily: typography.bodyStrong,
    color: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 14,
    textTransform: "uppercase",
  },
  selected: {
    color: colors.background,
  },
  demoBar: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.yellow,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
  demoLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.bodyStrong,
    letterSpacing: 0.1,
  },
  darkText: { color: colors.background },
  exit: { minHeight: 48, justifyContent: "center", paddingHorizontal: 6 },
  exitText: { color: colors.background, fontSize: 13, fontFamily: typography.bodyStrong },
  liveBar: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderTopWidth: 2,
    borderTopColor: colors.line,
    backgroundColor: colors.blueWash,
  },
});
