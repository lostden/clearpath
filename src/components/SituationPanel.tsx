import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OfficialAlert } from "@/domain/types";
import {
  ActionButton,
  Body,
  Panel,
  SectionTitle,
  SourceBadge,
} from "@/ui/components";
import { colors, typography } from "@/ui/tokens";

type Props = {
  alerts: OfficialAlert[];
  source: "live" | "cached" | "demo" | "unavailable";
  loading?: boolean;
  error?: boolean;
  onOpenAlert: (alert: OfficialAlert) => void;
  priorityExplanations?: ReadonlyMap<string, string>;
};
export function SituationPanel({
  alerts,
  source,
  loading = false,
  error = false,
  onOpenAlert,
  priorityExplanations,
}: Props) {
  const first = alerts[0];
  const cached = source === "cached";
  return (
    <View style={s.container}>
      <SourceBadge source={source} />
      {loading && <Body>Checking official NWS alerts…</Body>}
      {(error || (source === "unavailable" && !loading)) && (
        <Panel>
          <SectionTitle>Unable to verify current alerts.</SectionTitle>
          <Body>
            Check local emergency authorities and try refreshing when a
            connection is available.
          </Body>
        </Panel>
      )}
      {cached && (
        <Body>
          Saved alerts · not verified current. These may have changed since the
          last successful update.
        </Body>
      )}
      {!first && !loading && source !== "unavailable" && (!error || cached) && (
        <Panel>
          <SectionTitle>
            {cached
              ? "No warnings retained in this saved snapshot. Current alerts are unverified."
              : source === "demo"
                ? "No active alerts in this simulated scenario."
                : "No active official alerts found for this location."}
          </SectionTitle>
          <Body>
            Missing alerts do not establish personal safety. Follow local
            emergency authorities.
          </Body>
        </Panel>
      )}
      {first && (
        <View
          style={[
            s.warning,
            {
              borderLeftColor:
                first.severity === "Extreme" || first.severity === "Severe"
                  ? colors.danger
                  : colors.caution,
            },
          ]}
        >
          <View style={s.row}>
            <Text style={s.event}>{first.event}</Text>
            <Text
              style={[
                s.severity,
                {
                  backgroundColor:
                    first.severity === "Extreme" || first.severity === "Severe"
                      ? colors.orange
                      : colors.yellow,
                },
              ]}
            >
              {first.severity}
            </Text>
          </View>
          <Text accessibilityRole="header" style={s.headline}>
            {first.headline || first.event}
          </Text>
          <Text style={s.agency}>{first.agency}</Text>
          {priorityExplanations?.get(first.id) && <Body>
            {priorityExplanations.get(first.id)!.split(". ")[0]}. Urgency {first.urgency}; severity {first.severity}; certainty {first.certainty}.
          </Body>}
          <View style={s.instruction}>
            <Text style={s.instructionLabel}>
              {source === "demo"
                ? "SIMULATED INSTRUCTIONS"
                : "ISSUING AGENCY INSTRUCTIONS"}
            </Text>
            <Text style={s.instructionText}>
              {first.instruction ||
                "No instructions were supplied with this warning. Read the original warning and follow local emergency authorities."}
            </Text>
          </View>
          <Body>Expires {new Date(first.expires).toLocaleString()}</Body>
          <ActionButton
            title={
              source === "demo"
                ? "Read simulated warning"
                : "Read full original warning"
            }
            onPress={() => onOpenAlert(first)}
          />
        </View>
      )}
      {alerts.length > 1 && (
        <View style={s.more}>
          <SectionTitle>
            {alerts.length - 1} additional{" "}
            {alerts.length === 2 ? "warning" : "warnings"}
          </SectionTitle>
          {alerts.slice(1).map((alert) => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              accessibilityLabel={`Read ${alert.event}`}
              onPress={() => onOpenAlert(alert)}
              style={s.additional}
            >
              <Text style={s.event}>{alert.event}</Text>
              <Text style={s.agency}>
                {alert.severity} · {alert.agency}
              </Text>
              <Text style={s.agency}>Read full warning →</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 16 },
  warning: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderLeftWidth: 6,
    padding: 16,
    gap: 14,
    borderRadius: 0,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  event: { fontSize: 16, lineHeight: 24, color: colors.ink, fontFamily: typography.bodyStrong },
  severity: {
    color: colors.background,
    fontSize: 12,
    fontFamily: typography.bodyStrong,
    backgroundColor: colors.dangerWash,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 0,
    textTransform: "uppercase",
  },
  headline: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 29,
    fontFamily: typography.heading,
    letterSpacing: -0.5,
  },
  agency: { color: colors.secondary, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  instruction: {
    gap: 8,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
  instructionLabel: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontFamily: typography.bodyStrong,
  },
  instructionText: { color: colors.ink, fontFamily: typography.body, fontSize: 16, lineHeight: 25 },
  more: { gap: 10 },
  additional: {
    minHeight: 64,
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
});
