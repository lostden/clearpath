import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import PrepareScreen from "../src/app/prepare";
import { PreparednessProvider } from "../src/state/PreparednessState";

const storageKey = "@clearpath/preparation/v1";
const defaultRead = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const defaultWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const sectionButtons = [
  "Show field guides",
  "Show emergency kit",
  "Show family plan",
  "Show saved contacts",
  "Show emergency numbers",
] as const;

async function preparation() {
  return render(<PreparednessProvider><PrepareScreen /></PreparednessProvider>);
}

beforeEach(async () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(defaultRead);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(defaultWrite);
  await AsyncStorage.clear();
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

test("offline field guides and 911 are available before local hydration without rendering the kit", async () => {
  let finishRead!: (raw: string | null) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve; }));
  const screen = await preparation();
  expect(screen.getByText("LOCAL COPY / LOADING")).toBeTruthy();
  expect(screen.getByRole("header", { name: "02 / FIELD GUIDANCE" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "GET HELP · CALL 911" })).toBeTruthy();
  expect(screen.queryByRole("header", { name: "01 / EMERGENCY KIT" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Drinking water" })).toBeNull();
  for (const name of sectionButtons) {
    expect(screen.getByRole("button", { name }).props.accessibilityState.selected).toBe(name === "Show field guides");
  }
  await fireEvent.press(screen.getByRole("button", { name: "Read Flooding" }));
  expect(screen.getByText(/Do not walk or drive into floodwater/)).toBeTruthy();
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(() => finishRead(null));
  await waitFor(() => expect(screen.getByText("LOCAL COPY / SAVED ON THIS PHONE")).toBeTruthy());
});

test("section switches retain a kit edit and keep the full index plus 911 available", async () => {
  const screen = await preparation();
  await waitFor(() => expect(screen.getByText("LOCAL COPY / SAVED ON THIS PHONE")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Show emergency kit" }));
  expect(screen.queryByRole("header", { name: "02 / FIELD GUIDANCE" })).toBeNull();
  expect(screen.getByRole("header", { name: "01 / EMERGENCY KIT" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("checkbox", { name: "Drinking water" }));
  expect(screen.getByRole("checkbox", { name: "Drinking water" }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "Show field guides" }));
  expect(screen.queryByRole("checkbox", { name: "Drinking water" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Show emergency kit" }));
  expect(screen.getByRole("checkbox", { name: "Drinking water" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("progressbar", { name: "1 of 12 emergency kit items completed" }).props.accessibilityValue.now).toBe(1);
  for (const name of sectionButtons) {
    expect(screen.getByRole("button", { name }).props.accessibilityState.selected).toBe(name === "Show emergency kit");
  }
  expect(screen.getAllByRole("button", { name: "GET HELP · CALL 911" })).toHaveLength(1);
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(storageKey))!).checked.water).toBe(true));
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test("family-plan edits and a contact draft survive leaving their sections", async () => {
  const screen = await preparation();
  await waitFor(() => expect(screen.getByText("LOCAL COPY / SAVED ON THIS PHONE")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Show family plan" }));
  await fireEvent.changeText(screen.getByLabelText("Family meeting place"), "Test meeting place");
  await fireEvent.changeText(screen.getByLabelText("Family out-of-area contact"), "Test relative");
  await fireEvent.press(screen.getByRole("button", { name: "Show saved contacts" }));
  expect(screen.queryByLabelText("Family meeting place")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Add emergency contact" }));
  await fireEvent.changeText(screen.getByLabelText("Contact name"), "Test contact");
  await fireEvent.changeText(screen.getByLabelText("Contact phone number"), "5550100");
  await fireEvent.press(screen.getByRole("button", { name: "Show field guides" }));
  expect(screen.queryByLabelText("Contact name")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Show family plan" }));
  expect(screen.getByLabelText("Family meeting place").props.value).toBe("Test meeting place");
  expect(screen.getByLabelText("Family out-of-area contact").props.value).toBe("Test relative");
  await fireEvent.press(screen.getByRole("button", { name: "Show saved contacts" }));
  expect(screen.getByLabelText("Contact name").props.value).toBe("Test contact");
  expect(screen.getByLabelText("Contact phone number").props.value).toBe("5550100");
  expect(Linking.openURL).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Save contact" }));
  expect(screen.getByRole("button", { name: "Call Test contact" })).toBeTruthy();
  expect(screen.queryByLabelText("Contact name")).toBeNull();
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toMatchObject({
    meetingPlace: "Test meeting place",
    outOfAreaContact: "Test relative",
    contacts: [{ name: "Test contact", phone: "5550100" }],
  }));
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test("saved contact and resource dialers require deliberate section and confirmation actions", async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify({
    checked: {}, meetingPlace: "", outOfAreaContact: "",
    contacts: [{ id: "test-contact", name: "Test family", phone: "555 0100" }],
  }));
  const screen = await preparation();
  await waitFor(() => expect(screen.getByText("LOCAL COPY / SAVED ON THIS PHONE")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Call Test family" })).toBeNull();
  expect(screen.queryByRole("button", { name: "2-1-1 Texas — community resources · 211" })).toBeNull();
  for (const name of sectionButtons) {
    await fireEvent.press(screen.getByRole("button", { name }));
    expect(screen.getAllByRole("button", { name: "GET HELP · CALL 911" })).toHaveLength(1);
    for (const indexName of sectionButtons) {
      expect(screen.getByRole("button", { name: indexName }).props.accessibilityState.selected).toBe(indexName === name);
    }
  }
  expect(screen.getByRole("button", { name: "2-1-1 Texas — community resources · 211" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Call Test family" })).toBeNull();
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Show saved contacts" }));
  expect(screen.queryByRole("button", { name: "2-1-1 Texas — community resources · 211" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Call Test family" }));
  expect(Alert.alert).toHaveBeenCalledWith("Call Test family?", expect.any(String), expect.any(Array));
  expect(Linking.openURL).not.toHaveBeenCalled();
  const choices = jest.mocked(Alert.alert).mock.calls[0][2]!;
  expect(choices.find((choice) => choice.text === "Cancel")).toBeTruthy();
  const openDialer = choices.find((choice) => choice.text === "Open dialer")!;
  await act(() => openDialer.onPress?.());
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith("tel:5550100");
  jest.mocked(Alert.alert).mockClear();
  jest.mocked(Linking.openURL).mockClear();
  await fireEvent.press(screen.getByRole("button", { name: "Show emergency numbers" }));
  expect(Linking.openURL).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "2-1-1 Texas — community resources · 211" }));
  expect(Alert.alert).toHaveBeenCalledWith("Call 2-1-1 Texas — community resources?", expect.any(String), expect.any(Array));
  expect(Linking.openURL).not.toHaveBeenCalled();
  const resourceChoices = jest.mocked(Alert.alert).mock.calls[0][2]!;
  await act(() => resourceChoices.find((choice) => choice.text === "Open dialer")?.onPress?.());
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith("tel:211");
});
