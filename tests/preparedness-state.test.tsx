import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  parsePreparation,
  PreparednessProvider,
  usePreparation,
} from "../src/state/PreparednessState";

const storageKey = "@clearpath/preparation/v1";
const defaultRead = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const defaultWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const saved = {
  checked: { water: true },
  contacts: [
    { id: "contact-1", name: "Test family contact", phone: "5550100" },
  ],
  meetingPlace: "Test meeting point",
  outOfAreaContact: "Test out-of-area contact",
};

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(defaultRead);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(defaultWrite);
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
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
});

test("valid restoration stays saved without redundantly rewriting existing storage", async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(saved));
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("an unnecessary write would fail"));
  writes.mockClear();
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current.saved).toEqual(saved);
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
  expect(writes).not.toHaveBeenCalled();
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toEqual(saved);
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
  expect(hook.result.current.saveStatus).toBe("session");
  await act(() => {
    hook.result.current.toggle("water");
    hook.result.current.update({ meetingPlace: "Session-only meeting point" });
  });
  expect(hook.result.current.saved.checked.water).toBe(true);
  expect(hook.result.current.saved.meetingPlace).toBe("Session-only meeting point");
  expect(hook.result.current.saveStatus).toBe("session");
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
  expect(hook.result.current.saveStatus).toBe("session");
});

test("loading saved preparation is distinct from a completed local save", async () => {
  let finishRead!: (raw: string | null) => void;
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve; }));
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  expect(hook.result.current.ready).toBe(false);
  expect(hook.result.current.saveStatus).toBe("loading");
  await act(() => finishRead(JSON.stringify(saved)));
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.saved).toEqual(saved);
});

test("a delayed write stays saving until that latest revision is actually written", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
  const pending = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem").mockReturnValueOnce(pending.promise);
  writes.mockClear();
  await act(() => hook.result.current.update({ meetingPlace: "New meeting point" }));
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(hook.result.current.saved.meetingPlace).toBe("New meeting point");
  expect(writes).toHaveBeenCalledTimes(1);
  expect(JSON.parse(writes.mock.calls[0][1]).meetingPlace).toBe("New meeting point");
  await act(() => pending.resolve());
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
});

test("multiple edits serialize writes and older completions cannot finish the newest save", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem")
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  writes.mockClear();
  await act(() => hook.result.current.update({ meetingPlace: "First point" }));
  await act(() => hook.result.current.update({ meetingPlace: "Latest point" }));
  await act(() => hook.result.current.toggle("water"));
  expect(writes).toHaveBeenCalledTimes(1);
  expect(hook.result.current.saveStatus).toBe("saving");

  await act(() => first.resolve());
  expect(writes).toHaveBeenCalledTimes(2);
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(hook.result.current.storageError).toBeNull();
  await act(() => second.reject(new Error("older write failed")));
  expect(writes).toHaveBeenCalledTimes(3);
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(hook.result.current.storageError).toBeNull();
  expect(JSON.parse(writes.mock.calls[2][1])).toMatchObject({ meetingPlace: "Latest point", checked: { water: true } });
  await act(() => third.resolve());
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
});

test("a failed latest write stays session-only until a later explicit update succeeds", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("device storage full"));
  writes.mockClear();
  await act(() => hook.result.current.update({ outOfAreaContact: "Test relative" }));
  expect(hook.result.current.saveStatus).toBe("session");
  expect(hook.result.current.storageError).toBe("Changes are available this session, but could not be saved on this device.");
  expect(hook.result.current.saved.outOfAreaContact).toBe("Test relative");
  expect(writes).toHaveBeenCalledTimes(1);

  const retry = deferred();
  writes.mockReturnValueOnce(retry.promise);
  await act(() => hook.result.current.update({}));
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(hook.result.current.storageError).not.toBeNull();
  expect(writes).toHaveBeenCalledTimes(2);
  expect(JSON.parse(writes.mock.calls[1][1]).outOfAreaContact).toBe("Test relative");
  await act(() => retry.resolve());
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
});
