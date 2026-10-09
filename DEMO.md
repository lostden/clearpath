# Demonstration

The demonstration must show a functioning native app on a phone. Use clearly simulated scenarios when real warnings are absent; never imply that fictional events are live. The [2026 competition rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf) request a 1–3 minute demonstration video with participant names, app name/purpose/audience, tools, and functionality. Keep the final video within three minutes.

## Preparation

Run `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1` on this machine, or `npm start` with a system Node installation. Launch in compatible Expo Go on Android/iOS. Verify the checklist/contact persistence and scenarios on the actual phone before recording; results are recorded in TESTING.md.

Use the app's demo controls to choose the Hill Country flash-flood, tornado, normal/no-alert, and internet-outage scenarios. Confirm **SIMULATED DEMO** stays visible on Home, warning details, and Map. Demo fixtures must not write to the real NWS snapshot. Exit the demo with the live-mode control, choose/confirm the location, and refresh to establish a live retrieval.

An outage scenario illustrates cached presentation; it does not prove actual airplane-mode persistence. Test that separately. Tiles and source websites may need internet even when the local preparedness screen works offline. Never activate an actual emergency telephone call for a demonstration.

## Three-minute walkthrough

| Time | Demonstration |
| --- | --- |
| 0:00–0:20 | Introduce participants, ClearPath, and its audience: people in Texas who need official emergency information with less cognitive load. Explain the flooding inspiration. |
| 0:20–0:45 | Show the native phone tabs and manual/GPS location choice. Explain what a selected point means. |
| 0:45–1:15 | Select simulated Hill Country flooding. Identify agency classification, time, instructions, all-alert access, and full-warning view. Keep the simulation label visible. |
| 1:15–1:35 | Switch to tornado and no-alert examples. Explain that no reported alert is not a safety guarantee. |
| 1:35–1:55 | Show map controls and supplied geometry or the honest missing-map fallback. State that standard directions are not verified evacuation routes. |
| 1:55–2:15 | Show the simulated outage/cached state with its old retrieval time. Open Prepare, complete a checklist item, and display a local contact. |
| 2:15–2:40 | Exit demo and retrieve a real NWS point response. Zero active alerts is a valid demonstration outcome; an unavailable feed must be described accurately. |
| 2:40–3:00 | Explain TypeScript/React Native/Expo, one original student algorithm decision and its tests **after implementation**, and the AI assistance disclosure. |

## Checkpoint limitations to say aloud

At this checkpoint, provider order is preserved and the original student engine is pending. The final demonstration's algorithm segment must be completed after milestone 5. USGS observations are a milestone 6 roadmap item, not an integrated live feature. Do not narrate station observations, approved road-closure ingestion, paid Google configuration, or physical-device validation that has not been performed.

When recording the eventual submission, use an actual student contribution and accurately summarize the successful checks from TESTING.md. Avoid personal contact information and exact home coordinates in public footage. This plan does not upload or publish a video.
