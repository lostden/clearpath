import { getRegionalAlerts } from "../src/data/nws";
import { fetchJson } from "../src/data/http";
import { nwsCollection, nwsFeature, TEST_NOW } from "./fixtures/alerts";

jest.mock("../src/data/http", () => ({
  ...jest.requireActual("../src/data/http"),
  fetchJson: jest.fn(),
}));
const fetchData = jest.mocked(fetchJson);

beforeEach(() => {
  jest.useFakeTimers({ now: TEST_NOW });
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test.each([
  ["TX", "https://api.weather.gov/alerts/active?area=TX"],
  ["US", "https://api.weather.gov/alerts/active?status=actual"],
] as const)("%s coverage uses its official endpoint and forwards cancellation", async (coverage, url) => {
  const signal = new AbortController().signal;
  fetchData.mockResolvedValue(nwsCollection());
  await expect(getRegionalAlerts(coverage, signal)).resolves.toEqual([]);
  expect(fetchData).toHaveBeenCalledWith(url, {
    signal,
    headers: {
      Accept: "application/geo+json",
      "User-Agent": "ClearPath/0.1 (student emergency information app)",
    },
  });
});

test("regional coverage includes actual advisories and watches, preserves text without geometry, and excludes CAP test messages", async () => {
  fetchData.mockResolvedValue(nwsCollection(
    nwsFeature({ id: "advisory", event: "Heat Advisory", severity: "Moderate" }),
    nwsFeature({ id: "watch", event: "Flood Watch", urgency: "Expected" }),
    nwsFeature({ id: "exercise", status: "Test" }),
  ));
  const alerts = await getRegionalAlerts("US");
  expect(alerts.map((alert) => alert.event)).toEqual(["Heat Advisory", "Flood Watch"]);
  expect(alerts.every((alert) => alert.geometry === null)).toBe(true);
  expect(alerts[0].instruction).toBe("Original official instruction.\nSecond line.");
});

test("regional malformed collections fail verification rather than reporting a false empty map", async () => {
  fetchData.mockResolvedValue(nwsCollection(nwsFeature({ severity: "Danger" })));
  await expect(getRegionalAlerts("TX")).rejects.toMatchObject({ kind: "invalid-response" });
});

test("unsupported coverage fails before making a request", async () => {
  await expect(getRegionalAlerts("CA" as "TX")).rejects.toThrow(/Choose Texas or U.S./);
  expect(fetchData).not.toHaveBeenCalled();
});
