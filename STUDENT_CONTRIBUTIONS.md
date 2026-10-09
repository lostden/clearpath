# Student contributions

This ledger distinguishes the student's project vision from original code and AI-generated support. The student supplied ClearPath's purpose, Texas flooding focus, product constraints, and requested contribution boundary. No independently student-written algorithm has been supplied or verified at this checkpoint. Do not claim otherwise in the submission.

## Authorship ledger

| Work | Current attribution | Evidence to retain |
| --- | --- | --- |
| Product motivation and requirements | Student supplied | Original project request and later decisions |
| Expo scaffold and milestones 1–4 support code | Framework scaffold / Codex-assisted | Coherent commits and AI_USAGE.md |
| Offline safety summaries and documentation | Codex-assisted, official references | Source links and student review |
| Relevance/prioritization engine | **Pending student implementation** | Student code, design notes, tests, explanations |
| Review and fixes after student implementation | Record individually | Review findings; identify generated suggestions adopted |

Generated parsing, expiry, and update handling form a runnable foundation. Reading or accepting generated code does not retroactively make it independent student work. The student can independently design additional normalization and relevance behavior, implement it, explain its tests, and document the differences.

## Milestone 5 exercise

Implement deterministic, explainable relevance and display ordering using `OfficialAlert` and selected-location types. Keep the network adapter and provenance boundary intact. Work in `src/student/`, add student-authored tests, then request a Codex review. No original prioritization algorithm is provided in this checkpoint.

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
