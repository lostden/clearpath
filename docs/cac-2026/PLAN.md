# ClearPath CAC readiness implementation plan

> Execute the authorized improvements in tested increments. Use the existing debugging, TDD, parallel-task and review workflows; keep progress in PROGRESS.md.

**Goal:** Deliver the strongest verified, demonstrable ClearPath increment before the October 20–21 internal target, without deployment or a final video script.

**Architecture:** Preserve point/regional feed separation, official source text, original snapshot times, demo isolation and existing storage. Add a pure explainable display-order policy, route existing warnings to bundled guides, and disclose secondary metadata progressively. No new native dependencies or cloud activation.

**Stack:** Expo 57 / React Native 0.86 / React 19.2 / TypeScript / Expo Router / existing Jest and Node tests.

**Authorization:** User-provided implementation brief in the October 13 conversation and attachment `51a55a0d-3b4c-4c1d-8e6f-fcaab80c9cbd/pasted-text-1.txt`. The user reports coordinator permission for AI implementation; no written coordinator evidence is on file. Preserve honest AI attribution.

## Constraints and review focus

- No paid builds, deployments, Firebase activation, secrets/account changes, remote pushes or history rewriting.
- Never invent personal risk, route safety, flood stage, alert coverage or independently student-written code.
- Cached, unavailable and simulated data must retain their provenance after navigation and refresh.
- Test future Alert/Update/Cancel before replacement, exact expiry, time-zone equivalents and clock rollback.
- All current warnings remain accessible after ordering; regional coverage cannot establish selected-point applicability.
- Unsupported guide mappings fall back to Prepare; repeated guide navigation must reopen the intended guide.
- Detail disclosures must preserve official instructions, errors, source state and persistent Close actions.
- An installed-app offline restart and physical iPhone behavior require real device evidence; exports/mocks are insufficient.

## Tasks

1. **Timestamp correctness** — `src/data/nws.ts`, `src/domain/alerts.ts`, point/regional freshness and corresponding tests. Write future-cancellation/rollback regressions, observe failure, implement a documented one-minute issuance skew bound before replacement, verify focused tests. Cached timestamps never advance.
2. **Explainable priority** — `src/student/priority.ts`, `tests/priority.test.ts`, Home/SituationPanel/AlertDetail integration tests. Pure `prioritizeWarnings(alerts, context)` returns ordered original alerts plus reasons. Lifecycle first; point-response evidence is explicit; urgency/severity/certainty then deterministic timestamp/identity ties. Unknown stays visible; no physical-risk score. Test frozen/shuffled inputs, conflicting classifications, missing/unknown metadata, expiry and updates before UI integration.
3. **Warning-to-guide and sources** — bounded event-to-guide resolver, `src/components/AlertDetail.tsx`, `src/app/prepare.tsx`, `src/data/preparedness.ts`, related tests. Use Expo Router params to open an existing guide; unsupported alerts open general Prepare. Expose existing source/review information without rewriting guidance.
4. **Local relevance** — `src/services/location.ts`, preparedness/local resources, fixture and picker tests. Verify a public Frisco reference coordinate and official local links. Preserve point-only semantics. Record exact sources.
5. **Mobile presentation and simulation** — shared disclosure component; Home, Map and related tests; `src/data/demo.ts`/DemoControls if a bounded North Texas scenario fits. Keep current visual identity, prominent instructions and source states. Test disclosure navigation and demo isolation; inspect small browser layouts and available iOS runtime.
6. **Small technical repairs** — cloud timestamp types/validation and real server contract regression, nested-worktree Jest ignore, SDK-compatible advisory triage only. No cloud activation. Relevant tests first.
7. **Verification and handoff** — full typecheck/lint/Jest/server tests, native JS exports, fresh live adapter checks where useful, runtime/browser checks. Append evidence to historical docs; update milestones/AI ledger accurately. Create `VIDEO_READINESS.md` and precise iPhone acceptance checklist. Independent whole-change review, repair significant findings, then coherent local commit(s).

## Execution record

- [x] Current source and audit revalidated at baseline `11520e30f4448da0585e8bfc3c79f1e70da54477`.
- [x] Working branch created: `codex/cac-2026-readiness`; master preserved.
- [x] Tasks 1–6 implemented and focused checks pass in application commit `33d9b50b9c8fab1953f28f88235b341b6adce301` (1.1.0).
- [x] Whole-change review completed; clock-admission timers and hidden Home diagnostics repaired/rechecked. Typecheck/lint, 46 suites / 924 app tests, 37 server tests and both native JS exports pass.
- [x] Current evidence, limitations and recording handoff saved in VIDEO_READINESS.md and IPHONE_CHECKLIST.md. Fresh browser workflow/narrow-layout checks pass; simulator launch timed out and physical acceptance remains pending.

Physical verification may remain pending with status **READY AFTER MANUAL PHONE VERIFICATION**, exactly as authorized by the brief. Do not certify device behavior or contest compliance without evidence.
