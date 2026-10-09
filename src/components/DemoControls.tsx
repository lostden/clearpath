import { Text, Pressable, StyleSheet, View } from "react-native";
import { useAppState } from "@/state/AppState";
import type { DemoScenario } from "@/domain/types";
import { ActionButton, Body } from "@/ui/components";
import { colors } from "@/ui/tokens";
const scenarios: { id: DemoScenario; label: string }[] = [
  { id: "flood", label: "Flood" },
  { id: "tornado", label: "Tornado" },
  { id: "normal", label: "No alerts" },
  { id: "offline", label: "Outage" },
];
export function DemoControls() {
  const { mode, setMode, scenario, setScenario } = useAppState();
  return mode === "demo" ? (
    <View style={s.container}>
      <View style={s.options}>
        {scenarios.map((option) => (
          <Pressable
            testID={`demo-${option.id}`}
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Simulate ${option.label}`}
            accessibilityState={{ selected: option.id === scenario }}
            onPress={() => setScenario(option.id)}
            style={[s.option, option.id === scenario && s.selected]}
          >
            <Text
              style={[
                s.text,
                option.id === scenario && { color: colors.surface },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ActionButton
        testID="mode-live"
        title="Return to live mode"
        onPress={() => setMode("live")}
        secondary
      />
    </View>
  ) : (
    <View style={s.container}>
      <Body>
        Demo scenarios use local fixtures and are separate from official feeds.
      </Body>
      <ActionButton
        title="Explore simulated demo"
        onPress={() => setMode("demo")}
        secondary
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.navy },
  text: { fontSize: 13, fontWeight: "600", color: colors.ink },
});
