import { cleanup, fireEvent, render, within } from "@testing-library/react-native";
import { Linking } from "react-native";
import { WildfireDetail, WILDFIRE_LIMIT_COPY, wildfireDetailSource, type WildfireSelection } from "../src/components/WildfireDetail";

const selection: WildfireSelection = {
  item: {
    id: "published-id", objectId: 5, incidentId: null, name: "PUBLISHED TEST RECORD",
    geometry: { type: "Polygon", coordinates: [[[-100, 30], [-99, 30], [-99, 31], [-100, 30]]] },
    capturedAt: "2026-09-30T10:00:00.000Z", polygonUpdatedAt: "2026-10-10T20:00:00.000Z",
    incidentUpdatedAt: "2026-10-10T21:00:00.000Z", acres: 0, reportedAcres: 120.5,
    percentContained: 0, state: "US-TX", mapMethod: "Infrared Image", featureCategory: "Wildfire Daily Fire Perimeter",
    sourceUrl: "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?objectIds=5&f=pjson",
  },
  source: "live", fetchedAt: "2026-10-10T22:00:00.000Z", coverage: "TX", available: 8,
  omitted: 3, truncated: true, reason: "Some mapped records were omitted.",
};

afterEach(async () => { await cleanup(); });

test("perimeter details retain published-footprint limits and Close outside scrolling content", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  const close = jest.fn();
  const screen = await render(<WildfireDetail selection={selection} source="live" onClose={close} />);
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const content = within(scrollViews[0]);
  expect(screen.getAllByRole("button", { name: "Close perimeter" })).toHaveLength(1);
  expect(content.queryByRole("button", { name: "Close perimeter" })).toBeNull();
  expect(content.getByText(selection.item.name)).toBeTruthy();
  expect(content.getByText(WILDFIRE_LIMIT_COPY)).toBeTruthy();
  expect(content.getByRole("button", { name: "Open official NIFC record" })).toBeTruthy();
  expect(screen.getByText(`Captured: ${new Date(selection.item.capturedAt!).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(`Polygon record edited: ${new Date(selection.item.polygonUpdatedAt!).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(`Copy retrieved: ${new Date(selection.fetchedAt!).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText("Mapped footprint: 0 acres")).toBeTruthy();
  expect(screen.getByText("Reported containment: 0%. This does not verify a location.")).toBeTruthy();
  expect(screen.getByText(/PARTIAL COPY \/ 3 mapped records not included/)).toBeTruthy();
  expect(screen.getByText(WILDFIRE_LIMIT_COPY)).toBeTruthy();
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Open official NIFC record" }));
  expect(open).toHaveBeenCalledWith(selection.item.sourceUrl);
  await fireEvent.press(screen.getByRole("button", { name: "Close perimeter" }));
  expect(close).toHaveBeenCalledTimes(1);
});

test("missing capture, method and incident values stay unknown rather than borrowing fresh timestamps", async () => {
  const missing = { ...selection, item: { ...selection.item, capturedAt: null, mapMethod: null, acres: null, reportedAcres: null, percentContained: null }, available: null, omitted: null };
  const screen = await render(<WildfireDetail selection={missing} source="cached" onClose={jest.fn()} />);
  expect(screen.getByText("CAPTURE DATE UNKNOWN")).toBeTruthy();
  expect(screen.getByText("Mapping method: NOT SUPPLIED")).toBeTruthy();
  expect(screen.getByText("Mapped footprint: NOT SUPPLIED")).toBeTruthy();
  expect(screen.getByText("Reported containment: NOT SUPPLIED. This does not verify a location.")).toBeTruthy();
  expect(screen.getByText("MATCHING RECORD COUNT UNVERIFIED")).toBeTruthy();
  expect(screen.getByText(/PARTIAL COPY \/ omitted count unknown/)).toBeTruthy();
  expect(screen.getByText("NIFC / CACHED · UNVERIFIED")).toBeTruthy();
});

test("selection verification requires the same copy, coverage and published record", () => {
  const current = { source: "live" as const, fetchedAt: selection.fetchedAt, coverage: "TX" as const, items: [selection.item] };
  expect(wildfireDetailSource(selection, current)).toBe("live");
  expect(wildfireDetailSource({ ...selection, source: "cached" }, current)).toBe("cached");
  expect(wildfireDetailSource(selection, { ...current, source: "cached" })).toBe("cached");
  expect(wildfireDetailSource(selection, { ...current, coverage: "US" })).toBe("cached");
  expect(wildfireDetailSource(selection, { ...current, fetchedAt: "2026-10-10T23:00:00.000Z" })).toBe("cached");
  expect(wildfireDetailSource(selection, { ...current, items: [] })).toBe("cached");
  expect(wildfireDetailSource(selection, { ...current, items: [{ ...selection.item, capturedAt: null }] })).toBe("cached");
});
