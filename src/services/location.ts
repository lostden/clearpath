import * as Location from "expo-location";
import { validCoordinates } from "@/domain/alerts";
import type { SelectedLocation } from "@/domain/types";
export const texasLocations: SelectedLocation[] = [
  {
    // Census TIGERweb ACS25, geography as of 2025-01-01; Frisco GEOID 4827684.
    // INTPTLAT/INTPTLON is a public reference point, not citywide coverage.
    // https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_2025_acs25_tx.html
    label: "Frisco, Texas · Census reference point",
    coordinates: { latitude: 33.155424, longitude: -96.8225927 },
    kind: "manual",
  },
  {
    label: "Kerrville, Texas · city center",
    coordinates: { latitude: 30.0474, longitude: -99.1403 },
    kind: "manual",
  },
  {
    label: "Austin, Texas · city center",
    coordinates: { latitude: 30.2672, longitude: -97.7431 },
    kind: "manual",
  },
  {
    label: "San Antonio, Texas · city center",
    coordinates: { latitude: 29.4241, longitude: -98.4936 },
    kind: "manual",
  },
  {
    label: "Houston, Texas · city center",
    coordinates: { latitude: 29.7604, longitude: -95.3698 },
    kind: "manual",
  },
  {
    label: "Dallas, Texas · city center",
    coordinates: { latitude: 32.7767, longitude: -96.797 },
    kind: "manual",
  },
  {
    label: "Galveston, Texas · city center",
    coordinates: { latitude: 29.3013, longitude: -94.7977 },
    kind: "manual",
  },
];
export function manualLocation(
  latitude: string,
  longitude: string,
  label: string,
): SelectedLocation {
  if (!latitude.trim() || !longitude.trim())
    throw new Error("Enter both latitude and longitude.");
  const coordinates = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  if (!validCoordinates(coordinates))
    throw new Error(
      "Latitude must be between −90 and 90; longitude between −180 and 180.",
    );
  return {
    label:
      label.trim().slice(0, 80) ||
      `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
    coordinates,
    kind: "manual",
  };
}
async function boundedLocationStep<T>(
  work: Promise<T>,
  duration: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), duration);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function requestDeviceLocation(): Promise<SelectedLocation> {
  let permission = await boundedLocationStep(
    Location.getForegroundPermissionsAsync(),
    8_000,
    "Location access check timed out. Try GPS again or choose a manual location.",
  );
  // The Android request path enters the Activity permission flow even when
  // permission is granted. Read first and ask only when access is missing.
  if (!permission.granted && permission.canAskAgain) {
    permission = await boundedLocationStep(
      Location.requestForegroundPermissionsAsync(),
      60_000,
      "Location permission request timed out. Try GPS again or choose a manual location.",
    );
  }
  if (!permission.granted)
    throw new Error(
      "Location permission denied. Choose a city center or enter coordinates instead.",
    );
  if (!(await boundedLocationStep(
    Location.hasServicesEnabledAsync(),
    8_000,
    "Device location check timed out. Try GPS again or choose a manual location.",
  )))
    throw new Error(
      "Device location services are off. Enable them or select a location manually.",
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "GPS took too long. Try again outdoors or choose a manual location.",
              ),
            ),
          20_000,
        );
      }),
    ]);
    const coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    if (!validCoordinates(coordinates))
      throw new Error(
        "The device returned invalid coordinates. Choose a location manually.",
      );
    const accuracy = position.coords.accuracy;
    return {
      label: `GPS point · single reading${accuracy && Number.isFinite(accuracy) ? ` · ±${Math.ceil(accuracy)} m` : ""}`,
      coordinates,
      kind: "gps",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
