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

On this Windows machine, Node/npm/Git were absent from the initial PATH. A helper uses the bundled Node runtime and locally installed npm CLI:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Use `-Check` with that script for typecheck, lint, and tests. `pnpm` is also available through the runtime reported by `load_workspace_dependencies`; use its reported executable path if npm is unavailable. Do not mix lockfiles or dependency managers. This checkout's lockfile is authoritative. Installing a system Node runtime is optional, not a prerequisite for this session.

## Checkpoint scope

The working increment targets Home, Map, and Prepare navigation; distinct simulated scenarios; foreground/manual location; and an NWS point-alert adapter. Check [MILESTONES.md](MILESTONES.md) for scope and [TESTING.md](TESTING.md) for executed checks and remaining phone verification. Offline safety text is bundled in the app. Live, cached, simulated, and unavailable information must retain distinct labels.

USGS observations and approved DriveTexas API access remain future work. A road-resource link does not mean road closures are integrated. The student engine remains pending even if temporary display ordering exists.

## Keys and native maps

NWS point alerts do not currently require an API key; identify this application with its User-Agent. Configure a real developer contact before distributing it. [NWS API documentation](https://www.weather.gov/documentation/services-web-api).

`react-native-maps` is included in Expo Go. A standalone Google Maps binary requires native configuration and a rebuilt development app. SDK 57 recommends version 1.27.2; use `npx expo install react-native-maps` for compatibility. Configure `androidGoogleMapsApiKey` and optionally `iosGoogleMapsApiKey` through the `react-native-maps` plugin in app configuration. Restrict Android keys by package and signing SHA-1, and iOS keys by bundle identifier. [Expo SDK 57 map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

Google Maps Platform setup requires an appropriate Google Cloud project, enabled platform SDK, API key, and billing configuration. Those account/billing steps have not been performed. Do not commit keys. Native mobile map keys are embedded in the binary; platform and API restrictions are essential, and environment variables do not make them server secrets. [Google Maps SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key).

With missing map configuration, use the app's fallback information and official-source links. Apple Maps is acceptable for iOS development. Never draw a substitute polygon for a live warning lacking geometry.

## Development builds

For local Android builds, install Android Studio, an Android SDK, and a compatible Java toolchain, then use:

```powershell
npx expo run:android
```

Local iOS builds require macOS/Xcode: `npx expo run:ios`. Windows cannot compile an iOS app locally. A cloud development build requires an Expo account and project configuration; after those are configured, install the development client with `npx expo install expo-dev-client`, configure with `npx eas-cli@latest build:configure`, and build with `npx eas-cli@latest build --profile development --platform android` (or `ios`). No cloud build, signing, upload, publication, or paid service has been executed. [Expo development builds](https://docs.expo.dev/develop/development-builds/create-a-build/).

## Project notes

Read [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SAFETY.md](SAFETY.md), and [DEMO.md](DEMO.md). Follow [AGENTS.md](AGENTS.md) when changing dependencies. Refresh the validation record after each coherent checkpoint; do not infer a passing test from the presence of a test file.
