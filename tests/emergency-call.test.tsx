import { fireEvent, render } from "@testing-library/react-native";
import { Alert, Linking, Platform } from "react-native";
import { confirmAction, EmergencyButton, EmergencyControl } from "../src/ui/components";

const initialWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (initialWindow) Object.defineProperty(globalThis, "window", initialWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("deliberate emergency dialer action", () => {
  test.each([
    { component: EmergencyButton, label: "GET HELP · CALL 911" },
    { component: EmergencyControl, label: "Emergency? Call 911" },
  ])("$label requires a button press and a separate confirmation before opening the dialer", async ({ component: Control, label }) => {
    const showConfirmation = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const openDialer = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const screen = await render(<Control />);
    expect(showConfirmation).not.toHaveBeenCalled();
    expect(openDialer).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole("button", { name: label }),
    );
    expect(showConfirmation).toHaveBeenCalledWith(
      "Call 911?",
      expect.any(String),
      expect.any(Array),
    );
    expect(openDialer).not.toHaveBeenCalled();

    const actions = showConfirmation.mock.calls[0][2];
    expect(actions?.find((action) => action.text === "Cancel")?.style).toBe(
      "cancel",
    );
    actions?.find((action) => action.text === "Cancel")?.onPress?.();
    expect(openDialer).not.toHaveBeenCalled();
    actions?.find((action) => action.text === "Open dialer")?.onPress?.();
    expect(openDialer).toHaveBeenCalledWith("tel:911");
  });
});

describe("browser confirmation before an emergency dialer action", () => {
  test.each([
    { component: EmergencyButton, label: "GET HELP · CALL 911" },
    { component: EmergencyControl, label: "Emergency? Call 911" },
  ])("$label opens only after explicit browser confirmation, preserving cancellation", async ({ component: Control, label }) => {
    jest.replaceProperty(Platform, "OS", "web");
    const confirm = jest.fn().mockReturnValue(false);
    Object.defineProperty(globalThis, "window", { configurable: true, value: { confirm } });
    const nativeAlert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const openDialer = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const screen = await render(<Control />);
    const button = screen.getByRole("button", { name: label });
    expect(confirm).not.toHaveBeenCalled();
    expect(openDialer).not.toHaveBeenCalled();

    await fireEvent.press(button);
    expect(confirm).toHaveBeenCalledWith(
      "Call 911?\n\nThis will open your phone dialer. You must confirm the call on your device.\n\nOK: Open dialer",
    );
    expect(openDialer).not.toHaveBeenCalled();
    expect(nativeAlert).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await fireEvent.press(button);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(openDialer).toHaveBeenCalledTimes(1);
    expect(openDialer).toHaveBeenCalledWith("tel:911");
    expect(nativeAlert).not.toHaveBeenCalled();
  });
});

test.each(["android", "ios"] as const)("%s shared confirmation retains Cancel and explicit destructive confirmation", (platform) => {
  jest.replaceProperty(Platform, "OS", platform);
  const nativeAlert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const onConfirm = jest.fn();
  confirmAction({ title: "Remove test item?", message: "Synthetic item", confirmLabel: "Remove", destructive: true, onConfirm });
  expect(nativeAlert).toHaveBeenCalledWith("Remove test item?", "Synthetic item", expect.any(Array));
  expect(onConfirm).not.toHaveBeenCalled();
  const actions = nativeAlert.mock.calls[0][2]!;
  expect(actions).toHaveLength(2);
  const cancel = actions.find((action) => action.text === "Cancel")!;
  expect(cancel.style).toBe("cancel");
  cancel.onPress?.();
  expect(onConfirm).not.toHaveBeenCalled();
  const remove = actions.find((action) => action.text === "Remove")!;
  expect(remove.style).toBe("destructive");
  remove.onPress?.();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test.each(["server rendering", "missing browser dialog"])("web confirmation performs no action during %s", (environment) => {
  jest.replaceProperty(Platform, "OS", "web");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: environment === "server rendering" ? undefined : {},
  });
  const nativeAlert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const onConfirm = jest.fn();
  expect(() => confirmAction({ title: "Open dialer?", message: "Synthetic action", confirmLabel: "Open dialer", onConfirm })).not.toThrow();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(nativeAlert).not.toHaveBeenCalled();
});
