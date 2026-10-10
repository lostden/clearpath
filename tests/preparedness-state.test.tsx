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
  expect(hook.result.current.canRetrySave).toBe(false);
  await act(() => {
    hook.result.current.toggle("water");
    hook.result.current.update({ meetingPlace: "Session-only meeting point" });
    hook.result.current.retrySave();
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
  expect(hook.result.current.canRetrySave).toBe(false);
  await act(() => hook.result.current.retrySave());
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
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

test("explicit retry saves unchanged latest kit, plan and contact contents once despite duplicate taps", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const retry = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem")
    .mockRejectedValueOnce(new Error("Storage full"))
    .mockReturnValueOnce(retry.promise);
  await act(() => hook.result.current.update(saved));
  expect(hook.result.current.canRetrySave).toBe(true);
  const retrySave = hook.result.current.retrySave;
  await act(() => { retrySave(); retrySave(); });
  expect(hook.result.current.canRetrySave).toBe(false);
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(writes).toHaveBeenCalledTimes(2);
  expect(writes.mock.calls[1]).toEqual(writes.mock.calls[0]);
  expect(JSON.parse(writes.mock.calls[1][1])).toEqual(saved);
  expect(hook.result.current.saved).toEqual(saved);
  await act(() => retry.resolve());
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
  expect(hook.result.current.canRetrySave).toBe(false);
  await act(() => retrySave());
  expect(writes).toHaveBeenCalledTimes(2);
});

test("retry failure remains session-only and permits another deliberate attempt without auto retries", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("Storage full"));
  await act(() => hook.result.current.update({ meetingPlace: "Keep this unchanged" }));
  await act(() => hook.result.current.retrySave());
  expect(writes).toHaveBeenCalledTimes(2);
  expect(hook.result.current.saveStatus).toBe("session");
  expect(hook.result.current.canRetrySave).toBe(true);
  expect(hook.result.current.saved.meetingPlace).toBe("Keep this unchanged");
  writes.mockImplementation(defaultWrite);
  await act(() => hook.result.current.retrySave());
  expect(writes).toHaveBeenCalledTimes(3);
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!).meetingPlace).toBe("Keep this unchanged");
});

test.each(["resolve", "reject"] as const)("a newer edit during a retry wins when the older retry %ss", async (completion) => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const retry = deferred(); const latest = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem")
    .mockRejectedValueOnce(new Error("First save failed"))
    .mockReturnValueOnce(retry.promise)
    .mockReturnValueOnce(latest.promise);
  await act(() => hook.result.current.update(saved));
  const oldRetry = hook.result.current.retrySave;
  await act(() => oldRetry());
  await act(() => hook.result.current.update({ meetingPlace: "Newer point" }));
  await act(() => oldRetry());
  expect(writes).toHaveBeenCalledTimes(2);
  await act(() => { if (completion === "resolve") retry.resolve(); else retry.reject(new Error("Old retry failed")); });
  expect(writes).toHaveBeenCalledTimes(3);
  expect(hook.result.current.saveStatus).toBe("saving");
  expect(hook.result.current.canRetrySave).toBe(false);
  expect(JSON.parse(writes.mock.calls[2][1])).toEqual({ ...saved, meetingPlace: "Newer point" });
  await act(() => latest.resolve());
  expect(hook.result.current.saveStatus).toBe("saved");
  expect(hook.result.current.storageError).toBeNull();
  expect(hook.result.current.saved.meetingPlace).toBe("Newer point");
});

test("a retained retry callback cannot act after a newer edit invalidates its failed revision", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const latest = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Failed"))
    .mockReturnValueOnce(latest.promise);
  await act(() => hook.result.current.toggle("water"));
  const retrySave = hook.result.current.retrySave;
  await act(() => { hook.result.current.toggle("radio"); retrySave(); });
  expect(writes).toHaveBeenCalledTimes(2);
  expect(hook.result.current.canRetrySave).toBe(false);
  expect(JSON.parse(writes.mock.calls[1][1]).checked).toEqual({ water: true, radio: true });
  await act(() => latest.resolve());
});

test("a failed storage read never enables retries or permits overwrite after session edits", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Device read failed"));
  const writes = jest.spyOn(AsyncStorage, "setItem");
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current.canRetrySave).toBe(false);
  await act(() => { hook.result.current.update(saved); hook.result.current.retrySave(); });
  expect(hook.result.current.saveStatus).toBe("session");
  expect(hook.result.current.canRetrySave).toBe(false);
  expect(writes).not.toHaveBeenCalled();
});

test("unmount guards retained retry callbacks and queued writes behind an in-flight retry", async () => {
  const hook = await renderHook(() => usePreparation(), { wrapper: PreparednessProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const retry = deferred();
  const writes = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Failed"))
    .mockReturnValueOnce(retry.promise);
  await act(() => hook.result.current.update(saved));
  const retrySave = hook.result.current.retrySave;
  await act(() => retrySave());
  await act(() => hook.result.current.update({ meetingPlace: "Queued change" }));
  await hook.unmount();
  await act(() => { retry.resolve(); retrySave(); });
  expect(writes).toHaveBeenCalledTimes(2);
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
