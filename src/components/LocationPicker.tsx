import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  manualLocation,
  requestDeviceLocation,
  texasLocations,
} from "@/services/location";
import { useAppState } from "@/state/AppState";
import type { SelectedLocation } from "@/domain/types";
import {
  ActionButton,
  Body,
  Heading,
  Panel,
  Screen,
  SectionTitle,
} from "@/ui/components";
import { colors, typography } from "@/ui/tokens";
export function LocationPicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return visible ? <LocationPickerSession onClose={onClose} /> : null;
}
function LocationPickerSession({ onClose }: { onClose: () => void }) {
  const { setLocation, setLocationError, setMode } = useAppState();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  function cancelGps() {
    request.current += 1;
    setLoading(false);
    setError(null);
  }
  function close() {
    cancelGps();
    onClose();
  }
  function select(location: SelectedLocation) {
    setLocation(location);
    setLocationError(null);
    setMode("live");
    setError(null);
    setManualError(null);
    onClose();
  }
  async function gps() {
    const ticket = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const location = await requestDeviceLocation();
      if (request.current === ticket) select(location);
    } catch (cause) {
      if (request.current === ticket) {
        const message =
          cause instanceof Error
            ? cause.message
            : "GPS is unavailable. Choose a manual location.";
        setError(message);
        setLocationError(message);
      }
    } finally {
      if (request.current === ticket) setLoading(false);
    }
  }
  return (
    <Modal
      testID="location-picker"
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <SafeAreaView edges={["bottom"]} style={s.modalSafe}>
      <Screen header={
        <ActionButton title="Close location selector" onPress={close} secondary />
      }>
        <Text style={s.kicker}>LOCATION / POINT SELECTOR</Text>
        <Heading>SELECT POINT.</Heading>
        <Body>
          Choose GPS or a manual point. Live requests send these coordinates
          directly to the National Weather Service. Permission is requested only
          when you tap GPS.
        </Body>
        <ActionButton
          testID="location-gps"
          title={loading ? "Finding your GPS point…" : "Use foreground GPS"}
          onPress={() => void gps()}
          disabled={loading}
        />
        <Body>
          GPS is a single foreground reading. It does not track you in the
          background.
        </Body>
        {loading && <ActionButton title="Cancel GPS request" secondary onPress={cancelGps} />}
        {error && (
          <Panel>
            <View accessibilityLiveRegion="polite" aria-live="polite"><Body>{error}</Body></View>
          </Panel>
        )}
        <SectionTitle>TEXAS / REFERENCE POINTS</SectionTitle>
        <Body>
          City reference points check one point. Your address may have different
          warnings.
        </Body>
        {texasLocations.map((location) => (
          <Pressable
            key={location.label}
            accessibilityRole="button"
            accessibilityLabel={`Select ${location.label}`}
            disabled={loading}
            onPress={() => select(location)}
            style={({ pressed }) => [s.city, pressed && s.pressedCity]}
          >
            <View style={s.cityHeader}>
              <Text style={s.cityTitle}>{location.label}</Text>
              <Text accessibilityElementsHidden style={s.arrow}>→</Text>
            </View>
            <Text style={s.cityDetail}>
              {location.coordinates.latitude}, {location.coordinates.longitude}
            </Text>
          </Pressable>
        ))}
        <SectionTitle>MANUAL / COORDINATES</SectionTitle>
        <Text style={s.inputLabel}>POINT LABEL</Text>
        <TextInput
          accessibilityLabel="Location label"
          style={[s.input, focusedField === "label" && s.inputFocused]}
          onFocus={() => setFocusedField("label")}
          onBlur={() => setFocusedField(null)}
          selectionColor={colors.orange}
          placeholder="Optional name"
          placeholderTextColor={colors.secondary}
          value={label}
          onChangeText={setLabel}
          maxLength={80}
        />
        <Text style={s.inputLabel}>LATITUDE</Text>
        <TextInput
          testID="location-manual-latitude"
          accessibilityLabel="Latitude"
          style={[s.input, focusedField === "latitude" && s.inputFocused]}
          onFocus={() => setFocusedField("latitude")}
          onBlur={() => setFocusedField(null)}
          selectionColor={colors.orange}
          placeholder="Latitude, for example 30.0474"
          placeholderTextColor={colors.secondary}
          keyboardType="numbers-and-punctuation"
          value={latitude}
          onChangeText={setLatitude}
        />
        <Text style={s.inputLabel}>LONGITUDE</Text>
        <TextInput
          testID="location-manual-longitude"
          accessibilityLabel="Longitude"
          style={[s.input, focusedField === "longitude" && s.inputFocused]}
          onFocus={() => setFocusedField("longitude")}
          onBlur={() => setFocusedField(null)}
          selectionColor={colors.orange}
          placeholder="Longitude, for example -99.1403"
          placeholderTextColor={colors.secondary}
          keyboardType="numbers-and-punctuation"
          value={longitude}
          onChangeText={setLongitude}
        />
        {manualError && <View testID="location-manual-error" accessibilityLiveRegion="polite" aria-live="polite"><Body>{manualError}</Body></View>}
        <ActionButton
          testID="location-manual-save"
          title="Use these coordinates"
          disabled={loading}
          onPress={() => {
            try {
              select(manualLocation(latitude, longitude, label));
            } catch (cause) {
              setManualError(
                cause instanceof Error
                  ? cause.message
                  : "Check the coordinates.",
              );
            }
          }}
        />
        <Body>
          Coordinates can be outside Texas. NWS data coverage is limited to its
          supported areas. No warning results establish personal safety.
        </Body>
      </Screen>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: colors.background },
  kicker: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22, letterSpacing: 0.5 },
  city: {
    minHeight: 76,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    gap: 8,
  },
  pressedCity: { backgroundColor: colors.background, borderColor: colors.orange },
  cityHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cityTitle: { flex: 1, color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24, textTransform: "uppercase" },
  cityDetail: { color: colors.secondary, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  arrow: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 24, lineHeight: 30 },
  inputLabel: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24 },
  input: {
    minHeight: 56,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
  inputFocused: { borderColor: colors.orange },
});
