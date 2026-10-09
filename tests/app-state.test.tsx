import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { SelectedLocation } from "../src/domain/types";
import { AppProvider, useAppState } from "../src/state/AppState";

const storageKey = "@clearpath/selected-location/v1";
const point: SelectedLocation = {
  label: "Saved manual point",
  kind: "manual",
  coordinates: { latitude: 30.04741, longitude: -99.14039 },
};
beforeEach(async () => {
  await AsyncStorage.clear();
});

test("restores one validated selected point in live mode with its exact coordinates", async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(point));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.mode).toBe("live"));
  expect(hook.result.current.location).toEqual(point);
});

test("restored GPS is identified as a previous selection rather than a fresh device reading", async () => {
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({
      ...point,
      kind: "gps",
      label: "Current GPS point · ±20 m",
    }),
  );
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.mode).toBe("live"));
  expect(hook.result.current.location?.label).toBe(
    "Saved GPS point · last selection",
  );
  expect(hook.result.current.location?.coordinates).toEqual(point.coordinates);
});

test.each([
  JSON.stringify({ ...point, coordinates: { latitude: 300, longitude: -99 } }),
  JSON.stringify({ ...point, label: 123 }),
  JSON.stringify({ ...point, kind: "background" }),
])(
  "rejects invalid stored locations without entering live mode %#",
  async (raw) => {
    await AsyncStorage.setItem(storageKey, raw);
    const hook = await renderHook(() => useAppState(), {
      wrapper: AppProvider,
    });
    expect(hook.result.current.location).toBeNull();
    expect(hook.result.current.mode).toBe("demo");
  },
);

test("corrupt JSON reports inability to restore the selected point", async () => {
  await AsyncStorage.setItem(storageKey, "not json");
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() =>
    expect(hook.result.current.locationError).toBe(
      "The last selected point could not be restored. Select a location again.",
    ),
  );
  expect(hook.result.current.location).toBeNull();
});

test("a delayed stored-point read cannot overwrite a newer user selection", async () => {
  let finishRead!: (raw: string | null) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(
    new Promise((resolve) => {
      finishRead = resolve;
    }),
  );
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  const newer = {
    ...point,
    label: "Newer selected point",
    coordinates: { latitude: 31, longitude: -98 },
  };
  await act(() => {
    hook.result.current.setLocation(newer);
    hook.result.current.setMode("live");
  });
  await act(() => finishRead(JSON.stringify(point)));
  expect(hook.result.current.location).toEqual(newer);
  expect(hook.result.current.mode).toBe("live");
});

test("an explicit choice of demo mode takes precedence over delayed saved-point restoration", async () => {
  let finishRead!: (raw: string | null) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(
    new Promise((resolve) => {
      finishRead = resolve;
    }),
  );
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() => hook.result.current.setMode("demo"));
  await act(() => finishRead(JSON.stringify(point)));
  expect(hook.result.current.mode).toBe("demo");
  expect(hook.result.current.location).toBeNull();
});

test("persists the latest selected point without retaining a location history", async () => {
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  const newer = {
    ...point,
    label: "Latest selected point",
    coordinates: { latitude: 31, longitude: -98 },
  };
  await act(() => {
    hook.result.current.setLocation(point);
    hook.result.current.setLocation(newer);
  });
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toEqual(
      newer,
    ),
  );
  expect(await AsyncStorage.getAllKeys()).toEqual([storageKey]);
});

test("invalid selected coordinates do not reach persistence", async () => {
  const writes = jest.spyOn(AsyncStorage, "setItem");
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() =>
    hook.result.current.setLocation({
      ...point,
      coordinates: { latitude: 300, longitude: -99 },
    }),
  );
  expect(hook.result.current.location).toBeNull();
  expect(hook.result.current.locationError).toBe(
    "Please choose valid coordinates.",
  );
  expect(writes).not.toHaveBeenCalled();
});
