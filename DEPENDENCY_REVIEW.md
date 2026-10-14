# Dependency review — October 10, 2026

## Current recheck — October 13, 2026

Read-only `npm audit --json` now reports **67 findings: 51 high, 16 moderate, zero critical**; `npm audit --json --omit=dev` reports **61: 45 high, 16 moderate**. Both exit 1 because findings remain. The full count differs from the earlier 65; the five underlying advisory packages are still `braces`, `node-forge`, `decode-uri-component`, `sprintf-js` and `uuid`. No dependency versions changed in 1.1.0; the lockfile diff changes only the root app version. Do not attribute count movement to a package change without evidence.

The source-path analysis below still matters: the URL decoder is a potentially relevant Router runtime concern; several other traced paths are build/test/signing tools. `--omit=dev` is not a native bundle inventory. Suggested automatic changes include Expo 44, Router 58 and Jest 30; no compatibility-proven SDK 57 remediation was established. No forced fix/override or native upgrade was applied. Typecheck/lint, 924 app tests and both exports pass, which does not resolve security findings. Audit JSON is captured in the session's `/private/tmp/clearpath-cac-audit-final.json` and `clearpath-cac-audit-prod-final.json`; rerun for current advisory data.

During the later October 13 simulator retry, Expo CLI advertised Expo 57.0.28 and five other package updates. They were not installed at that checkpoint. The subsequent read-only review below records the actual alignment check and patch contents.

### Online SDK 57 patch review — October 13, 2026

`CI=1 EXPO_NO_DOTENV=1 npx --no-install expo install --check` **exited 1**, recommending these latest SDK 57 patch versions for best compatibility. This is a current recommendation warning; do not describe the check as passing or substitute the earlier offline/historical result.

| Package | Installed | Recommended |
| --- | --- | --- |
| `@expo/ui` | 57.0.22 | ~57.0.23 |
| `expo` | 57.0.27 | ~57.0.28 |
| `expo-location` | 57.0.20 | ~57.0.21 |
| `expo-router` | 57.0.25 | ~57.0.26 |
| `expo-splash-screen` | 57.0.9 | ~57.0.10 |
| `jest-expo` | 57.0.5 | ~57.0.6 |

Official published package contents were compared with read-only `npm diff --diff=<installed> --diff=<recommended>` calls, also tracing Expo's CLI/modules-core dependencies. Router's package has no JavaScript changes; registry metadata still selects `query-string@^7.1.3` → `decode-uri-component@^0.2.2`, so this Router patch does not establish remediation of that advisory. Location/Splash changelogs state no user-facing changes. CLI fixes TypeScript config-directory/path resolution; jest-expo corrects its Babel caller identity. Expo UI/modules-core include hosted-view/layout/keyboard and UI control fixes/features. Searches found no direct `@expo/ui`, `RNHostView` or `matchContents` use in ClearPath source/tests or its headless Router UI path. These observations do not prove the patch set is risk-free or irrelevant to every indirect path.

**Decision:** retain the already tested 1.1.0 dependency graph for this recording candidate. No current ClearPath failure or fix for the five audit roots was established by this patch review; updating would require a new regression/native-verification increment. The latest-patch recommendation remains an explicit maintenance item, not a resolved check. No package was installed, no lockfile changed and no claim of current package freshness is made. Future deliberate updates should use Expo's installer and rerun the full checks and relevant native acceptance. [Expo dependency alignment guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## Historical October 10 review

This is a scoped review of the SDK 57 dependency graph after the compatible `react-native-svg@15.15.4` addition. It is not a complete security assessment or a native-binary software bill of materials. No package, React version, install-script policy, or lockfile was changed by this review.

## Executed audit and comparison

Read-only commands were run against the current checkout with the bundled Node 24.19.0 and local npm CLI:

```sh
npm audit --json
npm audit --json --omit=dev
```

| Observation | Total | High | Moderate |
| --- | --- | --- | --- |
| October 9 recorded baseline | 65 | 49 | 16 |
| SVG installation's reported summary | 67 | 51 | 16 |
| October 10 fresh full audit JSON | 65 | 49 | 16 |
| October 10 fresh `--omit=dev` audit JSON | 61 | 45 | 16 |

Neither fresh audit reported a low or critical finding. The installation summary's two additional records were not reproduced in the fresh full audit, so they cannot be attributed to two new SVG advisories. Audit data and propagated package counts can change; retain the actual JSON from a future run when comparing results.

At the SVG-addition checkpoint, the Git lockfile diff added only `react-native-svg` and its parser/helper dependencies; it changed no existing package version. The fresh audit did not identify SVG, `css-select`, `css-tree`, `css-what`, `nth-check`, or its other newly added dependencies as vulnerable. This result does not establish that SVG is free of all vulnerabilities. The current coordinate fallback generates structured SVG paths/primitives from validated numbers; it does not download or parse remote SVG XML/CSS.

`--omit=dev` still reports much of Metro/Jest/config tooling because Expo/React Native packages include those modules in their dependency graph. A production-dependency audit is not proof that every reported package is bundled into an installed phone app, nor proof that the installed artifact is secure.

## Underlying advisories and inspected paths

The 65 full-audit records propagate from five advisory sources. The application source has no direct import of these five packages or of `query-string`. The NWS/USGS adapters parse typed JSON; they do not feed agency text into the affected glob, RSA-verification, format-string, UUID-buffer, or URI-decoding functions. This source review does not exclude every indirect runtime path.

| Installed root package | Issue and inspected dependency path | Impact in this checkout / available fix |
| --- | --- | --- |
| `braces@3.0.3` | Deeply nested glob patterns can exhaust the Node stack; `micromatch` propagates the finding through Metro/Jest. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Build/test glob processing is the traced path, not hazard observation data. No patched release is listed; the registry's latest remains 3.0.3. Keep project/glob inputs trusted and require an upstream fix before claiming remediation. |
| `node-forge@1.4.0` | Malformed RSA PKCS#1 v1.5 signatures may be accepted; Expo CLI/code-signing utilities call its verification functions. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | This is relevant to desktop signing/verification tooling. No patched release is listed; the registry's latest remains 1.4.0. It is not the app's NWS/USGS transport or parser. Do not treat the affected verification routine as a resolved security boundary. |
| `decode-uri-component@0.2.2` | Malformed percent-encoded input can cause excessive CPU use; Expo Router → `query-string@7.1.3`. [Maintainer disclosure](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr) | URL/query processing is a potentially relevant app/runtime path; installed Router code imports query-string. The patch is 0.5.0, outside query-string's `^0.2.2` range and now ESM. A blind override can break its CommonJS consumer. An SDK-compatible upstream adapter/update, or a separately tested incoming-URL boundary, is needed; neither has been applied or proved here. |
| `sprintf-js@1.0.3` | Unbounded precision format strings can abort formatting; coverage config → js-yaml/argparse. [Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | The traced path is tooling; the app does not supply user/agency text as sprintf format strings. No patched release is listed; latest 1.1.3 is also affected. |
| `uuid@7.0.3` | v3/v5/v6 output-buffer bounds can produce partial writes; Expo config → Xcode project tooling. [Maintainer disclosure](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) | The inspected Xcode call uses `uuid.v4()` without an output buffer, which is outside the cited vulnerable method pattern. Patched 11.1.1+ is outside the consumer's current major range; no compatibility-tested override was made. |

These paths narrow the practical concern but do not dismiss the findings. The fresh audit's proposed automatic fixes include Expo 44, Jest 30, React Native 0.87, and other SDK-incompatible changes. No safe automatic fix for the entire graph has been established. Do not run `npm audit fix --force` to obtain a smaller count. Keep the compatible lockfile, review upstream SDK-compatible patches, and rerun source/bundle/device checks for any deliberate remediation.

## React test renderer compatibility

The current SDK 57 runtime requires React/React DOM 19.2.3 and React Native 0.86.3, as recorded in Expo's local `bundledNativeModules.json` and [versioned SDK reference](https://docs.expo.dev/versions/v57.0.0/). Changing React to silence a test-only warning would break that supported runtime boundary.

Installed `test-renderer@1.3.0` uses `react-reconciler@0.34.0`, whose peer range is React `^19.3.0`. The test-renderer maintainer's [compatibility policy](https://github.com/mdjastrzebski/test-renderer/blob/main/docs/versioning.md) explicitly maps **1.2.x to React 19.2 / reconciler ~0.33.0**, and 1.3.x to React 19.3. Registry metadata confirms `test-renderer@1.2.0` and reconciler 0.33.0's React `^19.2.0` peer.

An exact **dev-only `test-renderer@1.2.0` pin** preserves runtime React 19.2.3. Installed React Native Testing Library 14.1.0 permits `test-renderer:^1.0.0`, React `>=19.0.0`, React Native `>=0.78`, and Jest `>=29.0.0`; 1.2.0 satisfies that peer range. `jest-expo@57.0.5` has no peer/dependency on this package; it separately depends on `react-test-renderer@19.2.3`, which remains unchanged. The root implementation applied the exact dev pin after this evidence was reviewed. Installed metadata now confirms test-renderer 1.2.0 resolves reconciler 0.33.0 with React `^19.2.0`. Final suite results are recorded separately in TESTING.md.

## Blocked resolver postinstall

`unrs-resolver@1.12.2` declares a `napi-postinstall` helper. Its matching optional Windows x64 binding `@unrs/resolver-binding-win32-x64-msvc@1.12.2` is already installed. A direct read-only `require("unrs-resolver")` succeeded and exposed the resolver API. Therefore the blocked postinstall warning does not establish a broken resolver on this machine, and broad install-script permission is not needed for the observed state. Re-run lint after dependency changes; a future missing platform binding should be diagnosed specifically instead of enabling all dependency scripts.

No credentials, local key files, or personal phone logs were read for this review. Final lint/typecheck/test/export results are recorded in [TESTING.md](TESTING.md).
