import { normalizeEarthquakes, EARTHQUAKE_WINDOW_MS } from "../src/services/usgsEarthquakes";
import { distanceKm, getNearbyRiverGauges, joinRiverObservations, normalizeStations, riverBoundingBox } from "../src/services/usgsRivers";
import { isRiverObservationDelayed, validObservationTime } from "../src/services/usgsTypes";
import { fetchJson } from "../src/data/http";

jest.mock("../src/data/http", () => ({
  ...jest.requireActual("../src/data/http"), fetchJson: jest.fn(),
}));
const fetchData = jest.mocked(fetchJson);

const NOW = Date.parse("2026-10-10T20:00:00Z");
const point = { latitude: 30, longitude: -99 };
const collection = (...features: unknown[]) => ({ type: "FeatureCollection", features });
function earthquake(properties: Record<string, unknown> = {}, geometry: unknown = { type: "Point", coordinates: [-99, 30, 4] }) {
  return { type: "Feature", id: "us-test", geometry, properties: {
    type: "earthquake", place: "Texas", time: NOW - 60_000, updated: NOW, mag: 2.1,
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us-test", status: "reviewed", ...properties,
  } };
}
function station(id = "USGS-08166200", coordinates = [-99, 30], properties: Record<string, unknown> = {}) {
  return { type: "Feature", id, geometry: { type: "Point", coordinates }, properties: {
    state_code: "48", site_type_code: "ST", monitoring_location_name: "Texas stream station", ...properties,
  } };
}
function observation(properties: Record<string, unknown> = {}) {
  return { type: "Feature", properties: {
    monitoring_location_id: "USGS-08166200", parameter_code: "00065", statistic_id: "00011",
    value: "1.20", unit_of_measure: "ft", time: "2026-10-10T14:45:00-05:00",
    approval_status: "Provisional", qualifier: null, ...properties,
  } };
}

test("normalizes official epicenters, preserves null magnitude and source time, excludes non-earthquakes", () => {
  const events = normalizeEarthquakes(collection(earthquake({ mag: null }), earthquake({ type: "quarry blast" })), NOW);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ coordinates: point, magnitude: null, depthKm: 4, observedAt: new Date(NOW - 60_000).toISOString() });
  expect(events[0]).not.toHaveProperty("severity");
});

test("a current empty earthquake feed differs from an invalid or partially malformed feed", () => {
  expect(normalizeEarthquakes(collection(), NOW)).toEqual([]);
  expect(() => normalizeEarthquakes({}, NOW)).toThrow();
  expect(() => normalizeEarthquakes(collection(earthquake(), earthquake({ time: "today" })), NOW)).toThrow(/could not be verified/);
  expect(() => normalizeEarthquakes(collection(earthquake({ url: "https://example.com" })), NOW)).toThrow();
  expect(() => normalizeEarthquakes(collection(earthquake({}, { type: "Point", coordinates: [NaN, 30, 4] })), NOW)).toThrow();
});

test("old cached earthquake events fall outside 24 hours; duplicate identities use latest source update", () => {
  expect(normalizeEarthquakes(collection(earthquake({ time: NOW - EARTHQUAKE_WINDOW_MS - 1 })), NOW)).toEqual([]);
  expect(normalizeEarthquakes(collection(earthquake({ time: NOW + 600_000 })), NOW)).toEqual([]);
  const events = normalizeEarthquakes(collection(earthquake({ mag: 2, updated: NOW - 1 }), earthquake({ mag: 2.5 })), NOW);
  expect(events).toHaveLength(1);
  expect(events[0].magnitude).toBe(2.5);
});

test("river discovery enforces verified Texas stream metadata and the radius after bounding-box discovery", () => {
  const stations = normalizeStations(collection(station(), station("USGS-08166201", [-98.5, 30.4]),
    station("USGS-08166202", [-99, 30], { state_code: "40" }), station("USGS-08166203", [-99, 30], { site_type_code: "GW" })), point);
  expect(stations.map((item) => item.id)).toEqual(["USGS-08166200"]);
  expect(distanceKm(point, point)).toBe(0);
  expect(distanceKm(point, { latitude: 30.4, longitude: -98.5 })).toBeGreaterThan(50);
  expect(() => riverBoundingBox({ latitude: NaN, longitude: -99 })).toThrow();
});

test("joins observations by station/parameter and preserves genuine zero, units, qualifiers and decimals", () => {
  const stations = normalizeStations(collection(station()), point);
  const [gauge] = joinRiverObservations(stations, collection(observation(), observation({ parameter_code: "00060", value: "0", unit_of_measure: "ft^3/s", qualifier: "Estimated" })));
  expect(gauge.gageHeight).toMatchObject({ value: 1.2, displayValue: "1.20", units: "ft", approvalStatus: "Provisional" });
  expect(gauge.streamflow).toMatchObject({ value: 0, units: "ft^3/s", qualifier: "Estimated" });
  expect(gauge).not.toHaveProperty("floodStage");
  expect(gauge).not.toHaveProperty("floodDepth");
});

test("missing, nonnumeric, timezone-free and foreign-station observations remain unavailable rather than zero", () => {
  const stations = normalizeStations(collection(station()), point);
  for (const value of [null, "", "Ice", "NaN"]) {
    expect(joinRiverObservations(stations, collection(observation({ value })))[0].gageHeight).toBeNull();
  }
  expect(joinRiverObservations(stations, collection(observation({ time: "2026-10-10T14:45:00" })))[0].gageHeight).toBeNull();
  expect(joinRiverObservations(stations, collection(observation({ monitoring_location_id: "USGS-00000000" })))[0].gageHeight).toBeNull();
  expect(joinRiverObservations(stations, collection())[0].streamflow).toBeNull();
});

test("mean/min/max are not mixed into instantaneous observations; latest source time wins", () => {
  const stations = normalizeStations(collection(station()), point);
  const [gauge] = joinRiverObservations(stations, collection(observation({ statistic_id: "00003", value: "8" }),
    observation(), observation({ time: "2026-10-10T20:00:00Z", value: "1.35" })));
  expect(gauge.gageHeight?.value).toBe(1.35);
  expect(isRiverObservationDelayed(gauge.gageHeight!, NOW + 91 * 60_000)).toBe(true);
  expect(isRiverObservationDelayed(gauge.gageHeight!, NOW)).toBe(false);
});

test("observation timestamps support fractional seconds while rejecting calendar rollover", () => {
  expect(validObservationTime("2026-10-10T20:00:00.123456Z")).toBe(true);
  expect(validObservationTime("2026-02-30T20:00:00Z")).toBe(false);
  expect(validObservationTime("2026-10-10T20:00:00+25:00")).toBe(false);
});

test("live river requests use current v1 API filters, follow official discovery pages, and batch selected IDs", async () => {
  fetchData.mockReset();
  fetchData.mockResolvedValueOnce({ ...collection(station()), links: [{ rel: "next", href:
    "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations/items?f=json&offset=200" }] })
    .mockResolvedValueOnce(collection(station("USGS-08166201", [-99.01, 30])))
    .mockResolvedValueOnce(collection(observation()));
  const snapshot = await getNearbyRiverGauges(point);
  expect(fetchData).toHaveBeenCalledTimes(3);
  const discovery = new URL(fetchData.mock.calls[0][0]);
  expect(discovery.pathname).toBe("/ogcapi/v1/collections/monitoring-locations/items");
  expect(discovery.searchParams.get("state_code")).toBe("48");
  expect(discovery.searchParams.get("site_type_code")).toBe("ST");
  expect(discovery.searchParams.get("bbox")!.split(",")).toHaveLength(4);
  const observations = new URL(fetchData.mock.calls[2][0]);
  expect(observations.searchParams.get("parameter_code")).toBe("00060,00065");
  expect(observations.searchParams.get("statistic_id")).toBe("00011");
  expect(observations.searchParams.get("monitoring_location_id")).toBe("USGS-08166200,USGS-08166201");
  expect(snapshot.items).toHaveLength(2);
  expect(snapshot.items[1].gageHeight).toBeNull();
});

test("an unexpected pagination origin cannot send requests to third parties", async () => {
  fetchData.mockReset();
  fetchData.mockResolvedValueOnce({ ...collection(), links: [{ rel: "next", href: "https://example.com/private" }] });
  await expect(getNearbyRiverGauges({ latitude: 30.1, longitude: -99.1 })).rejects.toThrow(/unverified pagination/);
  expect(fetchData).toHaveBeenCalledTimes(1);
});
