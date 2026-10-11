import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { Share } from "react-native";
import { ShareLocation } from "../src/components/ShareLocation";
import { DEMO_DATE_LABEL, DEMO_LOCATION } from "../src/data/demo";
import type { SelectedLocation } from "../src/domain/types";

const manual: SelectedLocation = {
  label: "Selected river point",
  kind: "manual",
  coordinates: { latitude: 30.0699306976302, longitude: -99.3328236030694 },
};

beforeEach(() => {
  jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
});

test("opening and cancelling a review never invokes the system share sheet", async () => {
  const screen = await render(<ShareLocation selectedLocation={manual} source="live" />);
  expect(Share.share).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const review = scrollViews[0];
  expect(within(review).getByText("REVIEW LOCATION.")).toBeTruthy();
  expect(within(review).getByText(/Latitude: 30.0699306976302/)).toBeTruthy();
  expect(within(review).queryByRole("button", { name: "Cancel location sharing" })).toBeNull();
  expect(Share.share).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel location sharing" }));
  expect(screen.queryByText("REVIEW LOCATION.")).toBeNull();
  expect(Share.share).not.toHaveBeenCalled();
});

test("confirmed manual sharing sends the exact reviewed coordinates and an HTTPS map point", async () => {
  const screen = await render(<ShareLocation selectedLocation={manual} source="cached" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  const reviewedMessage = screen.getByText(/MANUAL \/ SELECTED POINT/).props.children;
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  expect(Share.share).toHaveBeenCalledTimes(1);
  expect(Share.share).toHaveBeenCalledWith(
    {
      title: "Selected location",
      message: reviewedMessage,
    },
    { dialogTitle: "Share selected location", subject: "Selected location" },
  );
  expect(reviewedMessage).toContain("Longitude: -99.3328236030694");
  expect(reviewedMessage).toContain("https://www.google.com/maps/search/?api=1&query=30.0699306976302%2C-99.3328236030694");
  expect(reviewedMessage).toContain("not a GPS reading of my current position");
  await waitFor(() => expect(screen.getByText("Share sheet closed. Confirm delivery in the app you chose.")).toBeTruthy());
  expect(screen.queryByText(/Location sent|Message delivered/)).toBeNull();
});

test("saved GPS points are last selected coordinates and never claim a fresh position", async () => {
  const screen = await render(
    <ShareLocation selectedLocation={{ ...manual, kind: "gps", label: "Saved GPS point · last selection" }} source="unavailable" />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  const reviewedMessage = screen.getByText(/GPS \/ LAST SELECTED POINT/).props.children;
  expect(reviewedMessage).toContain("My current position has not been rechecked.");
  expect(reviewedMessage).toContain("Saved GPS point · last selection");
  expect(Share.share).not.toHaveBeenCalled();
});

test("demo messages clearly label simulation and the fixed July 4 exercise date", async () => {
  const screen = await render(<ShareLocation selectedLocation={DEMO_LOCATION} source="demo" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  const reviewedMessage = screen.getByText(/SIMULATED LOCATION \/ TRAINING ONLY/).props.children;
  expect(reviewedMessage).toContain(DEMO_DATE_LABEL);
  expect(reviewedMessage).toContain("This is not my actual position.");
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  expect(Share.share).toHaveBeenCalledWith(
    { title: "SIMULATED LOCATION / TRAINING ONLY", message: reviewedMessage },
    { dialogTitle: "Share selected location", subject: "SIMULATED LOCATION / TRAINING ONLY" },
  );
});

test("a point or mode change during review cannot silently change the shared message", async () => {
  const screen = await render(<ShareLocation selectedLocation={DEMO_LOCATION} source="demo" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  const reviewedMessage = screen.getByText(/SIMULATED LOCATION \/ TRAINING ONLY/).props.children;
  await screen.rerender(<ShareLocation selectedLocation={manual} source="live" />);
  expect(screen.getByText(/SIMULATED LOCATION \/ TRAINING ONLY/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  expect(jest.mocked(Share.share).mock.calls[0][0].message).toBe(reviewedMessage);
});

test.each([null, { ...manual, coordinates: { latitude: NaN, longitude: -99 } }])(
  "sharing is disabled without valid selected coordinates (%s)",
  async (selectedLocation) => {
    const screen = await render(<ShareLocation selectedLocation={selectedLocation} source="live" />);
    expect(screen.getByRole("button", { name: "Share location" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
    expect(screen.queryByText("REVIEW LOCATION.")).toBeNull();
    expect(Share.share).not.toHaveBeenCalled();
  },
);

test("native failure leaves the exact review available for deliberate retry", async () => {
  jest.mocked(Share.share).mockRejectedValueOnce(new Error("Native module unavailable"));
  const screen = await render(<ShareLocation selectedLocation={manual} source="live" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  await waitFor(() => expect(screen.getByText("Share sheet could not open. Retry or cancel.")).toBeTruthy());
  expect(Share.share).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Open share sheet" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  expect(Share.share).toHaveBeenCalledTimes(2);
});

test("iOS dismissal is cancellation, not delivery", async () => {
  jest.mocked(Share.share).mockResolvedValueOnce({ action: Share.dismissedAction });
  const screen = await render(<ShareLocation selectedLocation={manual} source="live" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  await waitFor(() => expect(screen.getByText("Sharing cancelled.")).toBeTruthy());
});

test.each(["Back", "fixed Cancel"])("a pending share cannot open twice and late completion after %s cannot revive the review", async (dismissal) => {
  let resolveShare!: (result: Awaited<ReturnType<typeof Share.share>>) => void;
  jest.mocked(Share.share).mockReturnValueOnce(new Promise((resolve) => { resolveShare = resolve; }));
  const screen = await render(<ShareLocation selectedLocation={manual} source="live" />);
  await fireEvent.press(screen.getByRole("button", { name: "Share location" }));
  await fireEvent.press(screen.getByRole("button", { name: "Open share sheet" }));
  expect(screen.getByRole("button", { name: "Opening share sheet…" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Opening share sheet…" }));
  expect(Share.share).toHaveBeenCalledTimes(1);
  if (dismissal === "Back") {
    await fireEvent(screen.getByTestId("share-location-review"), "requestClose");
  } else {
    const cancel = screen.getByRole("button", { name: "Cancel location sharing" });
    expect(cancel).toBeEnabled();
    const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
    expect(scrollViews).toHaveLength(1);
    expect(within(scrollViews[0]).queryByRole("button", { name: "Cancel location sharing" })).toBeNull();
    await fireEvent.press(cancel);
  }
  await act(() => resolveShare({ action: Share.sharedAction }));
  expect(screen.queryByText("REVIEW LOCATION.")).toBeNull();
  expect(screen.queryByText("Share sheet closed. Confirm delivery in the app you chose.")).toBeNull();
});
