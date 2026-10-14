# Demonstration

## Current recording checkpoint — source 1.1.0, October 13

**READY AFTER MANUAL PHONE VERIFICATION.** Use tested application commit `33d9b50b9c8fab1953f28f88235b341b6adce301`, not the older 1.0.0 Android APK. The final script is intentionally deferred. Follow [VIDEO_READINESS.md](docs/cac-2026/VIDEO_READINESS.md) and [IPHONE_CHECKLIST.md](docs/cac-2026/IPHONE_CHECKLIST.md).

Preferred short workflow: **Home → Explore simulated demo → North Texas flood → Read simulated warning → Why this warning is shown here → Read Flooding guide → KIT / FAMILY PLAN / LOCAL LINKS**. Keep **SIMULATED DEMO** visible. The two Frisco-area warnings, areas and fixed July 4, 2025 clock are invented fixtures, not historical government records. The Frisco map deliberately omits the old Hunt river measurement. Existing Flood, Tornado, No alerts and Outage scenarios remain available.

The explained priority engine is now implemented and AI-assisted; show source classifications and the future-cancellation regression as engineering examples, with honest contribution attribution. Do not claim student-independent implementation, adoption, predictive risk, safe routing or closed-app/cloud alerts. Browser workflow/layout checks passed; native iPhone, permission and installed-app offline-restart evidence remains pending. The earlier walkthrough below is historical and is superseded by the current handoff.

## Historical October 9–11 demonstration plan

The demonstration must show a functioning native app on a phone. Use clearly simulated scenarios when real warnings are absent; never imply that fictional events are live. The [2026 competition rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf) request a 1–3 minute demonstration video with participant names, app name/purpose/audience, tools, and functionality. Keep the final video within three minutes.

## Preparation

Use the installed ClearPath Android preview for Google Maps on this phone. See README.md for its USB installer. Expo Go remains a development option, but its observed Android client could not display basemap tiles. Verify checklist/contact persistence and scenarios on the actual phone before recording; results are recorded in TESTING.md.

A fresh installation opens in **live mode**, with no selected point and no verified local warning result. On Home, scroll to **TRAINING DEMO**, press **Explore simulated demo**, and use **Flood**, **Tornado**, **No alerts**, and **Outage**. Flood is a fictional Hunt/Guadalupe exercise frozen at **JUL 04 2025 / 05:15 CDT**, inspired by the Texas flooding; its warning areas and river measurements are not historical observations or live conditions. Confirm **SIMULATED DEMO** stays visible on Home, warning details, and Map. Demo fixtures must not write to the real NWS snapshot or trigger official notifications. Tap the persistent **Exit demo** control or **Return to live mode**, then **Choose location** or the location row at the top; choose a Texas city center, foreground GPS, or precise coordinates. With automatic feeds enabled, selecting the point starts live retrieval. In manual-feed mode use **Refresh official alerts** when the cooldown allows. Later launches restore the one last selected point in live mode; use **Explore simulated demo** to start the recorded scenarios.

An outage scenario illustrates cached presentation; it does not prove actual airplane-mode persistence. Test that separately. For independent offline startup, force-close and restart an installed binary with embedded JavaScript; Expo Go/development-client sessions may depend on Metro. Tiles and source websites may need internet even when the local preparedness screen works offline. Never activate an actual emergency telephone call for a demonstration.

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

At this checkpoint, provider order is preserved and the original student engine is pending. The final demonstration's algorithm segment must be completed after milestone 5. USGS earthquakes/river observations and optional NIFC perimeters are integrated; their source and observation times remain distinct from retrieval times. On October 11 the user confirmed installed Android basemap tiles, demo areas/marker, independent layer toggles, warning details, live NWS records/details, river stations/details, and USGS/NIFC feed displays and available details. This is not a complete accessibility, geometry-touch or offline acceptance audit. Approved road-closure ingestion and shelter occupancy are absent. Cloud notifications are not configured or phone-verified. Do not present a test notification as an emergency or claim uninterrupted background location monitoring.

When recording the eventual submission, use an actual student contribution and accurately summarize the successful checks from TESTING.md. Avoid personal contact information and exact home coordinates in public footage. This plan does not upload or publish a video.
