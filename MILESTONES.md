# Milestone ledger

## Current status — October 13, 2026 / source 1.1.0

Tested application commit: `33d9b50b9c8fab1953f28f88235b341b6adce301`. The user authorized AI-assisted implementation of the formerly blank module. Historical student-boundary language below describes the earlier plan, not the current source.

| Milestone | Current evidence and remaining work |
| --- | --- |
| 1–4 | Existing foundation retained; future NWS issuance/cancellation and rollback freshness repaired with regressions |
| 5 | Explainable pure engine implemented/integrated and reviewed; 41 engine tests plus Home cases. AI-assisted, not independently student-written |
| 6 | Existing official layers retained; Frisco demo/preset and guide navigation added. Native iPhone maps/permissions still need acceptance |
| 7 | Targeted disclosures, visible operational diagnostics and source attribution implemented; automated storage/failure checks pass. Physical restart, movement and assistive-technology checks remain |
| 8 | 46 suites / 924 app tests, 37 server tests, lint/typecheck and iOS/Android JS exports pass; browser workflow verified. **READY AFTER MANUAL PHONE VERIFICATION** for recording, not final submission certification |

Finish physical checks by October 20–21, then record and submit with a buffer. Current handoff and remaining authorship/submission evidence: [VIDEO_READINESS.md](docs/cac-2026/VIDEO_READINESS.md). No new native binary, deployment, remote push or final script was produced.

## Historical October 9–11 checkpoint and schedule

The development session built support increments for milestones 1–4. On October 10 the user explicitly authorized the tactical redesign and expanded official map coverage, including supporting work from milestone 6. The original student implementation at milestone 5 remains deliberately blank. Supporting cache, demo, or map behavior does not mark later milestones complete. Validation results are recorded in TESTING.md.

| Milestone | Objective and dependencies | Status at the student checkpoint |
| --- | --- | --- |
| 1 | Expo 57 compatible scaffold, TypeScript, architecture, navigation, design tokens | Implemented support increment; foundation/early data scaffold commit `cc5fae0`; October 10 tactical tokens and bundled static fonts added |
| 2 | Home/Map/Prepare and clearly simulated example states; depends on 1 | Implemented support increment; live-first unselected state and opt-in demo; earlier Android startup confirmed, current redesigned phone presentation pending |
| 3 | Foreground GPS and manual selected point; depends on 1–2 | Implemented support increment; last point restored locally with explicit saved-GPS label; native permission verification pending |
| 4 | Typed NWS point response, complete warning access, freshness/error states; depends on 3 | Implemented support increment; real adapter checks and combined automated evidence below |
| 5 | Student-developed relevance, ordering explanations, additional normalization, tests, and Codex review; depends on 4 | **Waiting for original student implementation** in `src/student/priority.ts`; no original engine generated or claimed |
| 6 | Native map refinement, supplied official geometry, USGS discovery and observations; original relevance depends on 5 | **Partially implemented support at the user's request**: separate Texas/U.S. NWS regional polygons/record list, worldwide 24-hour earthquakes, nearest 12 Texas stream stations within 50 km, optional bounded NIFC published wildfire outlines, distinct source timestamps and foreground polling. Successful native tiles/overlays, complete device acceptance, and student relevance remain pending. No flood-stage/depth, current fire edge, evacuation or route-safety inference |
| 7 | Broader persistence/failure/accessibility refinement; depends on tested data paths | Roadmap; early support does not replace full reliability verification |
| 8 | Device testing/performance review, final documentation, competition preparation; depends on 5–7 | Roadmap; demo/document drafts are preparation only |

## Recorded checkpoint evidence — October 9, 2026

`cc5fae0` records the foundational scaffold and early data modules. Subsequent Home/Map/Prepare, location, live-query, persistence, and provenance increments were implemented and checked together. The final support checkpoint commit is created after the validation record and documentation are finalized; inspect Git history for that commit.

| Executed check | Observed result |
| --- | --- |
| TypeScript | Passed |
| Expo lint | Passed |
| Jest | 15 suites passed; 114 tests passed |
| Expo dependency compatibility | Passed |
| Expo Doctor | 21 of 21 checks passed |
| Native JavaScript/Hermes export | Android and iOS bundles exported, approximately 3 MB and 2.7 MB |
| Real NWS adapter requests | Galveston returned two alerts; Kerrville returned zero at the time of retrieval |

Real warning availability changes. The adapter checks establish that actual official responses were retrieved and parsed at those points, without promising later conditions. Hermes export validates JavaScript bundling; it does not compile/install a native binary or validate a physical phone. No native phone, simulator, or Maestro run had been performed at the October 9 baseline. October 10 Android USB startup and map-failure UI evidence, plus later source-layer checks, are recorded separately in TESTING.md.

Browser previews inspect shared layouts separately from native behavior. Recorded viewport inspections belong in TESTING.md; they do not establish native map/permission/dialer operation. Dependency audit findings remain unresolved: 65 findings, including 49 high and 16 moderate. See TESTING.md for the scope and limitations of that audit.

## October 10 requested scope expansion

The user requested a dark tactical interface, local bold/monospace fonts, no custom animations, and live weather/earthquake/river map coverage with Texas flood/weather priority. The three font assets total about 266 KB. Home's exact-point warning result stays separate from Map's regional coverage. New regional/USGS layers use memory-only caches, foreground request gates, original source/retrieval times, and explicit cached/unavailable states. The optional linked-zone viewer requires a manual download and draws separate administrative outlines without establishing warning applicability or flood extent. Their implementation and adapter checks are supporting work; they do not supply the student's original engine or prove successful physical map rendering.

The latest combined automated run passed **36 Jest suites / 575 tests** without console warnings. Full typecheck and source/test lint passed. The earlier dependency/configuration check passed, including Expo Doctor **21/21**. Android/iOS Hermes JavaScript exports passed at approximately **3.4 MB / 3.1 MB**, with 37 assets. Tactical shared layouts were inspected at 320 × 568 and 390 × 844; the optional NIFC layer additionally displayed actual published outlines, distinct capture dates, verified Texas mapped-record emptiness and partial national coverage in the browser. Later checks verified grouped warning keyboard access and distinct feed-generation/retrieval labels. Eight tested text-token pairs exceeded 4.5:1. These checks do not complete physical acceptance or compile a native binary. Exact evidence and remaining phone checks are in [TESTING.md](TESTING.md).

The optional manual-update preference reduces repeated feed downloads while preserving freshness and warning-expiry checks. Preparation distinguishes pending, saved and session-only edits; a successful restore no longer rewrites stored values. Its section index makes offline guides and contacts reachable before the full checklist. Home distinguishes saved-point restoration from a missing selection; late persistence failures cannot override newer choices. GPS cancellation restores manual controls and ignores late results. The coordinate fallback has directional panning with dateline/pole guards. These are AI-assisted reliability support, not a completed milestone 7 or an original student algorithm.

The phone was unplugged during the redesign. A native Maps key, Google Cloud account/billing setup, the remote EAS preview-environment Maps key, and an installed APK remain pending user setup; none was created. The local preview profile explicitly selects the preview environment. The user expected to return at **12:00 a.m. tonight (midnight at the start of October 11, America/Chicago)**, not noon. That handoff time is separate from the competition deadline below.

## Checkpoint acceptance

For each increment, record the code state, exact commands run and outcomes, material limitations, remaining phone tests, and a coherent commit when local Git permits. A passing typecheck does not prove live alert availability or physical map rendering. The presence of an integration file is not evidence of successful integration. Offline release verification includes force-close/restart without connectivity in an installed binary with embedded JavaScript, not only an already loaded development session.

For milestone 5, the student supplies the design note and implementation described in STUDENT_CONTRIBUTIONS.md. Review that work and its meaningful tests before enabling it in the live presentation. Preserve authorship in commits and AI_USAGE.md.

## Suggested schedule after this checkpoint

- October 10–14: student implements and explains milestone 5; review and iterate on edge cases.
- October 15–18: finish milestone 6 validation/refinement around the requested map integrations; review the student contribution before enabling its original relevance logic. Keep missing geometry/readings and source limits explicit.
- October 19–22: test real phones, low connectivity, accessibility, persistence, and source failure behavior.
- October 23–25: record the working demonstration, finalize accurate contribution/disclosure records, and complete the submission with a buffer.

The official submission deadline is **October 26, 2026, 11:00 a.m. America/Chicago** (12:00 p.m. EDT). [Official registration page](https://www.congressionalappchallenge.us/students/student-registration/). Confirm the participating district and submission requirements with the official process. No registration, submission, or publication has been performed.
