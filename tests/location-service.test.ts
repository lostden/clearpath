import * as Location from "expo-location";
import {
  manualLocation,
  requestDeviceLocation,
} from "../src/services/location";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const readPermission = jest.mocked(Location.getForegroundPermissionsAsync);
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  readPermission.mockReset().mockResolvedValue(allowed);
  permission.mockReset().mockResolvedValue(allowed);
  services.mockReset().mockResolvedValue(true);
  position.mockReset().mockResolvedValue(gps);
});
afterEach(() => {
  jest.useRealTimers();
});

describe("foreground GPS service", () => {
  test("permission denial leaves an actionable manual fallback without reading location", async () => {
    const denied = {
      ...allowed,
      status: Location.PermissionStatus.DENIED,
      granted: false,
    };
    readPermission.mockResolvedValue(denied);
    permission.mockResolvedValue(denied);
    await expect(requestDeviceLocation()).rejects.toThrow(
      "Location permission denied. Choose a city center or enter coordinates instead.",
    );
    expect(services).not.toHaveBeenCalled();
    expect(position).not.toHaveBeenCalled();
  });

  test("missing foreground permission is requested once before a single point is acquired", async () => {
    readPermission.mockResolvedValue({
      ...allowed,
      status: Location.PermissionStatus.DENIED,
      granted: false,
    });
    expect(await requestDeviceLocation()).toMatchObject({ kind: "gps" });
    expect(readPermission).toHaveBeenCalledTimes(1);
    expect(permission).toHaveBeenCalledTimes(1);
    expect(permission.mock.invocationCallOrder[0]).toBeLessThan(services.mock.invocationCallOrder[0]);
    expect(position).toHaveBeenCalledTimes(1);
  });

  test("permanently denied permission does not repeat a native prompt or request location", async () => {
    readPermission.mockResolvedValue({
      ...allowed,
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
    });
    await expect(requestDeviceLocation()).rejects.toThrow(/Location permission denied/);
    expect(permission).not.toHaveBeenCalled();
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

  test("existing permission skips the native prompt and returns a single validated point with reported accuracy", async () => {
    expect(await requestDeviceLocation()).toEqual({
      kind: "gps",
      coordinates: { latitude: 30.0474, longitude: -99.1403 },
      label: "GPS point · single reading · ±33 m",
    });
    expect(position).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
    expect(readPermission).toHaveBeenCalledTimes(1);
    expect(permission).not.toHaveBeenCalled();
    expect(position).toHaveBeenCalledTimes(1);
  });

  test("a hung permission read times out and its late grant cannot start location access", async () => {
    jest.useFakeTimers();
    const pending = deferred<Location.LocationPermissionResponse>();
    readPermission.mockReturnValue(pending.promise);
    const assertion = expect(requestDeviceLocation()).rejects.toThrow(/Location access check timed out/);
    await jest.advanceTimersByTimeAsync(7_999);
    expect(permission).not.toHaveBeenCalled();
    expect(services).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await assertion;
    pending.resolve(allowed);
    await Promise.resolve();
    expect(permission).not.toHaveBeenCalled();
    expect(services).not.toHaveBeenCalled();
    expect(position).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("a hung permission prompt times out and its late grant cannot request a GPS point", async () => {
    jest.useFakeTimers();
    readPermission.mockResolvedValue({
      ...allowed,
      status: Location.PermissionStatus.DENIED,
      granted: false,
    });
    const pending = deferred<Location.LocationPermissionResponse>();
    permission.mockReturnValue(pending.promise);
    const assertion = expect(requestDeviceLocation()).rejects.toThrow(/Location permission request timed out/);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(permission).toHaveBeenCalledTimes(1);
    expect(services).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await assertion;
    pending.resolve(allowed);
    await Promise.resolve();
    expect(services).not.toHaveBeenCalled();
    expect(position).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("a hung services check times out and its late result cannot request a GPS point", async () => {
    jest.useFakeTimers();
    const pending = deferred<boolean>();
    services.mockReturnValue(pending.promise);
    const assertion = expect(requestDeviceLocation()).rejects.toThrow(/Device location check timed out/);
    await jest.advanceTimersByTimeAsync(8_000);
    await assertion;
    pending.resolve(true);
    await Promise.resolve();
    expect(position).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
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
    const pending = deferred<Location.LocationObject>();
    position.mockReturnValue(pending.promise);
    const accepted = jest.fn();
    const task = requestDeviceLocation();
    void task.then(accepted, () => {});
    const assertion = expect(task).rejects.toThrow(
      "GPS took too long. Try again outdoors or choose a manual location.",
    );
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    pending.resolve(gps);
    await Promise.resolve();
    expect(accepted).not.toHaveBeenCalled();
    expect(position).toHaveBeenCalledTimes(1);
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
