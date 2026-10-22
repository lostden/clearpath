# 10 — Video readiness report

Prepared **October 21, 2026**. **PRE-RECORDING PACKAGE COMPLETE; READY FOR THE SHORT PHONE REHEARSAL.** Actual narration, camera/phone/code clips, subtitle synchronization, final export, public access and submission remain unverified. This status applies to preparation, not a completed film or final contest acceptance.

## Source and change audit

App **1.1.0**, application commit **`33d9b50b9c8fab1953f28f88235b341b6adce301`**, branch **`codex/cac-2026-readiness`**. Reviewed checkout HEAD: **`18971d2`**. `git diff 33d9b50 -- src tests package.json package-lock.json app.json app.config.ts` was empty before package creation: no new app feature or dependency change since the accepted increment. October 14–15 work added video/contribution/registration documentation, source packaging and dependency review. This package adds only local planning/graphics/subtitles and records; no application, account, infrastructure or production data was changed.

Relevant current sources read: README, AGENTS, current/historical testing evidence, DEMO, ARCHITECTURE, contribution/AI records, existing video handoff, current routes/components, fixtures, preparedness/resources, priority/lifecycle/navigation code and current tests. See [inventory/selection](01_FINAL_FEATURE_SELECTION.md) and [exact walkthrough](06_MAC_CODE_RECORDING.md).

## Safe checks actually executed October 21

| Command / inspection | Actual result |
| --- | --- |
| `npm run typecheck` | Exit 0 |
| `CI=1 EXPO_NO_DOTENV=1 npm run lint -- --no-cache` | Exit 0 |
| `npm test -- --cacheDirectory=/private/tmp/clearpath-cac-video-20261021-jest` | Exit 0; **46 suites / 924 tests**, 24.766 s; no Jest console warnings |
| `node --test server/watcher.test.mjs` in sandbox | Exit 1: **34 pass / 3 fail**, all three HTTP listener tests blocked by `listen EPERM 127.0.0.1` |
| Same watcher suite with loopback permission: `node --test --test-reporter=spec server/watcher.test.mjs` | Exit 0; **37/37**, 692.562 ms; external providers mocked, temporary local listeners only, no real enrollment/push or deployment |
| Source/config/dependency comparison against accepted app commit | Empty; accepted application remains unchanged |
| Script/scene/caption/graphic/package verification | See [verification_report.json](verification_report.json), generated after final file/asset checks; measured word counts, sequence and dimensions are document checks, not footage acceptance. |

Earlier October 15 fresh-ZIP install/typecheck/lint/Android+iOS Hermes exports passed; no new native build/export is claimed by this October 21 document task. The older Android APK is 1.0.0. The latest recorded security review (October 15, not a current audit) retained 65 findings from five roots; no complete compatible remediation was established. Recommended SDK patches remain maintenance, not an installed fix. See [dependency review](../../DEPENDENCY_REVIEW.md).

## Device evidence and limits

On October 14, the user reported all four core physical iPhone checks passed and named **Shiven** as tester: startup/tabs; North Texas warning→Flooding guide; map tiles/two fixture areas/zoom/drag; kit/meeting/contact restoration after closing/reopening Expo Go **with Metro available**. Versions were reported as “57.0.27 or 57.0.28 and 26.6.1”; exact identification/model remain incomplete. Codex did not independently observe that phone. October 13 simulator source/detail/map/storage checks are separate evidence, not physical acceptance.

**No new October 21 physical test or recording occurred.** Rehearse explanation/source-date/local-link views, current keyboard dismissal, framing and Recenter on the actual filming phone. Existing automated/simulator evidence supports these functions; the rehearsal checks this phone’s visual/touch execution. GPS/notifications, full accessibility, background behavior, all geometry interactions and independent offline cold restart remain unverified and absent from the narration.

## Risks resolved in the filming plan

- **Live feed unavailable/no warning:** local North Texas fixtures provide a reproducible scenario; original live data are never edited or relabelled.
- **Map loading:** tiles need internet. Preload; if unavailable, use the existing warning list with the explicit replacement narration in file 02. No false Apple fallback-control promise.
- **Scrolling/modals:** warning Close control remains available; source/classification fields need short slow scrolls. Record stationary inserts rather than frantic navigation.
- **Keyboard/save state:** enter values off camera, dismiss safely, wait for actual saved status. Unreadable/session-only storage cannot be filmed as persistence success.
- **Privacy:** demo preparation uses the same local store as live mode. Preserve originals privately and restore only temporary changes. Do not clear app data.
- **iPhone visual differences:** new client version, text size, safe-area/keyboard or clipping can invalidate a planned crop. Review a ten-second actual capture first; no mock screenshot repair.
- **Timing:** 292 words split 146/146; 165 planned seconds, approximately 116 seconds actual app footage. SRT timings remain estimates until recording. No voices/footage were generated to fabricate completion.
- **Ownership/compliance:** script uses reported roles and learning, identifies extensive Codex implementation/production assistance and avoids independent-code claims. Coordinator permission scope and substantial student-understanding eligibility still need human review.

## Remaining human work and next three actions

1. Both students review names/roles/script and run the five-minute filming-phone rehearsal in file 05. Time the complete read aloud; correct a real failure or inaccurate sentence before capture.
2. Record every listed phone, code, camera and real-voice clip; edit to file 08, retime captions and inspect the actual 1080p export for 2:35–2:50 and strict under-three-minute length.
3. Complete file 09’s private eligibility/AI/portal review; later publish the approved film and submit it, keeping the actual receipt. Use the earlier deadline: October 26, 11 a.m. Central, target October 24.

No additional feature is needed solely for this planned cut. Do not upgrade the accepted app or activate infrastructure to create a more impressive claim.
