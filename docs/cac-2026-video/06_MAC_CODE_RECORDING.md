# 06 — Mac and code recording

## Exact source identity

Repository: `/Users/shivengarisa/clearpath`. Branch: `codex/cac-2026-readiness`. Accepted app: **1.1.0 / `33d9b50b9c8fab1953f28f88235b341b6adce301`**. Reviewed checkout HEAD before this package: `18971d2`; later package commits do not change app source. Run `git status --short` and `git log -1 --oneline` in a separate private terminal to check for later work; never discard someone else’s edits. If app code changed, revalidate the relevant footage/line numbers before capture.

Open only the target source files in VS Code. Hide Explorer, minimap, terminal history and unrelated tabs; turn off personal notifications. Set editor font to **24–28 px** and adjust until the selected 15–20 lines are readable at 1080p. Use Command-P for a file and Control-G / Go → Go to Line for the line. Select the target lines; do not edit them or fake a green test result. Keep code footage’s **AI-ASSISTED IMPLEMENTATION** overlay.

| Clip / minimum raw length | Exact local path and verified lines | Stationary selection / explanation |
| --- | --- | --- |
| M01a_context.mov / 11 s | [priority.ts:9](/Users/shivengarisa/clearpath/src/student/priority.ts:9), lines 9–15 | `PriorityContext`: selected point, explicit clock, source and applicability evidence. Backup: `prioritizeWarnings` signature at lines 101–104. |
| M01b_priority.mov / 13 s | [priority.ts:129](/Users/shivengarisa/clearpath/src/student/priority.ts:129), lines 129–147 | Lifecycle resolution, stable sort, explanation, original alert return. Backup stationary inset: classifications 23–25 and comparator 52–65. |
| M02_issuance.mov / 12 s | [alerts.ts:3](/Users/shivengarisa/clearpath/src/domain/alerts.ts:3), lines 3–8 | `MAX_ISSUANCE_SKEW_MS`, `hasPlausibleIssuance`; sent time can be at most one minute ahead. Future onset is a different field. |
| M03_current.mov / 11 s | [alerts.ts:79](/Users/shivengarisa/clearpath/src/domain/alerts.ts:79), lines 79–89 | `currentAlerts`: issuance filter comes before `uniqueAlerts` replacement/cancellation resolution, then expiration. |
| M04_regression.mov / 12 s | [alerts.test.ts:75](/Users/shivengarisa/clearpath/tests/alerts.test.ts:75), lines 75–88 | The real Alert/Update/Cancel parameterized regression; both reversed-input assertions retain the original warning. |

Allow three-second still handles around every selection. The two engineering examples are **prioritization** and **issuance/lifecycle validation**; the helper and test cuts explain those examples, not additional claimed student algorithms. These are AI-assisted implementations. `src/student/` is a historical directory name, not evidence of independent authorship.

## Recording the screen

Press **Shift-Command-5 → Record Selected Portion**, frame only the clean editor, choose a local save destination in Options, microphone OFF, then Record. Use SDR/most-compatible capture if the Mac offers it. Stop from the menu bar or Control-Command-Escape; inspect text/cursor motion before the next take. Keep the existing phone Metro terminal running separately. [Apple’s current recording controls](https://support.apple.com/en-us/102618).

Put selected takes in `/Users/shivengarisa/clearpath/artifacts/cac-video/raw/mac/`. Do not include shell environment dumps, account credentials, hidden config, build console secrets or actual contact values. The graphic files are already 1920×1080 and can be imported directly; there is no need to film a browser displaying them.

Optional authentic test-result insert (not needed for the 2:45 default): run in a separate clean terminal, then record its real result only:

```sh
npm test -- --runTestsByPath tests/priority.test.ts tests/alerts.test.ts tests/nws.test.ts --cacheDirectory=/private/tmp/clearpath-cac-video-recording-jest
```

The current full run passed 924 tests on October 21. A future focused command has its own observed result; do not label it 924 or paste old green text into a terminal. If it fails, diagnose and omit the insert until resolved.

## Presenters and narration

Use the same iPhone camera **after** phone screen captures. Default: brief shared facecam for names/closing, voiceover for app/code. Landscape 1080p/30 fps if supported; eye-height lens, mid-chest framing, both students equally sized, plain background and front/side window light. No student IDs, private papers or addresses in view. Clean the lens; avoid backlighting and noisy fans. Keep the microphone roughly 20–30 cm from the speaking person when recording voiceover and maintain a similar distance between takes.

Record **C01_intro.mov** (scene 2, minimum 20 s with handles) and **C02_close.mov** (scene 10, minimum 17 s), using your own voices. The first four seconds of C01 show faces; its remaining audio continues over the actual app. For scene 9 record both labelled voice segments, optional PiP in the unused margin only. Record separate **V01…V10** audio takes following file 04; for scenes 2 and 10 use camera audio rather than layering a duplicate voiceover. Cue the scene number, pause two seconds, read, pause two seconds. Trim the cue. Record two natural takes, not synthetic voices.

If separate camera/audio devices are used, clap once and align the waveform. For silent app/code footage, align narration to the actual tap/highlight. Listen on headphones and a phone speaker before choosing takes. A role statement must reflect the person speaking it; review the recorded mapping before editing.

## Narration track names

Use these labels inside the editor or as exported audio basenames; retain the real `.m4a`/`.wav` extension. Recording voiceover directly in the editor does not require exporting a separate audio file.

| Scene | Audio source / name |
| --- | --- |
| 1 | V01_Manas |
| 2 | C01_intro camera audio: Manas, then Shiven |
| 3 | V03_Shiven |
| 4 | V04_Manas |
| 5 | V05_Shiven |
| 6 | V06_Manas |
| 7 | V07_Shiven |
| 8 | V08_Manas |
| 9 | V09a_Manas, then V09b_Shiven |
| 10 | C02_close camera audio: Manas, Shiven, Manas |
