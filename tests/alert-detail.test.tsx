import { act, fireEvent, render } from "@testing-library/react-native";
import {
  AlertDetail,
  detailSource,
  type AlertSelection,
} from "../src/components/AlertDetail";
import { officialAlert } from "./fixtures/officialAlert";

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
  jest.useFakeTimers({ now });
  try {
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
  } finally {
    jest.useRealTimers();
  }
});
