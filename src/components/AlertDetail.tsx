import { Modal, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OfficialAlert } from "@/domain/types";
import {
  ActionButton,
  Body,
  Heading,
  Panel,
  Screen,
  SectionTitle,
  SourceBadge,
  openLink,
} from "@/ui/components";
import { colors, typography } from "@/ui/tokens";
import { DEMO_TIMESTAMP } from "@/data/demo";
export type AlertSelection = {
  alert: OfficialAlert;
  source: "live" | "cached" | "demo" | "unavailable";
  fetchedAt: string | null;
};
export function detailSource(
  selection: AlertSelection | null,
  source: AlertSelection["source"],
  fetchedAt: string | null,
): AlertSelection["source"] {
  if (selection?.source === "demo") return "demo";
  return selection &&
    selection.source === "live" &&
    source === "live" &&
    fetchedAt === selection.fetchedAt
    ? "live"
    : "cached";
}
export function AlertDetail({
  alert,
  source,
  onClose,
  fetchedAt,
  onViewZoneAreas,
}: {
  alert: OfficialAlert | null;
  source: AlertSelection["source"];
  onClose: () => void;
  fetchedAt?: string | null;
  onViewZoneAreas?: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!alert || source === "demo") return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(alert.expires) - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [alert, source]);
  const displayTime = source === "demo" ? DEMO_TIMESTAMP : now;
  return (
    <Modal
      visible={!!alert}
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      {alert && (
        <SafeAreaView edges={["bottom"]} style={s.modalSafe}>
        <Screen>
          <ActionButton title="Close warning" onPress={onClose} secondary />
          <Text style={s.kicker}>WARNING / SOURCE COPY</Text>
          <SourceBadge source={source} />
          {Date.parse(alert.expires) <= displayTime && (
            <View style={s.expired}>
              <SectionTitle>This warning has expired.</SectionTitle>
              <Body>
                Read this as a historical snapshot. Follow current official
                instructions.
              </Body>
            </View>
          )}
          {fetchedAt && (
            <Body>
              Warning copy retrieved: {new Date(fetchedAt).toLocaleString()}
            </Body>
          )}
          <Heading>{alert.event}</Heading>
          <Body>{alert.headline}</Body>
          <Panel>
            <SectionTitle>{source === "demo" ? "SIMULATED INSTRUCTIONS" : "Original instructions"}</SectionTitle>
            <Body>
              {alert.instruction ||
                "No instructions were supplied with this warning."}
            </Body>
          </Panel>
          <SectionTitle>{source === "demo" ? "SIMULATED WARNING TEXT" : "Full warning text"}</SectionTitle>
          <Body>{alert.description}</Body>
          <SectionTitle>ISSUANCE / TIMES</SectionTitle>
          <Panel>
          <Body>Agency: {alert.agency}</Body>
          <Body>
            Severity: {alert.severity} · Urgency: {alert.urgency} · Certainty:{" "}
            {alert.certainty}
          </Body>
          <Body>Sent: {new Date(alert.sent).toLocaleString()}</Body>
          <Body>
            Onset:{" "}
            {alert.onset
              ? new Date(alert.onset).toLocaleString()
              : "Not provided"}
          </Body>
          <Body>Expires: {new Date(alert.expires).toLocaleString()}</Body>
          </Panel>
          {alert.sourceUrl && (
            <ActionButton
              title="Open official NWS source"
              onPress={() => void openLink(alert.sourceUrl!)}
            />
          )}
          {source !== "demo" && !!alert.affectedZones?.length && onViewZoneAreas && <>
            <SectionTitle>NWS / Zone boundaries</SectionTitle>
            <Body>Optional downloads of linked NWS zones. Zone boundaries are not supplied warning polygons or measured flood extent.</Body>
            <ActionButton title="View NWS zone areas" secondary disabled={source !== "live" || Date.parse(alert.expires) <= displayTime} onPress={onViewZoneAreas} />
          </>}
        </Screen>
        </SafeAreaView>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: colors.background },
  kicker: {
    color: colors.orange,
    fontFamily: typography.bodyStrong,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  expired: {
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: colors.background,
    padding: 20,
    gap: 12,
  },
});
