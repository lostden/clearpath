# ClearPath verification record

This record distinguishes executed checks from pending native verification. Android Expo Go startup and the map-loading failure UI were confirmed on a physical phone on October 10, 2026. The current home screen was confirmed after restoring USB transport on October 11; successful native Google tiles/overlays remain unverified. Complete native feature checks, iOS startup, and native Maestro execution remain pending.

## Android setup — October 11, 2026

The moto g stylus - 2025 was authorized as device `ZA2233QT3V`. Metro listened on IPv4 localhost port 8082. After a remote-update download failure, `adb reverse --list` was empty; recreating `tcp:8082` and cold-opening Expo Go reached `ExperienceActivity`. The user then confirmed the ClearPath home screen without the reported `bodyStrong` error. A bounded current-Expo-Go-process log check showed no fresh matching TypeError, CLI-connect warning, or remote-download error after that launch. The earlier typography frame did not match current source lines; this is startup/transport evidence, not proof of a cache defect or complete screen acceptance.

EAS CLI 24.12.1 authenticated the user's existing account and linked `lostdens-team/clearpath` to project `93c6f679-06ad-4edf-8ff7-8eec0290035b`. Expo generated the remote Android preview keystore for `org.clearpath.student`; its public SHA-1 is recorded in README for the Google restriction. No keystore or API-key values were written into the repository. Dynamic configuration now preserves `config.extra`, including the linked EAS project ID, before adding boolean map-configuration flags.

For those configuration changes, full TypeScript and source/test ESLint passed. `expo install --check` reported dependencies up to date; Expo Doctor 1.20.4 passed **21/21 checks**. Configured images/fonts are present and tracked, and the lockfile matches dependencies and devDependencies. The previous **575-test** result below applies to the application checkpoint; it was not rerun for account metadata. The restricted Google key, native APK build/install, successful tiles/overlays, and independent offline cold start remain pending.

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

| Check | Baseline result, October 9, 2026; later checks below |
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

The original shared React Native web layout was inspected at 390 × 844 and 320 × 568 preview sizes. Home's warning, location, emergency control, persistent demo strip, and tabs fit; Home/Prepare navigation worked, and the selected tab was exposed in the accessibility tree. Checkbox state, expanded guides, and disabled actions also have explicit accessibility state props. These were checks of the earlier design and support layout review only: they do not establish native screen-reader behavior, map rendering, GPS permissions, or dialer operation. The current tactical layout and eight text-token contrast pairs were separately checked below; complete device accessibility checks remain pending.

The suite exercises malformed/partially unverifiable NWS responses, original instruction preservation, timezone-aware timestamps, expiration, duplicate and update/cancellation handling, test-message exclusion, request failure/timeout/abort behavior, coordinate validation, exact selected-point cache isolation, corrupt cache rejection, and strict live/cached/demo separation. Component checks verify source labels, no-alert/failure states, original warning access, stale detail-copy provenance, expiration while a detail is open, and deliberate dialer confirmation. Foreground-GPS checks cover denial, disabled services, timeout, invalid device coordinates, and discarded late results. Persistence checks cover restored manual/saved GPS points, deliberate choices during delayed hydration, checklist/plan/contacts, storage failures, and keeping only the latest selected point.

Geographic applicability and student-defined priority ordering remain a Milestone 5 checkpoint. The current app preserves NWS point-query membership and provider order. Existing geometry validation tests are not a substitute for the student's future point-in-polygon, boundary/hole, relevance, or ordering tests.

## Native device checklist

### Android startup troubleshooting — October 10, 2026

The user reported that Expo Go never finished opening the app after LAN, ngrok, cache reset, and an HTTPS launch attempt. Earlier diagnostics retrieved the Android manifest and complete development bundle through ngrok; those fetches were computer checks, not successful phone startup. Phone request headers identified Expo Go 57.0.9 / runtime SDK 57. Its recorded packager status response was valid, but no phone bundle request was captured. No specific client-side cause has been established.

Google Platform Tools 37.0.1 was downloaded from the official Android repository and `adb version` ran successfully. The initial device inventory found no connected phone. `scripts/android-usb.ps1` prepares a localhost-only USB connection and narrowly scoped Expo Go process logs. At that stage the USB launch and native screen verification were pending.

PowerShell syntax and the missing-device error path passed under Windows PowerShell 5.1. Its read-only HTTP readiness check passed against the existing Metro server. TypeScript and lint passed after the helper was added. An independent review corrected Android launch-timeout reporting and ensured port cleanup still runs if the owned server has already exited. Automatic approval review blocked an optional background-server verification command; that command did not run. During the initial authorization attempts, ADB still returned zero devices.

After the user connected the cable, toggled USB debugging, and approved the computer prompt, ADB detected one authorized **moto g stylus - 2025 running Android 16**. Windows also reported a working ADB interface. Expo Go was installed. The first foreground Metro server bound only to `::1`; a readiness request to `127.0.0.1` failed. Restarting that owned server with Node's `--dns-result-order=ipv4first` bound it to `127.0.0.1`, and `/status` returned `packager-status:running`. The USB helper now includes the same flag.

A targeted `adb reverse --no-rebind tcp:8082 tcp:8082` succeeded. Android accepted the `exp://127.0.0.1:8082` VIEW intent in Expo Go with `Status: ok`. Metro then recorded an Android bundle request (1,536 modules), and the user confirmed **ClearPath home screen** on the phone. No computer bundle probe was issued during this run. Automatic approval review had blocked an earlier combined USB setup/restart command; the successful launch used separate setup and VIEW commands without force-stopping Expo Go.

This verifies USB transport and physical Android home-screen startup in Expo Go. The helper's hidden background-process lifecycle has not been exercised end to end, and maps, GPS permission behavior, dialer confirmation, offline binary startup, accessibility, and the remaining checklist below still need device verification. No native ClearPath binary was compiled or installed in this run.

TypeScript, Expo lint, and USB launcher PowerShell syntax checks passed after the IPv4 launcher correction.

### Android map tile failure — October 10, 2026

The user reported a black rectangle inside ClearPath's map area while the surrounding page remained visible. The phone's installed Expo Go version was verified as **57.0.9**. Expo's public version-discovery API still listed that same Android client for SDK 57 on October 10; no newer matching client was found through that API. This was not a Play Store eligibility check. Demo coordinates and polygon conversion were valid; no black map style or incorrect map type was configured. Bounded Expo Go process logs showed Google Play services/Maps renderer initialization. No Maps authorization failure was present in the captured records. The matching [Expo Go issue](https://github.com/expo/expo/issues/49323) makes its embedded Maps credential a likely cause, not a verified diagnosis for this device.

Google maps now wait for `onMapLoaded`, rather than treating `onMapReady` as proof that tiles rendered. After 15 seconds without completion, a loading explanation and retry action replace the silent black area. Retry remounts the map; a late tile-completion callback can recover the existing map, and changing the point resets completion state. The full failure panel can grow for larger text. The compact Home preview has no nested retry button. Apple MapKit does not expose `onMapLoaded`, so it retains its prior native presentation without this Google-only loading gate.

The user reopened the physical Android Map tab and confirmed **Map did not finish loading** with **Retry map**. This verifies the failure UI on the phone; successful basemap tiles, polygons, and map interactions remain unverified. The user has an Expo account but no Google Cloud Maps project/key. No Cloud project, billing, API key, signing credentials, or native build was created. The installed-build configuration already accepts `GOOGLE_MAPS_ANDROID_API_KEY` through the native map plugin; a Google Cloud setup and rebuilt APK remain required for that route.

The map-failure checkpoint passed TypeScript, Expo lint, scoped ESLint for the changed test files, and **16 Jest suites / 123 tests** without console warnings. Nine new map tests cover completion versus readiness, the timeout, retry, late recovery, point changes, missing-key handling, compact controls, and Apple Maps behavior. An initial full run revealed that the older warning-detail fixture had expired against the real clock; those tests now use a fixed fake clock and unmount before restoring real timers, preserving all expiration assertions. The clean combined rerun exercised both changes. Mocked map callbacks do not prove successful native tiles.

### Tactical redesign and official map layers — October 10, 2026

The user explicitly requested the tactical dark interface and all three available source groups: NWS weather warnings, USGS earthquakes, and nearby Texas river gauges. First launch now stays in live mode with no selected point and an unverified local result; demo scenarios require a deliberate selection. The UI bundles three static font faces totaling 266,224 bytes (about 266 KB / 260 KiB), with system fallbacks during loading/failure. Custom modal transitions and map recentering use no animation. These implementation facts are not physical-device acceptance results.

Map's Texas/U.S. regional NWS query is separate from Home's selected-point query. Only supplied warning geometry is drawn; records without polygons stay in the list with an explicit missing-geometry explanation. Global earthquakes cover the past 24 hours. Rivers select up to the nearest 12 Texas USGS stream stations within 50 km of the selected point, preserving real observation times, units, and provisional status. Missing measurements remain unavailable. No flood depth, station flood-stage threshold, road passability, evacuation route, or comprehensive disaster coverage is inferred.

The new USGS adapter/hook files passed TypeScript and scoped ESLint. Their two focused Jest suites passed **16 tests**. Cases include malformed feeds, aged-out earthquakes, actual zero versus absent observations, geographic filtering, batch queries, safe pagination, instant-only readings, observed/source timestamps, independent layer switches, foreground cancellation, request cadence, cached provenance, and no real-feed requests in demo. An interim combined root run passed **21 suites / 169 tests** before additional map QA work. TypeScript and lint also passed after the SVG coordinate fallback integration and the exact dev-only test-renderer 1.2.0 pin; React remains 19.2.3.

| Current October 10 combined check | Executed result |
| --- | --- |
| Full Jest run | **34 suites / 470 tests passed**, 37.837 seconds, no console warnings; the affected **28 screen/detail tests** passed again after the final demo-selection state refinement |
| SDK dependency compatibility | `expo install --check`: dependencies are up to date |
| Final TypeScript / Expo lint | Full typecheck and ESLint across source/tests passed with no diagnostic output |
| Final native JavaScript export | Android **3.4 MB**, iOS **3.1 MB**, Hermes, **37 assets**; passed again after the final mode-boundary state refinement |
| Expo Doctor | **21/21 passed** with the bundled Git executable available on PATH |
| Current browser layout | Tactical screens inspected at **320 × 568** and **390 × 844**; details below |
| Tactical text contrast | Eight foreground/background token pairs exceeded **4.5:1**; exact ratios below |

JavaScript export is not an Android/iOS native binary build or physical acceptance test. No warning suppression was used to obtain the clean Jest result.

The first Doctor run reported 20/21 because Git was missing from PATH, so its `.expo` ignore check could not complete correctly. `.gitignore` already contained `.expo/`; the bundled Git's explicit `check-ignore .expo/` succeeded. Rerunning Doctor with that Git directory on PATH passed all 21 checks without changing the ignore file.

| Tactical text pair | Contrast ratio |
| --- | --- |
| White / black | 21.00:1 |
| Body gray / black | 12.55:1 |
| Orange / black | 6.71:1 |
| Yellow / black | 14.67:1 |
| White / surface `#111111` | 18.88:1 |
| Body gray / surface `#111111` | 11.29:1 |
| Orange / surface `#111111` | 6.04:1 |
| White / disabled surface | 13.20:1 |

These token measurements cover the listed text pairs, not every composite element or a device accessibility audit.

A real read-only adapter probe at **October 10, 2026, 22:05 UTC (5:05 p.m. America/Chicago)** parsed 200 earthquakes and 12 nearby stations for the Kerrville point `30.0474,-99.1403`. Seven stations had a supported measurement and five had none. The newest observed reading was `2026-10-10T21:55:00+00:00`; the river snapshot was fetched at `2026-10-10T22:05:32.210Z`. The earthquake feed was generated at `2026-10-10T22:05:12Z`. These counts/time values describe that probe only; they do not verify current local safety or successful phone map rendering. [Earthquake feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), [Water Data API](https://api.waterdata.usgs.gov/ogcapi/v1/openapi?f=html).

The phone is currently unplugged. Current font rendering, large-text layout, successful native tiles, regional polygons, earthquake/gauge markers, marker details, layer toggles, coordinate fallback, and share behavior require a new phone run. The fallback uses a bundled SVG longitude/latitude plot, explicitly labeled as schematic without a basemap/navigation; its addition is not evidence that Google Maps tiles work. No Google Cloud key/billing/signing configuration or native ClearPath APK build has been completed. The `preview` APK setup and its EAS environment are documented in README.md. A locally ignored key does not reach the cloud build automatically.

### Warning targets, feed provenance and save recovery — October 10, 2026

The combined regression run passed **35 suites / 525 tests** in **28.089 seconds**, without console warnings. Full TypeScript and source/test ESLint passed. No dependency, native Maps configuration or student priority implementation changed.

The coordinate warning suites passed **48 tests**, with **51** existing native-map/fire rendering checks also passing. Each warning groups its multipart and dateline copies into one target while retaining separately painted filled paths, independent holes and overlap. Focused cases assert unchanged projected paths, original callbacks, source labels, culling/counts and static compact views. Native SVG grouping uses supported library props; actual native touch and screen-reader grouping remain unverified while the phone is unplugged.

The USGS adapter suite passed **28 tests**, including provider status/count validation before raw-feature filtering. HTTP-success responses with invalid metadata, inconsistent counts or false-empty collections are rejected. Valid non-earthquake records, aged records and duplicates count toward raw completeness before display filtering. The Map/observation-detail suites passed **38 tests**; two cached-at-open/reconnect regressions first failed against the old implementation. Details retain their selected source, retrieval/generation times and record; replacement, removal, correction or a changed station-distance context cannot lend current verification to that old copy.

Preparation provider/screen suites passed **29 tests**. Deferred write cases cover retrying exact unchanged kit/plan/contact values, repeated and stale retry callbacks, later edits during successful or failed retries, retry failure/recovery, unmount, pending hydration and protected unreadable storage. **Retry local save** is offered only for an eligible failed write; it is not an overwrite option after a read failure. These mocked storage failures are automated evidence, not physical low-storage testing.

At **390 × 844**, the actual browser displayed explicitly labeled **Retrieved** and **Feed generated** times, with river/earthquake refresh controls before their records. A U.S. regional copy retrieved at **23:45:47 UTC** had **456 records / 34 mapped / 422 without supplied geometry**, with 34 distinct warning-group actions. Those visible counts describe that copy only. Enter opened its official flash-flood warning; after reload, Enter opened the Texas flood-warning group at **320 × 568**, retaining original agency instructions and source labels. The narrow timestamp view wrapped without horizontal clipping.

An earthquake detail at **390 × 844** retained retrieval **23:49:07 UTC**, feed generation **23:48:12 UTC**, observation **23:42:03 UTC** and update **23:46:11 UTC** as separate fields. After the layer refreshed, that retained detail became cached with those exact times unchanged. This verifies shared browser behavior; it does not establish native map tiles or a physical startup-time target. A transient hot-reload error occurred between dependent source edits; the completed source reloaded successfully and passed the checks above.

Ignored local browser proof: `artifacts/feed-timestamps-preview.jpg`, `artifacts/feed-timestamps-narrow-preview.jpg`, `artifacts/warning-keyboard-preview.jpg` and `artifacts/earthquake-detail-preview.jpg`. Save-retry failures were verified through the deferred tests rather than forced browser-storage corruption. Browser warn/error logs after **23:48 UTC** were empty. The preview returned to live Home, no selected point, automatic updates on, and its viewport override reset.

Final full TypeScript and source/test ESLint passed after the privacy copy was updated to include optional NIFC requests and RAM-only wildfire storage. Final Hermes exports passed at **3.4 MB Android / 3.1 MB iOS**, with **37 assets**: Android `entry-ac994d762967b4388462cb14803d4aca.hbc`, iOS `entry-822503df5a61d3cbaa902abfde79042c.hbc`, in `.expo/validated-native`. The CLI emitted only its existing NO_COLOR/FORCE_COLOR environment warning. These are JavaScript exports, not compiled/installed binaries; no APK, account, billing or key was created.

### Fixed emergency access and request guards — October 10, 2026

The combined run passed **36 suites / 575 tests** in **39.153 seconds**, without console warnings. Full TypeScript and source/test ESLint passed. Focused feed scheduling tests passed **83 cases**, including obsolete callbacks after disabling, A→B→A context changes, unmount, canceled waiting slots, duplicate request sharing, remount cooldowns and provider Retry-After. NWS point/regional provider pauses are shared; earthquake and river providers retain separate pauses. Cache identities, original retrieval times and display aging remain unchanged. A separate read-only gate review found no blocking issue for the current single-observer feed topology.

One confirmed **GET HELP / 911** action now sits outside Home, Map and Prepare scrolling content. At **320 × 568**, the browser measured its target at **77.6 × 58 pixels**, with one visible action. It remained visible on Map and deep in Prepare's unchecked kit after switching away and back. Demo labeling and Exit remained present. Manual refresh status wrapped alongside the action. Full-screen modals retain their own close controls; this check does not establish native dialog or screen-reader behavior.

Home's flood-demo headline moved from **y=625** to **y=370** in the narrow preview. The first screen now includes the warning type and severity, with the full headline and agency instructions retained in scrolling content. This is a layout measurement, not a timed physical startup test or personalized priority claim. The invalid contact form retained its entered values and exposed its error in an `aria-live="polite"` region; automated invalid-input cases confirmed no contact/storage write. The test draft was canceled and no call, share or external resource was opened.

Ignored browser proof: `artifacts/home-first-fold-before.jpg`, `artifacts/home-first-fold-after.jpg`, `artifacts/persistent-help-prepare-preview.jpg` and `artifacts/contact-error-preview.jpg`. The later 390-pixel browser command timed out, so no new 390-pixel result is claimed. Actual native large-text and dialer checks remain pending while the phone is unplugged.

Android/iOS Hermes JavaScript exports passed at **3.4 MB / 3.1 MB**, with **37 assets**: Android `entry-659ce522819c7c962357614387cbb76d.hbc`, iOS `entry-1d1a58442ed5a9bb831a8cfff328f9b7.hbc`, in `.expo/validated-native`. The CLI emitted its existing NO_COLOR/FORCE_COLOR environment warning. No dependency, Maps key, account, billing, student priority implementation or installed binary changed.

### Optional NIFC perimeters — October 10, 2026

The anonymous real adapter probe at **23:28:33 UTC** accepted **20 of 105** matching U.S. mapped records, with **85 omitted**, **47,905 vertices**, **174 polygon parts / 175 rings**, and **1,748,052 UTF-8 bytes** across four geometry pages (the count response was 15 bytes). Two capture dates remained unknown. Texas incident-state filtering returned count zero plus a valid empty geometry collection at **23:28:32 UTC**; this does not establish no fire affecting Texas. Results describe that retrieval only. [Official service](https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0).

Adapter **57**, hook **21**, wildfire-rendering **28**, and detail **3** focused tests passed. Cases cover strict WF/category/incident-state validation, HTTP-200 ArcGIS errors, malformed/uncounted/all-invalid emptiness, exact holes/dateline geometry, UTF-8/vertex/part/ring limits, bounded pages, explicit partial copies, later-page Retry-After and discard-on-abort. Hook tests cover default off/manual mode, foreground/network/cancel, per-coverage RAM copies, verified-empty removal, double taps, capture-date preservation and provider/cadence gates surviving true Map unmount/remount. Screen tests also preserve a selected copy's initial source, invalidate details across demo entry/exit and keep wildfire scope/counts separate from weather and the selected point.

The actual browser at **390 × 844** displayed the optional switch, a verified Texas empty mapped-record copy, the national **20/105/85 partial** result and supplied outlines after pan/zoom. Whiskey Creeks retained capture **September 30, 02:39:38 UTC** (September 29 on the Chicago device clock), independently of its October 10 polygon edit and client download. A multipart fire initially produced repeated coordinate-map controls; combining unchanged closed subpaths now gives one logical action per perimeter. Native pointer polygons retain all parts; multipart native screen-reader behavior still needs the phone. The refresh action sits above the record list, and coverage limits precede records.

The final browser confirmed exactly one coordinate action for Dome's multipart perimeter, and **Enter** opened its retained detail. The detail was also inspected at **320 × 568**, with wrapped labels/dates and no horizontal clipping; DOM dialog bounds matched 320 × 568. Browser warn/error logs from 23:21 UTC onward were empty. Preview was returned to live Home, no selected point, Auto updates on, wildfire off, and viewport override reset.

Saved ignored browser evidence: `artifacts/wildfire-detail-preview.jpg` and `artifacts/wildfire-detail-narrow-preview.jpg`. JavaScript exports and browser plots do not establish Google/Apple native tile or outline rendering. No new dependency, account, key, billing or installed APK was introduced. The final lint initially rejected a synchronous effect reset; the mode-boundary state adjustment passed full lint/typecheck and the affected 28 tests without suppressing a rule. Final bundles: Android `entry-bf3a9f5fc45f828ef5db8920e4af98c1.hbc`, iOS `entry-314d3e0939b7db90b31a29369c73e4a4.hbc`.

### On-demand NWS zone viewer — October 10, 2026

The warning's zone-area action opens a preflight without downloading. An explicit request draws independently labeled administrative outlines and reports failed/omitted areas; it does not fill missing warning geometry or decide whether the warning applies to the selected point. Its retained RAM copies keep original retrieval times. Current warning identity, issuance time, zone membership, verified source, active tab, connectivity, foreground state, and expiry gate the viewer. Close/background/expiry abort synchronously; late results and double taps are guarded. Coverage changes explicitly clear selection.

The focused viewer and geometry-fit suites passed **18 tests**, including the added independent zone-definition expiry case. Those checks cover manual preflight, download/cancellation behavior, expiry/foreground guards, source labels, and fitting supplied geometry. The combined boundary-service and NWS adapter focused suites passed **49 checks** with TypeScript/scoped lint clean, covering strict identities/geometry, budgets, memory cache, cancellation, cooldown, and effective/expiration dates. These results are included in the combined evidence above; they do not establish successful native rendering. The phone remains unplugged.

### Current browser inspection — October 10, 2026

The tactical shared UI was inspected at **320 × 568** and **390 × 844**. A live Texas browser snapshot showed **nine regional NWS warnings: one with a supplied polygon and eight without**, alongside **200 worldwide earthquakes**. These are counts observed during that session, not current conditions or personal risk. A simulated polygon could be opened with **Enter**; its complete frozen warning retained **SIMULATED DEMO** labeling without a false expired-warning notice. At 320 pixels wide, Prepare's checklist advanced to **1/12** after a checked item and was restored to **0/12**; the Flooding guide expanded correctly.

The live Corpus Christi Coastal Flood Advisory had six linked NWS zones. Explicit downloads at **22:32:51 UTC** and **22:36:21 UTC** loaded **four zones**, with **zero failed** and **two not loaded** under the four-endpoint limit. White, unfilled zone outlines and the four source panels were visually verified in the browser. Names/details remain in those panels; individual polygon parts are excluded from accessibility announcements to avoid hundreds of duplicate graphics. Module hot reload reset the RAM cache between those attempts, so both showed accurately retrieved copies rather than claiming a cache hit. A separate real loader probe at approximately **22:35 UTC** successfully loaded forecast zone `TXZ345` (247 polygon parts) and county zone `TXC199` (one part); its repeat reused RAM copies with their original retrieval times.

Web SVG property errors found during inspection were corrected. The subsequent browser run had **no new console errors after 22:29 UTC**. These checks verify shared browser layout, explicit manual source requests, the coordinate fallback, keyboard activation, and visible zone separation. They do not verify Google Maps tiles, physical phone rendering, native screen-reader behavior, all accessibility settings, or successful offline binary startup.

Local proof images: [simulated Map screen](artifacts/flood-map-preview.jpg) and [live NWS zone outlines](artifacts/nws-zone-preview.jpg). Both files were saved and inspected; the zone image shows the settled white outlines and partial-coverage counts. The `artifacts` directory is Git-ignored, so these local screenshots are not promised as part of a cloned checkout or submission.

### Manual updates, local saves and coordinate pan — October 10, 2026

The final combined run after these changes passed **28 suites / 327 tests**, with no console warnings. Full TypeScript and source/test ESLint also passed. Android/iOS Hermes exports passed at **3.3 MB / 3.0 MB**, with **37 assets**, to `.expo/validated-native`. The new preference/control suite passed 10 focused cases, the updated preparedness suite passed 15, and the coordinate plot suite passed 24. Manual scheduling tests cover hydration, initial/poll/resume/reconnect suppression, explicit refresh, source age/expiry, location/coverage isolation, cancellation and disabled-layer guards. Two USGS race cases first reproduced a repeated refresh canceling the first request; passing `cancelRefetch: false` made both calls share that request and preserve its original cooldown. No dependency or native map configuration changed in this refinement.

At **320 × 568**, the named Auto updates switch toggled off with clear manual-mode copy and the persistent footer. After a browser reload and preference hydration, it remained off, all fresh regional/USGS counts remained zero/unavailable, and explicit refresh actions were enabled. **Refresh weather** retrieved nine regional NWS records at **22:50:08 UTC**; earthquakes stayed unavailable. At **22:53:11 UTC**, with no automatic weather refresh, that exact timestamp remained and the copy was labeled cached/unverified. An explicit earthquake refresh at **22:57:44 UTC** displayed 198 events; the formerly long magnitude `1.75372219085693` displayed as `1.75`, with underlying values unchanged. The preview was restored to live Home, automatic updates on, no selected point, and a 0/12 checklist. No new browser warning/error logs appeared after **22:49:30 UTC**. This checks policy and presentation in the browser; exact request suppression is additionally covered by the scheduling tests.

At **390 × 844**, Prepare showed **LOCAL COPY / SAVED ON THIS PHONE**. A water-item check advanced to 1/12 and was restored to 0/12; save status settled back to saved. Deferred/failing storage tests cover saving/session-only feedback and ensure old completions cannot claim a newer edit is saved. Successful restoration performs no redundant write, and unreadable storage stays protected.

Coordinate **Pan east** moved the Texas viewport from `31.1000,-100.0000` to `31.1000,-93.0000` at the same 14-degree span. Recenter restored the original center/span; the selected location stayed unset and the NWS timestamp remained unchanged. Focused cases cover dateline wrapping, polar limits, exact overlay coordinates, selected-point separation, prop resets, compact behavior and exhausted controls. This does not establish native rendering.

Saved and inspected local proof: [manual update mode](artifacts/manual-updates-preview.jpg), [preparation save status](artifacts/preparation-status-preview.jpg), and [coordinate pan controls](artifacts/coordinate-pan-preview.jpg). These share the ignored local artifact limitation above.

### Saved-point startup, offline sections and GPS recovery — October 10, 2026

The combined Jest run passed **30 suites / 353 tests** in **23.599 seconds**, without console warnings. Full TypeScript and source/test ESLint passed. Native Hermes exports passed at **3.3 MB Android / 3.1 MB iOS**, with **37 assets**. Metro recovered from a file-map cache deserialization warning by doing a full crawl; the export completed successfully. No dependency or native configuration changed.

AppState's focused suite passed **22 tests**. Pending restoration is distinct from an absent point; malformed saved records report a restore failure. Explicit selections and demo choices suppress late reads/errors, and obsolete queued/in-flight write failures cannot overwrite current feedback. The Home screen suite passed **six tests** covering restoration feedback, enabled location choice, actual selected coordinates, unavailable provenance, and demo separation.

Prepare's **four screen tests** use the real preparation provider. They cover bundled guides and 911 before hydration completes, kit progress/persistence across sections, retained family-plan edits and unfinished contact drafts, and explicit contact/211 confirmation before a mocked dialer opens. The kit progress View is accessible. GPS picker/service suites passed **nine / twelve tests**, including hide/reopen recovery, cancellation followed by a manual selection, ignored late success/failure, and nearby manual validation. Cancellation prevents the pending attempt from selecting a point; it does not claim to stop an already-started operating-system location call. New GPS labels identify a single reading rather than an indefinitely current position.

The browser's compact Prepare header and all five section controls were inspected at **320 × 568**. At **390 × 844**, Enter expanded the bundled Flooding guide and selected the emergency-number section. The index retained pressed state and the 911 action; no call or external resource was opened. Submitting invalid latitude `300` kept the selector open with the error beside the coordinate fields and submit action; no point was selected. These checks do not measure five-second phone startup or establish native screen-reader/permission behavior.

Saved and inspected local proof: [Prepare section index](artifacts/preparation-index-preview.jpg), [offline field guides](artifacts/offline-guides-preview.jpg) and [manual-coordinate validation](artifacts/manual-location-error-preview.jpg). No new browser warning/error logs appeared after **23:01 UTC**. The preview was restored to live Home, automatic updates on, no selected point and a reset viewport. These remain ignored local artifacts. README now distinguishes the USB-only recent entry, unverified Wi-Fi/tunnel transport, an unbuilt installed preview APK, and optional native Google Maps setup.

Record phone model, OS version, build identifier, date, steps, and result for each run. Test an Android phone and an iPhone where available; include a smaller screen and the largest accessibility font size.

1. Start the app using the instructions in `README.md`. Verify that Home, Map, and Prepare are reachable and usable with large text and a screen reader. Verify tab labels and selected-tab announcements, readable timestamps, contrast, scroll behavior, and reachable 48-point controls.
2. Exercise all four demo scenarios. Confirm persistent `SIMULATED DEMO` labels on emergency and map screens; open the complete simulated warning. Confirm the outage simulation never acquires a live/cached-real source label, and expired examples stay outside current-warning displays.
3. On a fresh install, verify live mode has no selected point and no verified local result. Choose a manual coordinate, refresh, and compare the returned warning text and source with the official NWS point endpoint. Return from a demo and repeat. Live conditions change; a zero-alert response is a valid test result. Confirm the exact no-alert wording and absence of any personal-safety claim.
4. Request foreground GPS permission. Test grant, deny, and grant with location services disabled. Permission must follow user interaction, denial must leave manual selection available, and the app must remain usable. On Android test approximate location too; the app must identify location accuracy limitations.
5. Enter invalid and incomplete manual coordinates. Verify a clear error and no request with invalid input. Change selected points during a slow refresh; an old result must never appear under the new point.
6. Perform a successful live refresh, record its timestamp, then disable connectivity and refresh again. Verify cached provenance and original timestamp, failed verification wording, and no fabricated successful update. Restart offline at the same point, then choose a different point and verify that the old point's cache does not leak into it.
7. Test an expired cached warning with controlled fixtures/clock during development. Verify that it is excluded from current alerts, and the screen still explains that current information cannot be verified. A cached zero-alert result must never be presented as a current no-alert finding.
8. Enable airplane mode and visit Prepare. Check an item, add a test contact, restart, and verify persistence. Restore connectivity afterward. Test storage failure with the unit tests; real-device low-storage behavior needs an additional run.
9. Inspect the native map: pan, zoom, recenter, toggle warning areas, and tap a warning area. Compare coordinates and agency geometry with the fixture/source. Verify absence of a polygon when the agency supplied none, attribution, tile loading/retry behavior, and graceful missing-Google-key behavior. Repeat in an installed APK with its own restricted native Maps key.
10. Open the emergency confirmation, then choose **Cancel**. Verify that the dialer does not open. Validate non-emergency saved-contact dialer links with a test number if needed. Do not place a real emergency call as a test.
11. Open external official resources and ordinary map directions. Verify failure handling when no suitable app is available and visible route-safety limitations. No directions result implies passable roads or a verified evacuation route.
12. Switch Map between Texas/U.S. regional weather coverage and compare its records with that regional endpoint; confirm Home still checks the selected point separately. Inspect mapped/unmapped counts and records without polygons. Open earthquake and gauge details, compare agency source times/units/status, and verify that absent readings are unavailable. Switching layers off, leaving Map, backgrounding, and demo mode must stop their requests.
13. After successful Map requests, disconnect and verify cached labels with unchanged source/retrieval times. Confirm an old observation remains visibly delayed even after a recent successful fetch. Restart offline: only the selected-point persisted Home snapshot is promised; new regional/USGS snapshots are memory-only. In an installed APK, force-close/restart without Metro and verify bundled preparation content.
14. During a Google tile timeout, open **View areas without basemap**. Verify the schematic/no-navigation labels, coordinate axes, warning polygons/holes, independent source labels, enabled event/station points, selection marker, zoom/recenter, and detail actions. Compare the supplied coordinates with their source. Test empty/outside-window views without a safety claim and a return to **Retry Google Maps**. Repeat the fallback in web and an Android build missing its key.
15. Open a current live warning's **View NWS zone areas** and confirm the preflight makes no boundary request. Download manually; compare zone identifiers/outlines with official zone endpoints, including holes and partial/oversized failures. Verify separate warning/zone meanings, original retrieval timestamps for RAM hits, official definition dates when present, and no personal-applicability claim. Double tap, close during download, background, switch coverage/demo, turn weather off, disconnect, or expire/remove/update the warning: downloads must stop, late results must stay hidden, and reopening must require a new explicit action.

## Maestro scripts

The `.maestro/` YAML flows are authoring-ready examples, **not executed results**. They require an installed native ClearPath build and a connected Android device/emulator or iOS simulator supported by Maestro. They do not run against Expo Go's shared application ID. Replace `APP_ID` with the installed package/bundle identifier:

All five flows were aligned with the current live-first tactical UI and Prepare section index on October 10. Their **119 authored steps** parsed as five valid two-document YAML files with no parser diagnostics; command/selector shapes were inspected. Persistence selects the kit and waits for **LOCAL COPY / SAVED ON THIS PHONE** before restarting. Demo entry/exit is explicit. The emergency flow checks the shared action on all three tabs, including deep kit scrolling and retained scroll after navigation, and stops at Cancel. Use a disposable test build for `clearState`. Parsing and source alignment do not verify native visibility, selected-state selectors, or successful device execution.

```sh
maestro test -e APP_ID=org.clearpath.student .maestro/smoke.yaml
```

Run each flow and adjust platform-specific dialogs if needed. The emergency flow cancels the confirmation and never opens the dialer. GPS/live API latency and OS permissions need the additional manual checks above. See [Maestro parameters](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants.md) and [launch permissions](https://docs.maestro.dev/reference/commands-available/launchapp.md).

## Known limits and issues

- Physical Android home-screen startup through USB is confirmed for the current design on October 11. Complete current native acceptance checks and iOS/simulator verification remain pending. JavaScript export does not compile native projects or validate map keys and runtime permissions.
- Google basemap tiles did not render in the observed Android Expo Go 57.0.9 run. The failure UI is confirmed on the phone; an installed build with its own restricted Maps key remains unverified.
- NWS availability, incomplete warning geometry, and cached data freshness limit what can be verified. The app must retain explicit provenance and verification states.
- The scoped USGS integration has adapter/hook test and real-request evidence above; successful phone overlays remain pending. Milestone 6 is only partially implemented. The original student relevance/priority engine remains blank, and its student-authored tests remain pending.
- Dependency audit on October 9 reported **65 findings: 49 high and 16 moderate**. A fresh October 10 full JSON audit after SVG installation again reported 65; the installation's 67/51-high summary was not reproduced. Five underlying advisories propagate through the package graph; URI decoding through Router is a potentially runtime-relevant path, while several inspected paths are tooling. No safe automatic remediation for the whole SDK 57 graph was established. These findings remain unresolved; see [DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md) for exact versions, reachability limits, and renderer/resolver compatibility evidence.

Use [Expo unit testing guidance](https://docs.expo.dev/develop/unit-testing/) for the testing preset and [React Native Testing Library](https://oss.callstack.com/react-native-testing-library/docs/api/render) for current async component APIs.
