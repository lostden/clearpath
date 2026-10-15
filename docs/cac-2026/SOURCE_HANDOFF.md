# ClearPath 1.1.0 — local source handoff

Prepared October 14, 2026 for possible judge source/app-access requests. This local ZIP contains the tracked application, tests, assets, licenses and disclosure records. Nothing has been uploaded or made public.

- [Source ZIP](../../artifacts/ClearPath-1.1.0-review-15af3af.zip): **2,443,310 bytes**.
- [Machine-readable manifest](../../artifacts/ClearPath-review-manifest.json).
- Tested application commit: **33d9b50b9c8fab1953f28f88235b341b6adce301**.
- Archived snapshot: **15af3af55cf7ee6c378a70f8a512a3f74d400706**. Later commits can update handoff documentation; application source is unchanged.
- SHA-256: **42c922b7b9a6340e0b4268877cade0b692e492730595f288e51aaae361eb563e**.

## What was checked

All **202 archived files** match their Git snapshot blobs byte for byte. Package version is 1.1.0. AI_USAGE.md, STUDENT_CONTRIBUTIONS.md, TESTING.md, the project LICENSE and both font licenses are included. Only tracked files were archived: .git, node_modules, .expo and local environment files are absent; the two .env.example templates are included. Known credential-file/private-key/token patterns were checked without printing values. The original Git history is preserved in the checkout.

The original packaging check verified integrity. The later fresh-extraction checks below additionally verify dependency installation, static checks and JavaScript exports. Neither establishes native compilation, phone acceptance of the extracted copy, security certification or final contest acceptance. Remaining dependency findings and recommended SDK patches are documented in DEPENDENCY_REVIEW.md.

### Fresh-extraction verification — October 15, 2026

Codex verified the ZIP's SHA-256 and 202-file count, then extracted it into a new temporary directory. With Node **22.23.3** / npm **10.9.9**, `npm ci --offline --ignore-scripts --no-audit --no-fund` installed **1,134 packages** using a separate copy of the existing local npm cache. Install scripts stayed disabled; deprecation warnings appeared. This was not an online registry installation or a dependency upgrade.

In that extracted project, `npm run typecheck` and `CI=1 EXPO_NO_DOTENV=1 npm run lint -- --no-cache` both exited 0. `CI=1 EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 npm run export:native -- --output-dir <temporary-output>` also exited 0: Android **3.6 MB**, iOS **3.3 MB**, **37 assets**. Existing NO_COLOR/FORCE_COLOR environment warnings appeared. These are Hermes JavaScript bundles, not native binaries. All archived source files remained byte-identical after verification; the accepted checkout and dependency graph were unchanged. No simulator/phone UI, full Jest rerun, offline cold startup or live-service acceptance was performed in the fresh copy.

## Reviewer setup

1. Extract the ZIP and open its ClearPath-1.1.0 folder. Read README.md, TESTING.md and AI_USAGE.md first.
2. Install dependencies in that extracted copy with `npm ci --ignore-scripts`. The October 15 check used Node 22.23.3 / npm 10.9.9 and an offline cache; a new reviewer may need registry connectivity. The verified JavaScript-export workflow kept dependency install scripts disabled. Native build requirements must be reviewed separately.
3. Run npm start -- --lan. Keep the host awake and use a compatible SDK 57 Expo Go on the same reachable network, following README.md. The current physical iPhone's core workflow has user-reported passes; exact client/model metadata remain incomplete.
4. HOME → Explore simulated demo → NORTH TEXAS FLOOD → Read simulated warning → Read Flooding guide. MAP shows fictional areas; PREPARE includes kit/plan/contacts. Preserve SIMULATED DEMO labels and use fictional saved values.
5. For source verification, npm run typecheck, npm run lint and npm test are available; watcher tests use node --test server/watcher.test.mjs. Existing results are in TESTING.md. Do not claim a command passed in the extracted copy until it actually runs.

Live feeds/map tiles/source websites need connectivity. Expo Go startup can need Metro; the accepted preparation reopening test kept it available. No 1.1.0 native binary is included. Historical Android APK references describe older builds; do not treat them as this increment. Optional cloud push remains inactive.

## Preserve or rebuild

The ZIP/manifest are local ignored artifacts. Keep them with the final submission evidence if supplied to judges. If missing in another checkout, rebuild tracked content from the archived snapshot:

    git archive --format=zip --prefix=ClearPath-1.1.0/ --output=ClearPath-1.1.0-review-15af3af.zip 15af3af55cf7ee6c378a70f8a512a3f74d400706

Compute and record the rebuilt file's hash before sharing; the original hash above identifies the artifact created in this session. Source distribution or repository permission changes require a concrete reviewed handoff. The public video, final portal answers and actual submission still remain to complete.

