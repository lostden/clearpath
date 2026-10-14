import { act, cleanup, fireEvent, render, within } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import {
  AlertDetail,
  detailSource,
  type AlertSelection,
} from "../src/components/AlertDetail";
import { officialAlert } from "./fixtures/officialAlert";
import { TEST_NOW } from "./fixtures/alerts";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));

test.each([
  ["Flash Flood Warning", "Read Flooding guide", "flood"],
  ["Severe Thunderstorm Warning", "Open general preparedness", ""],
])("%s dismisses its warning before opening the appropriate bundled preparation", async (event, action, guide) => {
  let closed = false;
  jest.mocked(router.navigate).mockImplementation(() => {
    expect(closed).toBe(true);
  });
  const screen = await render(<AlertDetail alert={{ ...officialAlert, event }} source="cached" onClose={() => { closed = true; }} />);
  await fireEvent.press(screen.getByRole("button", { name: action }));
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: "/prepare",
    params: { guide, guideRequest: expect.any(String) },
  });
});

test("repeated warning actions issue distinct guide requests even within the same millisecond", async () => {
  const screen = await render(<AlertDetail alert={officialAlert} source="demo" onClose={() => {}} />);
  const action = screen.getByRole("button", { name: "Read Flooding guide" });
  await fireEvent.press(action);
  await fireEvent.press(action);
  const first = jest.mocked(router.navigate).mock.calls[0][0];
  const second = jest.mocked(router.navigate).mock.calls[1][0];
  expect(first).not.toEqual(second);
});

test("display-order explanation is secondary and preserves original official instructions", async () => {
  const explanation = "Shown earlier because this warning is in the selected-point NWS response. This is display order, not personal danger.";
  const screen = await render(<AlertDetail alert={officialAlert} source="live" priorityExplanation={explanation} onClose={() => {}} />);
  expect(screen.queryByText(explanation)).toBeNull();
  expect(screen.getByText(officialAlert.instruction!)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Why this warning is shown here" }));
  expect(screen.getByText(explanation)).toBeTruthy();
  expect(screen.getByText(officialAlert.instruction!)).toBeTruthy();
  expect(screen.getByText(officialAlert.description)).toBeTruthy();
});

beforeEach(() => {
  jest.mocked(router.navigate).mockReset();
  // Keep the fixed warning fixture current, and run expiration callbacks only
  // through explicit timer advancement inside act.
  jest.useFakeTimers({ now: TEST_NOW });
});

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

test("warning detail preserves the full description and original agency instructions", async () => {
  const onClose = jest.fn();
  const screen = await render(
    <AlertDetail alert={officialAlert} source="live" onClose={onClose} />,
  );
  expect(screen.getByText(officialAlert.description)).toBeTruthy();
  expect(screen.getByText(officialAlert.instruction!)).toBeTruthy();
  expect(
    screen.getByText(
      "Severity: Severe · Urgency: Immediate · Certainty: Observed",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Open official NWS source" }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close warning" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a long warning keeps Close outside its scrolling source copy without truncating instructions or changing its source link", async () => {
  const warning = {
    ...officialAlert,
    description: Array.from({ length: 30 }, (_, index) =>
      `Test paragraph ${index + 1}. ${officialAlert.description}`).join("\n\n"),
  };
  const onClose = jest.fn();
  const openSource = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  const screen = await render(<AlertDetail alert={warning} source="live" onClose={onClose} />);
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const content = within(scrollViews[0]);

  expect(content.getByText(warning.description)).toBeTruthy();
  expect(content.getByText(warning.instruction!)).toBeTruthy();
  expect(content.getByText(warning.headline!)).toBeTruthy();
  expect(content.queryByRole("button", { name: "Close warning" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Close warning" })).toHaveLength(1);
  await fireEvent.press(content.getByRole("button", { name: "Open official NWS source" }));
  expect(openSource).toHaveBeenCalledTimes(1);
  expect(openSource).toHaveBeenCalledWith(officialAlert.sourceUrl);
  await fireEvent.press(screen.getByRole("button", { name: "Close warning" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a simulated detail cannot link to a fabricated official source", async () => {
  const screen = await render(
    <AlertDetail
      alert={{ ...officialAlert, sourceUrl: null }}
      source="demo"
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("SIMULATED DEMO")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Open official NWS source" }),
  ).toBeNull();
});

test("only the exact still-verified warning copy retains live provenance in a detail view", () => {
  const selection: AlertSelection = {
    alert: officialAlert,
    source: "live",
    fetchedAt: "2026-10-09T18:05:00Z",
  };
  expect(detailSource(selection, "live", selection.fetchedAt)).toBe("live");
  expect(detailSource(selection, "cached", selection.fetchedAt)).toBe("cached");
  expect(detailSource(selection, "unavailable", null)).toBe("cached");
  expect(detailSource(selection, "live", "2026-10-09T18:06:00Z")).toBe(
    "cached",
  );
  expect(
    detailSource(
      { ...selection, source: "cached" },
      "live",
      selection.fetchedAt,
    ),
  ).toBe("cached");
});

test("an open simulated warning remains simulated when the user returns to live mode", () => {
  const selection: AlertSelection = {
    alert: officialAlert,
    source: "demo",
    fetchedAt: null,
  };
  expect(detailSource(selection, "live", "2026-10-09T18:05:00Z")).toBe("demo");
  expect(detailSource(selection, "cached", null)).toBe("demo");
});

test("an open warning is marked expired when its expiration passes", async () => {
  const now = Date.parse("2026-10-09T18:00:00Z");
  jest.setSystemTime(now);
  const alert = {
    ...officialAlert,
    expires: new Date(now + 1000).toISOString(),
  };
  const screen = await render(
    <AlertDetail
      alert={alert}
      source="cached"
      fetchedAt="2026-10-09T17:59:00Z"
      onClose={jest.fn()}
    />,
  );
  expect(screen.queryByText("This warning has expired.")).toBeNull();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1001);
  });
  expect(screen.getByText("This warning has expired.")).toBeTruthy();
  expect(
    screen.getByText(
      "Read this as a historical snapshot. Follow current official instructions.",
    ),
  ).toBeTruthy();
  expect(screen.getByText(officialAlert.instruction!)).toBeTruthy();
});
