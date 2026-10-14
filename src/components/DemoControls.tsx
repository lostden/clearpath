import { Text, Pressable, StyleSheet, View } from "react-native";
import { useAppState } from "@/state/AppState";
import type { DemoScenario } from "@/domain/types";
import { ActionButton, Body } from "@/ui/components";
import { colors, typography } from "@/ui/tokens";
import { getDemoScenarioDescription } from "@/data/demo";
const scenarios: { id: DemoScenario; label: string }[] = [
  { id: "frisco", label: "North Texas flood" },
  { id: "flood", label: "Flood" },
  { id: "tornado", label: "Tornado" },
  { id: "normal", label: "No alerts" },
  { id: "offline", label: "Outage" },
];
export function DemoControls() {
  const { mode, setMode, scenario, setScenario } = useAppState();
  return mode === "demo" ? (
    <View style={s.container}>
      <Text style={s.label}>SIMULATION / SCENARIO</Text>
      <Body>Local fixtures. No current emergency is represented.</Body>
      <Body>{getDemoScenarioDescription(scenario)}</Body>
      <View style={s.options}>
        {scenarios.map((option) => (
          <Pressable
            testID={`demo-${option.id}`}
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Simulate ${option.label}`}
            accessibilityState={{ selected: option.id === scenario }}
            onPress={() => setScenario(option.id)}
            style={({ pressed }) => [s.option, option.id === scenario && s.selected, pressed && s.pressed]}
          >
            <Text
              style={[
                s.text,
                option.id === scenario && { color: colors.background },
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
        Demo scenarios use local fixtures. They remain separate from official feeds.
      </Body>
      <ActionButton
        title="Explore simulated demo"
        onPress={() => { setScenario("frisco"); setMode("demo"); }}
        secondary
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 12, borderTopWidth: 2, borderTopColor: colors.line, paddingTop: 20 },
  label: { color: colors.yellow, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22, letterSpacing: 0.5 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.orange, borderColor: colors.orange },
  pressed: { borderColor: colors.yellow },
  text: { fontSize: 16, lineHeight: 24, fontFamily: typography.bodyStrong, color: colors.ink, textTransform: "uppercase" },
});
