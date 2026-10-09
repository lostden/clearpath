# Milestone ledger

The development session builds support increments for milestones 1–4 and stops before original student implementation at milestone 5. Supporting cache, demo, or map behavior may be introduced earlier to make those increments understandable; that does not mark later milestones complete. Validation results are recorded only in TESTING.md.

| Milestone | Objective and dependencies | Status at the student checkpoint |
| --- | --- | --- |
| 1 | Expo 57 compatible scaffold, TypeScript, architecture, navigation, restrained design tokens | Implemented support increment; foundation/early data scaffold commit `cc5fae0` |
| 2 | Home/Map/Prepare and clearly simulated example states; depends on 1 | Implemented support increment; native map scaffold/demo included; phone presentation verification pending |
| 3 | Foreground GPS and manual selected point; depends on 1–2 | Implemented support increment; last point restored locally with explicit saved-GPS label; native permission verification pending |
| 4 | Typed NWS point response, complete warning access, freshness/error states; depends on 3 | Implemented support increment; real adapter checks and combined automated evidence below |
| 5 | Student-developed relevance, ordering explanations, additional normalization, tests, and Codex review; depends on 4 | **Waiting for original student implementation** in `src/student/priority.ts`; no original engine generated or claimed |
| 6 | Native map refinement, supplied official geometry, USGS discovery and observations; depends on 5 | Roadmap; USGS not integrated. Optional approved road adapter requires terms/credentials |
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

Real warning availability changes. The adapter checks establish that actual official responses were retrieved and parsed at those points, without promising later conditions. Hermes export validates JavaScript bundling; it does not compile/install a native binary or validate a physical phone. No native phone, simulator, or Maestro run has been performed.

Browser previews inspect shared layouts separately from native behavior. Recorded viewport inspections belong in TESTING.md; they do not establish native map/permission/dialer operation. Dependency audit findings remain unresolved: 65 findings, including 49 high and 16 moderate. See TESTING.md for the scope and limitations of that audit.

## Checkpoint acceptance

For each increment, record the code state, exact commands run and outcomes, material limitations, remaining phone tests, and a coherent commit when local Git permits. A passing typecheck does not prove live alert availability or physical map rendering. The presence of an integration file is not evidence of successful integration. Offline release verification includes force-close/restart without connectivity in an installed binary with embedded JavaScript, not only an already loaded development session.

For milestone 5, the student supplies the design note and implementation described in STUDENT_CONTRIBUTIONS.md. Review that work and its meaningful tests before enabling it in the live presentation. Preserve authorship in commits and AI_USAGE.md.

## Suggested schedule after this checkpoint

- October 10–14: student implements and explains milestone 5; review and iterate on edge cases.
- October 15–18: milestone 6 USGS/map work, only after the student contribution is reviewed; avoid scope expansion if correctness is unresolved.
- October 19–22: test real phones, low connectivity, accessibility, persistence, and source failure behavior.
- October 23–25: record the working demonstration, finalize accurate contribution/disclosure records, and complete the submission with a buffer.

The official submission deadline is **October 26, 2026, 11:00 a.m. America/Chicago** (12:00 p.m. EDT). [Official registration page](https://www.congressionalappchallenge.us/students/student-registration/). Confirm the participating district and submission requirements with the official process. No registration, submission, or publication has been performed.
