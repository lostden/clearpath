import * as Location from "expo-location";
import { validCoordinates } from "@/domain/alerts";
import type { SelectedLocation } from "@/domain/types";
export const texasLocations: SelectedLocation[] = [
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
export async function requestDeviceLocation(): Promise<SelectedLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Location permission denied. Choose a city center or enter coordinates instead.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
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
      label: `Current GPS point${accuracy && Number.isFinite(accuracy) ? ` · ±${Math.ceil(accuracy)} m` : ""}`,
      coordinates,
      kind: "gps",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
