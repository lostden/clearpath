# Student contributions

## Current attribution — October 14, 2026

Version 1.1.0's priority engine is implemented with Codex assistance at the user's explicit authorization. `src/student/` is a historical path, not evidence of independent student code. AI-generated work includes the timestamp fix/clock timers, ordering and explanations, guide routing, Frisco resources/demo, UI disclosures/diagnostics, cloud contract correction and their tests. See AI_USAGE.md and tested commit `33d9b50b9c8fab1953f28f88235b341b6adce301`.

The user reports coordinator permission for AI-assisted implementation; no written organizer evidence is stored here and no blanket waiver is assumed. Student product requirements and historical feedback are documented. Each person's substantial coding, technical understanding and testing contribution still needs an evidence-backed entry. This is an evidence gap, not a claim that the students lack ability or did no work. Do not describe generated fixes as challenges the students independently solved.

| Person | Actual contribution / files or commit | Decision and explanation | Tests personally written/run | AI assistance |
| --- | --- | --- | --- | --- |
| Student 1 — current user, name pending | Original concept and requirements for government alerts, location warnings, preparedness, maps and disaster information; product direction, implementation review and feedback (confirmed by the user October 13) | Requested October 10 tactical redesign and added official map layers; directed development decisions. Implementation remains Codex-assisted | Reported all four core iPhone checks PASS October 14; actual test operator and individual attribution of earlier Android checks remain unconfirmed | User explicitly states that extensive Codex implementation must not be described as independently written by them |
| Student 2 — partner, name pending | Student 1 reports October 14 that the partner completed pre-audit features using AI implementation, specifically demo, map and checklist (within baseline `11520e3`) | Reported role is AI-assisted development of those features. Specific independently written code, debugging decisions and technical understanding have not been established | Not yet established | AI implementation explicitly confirmed by Student 1; preserve the existing Codex ledger and do not relabel generated baseline code as independently student-written |

### Git/contribution review after the user's clarification

All **27 commits** on the current branch through `e0bce45` were inspected by date, author label and subject alongside the assistance ledger and subsequent implementation. Earlier commits identify Codex or the AI-assisted scaffold. October 13 commits `33d9b50` and `e0bce45` were executed by Codex using the checkout's configured Git identity; their messages and AI_USAGE.md identify the assistance. A human-looking Git author label is not evidence of independent student implementation. No inspected commit establishes a separately student-authored algorithm or test. This does not prove that no student did technical work; it means the record cannot assign such work reliably.

The historical Android version-6 GPS/maps/test-notification confirmations are retained as user reports, without assigning them to a particular teammate. On October 14 the current user reported that all four supplied iPhone checks passed: startup/tabs, North Texas warning→Flooding guide, demo map tiles/areas/zoom/drag and kit/meeting/contact restoration after closing/reopening Expo Go with Metro available. TESTING.md preserves their scope. The report does not explicitly identify the test operator. Current simulator checks were performed by Codex, not either student.

In the same follow-up, Student 1 described the partner's contribution as **“they completeed everything up to what you started with before editing.”** Asked for specific features and assistance, Student 1 clarified **“AI implementation in the features before you graded it (demo, map, check list, etc).”** Record a user-reported AI-assisted development role for the pre-audit demo, map and checklist. This is not evidence that every baseline line was independently student-written. The baseline's existing AI-assistance records and Git review remain intact.

The later script can use the reported product/review role for Student 1 and AI-assisted demo/map/checklist development role for Student 2. Before adding personal coding/debugging/test claims or a challenge supposedly solved independently, clarify the actual task, person and assistance. Presenter names and individual phone-test attribution are still missing; do not fill gaps with invented accomplishments.

Before narration, each student should be able to trace one real source record through validation, lifecycle, display ordering and UI; explain cached versus live and why future cancellation is rejected; and honestly state what they personally changed or tested. Understanding a generated implementation does not change its authorship.

## Historical original student boundary — October 9–11

The exercise and pending ledger below are retained verbatim as earlier context. They do not describe the now-implemented engine or require pretending that it was student-written.

This ledger distinguishes the student's project vision from original code and AI-generated support. The student supplied ClearPath's purpose, Texas flooding focus, product constraints, and requested contribution boundary. No independently student-written algorithm has been supplied or verified at this checkpoint. Do not claim otherwise in the submission.

## Authorship ledger

| Work | Current attribution | Evidence to retain |
| --- | --- | --- |
| Product motivation and requirements | Student supplied | Original project request and later decisions |
| Expo scaffold and milestones 1–4 support code | Framework scaffold / Codex-assisted | Coherent commits and AI_USAGE.md |
| October 10 tactical design, local fonts, startup/maps support, regional NWS/USGS layers, and manual linked-zone viewer | Codex-assisted at the student's explicit request | Requested scope, exact generated files/commits, official references, and TESTING.md; this does not complete original milestone 5 or all of milestone 6 |
| Offline safety summaries and documentation | Codex-assisted, official references | Source links and student review |
| Relevance/prioritization engine | **Pending student implementation** | Student code, design notes, tests, explanations |
| Review and fixes after student implementation | Record individually | Review findings; identify generated suggestions adopted |

Generated parsing, expiry, and update handling form a runnable foundation. Reading or accepting generated code does not retroactively make it independent student work. The student can independently design additional normalization and relevance behavior, implement it, explain its tests, and document the differences.

## Milestone 5 exercise

Implement deterministic, explainable relevance and display ordering using `OfficialAlert` and selected-location types. Keep the network adapter and provenance boundary intact. Start with the deliberately unimplemented contract in `src/student/priority.ts`, add student-authored tests, then request a Codex review. No original prioritization algorithm is provided in this checkpoint.

Before coding, write a short design note answering:

1. Which evidence establishes applicability: an NWS point response, supplied geometry, or verified zone membership? How will you represent missing evidence?
2. How will you handle Polygon/MultiPolygon holes, boundaries, absent geometry, invalid points, and unknown applicability?
3. How will severity and urgency interact when warnings conflict? Explain the display convention without claiming physical-risk probabilities.
4. How will updated/canceled messages be recognized without hiding unrelated warnings of the same event type?
5. How will a stable tie-breaker keep ordering predictable across identical refreshes? What reason will accompany each result?
6. Which malformed fields should be rejected, retained as unknown, or exposed as incomplete? How will the UI avoid claiming a fully verified empty state after partial parsing failure?

Suggested contract: accept normalized alerts, selected coordinates, source applicability evidence, and an explicit clock. Return an ordered collection with a reason for each result and explicit relevance/freshness information. Keep functions pure: do not read GPS, fetch a feed, mutate source text, or write storage inside this engine. The student chooses the detailed API and ordering policy.

## Reference fields, not an original algorithm

Official severity values include `Extreme`, `Severe`, `Moderate`, `Minor`, and `Unknown`. Urgency values include `Immediate`, `Expected`, `Future`, `Past`, and `Unknown`; certainty is separate. These describe source messages. They are not a supplied personalized-risk score, and unknown does not mean low danger. Review the actual NWS response model before implementation. [NWS API specification](https://www.weather.gov/documentation/services-web-api).

Until the student engine is implemented and reviewed, support code retains provider order after basic validity/update filtering. All warnings remain inspectable. This is not claimed as the finished "most relevant warning" feature.

## Student-authored acceptance cases

These are test requirements and discussion prompts, not a generated implementation or a claim that milestone 5 tests have passed.

| Case | Required invariant / question |
| --- | --- |
| A expires exactly at the supplied clock | A is not a current warning |
| A has invalid/missing expiration | Do not claim A is verified current; document treatment |
| Two copies share identity with different sent times | Retain the correct latest message deterministically |
| Update B references A; unrelated C has the same event | Resolve the update; preserve C |
| Cancellation references A | A is not displayed as a current active message |
| Point-filtered official result has no polygon | Missing polygon alone must not discard applicability |
| A polygon has a hole | A point inside the hole is not inside the covered polygon |
| A MultiPolygon contains the selected point in its second part | Do not inspect only the first part |
| A point is on the boundary | Specify and test a consistent boundary convention |
| Severe/Expected warning and Moderate/Immediate warning coexist | Student explains a deterministic convention; both remain visible |
| Unknown severity/urgency coexists with known values | Do not invent source classifications or suppress the unknown message |
| Two alerts tie under the student's chosen rules | Stable order and an understandable tie-break reason |
| Cached alert is unexpired | Ordering cannot make it verified live |
| Simulated and official input are accidentally combined | Reject the mixed source path; never relabel simulated data live |
| Coordinates are NaN or outside allowed ranges | Reject invalid coordinates without fabricating applicability |
| Input array/object is frozen | Engine remains pure and does not mutate source instructions |
| Input order is shuffled | Explain whether and why the chosen deterministic results are invariant |

Use small synthetic geometries and fixed timestamps. Add adversarial examples rather than tests that simply copy the implementation. Review performance on many alerts only after correctness is demonstrated.

## Contribution log to fill during development

| Date | Student-authored files/commit | Decision and explanation | Tests written/run | AI assistance used |
| --- | --- | --- | --- | --- |
| Pending | — | Original relevance/prioritization design | — | — |

For each entry, state what you wrote, what you changed after review, and why. A credible explanation should trace one real input through parsing, relevance, ordering, presentation, and freshness boundaries, including a case where the available information is incomplete.
