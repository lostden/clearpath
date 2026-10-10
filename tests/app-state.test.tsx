import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { SelectedLocation } from "../src/domain/types";
import { AppProvider, useAppState } from "../src/state/AppState";

const storageKey = "@clearpath/selected-location/v1";
const originalGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const originalSetItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const point: SelectedLocation = {
  label: "Saved manual point",
  kind: "manual",
  coordinates: { latitude: 30.04741, longitude: -99.14039 },
};
beforeEach(async () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(originalGetItem);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(originalSetItem);
  await AsyncStorage.clear();
});
afterEach(async () => { await cleanup(); });

test("restores one validated selected point in live mode with its exact coordinates", async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(point));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.mode).toBe("live"));
  await waitFor(() => expect(hook.result.current.locationReady).toBe(true));
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
  JSON.stringify({ ...point, label: "   " }),
  "null",
  "[]",
  "",
])(
  "rejects invalid stored locations without selecting a point %#",
  async (raw) => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(raw);
    const hook = await renderHook(() => useAppState(), {
      wrapper: AppProvider,
    });
    await waitFor(() => expect(hook.result.current.locationReady).toBe(true));
    expect(hook.result.current.location).toBeNull();
    expect(hook.result.current.mode).toBe("live");
    expect(hook.result.current.locationError).toMatch(/could not be restored/);
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
  expect(hook.result.current.locationReady).toBe(true);
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

test("an absent saved point becomes ready without reporting a restore failure", async () => {
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.locationReady).toBe(true));
  expect(hook.result.current.location).toBeNull();
  expect(hook.result.current.locationError).toBeNull();
});

test("a pending saved-point read remains distinguishable from an absent point", async () => {
  let finish!: (raw: string | null) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  expect(hook.result.current.locationReady).toBe(false);
  expect(hook.result.current.location).toBeNull();
  await act(() => finish(null));
  expect(hook.result.current.locationReady).toBe(true);
  expect(hook.result.current.locationError).toBeNull();
});

test("a failed saved-point read settles readiness with an explicit restore error", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk unavailable"));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.locationReady).toBe(true));
  expect(hook.result.current.locationError).toMatch(/could not be restored/);
  expect(hook.result.current.location).toBeNull();
});

test("a late failed read cannot display a restore error after an explicit selection", async () => {
  let rejectRead!: (error: Error) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRead = reject; }));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() => hook.result.current.setLocation(point));
  expect(hook.result.current.locationReady).toBe(true);
  await act(() => rejectRead(new Error("late disk failure")));
  expect(hook.result.current.location).toEqual(point);
  expect(hook.result.current.locationError).toBeNull();
});

test("an explicit demo choice also suppresses a late restore failure", async () => {
  let rejectRead!: (error: Error) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRead = reject; }));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() => hook.result.current.setMode("demo"));
  await act(() => rejectRead(new Error("late disk failure")));
  expect(hook.result.current.mode).toBe("demo");
  expect(hook.result.current.locationReady).toBe(true);
  expect(hook.result.current.locationError).toBeNull();
});

test("an obsolete in-flight write failure cannot replace the latest point or its save status", async () => {
  let failFirst!: (error: Error) => void;
  const writes = jest.spyOn(AsyncStorage, "setItem").mockImplementationOnce(() => new Promise((_resolve, reject) => { failFirst = reject; }));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.locationReady).toBe(true));
  await act(() => hook.result.current.setLocation(point));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
  const latest = { ...point, label: "Latest", coordinates: { latitude: 31, longitude: -98 } };
  await act(() => hook.result.current.setLocation(latest));
  writes.mockImplementation(originalSetItem);
  await act(() => failFirst(new Error("obsolete write failed")));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(hook.result.current.location).toEqual(latest);
  expect(hook.result.current.locationError).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toEqual(latest);
});

test("a failed latest write leaves the selected point usable and a later selection recovers persistence", async () => {
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("save failed"));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() => hook.result.current.setLocation(point));
  await waitFor(() => expect(hook.result.current.locationError).toMatch(/could not be saved/));
  expect(hook.result.current.locationReady).toBe(true);
  expect(hook.result.current.location).toEqual(point);
  const latest = { ...point, label: "Recovered selection", coordinates: { latitude: 31, longitude: -98 } };
  await act(() => hook.result.current.setLocation(latest));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(hook.result.current.locationError).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toEqual(latest);
});

test("older pending writes finish before the latest point is persisted", async () => {
  let finishFirst!: () => void;
  const writes = jest.spyOn(AsyncStorage, "setItem").mockImplementationOnce((key, raw) => new Promise<void>((resolve) => {
    finishFirst = () => { void originalSetItem(key, raw).then(resolve); };
  }));
  const hook = await renderHook(() => useAppState(), { wrapper: AppProvider });
  await act(() => hook.result.current.setLocation(point));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
  const middle = { ...point, label: "Skipped middle", coordinates: { latitude: 30.5, longitude: -98.5 } };
  const latest = { ...point, label: "Latest", coordinates: { latitude: 31, longitude: -98 } };
  await act(() => { hook.result.current.setLocation(middle); hook.result.current.setLocation(latest); });
  expect(writes).toHaveBeenCalledTimes(1);
  writes.mockImplementation(originalSetItem);
  await act(() => finishFirst());
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(JSON.parse(writes.mock.calls[1][1])).toEqual(latest);
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toEqual(latest);
});
