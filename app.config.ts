import type { ConfigContext, ExpoConfig } from "expo/config";
export default function configure({ config }: ConfigContext): ExpoConfig {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
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
      blockedPermissions: [
        "android.permission.ACCESS_BACKGROUND_LOCATION",
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
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
      ...mapPlugins,
    ],
    extra: {
      ...config.extra,
      hasAndroidMapsKey: !!androidKey,
      hasIosMapsKey: !!iosKey,
    },
  };
}
