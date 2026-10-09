import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput } from "react-native";
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
import { colors } from "@/ui/tokens";
export function LocationPicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { setLocation, setLocationError, setMode } = useAppState();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    if (!visible) request.current += 1;
  }, [visible]);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  function close() {
    request.current += 1;
    setLoading(false);
    onClose();
  }
  function select(location: SelectedLocation) {
    setLocation(location);
    setLocationError(null);
    setMode("live");
    setError(null);
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
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <Screen>
        <ActionButton
          title="Close location selector"
          onPress={close}
          secondary
        />
        <Heading>Where should we check?</Heading>
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
        {error && (
          <Panel>
            <Body>{error}</Body>
          </Panel>
        )}
        <SectionTitle>Texas city centers</SectionTitle>
        <Body>
          City centers check one point. Your address may have different
          warnings.
        </Body>
        {texasLocations.map((location) => (
          <Pressable
            key={location.label}
            accessibilityRole="button"
            accessibilityLabel={`Select ${location.label}`}
            disabled={loading}
            onPress={() => select(location)}
            style={s.city}
          >
            <Text style={s.cityTitle}>{location.label}</Text>
            <Text style={s.cityDetail}>
              {location.coordinates.latitude}, {location.coordinates.longitude}{" "}
              →
            </Text>
          </Pressable>
        ))}
        <SectionTitle>Enter a precise point</SectionTitle>
        <TextInput
          accessibilityLabel="Location label"
          style={s.input}
          placeholder="Optional name"
          placeholderTextColor={colors.secondary}
          value={label}
          onChangeText={setLabel}
          maxLength={80}
        />
        <TextInput
          testID="location-manual-latitude"
          accessibilityLabel="Latitude"
          style={s.input}
          placeholder="Latitude, for example 30.0474"
          placeholderTextColor={colors.secondary}
          keyboardType="numbers-and-punctuation"
          value={latitude}
          onChangeText={setLatitude}
        />
        <TextInput
          testID="location-manual-longitude"
          accessibilityLabel="Longitude"
          style={s.input}
          placeholder="Longitude, for example −99.1403"
          placeholderTextColor={colors.secondary}
          keyboardType="numbers-and-punctuation"
          value={longitude}
          onChangeText={setLongitude}
        />
        <ActionButton
          testID="location-manual-save"
          title="Use these coordinates"
          disabled={loading}
          onPress={() => {
            try {
              select(manualLocation(latitude, longitude, label));
            } catch (cause) {
              setError(
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
    </Modal>
  );
}
const s = StyleSheet.create({
  city: {
    minHeight: 60,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  cityTitle: { color: colors.ink, fontSize: 16 },
  cityDetail: { color: colors.secondary, fontSize: 13 },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 14,
    color: colors.ink,
    fontSize: 16,
  },
});
