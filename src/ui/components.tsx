import { type PropsWithChildren, type ReactNode } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AlertButton,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography } from "./tokens";

export function Screen({
  children,
  header,
  ...props
}: PropsWithChildren<ScrollViewProps & { header?: ReactNode }>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {header != null && <View style={styles.screenHeader}>{header}</View>}
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
      <Text style={styles.brandText}>CLEARPATH</Text>
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
        source === "demo" && { backgroundColor: colors.yellow, borderColor: colors.yellow },
        source === "cached" && { borderColor: colors.yellow },
        source === "unavailable" && { borderColor: colors.orange },
      ]}
    >
      <Text accessibilityLabel={labels[source]} style={[styles.badgeText, source === "demo" && { color: colors.background }]}>
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
        pressed && { borderColor: colors.yellow },
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[styles.buttonText, (secondary || disabled) && { color: colors.ink }]}>
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
export function confirmAction({ title, message, confirmLabel, onConfirm, destructive = false }: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  if (Platform.OS === "web") {
    // Browser dialogs return false when cancelled or suppressed. Never perform
    // the action during server rendering or without an explicit OK response.
    if (typeof window !== "undefined" && typeof window.confirm === "function" &&
        window.confirm(`${title}\n\n${message}\n\nOK: ${confirmLabel}`)) {
      onConfirm();
    }
    return;
  }
  const confirm: AlertButton = { text: confirmLabel, onPress: onConfirm };
  if (destructive) confirm.style = "destructive";
  Alert.alert(
    title,
    message,
    [{ text: "Cancel", style: "cancel" }, confirm],
  );
}
export function confirmCall(number: string, label = number) {
  confirmAction({
    title: `Call ${label}?`,
    message: "This will open your phone dialer. You must confirm the call on your device.",
    confirmLabel: "Open dialer",
    onConfirm: () => { void openLink(`tel:${number}`); },
  });
}
export function EmergencyButton() {
  return (
    <View style={styles.hardShadow}>
    <ActionButton
      title="GET HELP · CALL 911"
      onPress={() => confirmCall("911")}
    />
    </View>
  );
}
export function EmergencyControl() {
  return <Pressable
    testID="shared-emergency-control"
    accessibilityRole="button"
    accessibilityLabel="Emergency? Call 911"
    onPress={() => confirmCall("911")}
    style={({ pressed }) => [styles.emergencyControl, pressed && { borderColor: colors.yellow }]}
  >
    <Text style={styles.emergencyLabel}>GET HELP</Text>
    <Text style={styles.emergencyNumber}>911</Text>
  </Pressable>;
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screenHeader: {
    padding: 18,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 18,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 32,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, maxWidth: "100%" },
  mark: {
    backgroundColor: colors.orange,
    height: 32,
    width: 32,
    flexShrink: 0,
    borderRadius: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  stroke: {
    width: 4,
    height: 20,
    borderRadius: 0,
    backgroundColor: colors.background,
    transform: [{ rotate: "25deg" }],
  },
  brandText: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: typography.heading,
    letterSpacing: -0.9,
    flexShrink: 1,
  },
  heading: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 39,
    fontFamily: typography.heading,
    letterSpacing: -1.1,
    textTransform: "uppercase",
  },
  body: { color: colors.secondary, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontFamily: typography.heading, fontSize: 19, lineHeight: 25, letterSpacing: -0.4, textTransform: "uppercase" },
  panel: {
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 0,
    gap: 12,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.cautionWash,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.line,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.bodyStrong,
    letterSpacing: 0.2,
  },
  button: {
    minHeight: 52,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.orange,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  disabledButton: { backgroundColor: "#303030", borderColor: "#888888" },
  hardShadow: { backgroundColor: colors.ink, paddingRight: 4, paddingBottom: 4 },
  emergencyControl: {
    minWidth: 104,
    minHeight: 52,
    maxWidth: "100%",
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "stretch",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  emergencyLabel: { color: colors.background, fontFamily: typography.bodyStrong, fontSize: 12, lineHeight: 18, textAlign: "center", alignSelf: "stretch", flexShrink: 0 },
  emergencyNumber: { color: colors.background, fontFamily: typography.heading, fontSize: 22, lineHeight: 26, textAlign: "center", alignSelf: "stretch", flexShrink: 0 },
  buttonText: {
    color: colors.background,
    fontSize: 15,
    fontFamily: typography.bodyStrong,
    lineHeight: 21,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
