import { useEffect, useRef, useState } from "react";
import { Modal, Share, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEMO_DATE_LABEL } from "@/data/demo";
import { validCoordinates } from "@/domain/alerts";
import type { SelectedLocation } from "@/domain/types";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle } from "@/ui/components";
import { colors, typography } from "@/ui/tokens";

type LocationSource = "demo" | "live" | "cached" | "unavailable";
type ReviewedPoint = { location: SelectedLocation; source: LocationSource };

function shareMessage({ location, source }: ReviewedPoint): string {
  const { latitude, longitude } = location.coordinates;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  const provenance = source === "demo"
    ? ["SIMULATED LOCATION / TRAINING ONLY", DEMO_DATE_LABEL, "Fictional exercise point. This is not my actual position."]
    : location.kind === "gps"
      ? ["GPS / LAST SELECTED POINT", "These are last selected GPS coordinates. My current position has not been rechecked."]
      : ["MANUAL / SELECTED POINT", "This is a manually selected point, not a GPS reading of my current position."];
  return [
    ...provenance,
    `Point: ${location.label}`,
    `Latitude: ${latitude}`,
    `Longitude: ${longitude}`,
    mapsUrl,
  ].join("\n");
}

/** Sharing reviews a copy of one selected point; it never requests a new position. */
export function ShareLocation({ selectedLocation, source }: {
  selectedLocation: SelectedLocation | null;
  source: LocationSource;
}) {
  const [reviewedPoint, setReviewedPoint] = useState<ReviewedPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const operation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => () => { operation.current += 1; }, []);

  function openReview() {
    if (!selectedLocation || !validCoordinates(selectedLocation.coordinates) || inFlight.current) return;
    operation.current += 1;
    // Keep the reviewed payload stable if the selected point or alert mode changes.
    setReviewedPoint({
      source,
      location: { ...selectedLocation, coordinates: { ...selectedLocation.coordinates } },
    });
    setStatus(null);
    setBusy(false);
  }
  function closeReview() {
    operation.current += 1;
    inFlight.current = false;
    setReviewedPoint(null);
    setBusy(false);
    setStatus(null);
  }
  async function openShareSheet() {
    if (!reviewedPoint || inFlight.current) return;
    inFlight.current = true;
    const ticket = ++operation.current;
    setBusy(true);
    setStatus(null);
    try {
      const result = await Share.share(
        { title: reviewedPoint.source === "demo" ? "SIMULATED LOCATION / TRAINING ONLY" : "Selected location", message: shareMessage(reviewedPoint) },
        { dialogTitle: "Share selected location", subject: reviewedPoint.source === "demo" ? "SIMULATED LOCATION / TRAINING ONLY" : "Selected location" },
      );
      if (ticket !== operation.current) return;
      // Android reports sharedAction even after dismissal; never infer delivery.
      setStatus(result.action === Share.dismissedAction
        ? "Sharing cancelled."
        : "Share sheet closed. Confirm delivery in the app you chose.");
    } catch {
      if (ticket === operation.current) setStatus("Share sheet could not open. Retry or cancel.");
    } finally {
      if (ticket === operation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <>
      <ActionButton
        testID="share-location"
        title="Share location"
        onPress={openReview}
        secondary
        disabled={!selectedLocation || !validCoordinates(selectedLocation.coordinates)}
      />
      <Modal
        testID="share-location-review"
        visible={!!reviewedPoint}
        animationType="none"
        presentationStyle="fullScreen"
        onRequestClose={closeReview}
      >
        {reviewedPoint && (
          <SafeAreaView edges={["bottom"]} style={s.safe}>
            <Screen>
              <ActionButton title="Cancel location sharing" onPress={closeReview} secondary />
              <Text style={s.kicker}>SHARE / SELECTED POINT</Text>
              <Heading>REVIEW LOCATION.</Heading>
              <Body>Check the point. Choose a recipient in the system share sheet.</Body>
              <Panel>
                <SectionTitle>MESSAGE / EXACT COPY</SectionTitle>
                <Text selectable style={s.message}>{shareMessage(reviewedPoint)}</Text>
              </Panel>
              <Body>
                This shares the selected point only. It does not recheck GPS or send warnings, contacts, or location history.
              </Body>
              <ActionButton
                title={busy ? "Opening share sheet…" : "Open share sheet"}
                onPress={() => void openShareSheet()}
                disabled={busy}
              />
              {status && <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>}
            </Screen>
          </SafeAreaView>
        )}
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kicker: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  message: { color: colors.ink, fontFamily: typography.body, fontSize: 16, lineHeight: 26 },
  status: { color: colors.yellow, fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24 },
});
