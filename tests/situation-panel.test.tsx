import { fireEvent, render } from "@testing-library/react-native";
import { SituationPanel } from "../src/components/SituationPanel";
import { officialAlert } from "./fixtures/officialAlert";

describe("situation verification and source states", () => {
  test("a successful empty live result uses the exact no-alert wording", async () => {
    const screen = await render(
      <SituationPanel alerts={[]} source="live" onOpenAlert={jest.fn()} />,
    );
    expect(
      screen.getByText("No active official alerts found for this location."),
    ).toBeTruthy();
    expect(screen.getByLabelText("LIVE · OFFICIAL NWS")).toBeTruthy();
    expect(screen.queryByText("You are safe.")).toBeNull();
  });

  test.each(["unavailable", "live"] as const)(
    "failed verification cannot become an empty live finding (%s)",
    async (source) => {
      const screen = await render(
        <SituationPanel
          alerts={[]}
          source={source}
          error
          onOpenAlert={jest.fn()}
        />,
      );
      expect(screen.getByText("Unable to verify current alerts.")).toBeTruthy();
      expect(
        screen.queryByText(
          "No active official alerts found for this location.",
        ),
      ).toBeNull();
    },
  );

  test("the initial in-flight request does not show a no-alert result", async () => {
    const screen = await render(
      <SituationPanel
        alerts={[]}
        source="live"
        loading
        onOpenAlert={jest.fn()}
      />,
    );
    expect(screen.getByText("Checking official NWS alerts…")).toBeTruthy();
    expect(
      screen.queryByText("No active official alerts found for this location."),
    ).toBeNull();
  });

  test("saved empty information remains explicitly unverified", async () => {
    const screen = await render(
      <SituationPanel
        alerts={[]}
        source="cached"
        error
        onOpenAlert={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("CACHED · NOT VERIFIED CURRENT")).toBeTruthy();
    expect(
      screen.getByText(
        "No warnings retained in this saved snapshot. Current alerts are unverified.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("No active official alerts found for this location."),
    ).toBeNull();
  });

  test("simulated warning keeps a persistent demo marker and distinct instructions label", async () => {
    const screen = await render(
      <SituationPanel
        alerts={[officialAlert]}
        source="demo"
        onOpenAlert={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("SIMULATED DEMO")).toBeTruthy();
    expect(screen.getByText("SIMULATED INSTRUCTIONS")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Read simulated warning" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("LIVE · OFFICIAL NWS")).toBeNull();
  });

  test("preserves the agency instructions and makes every applicable warning accessible", async () => {
    const second = {
      ...officialAlert,
      id: "test-alert-2",
      event: "Tornado Warning",
      severity: "Extreme" as const,
    };
    const third = {
      ...officialAlert,
      id: "test-alert-3",
      event: "Flood Watch",
      severity: "Moderate" as const,
    };
    const onOpenAlert = jest.fn();
    const screen = await render(
      <SituationPanel
        alerts={[officialAlert, second, third]}
        source="live"
        onOpenAlert={onOpenAlert}
      />,
    );
    expect(screen.getByText(officialAlert.instruction!)).toBeTruthy();
    expect(screen.getByText(officialAlert.headline!)).toBeTruthy();
    expect(screen.getByText("2 additional warnings")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", { name: "Read full original warning" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Read Tornado Warning" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Read Flood Watch" }),
    );
    expect(onOpenAlert.mock.calls.map(([alert]) => alert)).toEqual([
      officialAlert,
      second,
      third,
    ]);
  });

  test("missing agency instructions are disclosed instead of synthesized", async () => {
    const screen = await render(
      <SituationPanel
        alerts={[{ ...officialAlert, instruction: null }]}
        source="live"
        onOpenAlert={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No instructions were supplied with this warning. Read the original warning and follow local emergency authorities.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(officialAlert.instruction!)).toBeNull();
  });
});
