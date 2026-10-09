# ClearPath verification record

This record distinguishes executed checks from tests that still require a native build and a phone. No physical Android/iOS run or native Maestro run has been performed in this workspace.

## Automated checks

Run from the project directory with Node 22.13 or later:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run export:native
npx expo install --check
npx expo-doctor
```

The `jest-expo` preset supplies SDK 57 native test mocks. React Native Testing Library 14 uses React 19-compatible async rendering and events. Storage, connectivity, and safe-area mocks are isolated test substitutes; these checks do not prove that platform permissions, maps, or the device dialer work.

| Check | Most recent observed result, October 9, 2026 |
| --- | --- |
| TypeScript | Passed: `npm run typecheck` |
| Expo lint | Passed: `npm run lint`; test/config files also passed explicit ESLint |
| Jest | Passed: 15 suites / 114 tests in the final combined root run |
| Native JavaScript export | Passed: Android 3 MB and iOS 2.7 MB Hermes JavaScript bundles; native binary compilation not performed |
| Expo dependency compatibility | Passed: `expo install --check` |
| Expo Doctor | Passed: 21/21 checks |
| Text contrast | Seven normal-text token pairs independently checked above 4.5:1; complete device accessibility verification remains pending |
| Physical phone / simulator / Maestro | Not run; no configured device or simulator available |

Five Maestro YAML flows parsed successfully as two-document flow files. This validates YAML syntax only, not Maestro execution or native behavior. Earlier runs caught a false no-alert message during failed verification, a background freshness boundary, mocked-listener cleanup, and test storage isolation; the affected code/tests were corrected and the reruns above passed.

An earlier full run exposed an asynchronous React `act` warning from the alert provider's zero-delay display-clock update. Its test suite now controls the clock and timers consistently. The final combined run passed all 15 suites / 114 tests without console warnings. No application logs or React warnings were suppressed.

The shared React Native web layout was inspected at 390 × 844 and 320 × 568 preview sizes. Home's warning, location, emergency control, persistent demo strip, and tabs fit; Home/Prepare navigation worked, and the selected tab was exposed in the accessibility tree. Checkbox state, expanded guides, and disabled actions also have explicit accessibility state props. These browser checks support layout review only: they do not establish native screen-reader behavior, map rendering, GPS permissions, or dialer operation.

The suite exercises malformed/partially unverifiable NWS responses, original instruction preservation, timezone-aware timestamps, expiration, duplicate and update/cancellation handling, test-message exclusion, request failure/timeout/abort behavior, coordinate validation, exact selected-point cache isolation, corrupt cache rejection, and strict live/cached/demo separation. Component checks verify source labels, no-alert/failure states, original warning access, stale detail-copy provenance, expiration while a detail is open, and deliberate dialer confirmation. Foreground-GPS checks cover denial, disabled services, timeout, invalid device coordinates, and discarded late results. Persistence checks cover restored manual/saved GPS points, deliberate choices during delayed hydration, checklist/plan/contacts, storage failures, and keeping only the latest selected point.

Geographic applicability and student-defined priority ordering remain a Milestone 5 checkpoint. The current app preserves NWS point-query membership and provider order. Existing geometry validation tests are not a substitute for the student's future point-in-polygon, boundary/hole, relevance, or ordering tests.

## Native device checklist

Record phone model, OS version, build identifier, date, steps, and result for each run. Test an Android phone and an iPhone where available; include a smaller screen and the largest accessibility font size.

1. Start the app using the instructions in `README.md`. Verify that Home, Map, and Prepare are reachable and usable with large text and a screen reader. Verify tab labels and selected-tab announcements, readable timestamps, contrast, scroll behavior, and reachable 48-point controls.
2. Exercise all four demo scenarios. Confirm persistent `SIMULATED DEMO` labels on emergency and map screens; open the complete simulated warning. Confirm the outage simulation never acquires a live/cached-real source label, and expired examples stay outside current-warning displays.
3. Return to live mode. Choose a manual coordinate, refresh, and compare the returned warning text and source with the official NWS point endpoint. Live conditions change; a zero-alert response is a valid test result. Confirm the exact no-alert wording and absence of any personal-safety claim.
4. Request foreground GPS permission. Test grant, deny, and grant with location services disabled. Permission must follow user interaction, denial must leave manual selection available, and the app must remain usable. On Android test approximate location too; the app must identify location accuracy limitations.
5. Enter invalid and incomplete manual coordinates. Verify a clear error and no request with invalid input. Change selected points during a slow refresh; an old result must never appear under the new point.
6. Perform a successful live refresh, record its timestamp, then disable connectivity and refresh again. Verify cached provenance and original timestamp, failed verification wording, and no fabricated successful update. Restart offline at the same point, then choose a different point and verify that the old point's cache does not leak into it.
7. Test an expired cached warning with controlled fixtures/clock during development. Verify that it is excluded from current alerts, and the screen still explains that current information cannot be verified. A cached zero-alert result must never be presented as a current no-alert finding.
8. Enable airplane mode and visit Prepare. Check an item, add a test contact, restart, and verify persistence. Restore connectivity afterward. Test storage failure with the unit tests; real-device low-storage behavior needs an additional run.
9. Inspect the native map: pan, zoom, recenter, toggle warning areas, and tap a warning area. Compare coordinates and agency geometry with the fixture/source. Verify absence of a polygon when the agency supplied none, attribution, and graceful missing-Google-key behavior. River observations require their later milestone and must not be claimed as complete.
10. Open the emergency confirmation, then choose **Cancel**. Verify that the dialer does not open. Validate non-emergency saved-contact dialer links with a test number if needed. Do not place a real emergency call as a test.
11. Open external official resources and ordinary map directions. Verify failure handling when no suitable app is available and visible route-safety limitations. No directions result implies passable roads or a verified evacuation route.

## Maestro scripts

The `.maestro/` YAML flows are authoring-ready examples, **not executed results**. They require an installed native ClearPath build and a connected Android device/emulator or iOS simulator supported by Maestro. They do not run against Expo Go's shared application ID. Replace `APP_ID` with the installed package/bundle identifier:

```sh
maestro test -e APP_ID=org.clearpath.student .maestro/smoke.yaml
```

Run each flow and adjust platform-specific dialogs if needed. The emergency flow cancels the confirmation and never opens the dialer. GPS/live API latency and OS permissions need the additional manual checks above. See [Maestro parameters](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants.md) and [launch permissions](https://docs.maestro.dev/reference/commands-available/launchapp.md).

## Known limits and issues

- No device/simulator evidence yet. JavaScript export checks module bundling; it does not compile native projects or validate map keys and runtime permissions.
- NWS availability, incomplete warning geometry, and cached data freshness limit what can be verified. The app must retain explicit provenance and verification states.
- Nearby USGS observations and student relevance/priority logic await their recorded milestone; their tests are pending.
- Dependency audit on October 9 reported **65 findings: 49 high and 16 moderate**. Most entries are propagated through Expo/Metro/Jest tooling from five underlying advisories. Compatible nonbreaking remediation was not available for all of them. The audit's suggested forced upgrades/downgrades conflict with SDK 57 compatibility. These findings remain unresolved and require upstream review before a production release; they are not a clean security result.

Use [Expo unit testing guidance](https://docs.expo.dev/develop/unit-testing/) for the testing preset and [React Native Testing Library](https://oss.callstack.com/react-native-testing-library/docs/api/render) for current async component APIs.
