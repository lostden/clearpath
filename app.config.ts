import type { ConfigContext, ExpoConfig } from "expo/config";
export default function configure({ config }: ConfigContext): ExpoConfig {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  // Cloud push stays inactive until the operator completes FCM, hosting and consent.
  const cloudEndpoint = process.env.EXPO_PUBLIC_CLEARPATH_PUSH_URL;
  const firebaseFile = process.env.GOOGLE_SERVICES_JSON;
  const cloudPushEnabled = process.env.CLEARPATH_PUSH_ENABLED === "true" && !!cloudEndpoint && !!firebaseFile;
  const backgroundGps = cloudPushEnabled && process.env.CLEARPATH_BACKGROUND_GPS === "true";
  const mapPlugins: NonNullable<ExpoConfig["plugins"]> = [];
  if (androidKey || iosKey)
    mapPlugins.push([
      "react-native-maps",
      {
        ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}),
        ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}),
      },
    ]);
  return {
    ...config,
    name: "ClearPath",
    slug: "clearpath",
    android: {
      ...config.android,
      package: "org.clearpath.student",
      ...(cloudPushEnabled ? { googleServicesFile: firebaseFile } : {}),
      blockedPermissions: [
        ...(!backgroundGps ? ["android.permission.ACCESS_BACKGROUND_LOCATION"] : []),
        "android.permission.RECORD_AUDIO",
      ],
    },
    ios: {
      ...config.ios,
      bundleIdentifier: "org.clearpath.student",
      supportsTablet: true,
    },
    plugins: [
      ...(config.plugins || []),
      ["expo-notifications", { color: "#FF5A00", defaultChannel: "clearpath-nws" }],
      "expo-secure-store",
      [
        "expo-font",
        {
          android: {
            fonts: [
              {
                fontFamily: "ArchivoBlack",
                fontDefinitions: [
                  { path: "./assets/fonts/ArchivoBlack.ttf", weight: 400, style: "normal" },
                ],
              },
              {
                fontFamily: "RobotoMono",
                fontDefinitions: [
                  { path: "./assets/fonts/RobotoMono.ttf", weight: 400, style: "normal" },
                ],
              },
              {
                fontFamily: "RobotoMonoBold",
                fontDefinitions: [
                  { path: "./assets/fonts/RobotoMonoBold.ttf", weight: 400, style: "normal" },
                ],
              },
            ],
          },
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "ClearPath uses your location only when you choose GPS, to retrieve official warnings for that point. Manual selection is also available.",
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: backgroundGps,
          isAndroidForegroundServiceEnabled: backgroundGps,
        },
      ],
      ...mapPlugins,
    ],
    extra: {
      ...config.extra,
      hasAndroidMapsKey: !!androidKey,
      hasIosMapsKey: !!iosKey,
      cloudPushEnabled,
      cloudPushEndpoint: cloudPushEnabled ? cloudEndpoint : null,
      cloudPushFcmConfigured: cloudPushEnabled,
      cloudPushBackgroundLocationEnabled: backgroundGps,
    },
  };
}
