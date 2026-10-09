import { Modal } from "react-native";
import { useEffect, useState } from "react";
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
}: {
  alert: OfficialAlert | null;
  source: AlertSelection["source"];
  onClose: () => void;
  fetchedAt?: string | null;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(alert.expires) - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [alert]);
  return (
    <Modal
      visible={!!alert}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      {alert && (
        <Screen>
          <ActionButton title="Close warning" onPress={onClose} secondary />
          <SourceBadge source={source} />
          {Date.parse(alert.expires) <= now && (
            <Panel>
              <SectionTitle>This warning has expired.</SectionTitle>
              <Body>
                Read this as a historical snapshot. Follow current official
                instructions.
              </Body>
            </Panel>
          )}
          {fetchedAt && (
            <Body>
              Warning copy retrieved: {new Date(fetchedAt).toLocaleString()}
            </Body>
          )}
          <Heading>{alert.event}</Heading>
          <Body>{alert.headline}</Body>
          <Panel>
            <SectionTitle>Original instructions</SectionTitle>
            <Body>
              {alert.instruction ||
                "No instructions were supplied with this warning."}
            </Body>
          </Panel>
          <SectionTitle>Full warning text</SectionTitle>
          <Body>{alert.description}</Body>
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
          {alert.sourceUrl && (
            <ActionButton
              title="Open official NWS source"
              onPress={() => void openLink(alert.sourceUrl!)}
            />
          )}
        </Screen>
      )}
    </Modal>
  );
}
