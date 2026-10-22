# ClearPath — word-for-word two-person script

> Historical October 14 version. For the upcoming recording, use the [October 21 complete package](../cac-2026-video/README.md), including its 292-word script and 2:45 timeline. This older record is preserved for traceability.


Prepared October 14, 2026 after the user delegated the video-stage sequence. Source: ClearPath 1.1.0, application commit 33d9b50b9c8fab1953f28f88235b341b6adce301. Names use the order supplied: Manas = concept/product/review; Shiven = earlier AI-assisted demo/map/checklist development and four core iPhone checks. Confirm that name-to-role mapping before filming.

Target edit: **2:40**. Spoken text: **343 words** (Manas 171, Shiven 172; whitespace count). Timing is a planning estimate, not a measured recording. Rehearse aloud; allow natural breaths and taps, and keep the final cut within 2:30–2:50. Do not rush to fit a take. See [exact filming plan](VIDEO_PRODUCTION.md).

Read only the quoted narration. Headings and speaker labels are not spoken. Use your own voices. The script was drafted by Codex from the repository and user-reported contributions; review it for accuracy.

## 0:00–0:12 · Scene 1

**Manas:**

> I’m Manas. I developed the ClearPath concept and helped guide its design.

**Shiven:**

> I’m Shiven. I worked on its earlier AI-assisted features and tested this version on iPhone.

## 0:12–0:30 · Scene 2

**Manas:**

> ClearPath helps Texas families understand official weather warnings and prepare in one place. We’re demonstrating a fictional North Texas flood at a public Frisco reference point. The simulation label stays visible, so this is never presented as a live emergency.

## 0:30–0:48 · Scene 3

**Shiven:**

> This warning keeps its instructions and urgency, severity, and certainty together. Open “Why this warning is shown here” to see the display policy. Urgency comes first, then severity and certainty. It organizes warnings without calculating personal danger.

## 0:48–1:04 · Scene 4

**Manas:**

> Tap “Read Flooding guide” to go straight from the warning to existing preparedness guidance. The guide identifies its official reference and review date. Its general advice does not replace current instructions from emergency officials.

## 1:04–1:18 · Scene 5

**Shiven:**

> On the map, two fictional warning areas provide context. Pan and zoom show their locations. They do not measure flooding or safe routes, and regional records stay separate from selected-point alerts.

## 1:18–1:34 · Scene 6

**Manas:**

> In Prepare, check drinking water, save a meeting place, and keep a contact. Shiven verified those values returned after reopening Expo Go with the Mac server available. Local links connect users to Frisco and North Texas resources.

## 1:34–1:52 · Scene 7

**Shiven:**

> ClearPath uses TypeScript, React Native, Expo, and Expo Router. Here, a pure prioritization function takes warnings, a selected point, source evidence, and a clock. It preserves source records and gives stable ordering with explanations.

## 1:52–2:10 · Scene 8

**Manas:**

> One reliability issue was a future-dated cancellation hiding a valid warning. The AI-assisted repair checks issuance time before resolving updates or cancellations. Regression tests check that future messages cannot remove the current warning, including when input order changes.

## 2:10–2:27 · Scene 9

**Shiven:**

> Codex extensively assisted the interface, APIs, maps, reliability changes, and automated tests. My earlier AI-assisted work included the demo, map, and checklist. Manas directed requirements and reviewed results. I ran the four core iPhone checks, and all passed.

## 2:27–2:40 · Scene 10

**Manas:**

> I learned how to use mobile frameworks to build features.

**Shiven:**

> I learned testing, debugging, shipping features, and backend development. ClearPath connects warnings with practical preparation. Thank you.

## Narration guardrails

The technical passages explain the implemented system; they do not claim either presenter independently authored the generated fixes. “Four core iPhone checks” means the four reported tasks in TESTING.md, not every physical test or actual emergency delivery. The reopening claim keeps Metro available; do not replace it with an offline-startup claim. Keep fictional North Texas warnings visibly labeled throughout. No claimed prediction, safe routing, adoption, endorsement or closed-app push.

If a sentence does not match the footage or your actual role, change it before recording and update the storyboard. Personal coding/debugging experiences have not been invented to fill speaking time.

