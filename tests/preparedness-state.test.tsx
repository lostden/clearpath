import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  parsePreparation,
  PreparednessProvider,
  usePreparation,
} from "../src/state/PreparednessState";

const storageKey = "@clearpath/preparation/v1";
const saved = {
  checked: { water: true },
  contacts: [
    { id: "contact-1", name: "Test family contact", phone: "5550100" },
  ],
  meetingPlace: "Test meeting point",
  outOfAreaContact: "Test out-of-area contact",
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test.each([
  "not json",
  "null",
  "[]",
  "{}",
  JSON.stringify({ ...saved, checked: { water: "yes" } }),
  JSON.stringify({ ...saved, contacts: [{ name: "Missing fields" }] }),
])("rejects malformed offline preparation %#", (raw) => {
  expect(() => parsePreparation(raw)).toThrow();
});

test("loads locally saved checklist, communication plan, and contacts without network access", async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(saved));
  const hook = await renderHook(() => usePreparation(), {
    wrapper: PreparednessProvider,
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current.saved).toEqual(saved);
  expect(hook.result.current.storageError).toBeNull();
});

test("persists checklist and plan changes in order", async () => {
  const hook = await renderHook(() => usePreparation(), {
    wrapper: PreparednessProvider,
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(() => {
    hook.result.current.toggle("water");
  });
  await act(() => {
    hook.result.current.toggle("radio");
    hook.result.current.update({ meetingPlace: "Saved meeting point" });
  });
  await waitFor(async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    expect(JSON.parse(raw!)).toMatchObject({
      checked: { water: true, radio: true },
      meetingPlace: "Saved meeting point",
    });
  });
});

test("does not overwrite unreadable saved data and explains the storage failure", async () => {
  await AsyncStorage.setItem(storageKey, "corrupt existing record");
  const writes = jest.spyOn(AsyncStorage, "setItem");
  writes.mockClear();
  const hook = await renderHook(() => usePreparation(), {
    wrapper: PreparednessProvider,
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current.storageError).toBe(
    "Saved preparation could not be loaded. Existing storage will not be overwritten.",
  );
  await act(() => {
    hook.result.current.toggle("water");
  });
  expect(hook.result.current.saved.checked.water).toBe(true);
  expect(writes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(storageKey)).toBe(
    "corrupt existing record",
  );
});

test("a failed write keeps session changes and reports that they are not persisted", async () => {
  jest
    .spyOn(AsyncStorage, "setItem")
    .mockRejectedValue(new Error("device storage full"));
  const hook = await renderHook(() => usePreparation(), {
    wrapper: PreparednessProvider,
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(() => {
    hook.result.current.toggle("water");
  });
  await waitFor(() =>
    expect(hook.result.current.storageError).toBe(
      "Changes are available this session, but could not be saved on this device.",
    ),
  );
  expect(hook.result.current.saved.checked.water).toBe(true);
});
