import { fireEvent, render } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import { EmergencyButton, EmergencyControl } from "../src/ui/components";

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
