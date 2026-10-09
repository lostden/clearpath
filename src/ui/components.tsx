import { type PropsWithChildren } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./tokens";

export function Screen({
  children,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        {...props}
        contentContainerStyle={[styles.content, props.contentContainerStyle]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Brand() {
  return (
    <View style={styles.brand}>
      <View accessibilityElementsHidden style={styles.mark}>
        <View style={styles.stroke} />
        <View style={[styles.stroke, { height: 12 }]} />
      </View>
      <Text style={styles.brandText}>ClearPath</Text>
    </View>
  );
}
export function SourceBadge({
  source = "demo",
}: {
  source?: "demo" | "cached" | "live" | "unavailable";
}) {
  const labels = {
    demo: "SIMULATED DEMO",
    cached: "CACHED · NOT VERIFIED CURRENT",
    live: "LIVE · OFFICIAL NWS",
    unavailable: "CURRENT DATA UNAVAILABLE",
  };
  return (
    <View
      style={[
        styles.badge,
        source === "live" && { backgroundColor: colors.blueWash },
      ]}
    >
      <Text accessibilityLabel={labels[source]} style={styles.badgeText}>
        {labels[source]}
      </Text>
    </View>
  );
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}
export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}
export function Panel({ children }: PropsWithChildren) {
  return <View style={styles.panel}>{children}</View>;
}
export function ActionButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Could not open link",
      "Please try again or open the resource using your browser.",
    );
  }
}
export function confirmCall(number: string, label = number) {
  Alert.alert(
    `Call ${label}?`,
    "This will open your phone dialer. You must confirm the call on your device.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open dialer",
        onPress: () => {
          void openLink(`tel:${number}`);
        },
      },
    ],
  );
}
export function EmergencyButton() {
  return (
    <ActionButton
      title="Emergency? Call 911"
      secondary
      onPress={() => confirmCall("911")}
    />
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    gap: 18,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 32,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    backgroundColor: colors.navy,
    height: 32,
    width: 32,
    borderRadius: 9,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  stroke: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: "white",
    transform: [{ rotate: "25deg" }],
  },
  brandText: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heading: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.9,
  },
  body: { color: colors.secondary, fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "600" },
  panel: {
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    gap: 12,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.cautionWash,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
