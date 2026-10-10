import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { FeedUpdateControl } from "../src/components/FeedUpdateControl";
import { FEED_PREFERENCES_KEY, FeedPreferencesProvider, useFeedPreferences } from "../src/state/FeedPreferences";

const READ_ERROR = "Saved update preference could not be read. Automatic updates are off for this session.";
const WRITE_ERROR = "Update mode changed for this session, but could not be saved for reopening.";
const SWITCH_NAME = "Automatic feed updates";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(async () => {
  await cleanup();
});

test("first launch defaults to automatic only after hydration and ignores premature mutations", async () => {
  const saved = deferred<string | null>();
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(saved.promise);
  const writes = jest.spyOn(AsyncStorage, "setItem");
  const hook = await renderHook(() => useFeedPreferences(), { wrapper: FeedPreferencesProvider });

  expect(hook.result.current).toMatchObject({ automatic: true, ready: false, storageError: null });
  await act(() => hook.result.current.setAutomatic(false));
  expect(hook.result.current).toMatchObject({ automatic: true, ready: false });
  expect(writes).not.toHaveBeenCalled();
  await act(() => saved.resolve(null));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current).toMatchObject({ automatic: true, storageError: null });
  expect(writes).not.toHaveBeenCalled();
});

test("the named switch stays disabled during hydration and shows the stored manual choice afterward", async () => {
  const saved = deferred<string | null>();
  jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(saved.promise);
  const writes = jest.spyOn(AsyncStorage, "setItem");
  const screen = await render(<FeedPreferencesProvider><FeedUpdateControl /></FeedPreferencesProvider>);

  const loadingSwitch = screen.getByRole("switch", { name: SWITCH_NAME });
  expect(loadingSwitch.props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  expect(screen.getByText("Loading saved update mode.")).toBeTruthy();
  await fireEvent.press(loadingSwitch);
  expect(writes).not.toHaveBeenCalled();
  await act(() => saved.resolve(JSON.stringify({ automatic: false })));
  await waitFor(() => expect(screen.queryByText("Loading saved update mode.")).toBeNull());

  const manualSwitch = screen.getByRole("switch", { name: SWITCH_NAME });
  expect(manualSwitch.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  expect(screen.getByText("MANUAL MODE / Tap Refresh for each feed. New updates are not checked automatically.")).toBeTruthy();
  expect(writes).not.toHaveBeenCalled();
});

test.each([
  "{invalid json",
  JSON.stringify({ automatic: "false" }),
  JSON.stringify(["manual"]),
])("corrupt stored preferences use manual mode without overwriting the saved data %#", async (raw) => {
  await AsyncStorage.setItem(FEED_PREFERENCES_KEY, raw);
  const writes = jest.spyOn(AsyncStorage, "setItem").mockClear();
  const hook = await renderHook(() => useFeedPreferences(), { wrapper: FeedPreferencesProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current).toMatchObject({ automatic: false, storageError: READ_ERROR });
  expect(writes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(FEED_PREFERENCES_KEY)).toBe(raw);
});

test("a storage read failure exposes the manual fallback and storage error through the accessible control", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Read failed"));
  const writes = jest.spyOn(AsyncStorage, "setItem");
  const screen = await render(<FeedPreferencesProvider><FeedUpdateControl /></FeedPreferencesProvider>);
  await waitFor(() => expect(screen.getByText(READ_ERROR)).toBeTruthy());
  const control = screen.getByRole("switch", { name: SWITCH_NAME });
  expect(control.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  expect(screen.getByText("OFF")).toBeTruthy();
  expect(writes).not.toHaveBeenCalled();
});

test("switch changes persist the chosen mode and reopening restores the latest successful toggle", async () => {
  await AsyncStorage.setItem(FEED_PREFERENCES_KEY, JSON.stringify({ automatic: false }));
  const screen = await render(<FeedPreferencesProvider><FeedUpdateControl /></FeedPreferencesProvider>);
  await waitFor(() => expect(screen.queryByText("Loading saved update mode.")).toBeNull());
  await fireEvent.press(screen.getByRole("switch", { name: SWITCH_NAME }));
  await waitFor(async () => expect(await AsyncStorage.getItem(FEED_PREFERENCES_KEY)).toBe(JSON.stringify({ automatic: true })));
  expect(screen.getByRole("switch", { name: SWITCH_NAME }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByText("Weather and earthquakes: 60s. Rivers and enabled wildfire perimeters: 5min. Foreground only.")).toBeTruthy();

  await fireEvent.press(screen.getByRole("switch", { name: SWITCH_NAME }));
  await waitFor(async () => expect(await AsyncStorage.getItem(FEED_PREFERENCES_KEY)).toBe(JSON.stringify({ automatic: false })));
  await screen.unmount();
  const reopened = await renderHook(() => useFeedPreferences(), { wrapper: FeedPreferencesProvider });
  await waitFor(() => expect(reopened.result.current.ready).toBe(true));
  expect(reopened.result.current).toMatchObject({ automatic: false, storageError: null });
});

test("a failed write retains the session choice and displays the save error without changing the stored choice", async () => {
  await AsyncStorage.setItem(FEED_PREFERENCES_KEY, JSON.stringify({ automatic: false }));
  const screen = await render(<FeedPreferencesProvider><FeedUpdateControl /></FeedPreferencesProvider>);
  await waitFor(() => expect(screen.queryByText("Loading saved update mode.")).toBeNull());
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Write failed"));
  await fireEvent.press(screen.getByRole("switch", { name: SWITCH_NAME }));
  await waitFor(() => expect(screen.getByText(WRITE_ERROR)).toBeTruthy());
  expect(screen.getByRole("switch", { name: SWITCH_NAME }).props.accessibilityState).toMatchObject({ checked: true, disabled: false });
  expect(screen.getByText("ON")).toBeTruthy();
  expect(await AsyncStorage.getItem(FEED_PREFERENCES_KEY)).toBe(JSON.stringify({ automatic: false }));
});

test("only the latest queued revision can clear an existing error or report its own save failure", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Read failed"));
  const hook = await renderHook(() => useFeedPreferences(), { wrapper: FeedPreferencesProvider });
  await waitFor(() => expect(hook.result.current.storageError).toBe(READ_ERROR));
  const first = deferred<void>();
  const latest = deferred<void>();
  const writes = jest.spyOn(AsyncStorage, "setItem").mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
  await act(() => {
    hook.result.current.setAutomatic(true);
    hook.result.current.setAutomatic(false);
  });
  expect(writes).toHaveBeenCalledTimes(1);
  expect(writes).toHaveBeenNthCalledWith(1, FEED_PREFERENCES_KEY, JSON.stringify({ automatic: true }));
  await act(() => first.resolve());
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(hook.result.current.storageError).toBe(READ_ERROR);
  expect(writes).toHaveBeenNthCalledWith(2, FEED_PREFERENCES_KEY, JSON.stringify({ automatic: false }));
  await act(() => latest.reject(new Error("Latest write failed")));
  await waitFor(() => expect(hook.result.current.storageError).toBe(WRITE_ERROR));
  expect(hook.result.current.automatic).toBe(false);

  await act(() => hook.result.current.setAutomatic(true));
  await waitFor(() => expect(hook.result.current.storageError).toBeNull());
  expect(hook.result.current.automatic).toBe(true);
  expect(await AsyncStorage.getItem(FEED_PREFERENCES_KEY)).toBe(JSON.stringify({ automatic: true }));
});

test("a superseded failed write cannot create an error or prevent the latest queued choice from being saved", async () => {
  const hook = await renderHook(() => useFeedPreferences(), { wrapper: FeedPreferencesProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const older = deferred<void>();
  const newer = deferred<void>();
  const writes = jest.spyOn(AsyncStorage, "setItem").mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  await act(() => {
    hook.result.current.setAutomatic(false);
    hook.result.current.setAutomatic(true);
  });
  expect(writes).toHaveBeenCalledTimes(1);
  await act(() => older.reject(new Error("Superseded write failed")));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(hook.result.current).toMatchObject({ automatic: true, storageError: null });
  expect(writes).toHaveBeenNthCalledWith(1, FEED_PREFERENCES_KEY, JSON.stringify({ automatic: false }));
  expect(writes).toHaveBeenNthCalledWith(2, FEED_PREFERENCES_KEY, JSON.stringify({ automatic: true }));
  await act(() => newer.resolve());
  expect(hook.result.current).toMatchObject({ automatic: true, storageError: null });
});
