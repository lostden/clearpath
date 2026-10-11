import { cleanup, fireEvent, render, within } from "@testing-library/react-native";
import { Linking } from "react-native";
import { HazardDetail, hazardDetailSource, type HazardSelection } from "../src/components/HazardDetail";
import type { OfficialEarthquake, RiverGauge } from "../src/services/usgsTypes";

const fetchedAt = "2026-10-10T22:00:00.000Z";
const generatedAt = "2026-10-10T21:59:45.000Z";
const quake: OfficialEarthquake = {
  id: "test-observation", name: "USGS TEST EPICENTER", coordinates: { latitude: 30, longitude: -99 },
  magnitude: 0, depthKm: 7, observedAt: "2026-10-10T20:05:00.000Z", updatedAt: "2026-10-10T21:40:00.000Z",
  sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/test-observation", reviewStatus: "reviewed",
};
const river: RiverGauge = {
  id: "test-observation", name: "USGS TEST STATION", coordinates: { latitude: 30, longitude: -99 }, distanceKm: 2.4,
  sourceUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-08166200/",
  gageHeight: {
    value: 0, displayValue: "0.00", units: "ft", observedAt: "2026-10-10T21:50:00.000Z",
    approvalStatus: "Provisional", qualifier: null,
  },
  streamflow: null,
};
const earthquakeSelection: HazardSelection = { kind: "earthquake", item: quake, source: "live", fetchedAt, generatedAt };
const riverSelection: HazardSelection = { kind: "river", item: river, source: "live", fetchedAt, generatedAt: null };
const copies = () => ({
  earthquakes: { items: [quake], source: "live" as const, fetchedAt, generatedAt },
  rivers: { items: [river], source: "live" as const, fetchedAt, generatedAt: null },
});

afterEach(async () => { await cleanup(); });

test("earthquake details retain observation times and a Close action outside scrolling content", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  const close = jest.fn();
  const screen = await render(<HazardDetail selection={earthquakeSelection} source="cached" onClose={close} />);
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const content = within(scrollViews[0]);
  expect(screen.getAllByRole("button", { name: "Close observation" })).toHaveLength(1);
  expect(content.queryByRole("button", { name: "Close observation" })).toBeNull();
  expect(content.getByText(quake.name)).toBeTruthy();
  expect(content.getByRole("button", { name: "Open official USGS source" })).toBeTruthy();
  expect(screen.getByText("USGS / CACHED · UNVERIFIED")).toBeTruthy();
  expect(screen.getByText(`Observed: ${new Date(quake.observedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(`Updated: ${new Date(quake.updatedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(`Feed generated: ${new Date(generatedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(`Retrieved: ${new Date(fetchedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText("M 0")).toBeTruthy();
  expect(screen.getByText("This point marks an epicenter. It does not show damage or an impact area.")).toBeTruthy();
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Open official USGS source" }));
  expect(open).toHaveBeenCalledWith(quake.sourceUrl);
  await fireEvent.press(screen.getByRole("button", { name: "Close observation" }));
  expect(close).toHaveBeenCalledTimes(1);
});

test("river detail keeps exact zero, units and provisional observation while missing streamflow stays unavailable", async () => {
  const screen = await render(<HazardDetail selection={riverSelection} source="live" onClose={jest.fn()} />);
  const scrollViews = screen.container.queryAll((node) => node.type === "RCTScrollView");
  expect(scrollViews).toHaveLength(1);
  const content = within(scrollViews[0]);
  expect(screen.getAllByRole("button", { name: "Close observation" })).toHaveLength(1);
  expect(content.queryByRole("button", { name: "Close observation" })).toBeNull();
  expect(content.getByText(river.name)).toBeTruthy();
  expect(content.getByRole("button", { name: "Open official USGS source" })).toBeTruthy();
  expect(screen.getByText("USGS / LAST VERIFIED COPY")).toBeTruthy();
  expect(screen.getByText("0.00 ft")).toBeTruthy();
  expect(screen.getByText(`Observed: ${new Date(river.gageHeight!.observedAt).toLocaleString()}`)).toBeTruthy();
  expect(screen.getByText(/PROVISIONAL/)).toBeTruthy();
  expect(screen.getByText("READING UNAVAILABLE")).toBeTruthy();
  expect(screen.queryByText(/Feed generated:/)).toBeNull();
  expect(screen.getByText("Gage height is relative to the station datum. It is not flood depth, flood stage or road passability.")).toBeTruthy();
});

test.each(["cached", "unavailable"] as const)("a detail opened as %s never promotes when the same current copy is live", (source) => {
  expect(hazardDetailSource({ ...earthquakeSelection, source }, copies())).toBe("cached");
  expect(hazardDetailSource({ ...riverSelection, source }, copies())).toBe("cached");
});

test("a live selection requires the same retrieved and generated copy with its original event still present", () => {
  const current = copies();
  expect(hazardDetailSource(earthquakeSelection, current)).toBe("live");
  expect(hazardDetailSource(riverSelection, current)).toBe("live");
  expect(hazardDetailSource(null, current)).toBe("cached");
  expect(hazardDetailSource({ ...earthquakeSelection, fetchedAt: null }, current)).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, source: "cached" } })).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, fetchedAt: "2026-10-10T22:01:00.000Z" } })).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, generatedAt: "2026-10-10T22:00:45.000Z" } })).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, items: [] } })).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, items: [{ ...quake, updatedAt: fetchedAt }] } })).toBe("cached");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, items: [{ ...quake, magnitude: 2.1 }] } })).toBe("cached");
});

test("station correction or changed point distance cannot lend live status to the retained reading", () => {
  const current = copies();
  for (const item of [
    { ...river, distanceKm: 9 },
    { ...river, gageHeight: { ...river.gageHeight!, observedAt: fetchedAt } },
    { ...river, gageHeight: { ...river.gageHeight!, approvalStatus: "Approved" as const } },
    { ...river, gageHeight: null },
    { ...river, streamflow: { ...river.gageHeight!, value: 15, displayValue: "15", units: "ft^3/s" } },
  ]) {
    expect(hazardDetailSource(riverSelection, { ...current, rivers: { ...current.rivers, items: [item] } })).toBe("cached");
  }
  expect(hazardDetailSource(riverSelection, { ...current, rivers: { ...current.rivers, items: [] } })).toBe("cached");
});

test("even matching IDs and retrieval times never borrow verification from the other provider layer", () => {
  const current = copies();
  expect(hazardDetailSource(earthquakeSelection, { ...current, rivers: { ...current.rivers, source: "cached", items: [] } })).toBe("live");
  expect(hazardDetailSource(riverSelection, { ...current, earthquakes: { ...current.earthquakes, source: "cached", items: [] } })).toBe("live");
  expect(hazardDetailSource(earthquakeSelection, { ...current, earthquakes: { ...current.earthquakes, items: [] } })).toBe("cached");
  expect(hazardDetailSource(riverSelection, { ...current, rivers: { ...current.rivers, items: [] } })).toBe("cached");
});
