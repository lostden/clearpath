import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AlertSelection } from "./AlertDetail";
import MapCanvas from "./MapCanvas";
import { fitMapGeometries } from "@/domain/mapBounds";
import { ClearPathDataError } from "@/data/http";
import { getNwsZoneBoundaries, NWS_ZONE_LIMITS, type ZoneBoundaryResult } from "@/services/nwsZones";
import { ActionButton, Body, Heading, Panel, Screen, SectionTitle, openLink } from "@/ui/components";
import { colors, typography } from "@/ui/tokens";
const EMPTY_ZONES: string[] = [];

export function ZoneAreaDetail({ selection, enabled, onClose }: {
  selection: AlertSelection | null;
  enabled: boolean;
  onClose: () => void;
}) {
  if (!selection) return null;
  return <ZoneSession key={`${selection.alert.id}-${selection.alert.sent}`} selection={selection} enabled={enabled} onClose={onClose} />;
}

function ZoneSession({ selection, enabled, onClose }: {
  selection: AlertSelection;
  enabled: boolean;
  onClose: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ZoneBoundaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const consumed = useRef(0);
  const busy = useRef(false);
  const closed = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const alert = selection.alert;
  const urls = alert.affectedZones ?? EMPTY_ZONES;
  const close = useCallback(() => {
    closed.current = true;
    activeRequest.current?.abort();
    onClose();
  }, [onClose]);

  // A zone view is tied to one currently verified alert. Leaving its context,
  // backgrounding, or expiring closes the view and cancels its downloads.
  useEffect(() => {
    if (!enabled || AppState.currentState !== "active" || Date.parse(alert.expires) <= Date.now()) {
      close();
      return;
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") close();
    });
    const timer = setTimeout(close, Math.max(1, Date.parse(alert.expires) - Date.now()));
    return () => { subscription.remove(); clearTimeout(timer); };
  }, [alert.expires, enabled, close]);

  useEffect(() => {
    if (!attempt || consumed.current === attempt || !enabled || closed.current || AppState.currentState !== "active" || !(Date.parse(alert.expires) > Date.now())) return;
    consumed.current = attempt;
    const controller = new AbortController();
    activeRequest.current = controller;
    let active = true;
    void getNwsZoneBoundaries(urls, controller.signal).then((value) => {
      if (!active || controller.signal.aborted) return;
      setResult(value);
      if (value.retryAfterMs !== undefined) setCooldown(true);
    }).catch((cause: unknown) => {
      if (!active || controller.signal.aborted) return;
      setError(cause instanceof ClearPathDataError && cause.kind === "cancelled" ? "Download cancelled." : "Boundary download failed. Read the original warning.");
    }).finally(() => {
      if (active) { busy.current = false; setLoading(false); }
    });
    return () => { active = false; controller.abort(); if (activeRequest.current === controller) activeRequest.current = null; };
  }, [alert.expires, attempt, enabled, urls]);

  const retryAfter = result?.retryAfterMs;
  useEffect(() => {
    if (retryAfter === undefined) return;
    const timer = setTimeout(() => setCooldown(false), retryAfter);
    return () => clearTimeout(timer);
  }, [retryAfter, result]);
  useEffect(() => {
    if (!result?.boundaries.length) return;
    const deadlines = result.boundaries.flatMap((boundary) => [
      Date.parse(boundary.fetchedAt) + NWS_ZONE_LIMITS.cacheAgeMs,
      ...(boundary.expirationDate ? [Date.parse(boundary.expirationDate)] : []),
    ]);
    const deadline = Math.min(...deadlines);
    if (deadline <= Date.now()) { close(); return; }
    const timer = setTimeout(close, Math.max(1, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [close, result]);
  const fitted = result ? fitMapGeometries(result.boundaries.map((boundary) => boundary.geometry)) : null;
  const download = () => {
    if (!enabled || closed.current || busy.current || cooldown || !urls.length || AppState.currentState !== "active" || !(Date.parse(alert.expires) > Date.now())) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setAttempt((previous) => previous + 1);
  };
  return <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={close}>
    <SafeAreaView edges={["bottom"]} style={s.safe}>
      <Screen>
        <ActionButton title="Close zone areas" secondary onPress={close} />
        <Text style={s.kicker}>NWS / AFFECTED ZONE BOUNDARIES</Text>
        <Heading>Zone areas</Heading>
        <Body>{alert.event}</Body>
        <Panel>
          <SectionTitle>ZONE OUTLINES</SectionTitle>
          <Body>Zone boundaries, not a supplied warning polygon or measured flood extent. These areas do not establish whether the alert applies to your point.</Body>
          <Body>Download only when needed. Up to 4 linked zones; accepted boundary data is limited to 2 MiB. Large or failed zones are omitted. No background downloads.</Body>
        </Panel>
        <Text style={s.metadata}>{urls.length} LINKED ZONES / THIS WARNING</Text>
        {!result && !error && !loading && <Body>No zone boundaries downloaded.</Body>}
        {loading && <Body>DOWNLOADING / NWS zone boundaries</Body>}
        {error && <Body>{error}</Body>}
        {result && <>
          <Text style={s.metadata}>{result.loaded} LOADED / {result.failed} FAILED / {result.notLoaded} NOT LOADED / {result.requested} REQUESTED</Text>
          {(result.failed > 0 || result.notLoaded > 0) && <Panel><SectionTitle>PARTIAL COVERAGE</SectionTitle><Body>{result.reason || "Some linked zone boundaries are absent. Read the full warning for all named areas."}</Body></Panel>}
          {result.loaded > 0 && <Body>WHITE OUTLINE / RETRIEVED ZONE · GRAY OUTLINE / RETAINED ZONE</Body>}
          {enabled && fitted && <MapCanvas point={fitted.point} pointIsSelection={false} initialSpan={fitted.span} alerts={[]} source="live" showWarnings={false} zoneBoundaries={result.boundaries} />}
          {!result.loaded && <Body>No usable boundaries loaded. No mapped area is verified.</Body>}
          {result.boundaries.map((boundary) => <Panel key={boundary.url}>
            <SectionTitle>{boundary.id} / {boundary.name}</SectionTitle>
            <Body>{boundary.cached ? "BOUNDARY / RETAINED RAM COPY" : "BOUNDARY / RETRIEVED NWS COPY"}</Body>
            <Body>Retrieved: {new Date(boundary.fetchedAt).toLocaleString()}</Body>
            {boundary.effectiveDate && <Body>Zone definition effective: {new Date(boundary.effectiveDate).toLocaleString()}</Body>}
            {boundary.expirationDate && <Body>Zone definition expires: {new Date(boundary.expirationDate).toLocaleString()}</Body>}
            <ActionButton title={`Open NWS zone ${boundary.id}`} secondary onPress={() => void openLink(boundary.url)} />
          </Panel>)}
        </>}
        <ActionButton title={loading ? "Downloading boundaries" : cooldown ? "NWS download on cooldown" : result || error ? "Retry NWS boundaries" : "Download NWS boundaries"} disabled={!enabled || loading || cooldown || !urls.length} onPress={download} />
        <Body>The original warning text remains the source for instructions and named areas. Boundary copies can change; this view closes when the warning expires or its verified context changes.</Body>
      </Screen>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kicker: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  metadata: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
});
