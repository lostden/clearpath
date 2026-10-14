# ClearPath

ClearPath is a native Android/iOS emergency information assistant focused on Texas flooding and severe weather. It presents official weather warnings, worldwide recent earthquakes, nearby Texas river observations, and offline preparedness resources. This is a development checkpoint, not a validated emergency notification system or complete coverage of every disaster.

Current source is **1.1.0**, tested application commit `33d9b50b9c8fab1953f28f88235b341b6adce301` on `codex/cac-2026-readiness`. It adds explainable warning ordering, future-issuance safeguards, warning-to-guide navigation, Frisco resources and a fictional North Texas demo. The engine and this increment are AI-assisted at the user's explicit authorization, not independently student-written. See [STUDENT_CONTRIBUTIONS.md](STUDENT_CONTRIBUTIONS.md), [AI_USAGE.md](AI_USAGE.md) and the [video-readiness handoff](docs/cac-2026/VIDEO_READINESS.md).

Typecheck/lint, **924 app tests**, **37 watcher tests** and both native JavaScript exports passed October 13. Mobile-width browser checks and a later **iOS simulator** run verified the main workflow, Apple basemap/fixture rendering and saved preparation after an online Expo Go restart. On October 14 the user reported **four core physical iPhone checks PASS**: startup/tabs, North Texas warning→Flooding guide, demo map tiles/areas/zoom/drag, and kit/meeting/contact restoration after reopening Expo Go with Metro available. Device/client metadata and broader native checks remain incomplete. No 1.1.0 native binary was built; the older Android APK below does not contain these changes. Evidence and limits are preserved in [TESTING.md](TESTING.md).

## Run on a phone

### Current source on Mac and iPhone

From this checkout, run `npm start -- --lan`, keep the Mac awake, and scan the current QR code with the iPhone Camera using an Expo Go compatible with SDK 57. Use the same reachable Wi-Fi network. The [physical iPhone checklist](docs/cac-2026/IPHONE_CHECKLIST.md) records the user's four core passes and remaining permissions, keyboard, accessibility, additional map interactions and offline checks. The initial simulator launch failed; a later IPv4 localhost retry succeeded as documented in TESTING.md. Expo Go is a development transport and does not establish independent offline cold startup.

### Install the preview over USB

The latest Android preview, [version 6](https://expo.dev/accounts/lostdens-team/projects/clearpath/builds/7e0b03e4-f8cb-4c04-8af2-94e4620eaf4f), is **installed with phone-confirmed GPS, test notification and Google tiles**. Built from tested commit `84aedce302f2adaf91dc48b4354b230d81ce4e4e`, its files are `artifacts/ClearPath-7e0b03e4.apk`, the promoted `artifacts/ClearPath-latest.apk` (114,699,780 bytes) and matching `artifacts/ClearPath-preview.json`. SHA-256 is `f42db955dd6c31d1add35e4d18a329635c82a71c10ab0ea7379121fb2a505ff1`. The USB helper verified the checksum, installed and requested launch successfully; read-only package/process checks confirmed version 6 running. The user confirmed single-point GPS acquisition, a two-minute screen-awake check staying **ON / GPS FOLLOW / APP OPEN** without error, visible **TEST / NO EMERGENCY** and Google map tiles. Longer-duration following, physical movement/position accuracy, real NWS-event notification delivery and cloud push remain unverified.

The previously installed version 4 gives the bottom-tab/emergency labels their full available width and preloads the bundled Android fonts, addressing the reported **PREPAR** / **GET 9** clipping. It also includes persistent Close/Cancel controls in full-screen modals. On October 11, the user confirmed complete **PREPARE** and **GET HELP / 911** labels, Google map tiles, demo toggles/details and live feed displays/details on that version. The latest APK and metadata now select version 6; earlier inspected versioned APKs, including the phone-confirmed version 4 and locally tested version 5, are retained locally.

Reconnect the phone with a USB data cable, unlock it, leave **USB debugging** enabled, and approve **Allow USB debugging** if prompted. In this project folder, double-click **Install ClearPath.cmd**. Alternatively, run:

```powershell
Set-Location -LiteralPath 'C:\Users\twoma\Documents\New project\clearpath'
powershell -ExecutionPolicy Bypass -File .\scripts\install-preview.ps1
```

The wrapper runs the helper, which verifies the APK's SHA-256 against its matching metadata, installs with `adb install -r`, resolves the app's launcher component, and opens the ClearPath native app explicitly. It stops if the files are missing or do not match. The complete helper path passed for versions 4, 5 and 6, including checksum verification, installation and explicit launch. It preserves app data. The double-click wrapper has been reviewed but not executed.

Check the phone screen after installation and launch. Later, open **ClearPath** from the app drawer without a cable, Metro, or this computer; live feeds and map tiles still need internet. Choose a location for live local alerts, or explicitly select a **SIMULATED DEMO** scenario. Native Google tiles, repaired labels, demo layer toggles/details and live feed displays/details are user-confirmed on version 4; independent offline restart and broader native accessibility/geometry checks remain pending. As a phone-only alternative, use the APK download on the [version 6 Expo build page](https://expo.dev/accounts/lostdens-team/projects/clearpath/builds/7e0b03e4-f8cb-4c04-8af2-94e4620eaf4f); Android may ask permission to install from the downloading browser.

### Expo Go development session

The working Expo Go phone session used USB. Its recent entry, `exp://127.0.0.1:8082`, reaches this computer through the cable's port mapping. **That entry will not work after unplugging.**

There are two no-cable routes:

- **Expo Go over Wi-Fi:** the phone and computer must share a reachable network; the computer must stay awake with Metro running. Start a LAN server and scan its **new LAN QR code**. Wi-Fi and tunnel startup have not succeeded on this particular phone yet.
- **Installed preview APK:** bundles ClearPath so it can open without this computer, Metro, or USB. Live feeds and map tiles still need internet. The completed preview and matching metadata are ready for the install path above. An installed development client still uses Metro for development. [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

On this Windows machine, dependencies are already installed and the launcher adds the bundled Node/npm/Git tools to PATH. From PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\twoma\Documents\New project\clearpath'
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Keep that terminal open for Expo Go. Do not start another server on an occupied port; the already running localhost USB server is separate from a new LAN address. Use `-Check` with the helper for typecheck, lint, and tests. Installing a system Node runtime is optional for this checkout.

On another machine, use Node.js 22.13 or newer. The scaffold uses Expo SDK 57, React 19.2.3, and React Native 0.86.3. SDK compatibility is documented by [Expo](https://docs.expo.dev/versions/v57.0.0/).

Open a terminal in `clearpath`:

```powershell
npm ci
npm start
```

Install a compatible Expo Go on the phone. Put the computer and phone on the same local network, then scan the terminal's current LAN QR code with Expo Go on Android or the Camera app on iOS. Allow local-network access if prompted. The app is native; a browser preview does not verify phone behavior. A tunnel is another development transport to try, not a confirmed fix for this phone. [Expo development-server transports](https://docs.expo.dev/more/expo-cli/#tunneling).

On first launch, ClearPath opens in **live mode** with no selected point and no verified local warning result. Use **Choose location** on Home to select a listed Texas city center, request foreground GPS, or enter latitude/longitude. A city-center selection checks that one point. With automatic updates enabled, choosing a location starts the official NWS point request; manual mode requires **Refresh official alerts** when allowed. The Map tab can show a Texas regional overview before a point is selected. Regional records do not establish that a warning applies to you.

The five presentation scenarios are opt-in, fictional local fixtures with a persistent **SIMULATED DEMO** label. **Explore simulated demo** starts **North Texas flood** at the Frisco training point; the earlier Flood, Tornado, No alerts and Outage remain available. The fixed clock is a fixture, not a historical event claim. Use **Exit demo** to return to live mode. Choosing a location while in demo also switches to live mode. Real feeds are disabled during demo; basemap tiles still need internet.

To reduce repeated feed downloads, switch **Auto updates** off on Home or Map. The saved manual mode stops automatic feed requests, polling, and retries; use each feed's **Refresh** button when needed. The footer keeps **FEEDS / MANUAL REFRESH** visible. Successful copies still age into cached status, and expired warnings still disappear. Map tiles, explicit zone downloads, and external links can still use data. Update preferences load before any automatic request; an unreadable preference starts in manual mode with an explanation.

After a location has been selected, the app stores only that last selected point locally. On a later launch, **RESTORING POINT** identifies the pending read before it restores that point in live mode, allowing a matching saved snapshot to open offline. **Choose location** remains available during restoration; a newer choice wins over a delayed read or old write failure. A restored GPS selection is labeled **Saved GPS point · last selection**; a newly requested GPS point is labeled as a single reading. Neither label promises ongoing tracking. Cached information keeps its old retrieval time until a new official request succeeds. Use the location selector for another GPS reading or a different point.

Do not mix lockfiles or dependency managers. This checkout's lockfile is authoritative.

### Expo Go cannot download the app

Android's `java.io.IOException: Failed to download remote update` can occur when the phone cannot reach the development server. On this phone, LAN, ngrok/cache-reset attempts and the HTTPS download path did not produce a working startup; USB did. Clearing Metro or changing to a tunnel is not a verified repair here. If deliberately trying the tunnel transport, stop the LAN server you own with **Ctrl+C**, then use this checkout's launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Tunnel -Clear
```

The tunnel needs Expo's `@expo/ngrok` helper. If it is not installed, review Expo's installation prompt. Wait for **Tunnel ready**, close/reopen Expo Go, and scan the **new** QR code rather than opening the USB recent-project entry. Both devices need internet. The tunnel forwards the development server through ngrok at a public temporary URL; keep the terminal open during testing and stop it with Ctrl+C afterward. It is slower than LAN. The launcher invokes Expo directly so the switches do not depend on npm argument forwarding. [Expo tunnel documentation](https://docs.expo.dev/more/expo-cli/#tunneling).

If the same error persists, record the PowerShell output after scanning and the installed Expo Go version. This message alone cannot distinguish a network failure from another startup/download problem. The project requires an Expo Go version compatible with SDK 57.

### Run an Android phone through USB

If Expo Go remains stuck before opening ClearPath, use a USB data cable to bypass LAN and ngrok. This connection needs Google [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools), the existing Expo Go app, and foreground USB debugging authorization. Android Studio, Java, an emulator, a cloud build, and an Expo account are unnecessary for this route. On this machine Platform Tools 37.0.1 are installed in the parent `.tools/android-sdk` directory; the launcher finds that copy automatically. On another machine use an installed `adb.exe` or pass `-AdbPath` with its full path.

On the phone, enable Developer options (usually by tapping Build number seven times in About phone), enable **USB debugging**, connect the data cable, unlock the phone, and approve **Allow USB debugging** for this computer. Some phones need File transfer USB mode or the manufacturer USB driver. [Android device authorization](https://developer.android.com/tools/adb#Enabling).

Run from the project directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android-usb.ps1
```

The helper selects one authorized USB phone, checks that Expo Go is installed, maps device port 8082 to the computer, starts a localhost-only Metro server, waits for readiness, and opens `exp://127.0.0.1:8082` in Expo Go. It does not install/update Expo Go, erase phone app data, or change the firewall. Keep the terminal and cable connected. Ctrl+C stops the owned server and attempts to remove only the helper's port mapping. An occupied port or multiple phones produce a clear error; use `-Port` or `-DeviceSerial` when needed. [React Native USB connection](https://reactnative.dev/docs/running-on-device#method-1-using-adb-reverse-recommended).

If the phone still fails, leave that terminal running and collect bounded logs in a second terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android-usb.ps1 -Logs
```

This captures only the running Expo Go process, at most 300 relevant records from Android's main/crash buffers, into the ignored local `.expo/android-usb-device.log`. It refuses whole-phone logging if the process is missing. Review and redact any app/session/personal information before sharing logs. Metro output/errors are also local under `.expo/usb-metro-*.log`.

USB startup was confirmed on a moto g stylus - 2025 running Android 16 on October 10, 2026, using foreground Metro and the same reverse connection/launch URL. The launcher prefers IPv4 so Metro's localhost binding matches `127.0.0.1` on Windows. Its complete background-process lifecycle and native feature checklist remain pending; see [TESTING.md](TESTING.md).

## Checkpoint scope

The working increment includes Home, Map, and Prepare navigation; distinct simulated scenarios; foreground/manual location; selected-point NWS alerts; and separate regional weather, earthquake, and nearby river map layers. Check [MILESTONES.md](MILESTONES.md) for scope and [TESTING.md](TESTING.md) for executed checks and remaining phone verification. Offline safety text is bundled in the app. Live, cached, simulated, and unavailable information retain distinct labels.

Prepare opens on **FIELD GUIDES**. Its six section controls reach guides, kit, family plan, saved contacts, call numbers and **LOCAL LINKS**. Supported warning details open the matching existing guide; unsupported events open general Prepare. Original warning instructions remain above the action. Existing guide/kit/plan review dates and sources are visible. **GET HELP / 911** stays in the fixed tab area; calls require an explicit dialer confirmation. Drafts survive section changes.

Prepare shows **LOCAL COPY / SAVING**, **SAVED ON THIS PHONE**, or **SESSION ONLY / CHANGES NOT SAVED** for the latest kit, plan, and contacts. A completed form alone does not prove persistence. After a write failure, **Retry local save** attempts the unchanged latest values; another edit also attempts saving. An unreadable stored plan is protected from replacement, with no overwrite retry offered; new session edits remain usable with the session-only status.

Home checks NWS alerts for the selected point and explains deterministic ordering by official urgency, severity and certainty, then issue time and stable identity. All current warnings remain accessible; ordering is not a personal danger prediction. Map independently offers **Texas** or **U.S.** regional coverage without claiming selected-point applicability. It draws supplied polygons and lists records without geometry. Its other switches show USGS worldwide past-day earthquakes and up to 12 nearby Texas stream stations within 50 km; absent observations remain unavailable. Source and retrieval clocks remain separate. Frisco's Census reference preset checks one point, not the whole city.

For a current live regional warning with linked NWS zones, **View NWS zone areas** opens a separate preflight screen without fetching boundaries. **Download NWS boundaries** then retrieves up to four linked official zone definitions. These thin administrative outlines are separate from supplied warning polygons and measured flood extent; they do not determine whether the warning applies to a point. Partial/omitted areas remain explicit, and the original warning text stays available for instructions. Retained RAM copies keep their original retrieval time and a cached label. Closing the view, leaving Map, backgrounding, changing coverage/source, or expiration cancels its download; there is no zone polling or automatic retry loop. See [DATA_SOURCES.md](DATA_SOURCES.md) for accepted-data limits and zone validity. [NWS geolocation guide](https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf).

Earthquake event times and feed-generation times remain distinct from app retrieval times. River cards preserve the actual observation time, units, and provisional/approved status. Gage height is the station's reference measurement; it is not floodwater depth at your location, road passability, or an established flood-stage threshold. Recent retrieval does not make an old sensor reading current. The adapters use the [USGS earthquake GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), [USGS monitoring locations](https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations?f=html), and [USGS latest continuous observations](https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous?f=html).

Regional weather and USGS snapshots are cached only in memory. Visible, enabled live layers poll while the app is in the foreground and connected: weather/earthquakes once per minute, rivers once per five minutes. Switching a layer off or leaving Map stops its polling. An error, lost connection, or freshness boundary changes retained data to **cached** without changing its timestamps. The selected-point Home snapshot has its separate persisted cache; regional/USGS layers do not promise offline cold-start availability. [NWS alert service guidance](https://www.weather.gov/documentation/services-web-alerts).

The tactical interface uses dark surfaces, orange/yellow warning accents, and three bundled static font files: Archivo Black, Roboto Mono, and Roboto Mono Bold, totaling 266,224 bytes (about 266 KB / 260 KiB). Their licenses are in `assets/fonts`. Installed Android version 4 preloads their native family aliases before React text mounts. Expo Go, web and iOS retain local-asset runtime loading with system fallbacks; no runtime font download is required. Custom modal transitions and map recentering have no animation. Browser previews show an honest native-map fallback. Prepare supports local checklist progress, family-plan fields, and saved contacts. [Expo font guidance](https://docs.expo.dev/develop/user-interface/fonts/).

The shared browser layout and coordinate view were inspected at 320 × 568 and 390 × 844, including live layers, keyboard-opened demo warning details, and manually downloaded NWS zone outlines. The repaired footer was also checked at 320 × 640 and 434 × 900. Automated and browser results are recorded in [TESTING.md](TESTING.md); Google tiles and complete footer labels in installed Android version 4 are user-confirmed, while complete physical rendering checks remain pending.

Offline summaries require no content request once the app's JavaScript is loaded. Expo Go or a development client can still need Metro for cold launch. Verify force-close/restart without connectivity in an installed binary with embedded JavaScript before claiming independent offline startup; that physical verification is pending.

The optional **Wildfire perimeters** switch starts off. It uses the public NIFC current-perimeter service without a key, with separate Texas/U.S. incident coverage and up to twenty recently edited mapped records. Texas means the incident's reported state, not geographic intersection. White outlines show published footprints; cached outlines are gray. Capture dates stay separate from record editing and retrieval; missing records/partial copies are reported. Five-minute refresh and ten-minute fetched-copy labeling do not establish a current fire edge. Copies use RAM only. [Official NIFC metadata](https://www.arcgis.com/sharing/rest/content/items/d1c32af3212341869b3c810f1a215824?f=json).

Shelter occupancy, evacuation orders, and approved DriveTexas API access are not integrated. A road-resource link does not mean road closures are integrated. Earlier Android confirmations apply to their October 11 builds. Current native layout/accessibility, geometry interaction and physical offline cold restart remain pending. Home keeps operational diagnostics visible while settings controls are collapsed. The 1.1.0 ISO cloud-status repair does not enable cloud notifications.

## Location alert notifications

Home includes **ENABLE GPS + ALERTS** and **TEST NOTIFICATION**, introduced in version 5 and retained in version 6. App-local test notifications are user-confirmed in Android's notification shade on versions 5 and 6. Version 6 has confirmed single-point GPS acquisition and a two-minute screen-awake foreground check that stayed **ON / GPS FOLLOW / APP OPEN** without error. Longer-duration following, physical movement/position accuracy and actual NWS-event notification delivery remain unverified. The app-local notification confirmations are separate from the earlier Android shell display test. Enablement is explicit and asks for OS notification/GPS permission. GPS follows at most once per minute while the app is open with automatic feeds enabled. Demo, app backgrounding, manual-feed mode and a GPS fix reaching two minutes old pause it. Choosing a point manually stops following. Notifications use fresh, matching-point NWS Actual/Public messages only; they do not turn earthquake, river or perimeter observations into warnings.

The GPS startup repair is included in installed version 6. Both GPS paths now read existing permission before asking for access and bound their permission/services checks. Following exposes the current startup stage, labels failure **PAUSED / GPS ERROR** and places its error directly below the heading. Version 5's following and single-point controls remained waiting during awake phone tests; version 6's single-point acquisition and foreground following subsequently succeeded, including the two-minute screen-awake check. The repeated Android permission path is an inferred contributing cause, not a confirmed native diagnosis. GPS accuracy and freshness rules are unchanged; longer-duration following and physical movement/position accuracy remain unverified.

The first successful NWS check establishes a baseline for existing active messages. Later unseen messages, including newly encountered warnings after movement, can produce OS notifications. Persistent ID/sent dedup prevents ordinary polling repeats; storage or scheduling failure is displayed, and a crash between scheduling and persistence can still duplicate a notice. Tapping an official notice opens current live Home results. **TEST / NO EMERGENCY** is separate from the official cache and must not be presented as a real event.

**Cloud push is not configured.** Local GPS following and alert checks pause when ClearPath closes. The optional [cloud watcher](server/README.md) and tested client adapter are preparation only; the app has no cloud enrollment controls yet. They require Firebase/FCM configuration, an operator-controlled HTTPS host, private enrollment, explicit location-upload/background-permission consent and physical push/opt-out tests. Nothing has been deployed or enrolled. Its last-submitted-point freshness limit is 30 minutes; it is not continuous location tracking by itself. Adding Firebase to the existing billing-enabled Google project requires the user's terms review and inherits a pay-as-you-go plan. [Expo notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Firebase project requirements](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project).

## Keys and native maps

The implemented NWS, USGS and NIFC read-only feeds do not require an API key. Identify NWS requests with the application's User-Agent and configure a real developer contact before distributing it. [NWS API documentation](https://www.weather.gov/documentation/services-web-api), [USGS Water Data API specification](https://api.waterdata.usgs.gov/ogcapi/v1/openapi?f=html).

`react-native-maps` is included in Expo Go. A standalone Google Maps binary requires native configuration and a rebuilt development app. SDK 57 recommends version 1.27.2; use `npx expo install react-native-maps` for compatibility. Configure `androidGoogleMapsApiKey` and optionally `iosGoogleMapsApiKey` through the `react-native-maps` plugin in app configuration. Restrict Android keys by package and signing SHA-1, and iOS keys by bundle identifier. [Expo SDK 57 map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

This checkout reads `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` in `app.config.ts`; see `.env.example`. Put optional restricted keys in a local `.env.local` or the native build environment. Keep the variable names exactly as shown. The configuration passes keys only to the native map plugin and exposes boolean availability flags to JavaScript. The current package/bundle identifier is `org.clearpath.student`; use the actual development or release signing certificate when restricting the Android key. Rebuild after changing native map configuration.

Google Maps Platform setup requires an appropriate Google Cloud project, enabled platform SDK, API key, and billing configuration. Google currently requires billing enabled even though mobile Maps SDK usage is unlimited; other products/features have their own pricing. On October 11, the Cloud console confirmed a linked billing account for `clearpath-511305`; Maps SDK for Android is enabled, the existing key's Android/API restrictions are saved, and the preview build environment is configured. The user confirmed Google tiles in installed versions 2, 4 and 6. Do not commit keys. Native mobile map keys are embedded in the binary; platform and API restrictions are essential, and environment variables do not make them server secrets. [Google Maps SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key), [Android SDK usage and billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing).

With missing map configuration, use the app's fallback information and official-source links. Apple Maps is acceptable for iOS development. Never draw a substitute polygon for a live warning lacking geometry.

### Black Google map inside Android Expo Go

The physical Android test on October 10 found a black map in Expo Go 57.0.9. An [open Expo issue](https://github.com/expo/expo/issues/49323) reports the same client version and an expired Google Maps credential embedded in Expo Go. This is a likely explanation, but this phone's captured logs did not contain an authorization failure, so its exact cause remains unconfirmed. Adding this project's key cannot replace the key embedded in Expo Go.

The Google map shows a loading state and, if its tile-completion event does not arrive within 15 seconds, a clear explanation with **Retry map** and **View areas without basemap** actions. A late successful load can restore the native map. The compact Home preview has a status without nested buttons. Apple Maps retains its native presentation because it does not expose the same completion event. Simulation fixtures are local; real basemap tiles still require internet.

**View areas without basemap** opens a bundled SVG coordinate plot with longitude/latitude axes, supplied warning polygons, and enabled earthquake/gauge points. Browser previews and Android builds without a configured key also use this view. It is explicitly labeled **NO BASEMAP / COORDINATE VIEW** and **SCHEMATIC / NOT NAVIGATION**: it supplies no streets, terrain, flood extent, or safe route. Directional pan, zoom, recenter, and source details remain available. Pan moves the viewport by half its span, wraps longitude, and stops at the poles; it does not change the selected location or make a feed request. Recenter restores the original viewport and scale. This does not repair Expo Go's embedded Maps credential or verify successful Google tiles. Physical rendering of this newly added fallback still needs testing.

The Android preview configuration below is saved. Version codes 1, 2, 4, 5 and 6 finished, were downloaded, and passed static inspection; see [TESTING.md](TESTING.md) for build identities and checksums. The latest APK is version `1.0.0`, version code **6**, package `org.clearpath.student`, and non-debuggable. Its extracted certificate SHA-1 matches the Google restriction; exactly one nonempty Maps-key metadata value is present, `POST_NOTIFICATIONS` is declared, and Android background-location permission is absent. Its JavaScript bundle and all three matching font assets are present; key contents were not exposed. Certificate extraction is not full signature-integrity verification. Version 4 has user-confirmed complete footer labels, Google tiles, demo toggles/details and live feed displays/details; version 5 has a user-confirmed app-local test notification. Version 6 installed/launched successfully and has user-confirmed single-point GPS, two-minute screen-awake foreground continuity, app-local test notification and Google tiles. Longer-duration following, physical movement/position accuracy, real NWS-event/cloud delivery, offline cold start and broader native acceptance remain pending. Keep these settings for future rebuilds.

On this PC, the startup helper's PATH changes apply only inside its process. To use `npx` for the following EAS commands in your own project terminal, first run:

```powershell
$clearpathRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$clearpathTools = (Resolve-Path -LiteralPath '..\.tools\node_modules\.bin').Path
$env:PATH = "$clearpathTools;$clearpathRuntime\node\bin;$clearpathRuntime\native\git\cmd;$env:PATH"
```

1. The checkout is already linked to the Expo project `lostdens-team/clearpath` (`93c6f679-06ad-4edf-8ff7-8eec0290035b`). CLI login and remote preview-keystore generation completed on October 11 using EAS CLI 24.12.1. On a new computer, sign in with `npx eas-cli@latest login`; inspect the existing signing credentials with `npx eas-cli@latest credentials --platform android` and select **preview**. Keep the keystore private and reuse it for updates. [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/).
2. In Google Cloud project `clearpath-511305`, **Maps SDK for Android** is enabled. The existing key is restricted to **Android apps**, package `org.clearpath.student`, signing SHA-1 `F5:E1:17:60:19:33:5D:5A:12:A8:3C:D5:0F:24:B1:E3:3A:D5:F4:08`, and **Maps SDK for Android** only. This fingerprint is for the remote preview keystore, not Expo Go or a future Play App Signing certificate. This is the native Android SDK key, not a Maps JavaScript API key for a website.
3. In the [Expo project's environment-variable settings](https://expo.dev/accounts/lostdens-team/projects/clearpath/environment-variables), `GOOGLE_MAPS_ANDROID_API_KEY` is saved for **preview** with **Sensitive** visibility. Plain text and sensitive variables are available to EAS CLI when resolving this dynamic config; Secret variables are not. The existing preview profile explicitly selects that environment. A Git-ignored `.env.local` is not automatically uploaded to a cloud build. Keep the key out of chat, source, and screenshots. [EAS build environment handling](https://docs.expo.dev/eas/environment-variables/usage/).
4. The completed version 6 preview and matching metadata are ready; its USB helper install/launch, single-point GPS, two-minute screen-awake foreground follow check, app-local test notification and Google tiles are confirmed. Earlier version 4 footer/demo/live-feed checks and version 5 notification/GPS history are recorded in TESTING.md. Use **Install ClearPath.cmd** or the USB install helper above for another installation, then verify offline restart on the phone. For later rebuilds, run `npx eas-cli@latest build --profile preview --platform android`. This internal APK needs neither a Play Store publication nor a USB/Metro connection to run. Successful offline behavior still needs testing. Use the `development` profile instead only when you want an installed development client. [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

The existing `app.config.ts` map plugin consumes the exact variable name above and preserves the EAS project linkage from `app.json`. Rebuild whenever native map configuration changes. The standard EAS **preview** environment provides the staging path without requiring a custom environment name. At the October 11 checkpoint, the project, remote signing credentials, billing link, Android SDK, and restricted preview key are configured; version 6 is installed with phone-confirmed single-point GPS, two-minute screen-awake foreground follow continuity, app-local test notification and Google tiles. Footer labels and demo/live-overlay interactions were confirmed on version 4. Remaining native checks are recorded in TESTING.md. [Google setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key), [Expo map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Development builds

For local Android builds, install Android Studio, an Android SDK, and a compatible Java toolchain, then use:

```powershell
npx expo install expo-dev-client
npx expo run:android
```

Add `--device` to select a USB-connected phone with debugging enabled. Local iOS builds require macOS/Xcode: `npx expo run:ios`. Windows cannot compile an iOS app locally. A cloud development build requires an Expo account and project configuration; after those are configured, install the development client with `npx expo install expo-dev-client`, configure with `npx eas-cli@latest build:configure`, and build with `npx eas-cli@latest build --profile development --platform android` (or `ios`). Physical iPhone cloud builds require appropriate Apple developer/signing setup. Remote Android preview signing is configured, and the latest version 6 cloud preview is downloaded, inspected and installed with user-confirmed GPS acquisition, two-minute screen-awake foreground continuity, app-local test notification and Google tiles. Version 4's footer/demo/live-overlay acceptance and version 5's history remain separate evidence. Publication and paid-service purchases have not been performed. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Project notes

Read [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SAFETY.md](SAFETY.md), and [DEMO.md](DEMO.md). Follow [AGENTS.md](AGENTS.md) when changing dependencies. Refresh the validation record after each coherent checkpoint; do not infer a passing test from the presence of a test file.
