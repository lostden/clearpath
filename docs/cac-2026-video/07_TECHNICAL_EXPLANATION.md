# 07 — Technical explanation and attribution

## Example 1: explained, stable ordering

**Used function:** [prioritizeWarnings, line 101](/Users/shivengarisa/clearpath/src/student/priority.ts:101). Input context lines 9–15; classification order 23–25 / 52–58; tie comparator 61–65; lifecycle/sort/return 129–147. Actual Home integration: [index.tsx:38](/Users/shivengarisa/clearpath/src/app/index.tsx:38), with explanation passed to the detail modal.

- Input: normalized warnings, one selected point, explicit time, live/cached/demo/unavailable source, and exact-point applicability evidence.
- Processing: validate context and demo-source isolation; resolve lifecycle before ordering. Compare ordinal urgency, then severity, then certainty, followed by newer issuance/stable identity ties. Unknown remains explicit; it does not mean low danger. Ambiguous equal-time copies are disclosed.
- Output: original warning objects with explanations; no GPS/network/storage call, no generated danger probability and no silent suppression based on rank. Lifecycle cancellation/expiry is distinct from display ordering.
- Visible result: the fictional flash-flood warning appears first and its detail disclosure explains the order, with the other current warning still accessible. Regional membership is not selected-point evidence.
- Evidence: `tests/priority.test.ts` (41 tests), `tests/home-priority.test.tsx`, plus current full-suite run. Original records, shuffled/frozen input, ties, unknowns and source isolation are covered.

## Example 2: future cancellation admission

**Used functions:** [hasPlausibleIssuance, line 6](/Users/shivengarisa/clearpath/src/domain/alerts.ts:6) and [currentAlerts, line 79](/Users/shivengarisa/clearpath/src/domain/alerts.ts:79). Show guard 3–8, then admission-before-resolution 83–88. The NWS adapter additionally rejects unverifiable fresh collections; the cached-display guard prevents old invalid messages from erasing a current warning.

A future-issued cancellation once reached replacement logic and suppressed a valid warning. The repair validates `sent` before duplicate/reference processing and allows at most **60 seconds** of issue-time clock skew. Legitimate cancellations continue to remove referenced warnings; valid future onset remains allowed. This does not repair a badly set device clock or guarantee delivery.

**Regression:** [tests/alerts.test.ts:75](/Users/shivengarisa/clearpath/tests/alerts.test.ts:75), lines 75–88. Parameterized Alert/Update/Cancel cases assert both `[original, future]` and `[future, original]` retain the valid original. Supporting tests include valid cancellation, malformed/expired data and exact skew boundaries. The engineering point is the **order of validation and cancellation**, not a fake live incident.

## Explain the core diagram accurately

[Architecture graphic](assets/02_architecture.png): NWS selected-point response → issuance/lifecycle validation → explained order → Home/detail → existing-guide navigation → Prepare. Bundled demo fixtures join as a separately labelled source. Preparation is local AsyncStorage state; the Home NWS snapshot is an exact-point disk cache. Separate regional NWS/USGS/NIFC map queries are inventory features, not proof that a regional record applies to the selected point. [Full architecture](../../ARCHITECTURE.md).

The [stack graphic](assets/03_stack.png) distinguishes mobile/UI, data boundaries and local state. OpenAI is a development assistant here; the app does not use a runtime AI model to rewrite an official alert or predict hazards. Optional cloud push is inactive and excluded from the visual data flow.

## Who may truthfully say what

| Person/tool | Supported statement | Do not substitute |
| --- | --- | --- |
| Manas | Original concept/requirements, product direction and implementation review; reported framework/feature learning | “I independently wrote the priority algorithm / timestamp repair.” |
| Shiven | Earlier AI-assisted demo/map/checklist work; four user-reported October 14 iPhone checks; reported testing/debugging/shipping/backend learning | An invented independent backend implementation, debugging incident or production deployment. |
| Codex | Extensive app implementation, integration, reliability fixes, algorithms, tests, documentation and this production package | “Only a few suggestions” or hidden script/asset assistance. |

Sources: [student contribution record](../../STUDENT_CONTRIBUTIONS.md), [AI usage record](../../AI_USAGE.md), tested application commit `33d9b50`. Git author labels alone do not establish independent student code. The coordinator permission is user-reported; its written scope is unverified. Both students should explain these examples in their own words before filming; understanding code does not change its authorship.
