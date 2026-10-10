# ClearPath

ClearPath is a native Android/iOS emergency information assistant focused on Texas flooding and severe weather. It presents official weather information, a map, and offline preparedness resources. This is a development checkpoint, not a validated emergency notification system.

The project pauses before milestone 5 so the student can implement and explain the original relevance and prioritization engine. Generated support code must not be described as independently student-written. See [STUDENT_CONTRIBUTIONS.md](STUDENT_CONTRIBUTIONS.md) and [AI_USAGE.md](AI_USAGE.md).

## Run on a phone

Use Node.js 22.13 or newer. The scaffold uses Expo SDK 57, React 19.2.3, and React Native 0.86.3. SDK compatibility is documented by [Expo](https://docs.expo.dev/versions/latest/).

Open a terminal in `clearpath`:

```powershell
npm ci
npm start
```

Install a compatible Expo Go on the phone. Put the computer and phone on the same local network, then scan the terminal QR code with Expo Go on Android or the Camera app on iOS. Allow local-network access if prompted. The app is native; a browser preview does not verify phone behavior. If LAN access is blocked, use `npx expo start --tunnel` after checking the requested tunnel dependency and network setup.

On first launch, ClearPath opens the **Flood** presentation scenario with a persistent **SIMULATED DEMO** label. These are fictional local fixtures. Tap **Exit demo** above the tabs (or **Return to live mode** under Home's **Presentation scenarios**), then **Choose location** or the location row near the top. Select a listed Texas city center, request foreground GPS, or enter latitude/longitude. A city-center selection checks that one point. Choosing a location starts the official NWS request; use **Refresh official alerts** or pull down on Home when allowed. You can also choose a location directly while in demo; doing so switches to live mode.

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

This captures only the running Expo Go process, at most 300 relevant records from Android's main/crash buffers, into the ignored local `.expo/android-usb-device.log`. It refuses whole-phone logging if the process is missing. Review and redact any app/session/personal information before sharing logs. Metro output/errors are also local under `.expo/usb-metro-*.log`. The helper's phone behavior still needs an actual connected-device run; preparing it is not evidence that ClearPath has launched on a phone.

## Checkpoint scope

The working increment targets Home, Map, and Prepare navigation; distinct simulated scenarios; foreground/manual location; and an NWS point-alert adapter. Check [MILESTONES.md](MILESTONES.md) for scope and [TESTING.md](TESTING.md) for executed checks and remaining phone verification. Offline safety text is bundled in the app. Live, cached, simulated, and unavailable information must retain distinct labels.

The native map scaffold displays the selected point and supplied warning polygons. Its river marker and measurements are explicitly simulated. Browser previews use an honest native-map fallback. Prepare supports local checklist progress, family-plan fields, and saved contacts. Provider warning order is retained until the student implements milestone 5.

Offline summaries require no content request once the app's JavaScript is loaded. Expo Go or a development client can still need Metro for cold launch. Verify force-close/restart without connectivity in an installed binary with embedded JavaScript before claiming independent offline startup; that physical verification is pending.

USGS observations and approved DriveTexas API access remain future work. A road-resource link does not mean road closures are integrated. The student engine remains pending even if temporary display ordering exists.

## Keys and native maps

NWS point alerts do not currently require an API key; identify this application with its User-Agent. Configure a real developer contact before distributing it. [NWS API documentation](https://www.weather.gov/documentation/services-web-api).

`react-native-maps` is included in Expo Go. A standalone Google Maps binary requires native configuration and a rebuilt development app. SDK 57 recommends version 1.27.2; use `npx expo install react-native-maps` for compatibility. Configure `androidGoogleMapsApiKey` and optionally `iosGoogleMapsApiKey` through the `react-native-maps` plugin in app configuration. Restrict Android keys by package and signing SHA-1, and iOS keys by bundle identifier. [Expo SDK 57 map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

This checkout reads `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` in `app.config.ts`; see `.env.example`. Put optional restricted keys in a local `.env.local` or the native build environment. Keep the variable names exactly as shown. The configuration passes keys only to the native map plugin and exposes boolean availability flags to JavaScript. The current package/bundle identifier is `org.clearpath.student`; use the actual development or release signing certificate when restricting the Android key. Rebuild after changing native map configuration.

Google Maps Platform setup requires an appropriate Google Cloud project, enabled platform SDK, API key, and billing configuration. Those account/billing steps have not been performed. Do not commit keys. Native mobile map keys are embedded in the binary; platform and API restrictions are essential, and environment variables do not make them server secrets. [Google Maps SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key).

With missing map configuration, use the app's fallback information and official-source links. Apple Maps is acceptable for iOS development. Never draw a substitute polygon for a live warning lacking geometry.

## Development builds

For local Android builds, install Android Studio, an Android SDK, and a compatible Java toolchain, then use:

```powershell
npx expo install expo-dev-client
npx expo run:android
```

Add `--device` to select a USB-connected phone with debugging enabled. Local iOS builds require macOS/Xcode: `npx expo run:ios`. Windows cannot compile an iOS app locally. A cloud development build requires an Expo account and project configuration; after those are configured, install the development client with `npx expo install expo-dev-client`, configure with `npx eas-cli@latest build:configure`, and build with `npx eas-cli@latest build --profile development --platform android` (or `ios`). Physical iPhone cloud builds require appropriate Apple developer/signing setup. No cloud build, signing, upload, publication, or paid service has been executed. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Project notes

Read [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SAFETY.md](SAFETY.md), and [DEMO.md](DEMO.md). Follow [AGENTS.md](AGENTS.md) when changing dependencies. Refresh the validation record after each coherent checkpoint; do not infer a passing test from the presence of a test file.
