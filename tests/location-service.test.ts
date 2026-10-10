import * as Location from "expo-location";
import {
  manualLocation,
  requestDeviceLocation,
} from "../src/services/location";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const permission = jest.mocked(Location.requestForegroundPermissionsAsync);
const services = jest.mocked(Location.hasServicesEnabledAsync);
const position = jest.mocked(Location.getCurrentPositionAsync);
const allowed = {
  status: Location.PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  expires: "never" as const,
};
const gps = {
  timestamp: Date.now(),
  coords: {
    latitude: 30.0474,
    longitude: -99.1403,
    accuracy: 32.5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
};

beforeEach(() => {
  permission.mockResolvedValue(allowed);
  services.mockResolvedValue(true);
  position.mockResolvedValue(gps);
});
afterEach(() => {
  jest.useRealTimers();
});

describe("foreground GPS service", () => {
  test("permission denial leaves an actionable manual fallback without reading location", async () => {
    permission.mockResolvedValue({
      ...allowed,
      status: Location.PermissionStatus.DENIED,
      granted: false,
    });
    await expect(requestDeviceLocation()).rejects.toThrow(
      "Location permission denied. Choose a city center or enter coordinates instead.",
    );
    expect(services).not.toHaveBeenCalled();
    expect(position).not.toHaveBeenCalled();
  });

  test("disabled device services do not start a GPS request", async () => {
    services.mockResolvedValue(false);
    await expect(requestDeviceLocation()).rejects.toThrow(
      "Device location services are off. Enable them or select a location manually.",
    );
    expect(position).not.toHaveBeenCalled();
  });

  test("returns a single validated foreground point with reported accuracy", async () => {
    expect(await requestDeviceLocation()).toEqual({
      kind: "gps",
      coordinates: { latitude: 30.0474, longitude: -99.1403 },
      label: "GPS point · single reading · ±33 m",
    });
    expect(position).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
    expect(permission).toHaveBeenCalledTimes(1);
    expect(position).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid native coordinates before they reach a live request", async () => {
    position.mockResolvedValue({
      ...gps,
      coords: { ...gps.coords, latitude: NaN },
    });
    await expect(requestDeviceLocation()).rejects.toThrow(
      "The device returned invalid coordinates. Choose a location manually.",
    );
  });

  test("an unresolved GPS reading times out with manual fallback", async () => {
    jest.useFakeTimers();
    position.mockReturnValue(new Promise(() => undefined));
    const assertion = expect(requestDeviceLocation()).rejects.toThrow(
      "GPS took too long. Try again outdoors or choose a manual location.",
    );
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("manual point selection", () => {
  test.each([
    ["", "-99"],
    ["30", " "],
    ["not a number", "-99"],
    ["91", "-99"],
    ["30", "-181"],
  ])("rejects invalid %s, %s", (latitude, longitude) => {
    expect(() => manualLocation(latitude, longitude, "")).toThrow();
  });

  test("accepts a named point and preserves precise coordinates", () => {
    expect(manualLocation(" 30.04741 ", " -99.14039 ", " Test point ")).toEqual(
      {
        kind: "manual",
        label: "Test point",
        coordinates: { latitude: 30.04741, longitude: -99.14039 },
      },
    );
  });

  test("unnamed coordinates receive a readable label without changing the selected point", () => {
    const point = manualLocation("30.04741", "-99.14039", "");
    expect(point.label).toBe("30.0474, -99.1404");
    expect(point.coordinates).toEqual({
      latitude: 30.04741,
      longitude: -99.14039,
    });
  });
});
