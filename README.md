# ClearPath

ClearPath is a native Android/iOS emergency information assistant focused on Texas flooding and severe weather. It presents official weather warnings, worldwide recent earthquakes, nearby Texas river observations, and offline preparedness resources. This is a development checkpoint, not a validated emergency notification system or complete coverage of every disaster.

The original relevance and prioritization engine remains deliberately unimplemented at milestone 5. The user explicitly requested the October 10 tactical redesign and additional official map layers; that supporting work does not complete the student engine or all of milestone 6. Generated support code must not be described as independently student-written. See [STUDENT_CONTRIBUTIONS.md](STUDENT_CONTRIBUTIONS.md) and [AI_USAGE.md](AI_USAGE.md).

## Run on a phone

Use Node.js 22.13 or newer. The scaffold uses Expo SDK 57, React 19.2.3, and React Native 0.86.3. SDK compatibility is documented by [Expo](https://docs.expo.dev/versions/latest/).

Open a terminal in `clearpath`:

```powershell
npm ci
npm start
```

Install a compatible Expo Go on the phone. Put the computer and phone on the same local network, then scan the terminal QR code with Expo Go on Android or the Camera app on iOS. Allow local-network access if prompted. The app is native; a browser preview does not verify phone behavior. If LAN access is blocked, use `npx expo start --tunnel` after checking the requested tunnel dependency and network setup.

On first launch, ClearPath opens in **live mode** with no selected point and no verified local warning result. Use **Choose location** on Home to select a listed Texas city center, request foreground GPS, or enter latitude/longitude. A city-center selection checks that one point. Choosing a location starts the official NWS point request; refresh on Home when allowed. The Map tab can show a Texas regional overview before a point is selected. Regional records do not establish that a warning applies to you.

The four presentation scenarios are opt-in, fictional local fixtures with a persistent **SIMULATED DEMO** label. Enter one from Home, then use **Exit demo** to return to live mode. Choosing a location while in demo also switches to live mode. Real feeds are disabled during demo; basemap tiles still need internet.

To reduce repeated feed downloads, switch **Auto updates** off on Home or Map. The saved manual mode stops automatic feed requests, polling, and retries; use each feed's **Refresh** button when needed. The footer keeps **FEEDS / MANUAL REFRESH** visible. Successful copies still age into cached status, and expired warnings still disappear. Map tiles, explicit zone downloads, and external links can still use data. Update preferences load before any automatic request; an unreadable preference starts in manual mode with an explanation.

After a location has been selected, the app stores only that last selected point locally. On a later launch it restores that point in live mode, allowing a matching saved snapshot to open offline. A restored GPS selection is labeled **Saved GPS point · last selection**; it is not a new GPS reading. Cached information keeps its old retrieval time until a new official request succeeds. Use the location selector for a current GPS reading or a different point.

On this Windows machine, Node/npm/Git were absent from the initial PATH. A helper uses the bundled Node runtime and locally installed npm CLI:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Use `-Check` with that script for typecheck, lint, and tests. `pnpm` is also available through the runtime reported by `load_workspace_dependencies`; use its reported executable path if npm is unavailable. Do not mix lockfiles or dependency managers. This checkout's lockfile is authoritative. Installing a system Node runtime is optional, not a prerequisite for this session.

### Expo Go cannot download the app

Android's `java.io.IOException: Failed to download remote update` can occur when the phone cannot reach the development server over LAN. Stop the running server with **Ctrl+C**, then use this checkout's launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Tunnel -Clear
```

If prompted to install Expo's `@expo/ngrok` tunnel helper, accept the installation. Wait for **Tunnel ready**, close/reopen Expo Go, and scan the **new** QR code rather than opening the old recent-project entry. Both devices need internet. The tunnel forwards the development server through ngrok at a public temporary URL; keep the terminal open during testing and stop it with Ctrl+C afterward. It is slower than LAN. The launcher invokes Expo directly so the switches do not depend on npm argument forwarding. [Expo tunnel documentation](https://docs.expo.dev/more/expo-cli/#tunneling).

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

Prepare shows **LOCAL COPY / SAVING**, **SAVED ON THIS PHONE**, or **SESSION ONLY / CHANGES NOT SAVED** for the latest kit, plan, and contacts. A completed form alone does not prove persistence. An unreadable stored plan is protected from replacement; new session edits remain usable with the session-only status. After a write failure, another edit retries saving the latest values.

Home checks NWS alerts for the selected point. Map independently offers **Texas** or **U.S.** regional NWS coverage, drawing only supplied agency polygons and listing warnings with missing geometry. Its other switches show the USGS worldwide past-24-hour earthquake feed and up to the nearest 12 USGS Texas stream stations within 50 km of the selected point. A river layer needs a selected point; a missing observation is represented as unavailable, never an invented zero. Map coverage and Home's point result have separate source labels and retrieval times. Provider warning order is retained until the student implements milestone 5.

For a current live regional warning with linked NWS zones, **View NWS zone areas** opens a separate preflight screen without fetching boundaries. **Download NWS boundaries** then retrieves up to four linked official zone definitions. These thin administrative outlines are separate from supplied warning polygons and measured flood extent; they do not determine whether the warning applies to a point. Partial/omitted areas remain explicit, and the original warning text stays available for instructions. Retained RAM copies keep their original retrieval time and a cached label. Closing the view, leaving Map, backgrounding, changing coverage/source, or expiration cancels its download; there is no zone polling or automatic retry loop. See [DATA_SOURCES.md](DATA_SOURCES.md) for accepted-data limits and zone validity. [NWS geolocation guide](https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf).

Earthquake event times and feed-generation times remain distinct from app retrieval times. River cards preserve the actual observation time, units, and provisional/approved status. Gage height is the station's reference measurement; it is not floodwater depth at your location, road passability, or an established flood-stage threshold. Recent retrieval does not make an old sensor reading current. The adapters use the [USGS earthquake GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), [USGS monitoring locations](https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations?f=html), and [USGS latest continuous observations](https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous?f=html).

Regional weather and USGS snapshots are cached only in memory. Visible, enabled live layers poll while the app is in the foreground and connected: weather/earthquakes once per minute, rivers once per five minutes. Switching a layer off or leaving Map stops its polling. An error, lost connection, or freshness boundary changes retained data to **cached** without changing its timestamps. The selected-point Home snapshot has its separate persisted cache; regional/USGS layers do not promise offline cold-start availability. [NWS alert service guidance](https://www.weather.gov/documentation/services-web-alerts).

The tactical interface uses dark surfaces, orange/yellow warning accents, and three bundled static font files: Archivo Black, Roboto Mono, and Roboto Mono Bold, totaling 266,224 bytes (about 266 KB / 260 KiB). Their licenses are in `assets/fonts`. Font loading uses Expo's local-asset API with system fallbacks; it requires no font download at runtime. Custom modal transitions and map recentering have no animation. Browser previews show an honest native-map fallback. Prepare supports local checklist progress, family-plan fields, and saved contacts. [Expo font guidance](https://docs.expo.dev/develop/user-interface/fonts/).

The current shared browser layout and coordinate view were inspected at 320 × 568 and 390 × 844, including live layers, keyboard-opened demo warning details, and manually downloaded NWS zone outlines. Automated and browser results are recorded in [TESTING.md](TESTING.md); successful native tiles and current physical rendering remain pending.

Offline summaries require no content request once the app's JavaScript is loaded. Expo Go or a development client can still need Metro for cold launch. Verify force-close/restart without connectivity in an installed binary with embedded JavaScript before claiming independent offline startup; that physical verification is pending.

Wildfire perimeters, shelter occupancy, evacuation orders, and approved DriveTexas API access are not integrated. A road-resource link does not mean road closures are integrated. The student engine remains pending even if temporary display ordering exists. The phone was unplugged during the latest redesign, so its current native layout, map tiles, and new overlays remain unverified on a physical device.

## Keys and native maps

The implemented NWS and USGS read-only feeds do not require an API key. Identify NWS requests with the application's User-Agent and configure a real developer contact before distributing it. [NWS API documentation](https://www.weather.gov/documentation/services-web-api), [USGS Water Data API specification](https://api.waterdata.usgs.gov/ogcapi/v1/openapi?f=html).

`react-native-maps` is included in Expo Go. A standalone Google Maps binary requires native configuration and a rebuilt development app. SDK 57 recommends version 1.27.2; use `npx expo install react-native-maps` for compatibility. Configure `androidGoogleMapsApiKey` and optionally `iosGoogleMapsApiKey` through the `react-native-maps` plugin in app configuration. Restrict Android keys by package and signing SHA-1, and iOS keys by bundle identifier. [Expo SDK 57 map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

This checkout reads `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` in `app.config.ts`; see `.env.example`. Put optional restricted keys in a local `.env.local` or the native build environment. Keep the variable names exactly as shown. The configuration passes keys only to the native map plugin and exposes boolean availability flags to JavaScript. The current package/bundle identifier is `org.clearpath.student`; use the actual development or release signing certificate when restricting the Android key. Rebuild after changing native map configuration.

Google Maps Platform setup requires an appropriate Google Cloud project, enabled platform SDK, API key, and billing configuration. Google currently requires billing enabled even though mobile Maps SDK usage is unlimited; other products/features have their own pricing. Those account/billing steps have not been performed. Do not commit keys. Native mobile map keys are embedded in the binary; platform and API restrictions are essential, and environment variables do not make them server secrets. [Google Maps SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key), [Android SDK usage and billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing).

With missing map configuration, use the app's fallback information and official-source links. Apple Maps is acceptable for iOS development. Never draw a substitute polygon for a live warning lacking geometry.

### Black Google map inside Android Expo Go

The physical Android test on October 10 found a black map in Expo Go 57.0.9. An [open Expo issue](https://github.com/expo/expo/issues/49323) reports the same client version and an expired Google Maps credential embedded in Expo Go. This is a likely explanation, but this phone's captured logs did not contain an authorization failure, so its exact cause remains unconfirmed. Adding this project's key cannot replace the key embedded in Expo Go.

The Google map shows a loading state and, if its tile-completion event does not arrive within 15 seconds, a clear explanation with **Retry map** and **View areas without basemap** actions. A late successful load can restore the native map. The compact Home preview has a status without nested buttons. Apple Maps retains its native presentation because it does not expose the same completion event. Simulation fixtures are local; real basemap tiles still require internet.

**View areas without basemap** opens a bundled SVG coordinate plot with longitude/latitude axes, supplied warning polygons, and enabled earthquake/gauge points. Browser previews and Android builds without a configured key also use this view. It is explicitly labeled **NO BASEMAP / COORDINATE VIEW** and **SCHEMATIC / NOT NAVIGATION**: it supplies no streets, terrain, flood extent, or safe route. Directional pan, zoom, recenter, and source details remain available. Pan moves the viewport by half its span, wraps longitude, and stops at the poles; it does not change the selected location or make a feed request. Recenter restores the original viewport and scale. This does not repair Expo Go's embedded Maps credential or verify successful Google tiles. Physical rendering of this newly added fallback still needs testing.

For a ClearPath Android build, the remaining user setup is:

1. From the project terminal with Node/npm available, run `npx eas-cli@latest login`, then `npx eas-cli@latest build:configure` to link/configure the Expo project. Keep the existing `preview` APK profile. Run `npx eas-cli@latest credentials`, choose **Android** and **preview**, and create/select the signing keystore; use that certificate's SHA-1 for the Maps restriction. Keep the keystore private. These account/signing steps have not been run. [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/).
2. In Google Cloud, choose/create the project, configure billing, enable **Maps SDK for Android**, and create an API key restricted to that SDK and to `org.clearpath.student` with the actual build-signing SHA-1 from step 1. These Cloud/billing steps remain pending. This is the native Android SDK key, not a Maps JavaScript API key for a website.
3. In the Expo project's EAS environment-variable settings, set `GOOGLE_MAPS_ANDROID_API_KEY` for **preview**, preferably with sensitive visibility. The existing preview profile explicitly selects that EAS environment, but its cloud key has not been configured. A Git-ignored `.env.local` is not automatically uploaded to a cloud build. The local key is suitable only for local configuration/builds that actually load it.
4. Run `npx eas-cli@latest build --profile preview --platform android`, open its completed build link on the phone, download/install the APK, and verify tiles, overlays, and offline restart. Android may ask you to allow installation from the downloading browser. This internal APK needs neither a Play Store publication nor a USB/Metro connection to run. Successful offline behavior still needs testing. Use the `development` profile instead only when you want an installed development client. [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

The existing `app.config.ts` map plugin consumes the exact variable name above. Rebuild whenever native map configuration changes. The standard EAS **preview** environment provides the staging path without requiring a custom environment name. No Cloud project, billing, API key, credentials, or build has been created in this session. [Google setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key), [Expo map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Development builds

For local Android builds, install Android Studio, an Android SDK, and a compatible Java toolchain, then use:

```powershell
npx expo install expo-dev-client
npx expo run:android
```

Add `--device` to select a USB-connected phone with debugging enabled. Local iOS builds require macOS/Xcode: `npx expo run:ios`. Windows cannot compile an iOS app locally. A cloud development build requires an Expo account and project configuration; after those are configured, install the development client with `npx expo install expo-dev-client`, configure with `npx eas-cli@latest build:configure`, and build with `npx eas-cli@latest build --profile development --platform android` (or `ios`). Physical iPhone cloud builds require appropriate Apple developer/signing setup. No cloud build, signing, upload, publication, or paid service has been executed. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Project notes

Read [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SAFETY.md](SAFETY.md), and [DEMO.md](DEMO.md). Follow [AGENTS.md](AGENTS.md) when changing dependencies. Refresh the validation record after each coherent checkpoint; do not infer a passing test from the presence of a test file.
