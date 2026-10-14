# ClearPath video-readiness handoff

**Status: READY TO RECORD the accepted core app workflows.** Updated October 14, 2026 after the user's four physical-phone passes. Device/client metadata remain incomplete; additional feature checks and contribution limits remain below. This is an implementation/recording checkpoint, not certification that the submission or video is complete. No final narration/script has been written.

## Exact source and evidence

- App source version **1.1.0** in package.json/app.json.
- Tested application commit **`33d9b50b9c8fab1953f28f88235b341b6adce301`**, branch **`codex/cac-2026-readiness`**. Later documentation-only commits may follow; use `git log -1 --oneline` for the checkout HEAD.
- **924 app tests / 46 suites**, **37 watcher tests**, typecheck/lint and Android/iOS Hermes exports passed. Current browser workflow passed at mobile widths. Details and failures: [TESTING.md](../../TESTING.md).
- No new native binary. The retained Android version-code-6 APK is **1.0.0**, built from `84aedce302f2adaf91dc48b4354b230d81ce4e4e`; its October 11 phone confirmations do not verify 1.1.0.
- The first simulator launch timed out; a later IPv4 transport retry rendered ClearPath in Expo Go 57.0.9 / iOS 18.6. Main guide navigation, Apple basemap/fixture rendering and saved preparation after online Expo Go process restart passed. On October 14 the user separately reported **PASS** for physical startup/tabs, North Texas warning→Flooding guide, map tiles/two fictional areas/zoom/drag and kit/meeting/contact restoration after closing/reopening Expo Go with Metro available. These physical results are user-reported, not independently observed by Codex. Reported versions “57.0.27 or 57.0.28 and 26.6.1” need exact identification; model/operator remain unconfirmed. Additional steps remain in [IPHONE_CHECKLIST.md](IPHONE_CHECKLIST.md).

Current captures: browser [Home at 390 × 844](screenshots/home-390.png) and [warning-opened Flooding guide](screenshots/flood-guide-390.png), plus [native Apple Maps in the iOS simulator](screenshots/ios-simulator-frisco-map.jpg). Each is an actual capture from the named environment; none is physical-phone evidence or a product mockup.

## Truthful feature inventory

Automated verification means source behavior under the stated tests, not native-device acceptance.

| Feature | Current implementation / evidence | Recording limit |
| --- | --- | --- |
| Home/Map/Prepare | Expo Router tabs, persistent help/source strip, close controls; screen/browser tests and user-reported physical startup/tab pass | Complete native safe-area/keyboard/accessibility inspection remains |
| Selected location | Foreground single-reading GPS, manual coordinates, Texas presets; new verified Census Frisco reference point; last-point restore | Frisco is one point. Current native permission/GPS behavior pending |
| Official weather | NWS Actual/Public selected-point warnings, original classifications/instructions/source/times; all current warnings accessible | Live Frisco request parsed zero records at 23:59:54 UTC Oct 13. Do not promise an alert will exist at recording time |
| Warning lifecycle/freshness | Future-issued messages rejected before cancellation/replacement; bounded skew; exact expiry; cached original timestamps; rollback recovery timers | Validation depends on the device clock; no guaranteed emergency delivery |
| Explainable ordering | Pure urgency → severity → certainty convention, newer issuance/stable identity ties, unknown/conflict explanations and original objects; 41 engine tests plus Home tests | Display order, not prediction. AI-assisted code, not student-independent authorship |
| Warning→guide | Exact supported event mapping to existing flood/tornado/hurricane/winter/fire-weather guides; unknown → general Prepare; repeat requests preserve drafts. Physical North Texas warning→Flooding guide passed by user report | General guidance follows original instructions; no generated incident advice. Physical repeated-request/source-detail checks remain |
| Regional map | Separate Texas/U.S. NWS polygons/record list, missing geometry retained, optional explicit linked-zone viewer; web/Android schematic fallback | Apple basemap/Frisco fixtures rendered in simulator; physical tiles/two fictional areas/zoom/drag passed by user report. Remaining geometry/detail interactions unverified. Region/zone is not point applicability or measured hazard extent. Apple does not expose Google's tile-failure fallback |
| USGS/NIFC layers | Past-day global earthquakes; up to 12 nearby Texas stream stations/observations; optional bounded published wildfire outlines with separate dates | No earthquake prediction, flood-depth/stage inference, current fire edge, complete coverage or route safety. Regional copies are RAM only |
| Preparation | Five bundled guides, 12-item kit, family meeting/out-of-area plan, user contacts and emergency-number confirmations; source/review dates visible | Simulator and user-reported physical kit/meeting/contact restoration passed after closing/reopening Expo Go with Metro available. Independent offline cold start remains unverified |
| Frisco resources | Official City/NWS Fort Worth/TDEM/Collin links checked Oct 13; Census coordinate documented | Websites need connectivity. No official partnership, automatic enrollment or whole-city monitoring |
| Training | Five isolated scenarios. Explore starts fictional North Texas flood; old Flood/Tornado/No alerts/Outage retained; Frisco omits Hunt river fixture | Persistent SIMULATED DEMO; fixed July 4, 2025 clock is fictional, not historical NWS data |
| Feed settings/errors | Manual/automatic request controls and gates; secondary disclosures; GPS/storage failures remain visible with controls closed | Foreground only; manual mode does not poll. Native/assistive-technology acceptance pending |
| Sharing/calling | Deliberate sharing of selected coordinates and dialer confirmation | Hide private coordinates/contacts; never make a demonstration call to 911 |
| Local notices | Existing opt-in foreground GPS-follow/new-message policy and TEST / NO EMERGENCY control, tested with mocks | Historical Android test display confirmed; current iPhone delivery and real event delivery unverified. Omit if not phone-tested |
| Cloud preparation | Mobile ISO `lastCheckAt` contract repaired against real watcher output; 37 watcher tests | **Inactive/unconfigured/undeployed**, enrollment UI absent. Not a working background-push feature |

Do not mention disaster prediction, evacuation countdowns, safe routes, shelter occupancy, integrated road closures, guaranteed/closed-app alerts, official endorsement, adoption statistics or independently student-written generated code. These are absent or unsupported. A simulated outage is not evidence of physical airplane-mode restart.

## Strongest scenario and workflow

Use **North Texas flood**, at the public Frisco training point. The primary 25–30 second workflow is **Home → Read simulated warning → Why this warning is shown here → Read Flooding guide**. Show the original fixture instruction, official-style classifications, explanation and source attribution while retaining the simulation label. Briefly show the additional thunderstorm warning so ordering does not look like suppression. Then demonstrate one kit check and the family-plan/local-resource connection. Show the supplied map areas as context, not a flood extent or evacuation tool.

Before recording, load current source on iPhone, use the accepted core workflow and check any additional feature being filmed, use fictional saved values, silence unrelated notifications, and confirm no private coordinates/keys/contact data appear. Keep simulation labels and source clocks legible. Record app footage first in short clean clips, then narration around the actual footage. The user's four passes support that core Expo Go footage; they do not prove Metro-independent offline launch.

## Code worth showing in VS Code

| Location / function | Engineering point | Useful test |
| --- | --- | --- |
| `src/student/priority.ts` → `prioritizeWarnings`, `compareWarnings`, `provenance` | Explicit context, deterministic order, original-object preservation, source-aware reasons; no risk score | `tests/priority.test.ts`; `tests/home-priority.test.tsx` |
| `src/domain/alerts.ts` → `hasPlausibleIssuance`, `currentAlerts`; `src/data/nws.ts` → `normalizeNwsCollection` | Reject future cancellation before resolving references; distinguish onset from issuance | `tests/nws.test.ts`, `tests/alerts.test.ts` |
| `src/state/AlertsProvider.tsx` and `src/hooks/useRegionalAlerts.ts` | Shared display clock, original snapshot time and manual-mode recovery boundaries | `tests/useAlerts.test.tsx`, `tests/regional-alerts.test.tsx` |
| `src/domain/preparednessNavigation.ts` → `guideForEvent`; `AlertDetail.tsx` and `src/app/prepare.tsx` | Bounded mapping, Router request identity, repeated navigation without lost drafts | `tests/preparedness-navigation.test.ts`, `tests/prepare-screen.test.tsx` |
| `src/data/demo.ts` → `getDemoSnapshot`, `getDemoLocation` | Separate fixture namespace/point and live-cache isolation | `tests/demo.test.ts`, `tests/demo-controls.test.tsx`, `tests/map-screen.test.tsx` |

Use at most two implementation examples in the video: explained ordering and future-Cancel/source isolation. State that Codex assisted this implementation and describe only evidenced student design/review/test/code work. Do not narrate generated solutions as independently solved by either presenter. Main app: **TypeScript, React Native, Expo SDK 57, React 19.2, Expo Router**; optional inactive watcher: JavaScript/Node. AI is a development aid here, not a runtime alert interpreter.

Student 1 has confirmed the original concept/requirements, development direction, tactical redesign/map requests and review/feedback, and reported four core iPhone passes. Student 1 identifies Student 2's pre-audit work as **AI-assisted implementation of the demo, map and checklist**. These reported roles can be described honestly in the later video. The Git/contribution review does not establish independently student-written code, individual debugging challenges or who performed the Android/iPhone checks. Presenter names and personal technical examples still need confirmation before adding those claims. See STUDENT_CONTRIBUTIONS.md.

## Revised strict assessment

These are engineering judgments, not official judge scores or estimates of winning probability. The code is more convincing than the current ownership/impact evidence.

| Dimension | /10 | Reason |
| --- | --- | --- |
| Problem significance | 9 | Important local severe-weather/preparation problem |
| Originality | 5.5 | Explainable source-preserving workflow helps; alerts/maps/checklists already exist elsewhere |
| Technical sophistication | 8 | Independent feed/state boundaries, lifecycle/clock handling, deterministic policy, bounded geometry and provenance |
| Programming quality | 8 | Strong adversarial regressions and review; native/security limits remain |
| UI/UX | 7.5 | Coherent tactical identity, warning-first hierarchy and direct action; text remains dense and native accessibility unverified |
| Functionality | 8 | Complete tested warning→guide workflow and preparation; background cloud/roads/shelters absent |
| Reliability | 7 | Safety bug repaired and 924 tests; four core phone checks now pass by user report, while offline cold start, broader native acceptance and real notice delivery remain unverified |
| Local TX-04 relevance | 7.5 | Verified Frisco point/resources and North Texas scenario; no local pilot or emergency-management partnership |
| User usefulness | 7.5 | Official instructions connected to practical preparation; usefulness not yet measured with users |
| Demonstration potential | 8.5 | One understandable mobile workflow now fits a short demonstration |
| Student technical ownership | 2 (evidence) | Concept/review and partner's AI-assisted feature role reported; independent code, individual debugging/test attribution and demonstrated understanding remain unverified. This rates the record, not student ability |
| Overall competition readiness | 6.5 | Core phone footage accepted by user report; precise contribution evidence, final video and submission remain outstanding |

Against the published CAC dimensions, idea quality is about **6**, implementation **7.5**, and code engineering **8**; demonstrated student programming excellence remains unverified. The published criteria concern idea, implementation and coding skill. [2026 rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf).

The prior Stage A review examined accessible winner-video transcripts and sampled frames; it did not run their apps or inspect their code. [Piggy Pal](https://www.congressionalappchallenge.us/25-tx04/) demonstrates a focused mobile budgeting/tax problem. ClearPath now has an equally legible core workflow, but more feed complexity is not proof of a stronger submission. [Money Minds Junior](https://www.congressionalappchallenge.us/tx04-23/) shows that a focused learning/quiz project can win; framework complexity alone is insufficient. [Medicable](https://www.congressionalappchallenge.us/tx04-24/) is a verified TX-04 winner, but its video was private during review, so UI/code comparison is limited.

[HawaiiAlert.jp](https://www.congressionalappchallenge.us/25-hi01/) has a particularly clear Japanese-language access problem; the [office's account](https://case.house.gov/news/documentsingle.aspx?DocumentID=4804) describes NWS→translation→LINE. ClearPath's narrower advantage is keeping original instructions and showing why records are ordered, with locally saved preparation. Its differentiation is less distinctive than that language barrier. [Storm Shield](https://www.congressionalappchallenge.us/24-tx03/) addresses volunteer-shift coordination, a different disaster-response gap. None establishes a requirement for a complex AI model. ClearPath should prove its own workflow and user value rather than claim superiority over these winners or FEMA/Red Cross.

No additional feature is necessary solely for recording. Highest-value remaining work: an honest two-person contribution account, remaining checks for any extra footage and a small observed usability session with consenting family/student testers. Record actual tasks, confusion and fixes; do not invent endorsements, adoption or emergency effectiveness. Optional cosmetic work should wait unless a reproducible phone issue appears.

## Suggested 2:40 structure — no script

| Time | Focus / footage |
| --- | --- |
| 0:00–0:15 | Two presenters: app, Texas audience and one specific problem |
| 0:15–0:50 | iPhone: clearly simulated North Texas warning, original instruction and additional warning |
| 0:50–1:15 | Explanation → Flooding guide → one kit/family-plan action |
| 1:15–1:35 | Frisco point/resources and supplied map areas; one precise source/freshness limit |
| 1:35–2:10 | Mac: ordering and future-cancellation regression; truthful technology/AI/contribution explanation |
| 2:10–2:30 | iPhone: saved preparation or a real NWS point response; show only phone-verified behavior |
| 2:30–2:40 | What was learned, real testing evidence if obtained, practical purpose |

Keep most footage on the functioning app. Split narration between the two actual presenters after their contributions are documented. Use 1080p final output, readable portrait footage on a clean landscape canvas, brief captions for SIMULATED and source limits, and a runtime buffer below three minutes. Exact narration/recording-export/upload instructions belong to the later video stage.

## Remaining recording and submission gates

- The four supplied core [phone checks](IPHONE_CHECKLIST.md) passed by user report October 14. Capture only those accepted behaviors plus separately checked additions. Basic demo map tiles/areas/pan/zoom are included; remaining detail/GPS/notice/offline/accessibility segments need their own acceptance. Fill in device/client/operator metadata when available.
- Reported contribution roles are recorded: Student 1 concept/product/review; Student 2 AI-assisted demo/map/checklist development. Confirm names and any individual coding/debugging/test claims before final narration. Retain the coordinator's actual permission scope if available; disclosure remains necessary.
- Confirm team/district/age eligibility and registration. For two students, at least one must live or attend school in the hosting district. One entry each.
- Final video: participant names, purpose/audience, tools/languages and functioning app, **1–3 minutes**, public YouTube/Vimeo. Written answers and requested app/source access still pending. [2026 rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf).
- Plan to **October 26 noon EDT / 11 a.m. Central** in the rules PDF. The [registration page](https://www.congressionalappchallenge.us/students/student-registration/) shows a later time; use the earlier deadline unless the organizer clarifies. Target implementation/device acceptance October 20–21 and submit before the final day.
- Preserve source/license/AI records and exclude private data from footage. No registration, video upload, deployment, remote push or competition submission was performed here.
