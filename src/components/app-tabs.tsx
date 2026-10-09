import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/ui/tokens";
import { useAppState } from "@/state/AppState";
import { useAlerts } from "@/hooks/useAlerts";

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      aria-selected={!!isFocused}
      style={styles.button}
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
          <Text style={styles.demoLabel}>SIMULATED DEMO</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit demo and return to live mode"
            onPress={() => setMode("live")}
            style={styles.exit}
          >
            <Text style={styles.exitText}>Exit demo →</Text>
          </Pressable>
        </View>
      )}
      {mode === "live" && (
        <View style={styles.liveBar}>
          <Text style={styles.demoLabel}>
            {feed.source === "cached"
              ? "CACHED · NOT VERIFIED CURRENT"
              : feed.source === "live"
                ? "OFFICIAL NWS · LAST VERIFIED SNAPSHOT"
                : feed.isLoading
                  ? "CHECKING OFFICIAL ALERTS…"
                  : "CURRENT ALERTS UNVERIFIED"}
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
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    paddingTop: 8,
  },
  button: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selected: {
    color: colors.ink,
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  demoBar: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.cautionWash,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  demoLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  exit: { minHeight: 48, justifyContent: "center", paddingHorizontal: 6 },
  exitText: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  liveBar: {
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.blueWash,
  },
});
