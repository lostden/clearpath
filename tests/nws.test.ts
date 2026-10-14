import { describe, expect, test } from "@jest/globals";
import { isOfficialAlert, normalizeNwsCollection, validTimestamp } from "../src/data/nws";
import {
  nwsCollection,
  nwsFeature,
  officialAlert,
  TEST_NOW,
} from "./fixtures/alerts";

describe("NWS adapter", () => {
  test("retains only exact official affected-zone links without replacing missing alert geometry", () => {
    const url = "https://api.weather.gov/zones/forecast/TXZ345";
    const [alert] = normalizeNwsCollection(nwsCollection(nwsFeature({
      affectedZones: [url, url, "https://example.com/zones/forecast/TXZ345", `${url}?x=1`, null],
    })), TEST_NOW);
    expect(alert.affectedZones).toEqual([url]);
    expect(alert.geometry).toBeNull();
    expect(alert.instruction).toBe(officialAlert().instruction);
  });

  test("old cached alerts without optional zone links remain valid", () => {
    expect(isOfficialAlert(officialAlert())).toBe(true);
    expect(isOfficialAlert(officialAlert({ affectedZones: ["https://api.weather.gov/zones/county/TXC199"] }))).toBe(true);
    expect(isOfficialAlert(officialAlert({ affectedZones: ["https://example.com/fake"] }))).toBe(false);
  });

  test("does not discard usable warning text when optional affected-zone links are malformed", () => {
    const [alert] = normalizeNwsCollection(nwsCollection(nwsFeature({ affectedZones: "invalid optional field" })), TEST_NOW);
    expect(alert).toEqual(officialAlert());
  });

  test("normalizes actual public data and preserves original instructions exactly", () => {
    expect(
      normalizeNwsCollection(nwsCollection(nwsFeature()), TEST_NOW),
    ).toEqual([officialAlert()]);
  });

  test("handles legitimately absent headline, instruction, onset, and polygon", () => {
    const [alert] = normalizeNwsCollection(
      nwsCollection(
        nwsFeature({ headline: null, instruction: null, onset: null }),
      ),
      TEST_NOW,
    );
    expect(alert.headline).toBeNull();
    expect(alert.instruction).toBeNull();
    expect(alert.onset).toBeNull();
    expect(alert.geometry).toBeNull();
  });

  test("empty valid collections mean no alerts; invalid envelopes mean verification failed", () => {
    expect(normalizeNwsCollection(nwsCollection(), TEST_NOW)).toEqual([]);
    for (const bad of [
      null,
      [],
      {},
      { features: [] },
      { type: "FeatureCollection", features: "not an array" },
    ]) {
      expect(() => normalizeNwsCollection(bad, TEST_NOW)).toThrow(
        /invalid alert collection/,
      );
    }
  });

  test("rejects partial collections rather than concealing an unparseable warning", () => {
    expect(() =>
      normalizeNwsCollection(
        nwsCollection(nwsFeature(), nwsFeature({ severity: "Danger" })),
        TEST_NOW,
      ),
    ).toThrow(/could not be verified/);
    expect(() =>
      normalizeNwsCollection(
        nwsCollection(
          nwsFeature({ status: "Test" }),
          nwsFeature({ severity: "Danger" }),
        ),
        TEST_NOW,
      ),
    ).toThrow(/could not be verified/);
    expect(() =>
      normalizeNwsCollection(
        nwsCollection(nwsFeature({ severity: "Danger" })),
        TEST_NOW,
      ),
    ).toThrow(/could not be verified/);
  });

  test("excludes CAP tests, private messages, and expired records", () => {
    expect(
      normalizeNwsCollection(
        nwsCollection(
          nwsFeature({ status: "Test" }),
          nwsFeature({ scope: "Private" }),
          nwsFeature({ expires: "2026-10-09T18:45:00Z" }),
        ),
        TEST_NOW,
      ),
    ).toEqual([]);
  });

  test("processes cancellation references before filtering expiration", () => {
    const cancel = nwsFeature({
      id: "urn:cancel",
      messageType: "Cancel",
      sent: "2026-10-09T18:45:00Z",
      expires: "2026-10-09T18:50:00Z",
      references: [
        {
          identifier: "urn:test:1",
          "@id": "https://api.weather.gov/alerts/urn:test:1",
        },
      ],
    });
    expect(
      normalizeNwsCollection(nwsCollection(nwsFeature(), cancel), TEST_NOW),
    ).toEqual([]);
  });

  test.each(["Alert", "Update", "Cancel"])(
    "rejects an Actual/Public %s issued two minutes ahead before it can replace a warning",
    (messageType) => {
      const future = nwsFeature({
        id: messageType === "Alert" ? "urn:test:1" : "urn:future",
        messageType,
        sent: "2026-10-09T19:02:00Z",
        references: [{ identifier: "urn:test:1" }],
      });
      expect(() =>
        normalizeNwsCollection(nwsCollection(nwsFeature(), future), TEST_NOW),
      ).toThrow(/could not be verified/);
      expect(() =>
        normalizeNwsCollection(nwsCollection(future), TEST_NOW),
      ).toThrow(/could not be verified/);
    },
  );

  test.each(["2026-10-09T19:01:00Z", "2026-10-09T14:01:00-05:00"])(
    "allows exactly one minute of issuance skew using the timestamp's timezone: %s",
    (sent) => {
      const [alert] = normalizeNwsCollection(
        nwsCollection(nwsFeature({ sent, onset: "2026-10-09T19:30:00Z" })),
        TEST_NOW,
      );
      expect(alert.sent).toBe(sent);
      expect(alert.onset).toBe("2026-10-09T19:30:00Z");
    },
  );

  test("rejects issuance one millisecond beyond the allowed skew", () => {
    expect(() => normalizeNwsCollection(
      nwsCollection(nwsFeature({ sent: "2026-10-09T19:01:00.001Z" })),
      TEST_NOW,
    )).toThrow(/could not be verified/);
  });

  test("valid future onset warnings remain current and non-public future cancellations are excluded", () => {
    expect(normalizeNwsCollection(nwsCollection(
      nwsFeature({ onset: "2026-10-09T19:30:00Z" }),
      nwsFeature({
        id: "urn:test-cancel",
        status: "Test",
        messageType: "Cancel",
        sent: "2026-10-09T19:02:00Z",
        references: [{ identifier: "urn:test:1" }],
      }),
    ), TEST_NOW)).toEqual([officialAlert({ onset: "2026-10-09T19:30:00Z" })]);
  });

  test.each(["Update", "Cancel"])("valid %s messages inside the issuance skew still replace referenced warnings", (messageType) => {
    const result = normalizeNwsCollection(nwsCollection(
      nwsFeature(),
      nwsFeature({
        id: "urn:replacement",
        messageType,
        sent: "2026-10-09T19:01:00Z",
        references: [{ identifier: "urn:test:1" }],
      }),
    ), TEST_NOW);
    expect(result.map((alert) => alert.id)).toEqual(messageType === "Cancel" ? [] : ["urn:replacement"]);
  });

  test("preserves closed official polygons and never invents malformed geometry", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [-99, 30],
          [-98, 30],
          [-98, 31],
          [-99, 30],
        ],
      ],
    };
    expect(
      normalizeNwsCollection(
        nwsCollection({ ...nwsFeature(), geometry }),
        TEST_NOW,
      )[0].geometry,
    ).toEqual(geometry);
    const broken = {
      type: "Polygon",
      coordinates: [
        [
          [-99, 30],
          [-98, 30],
          [-98, 31],
        ],
      ],
    };
    expect(
      normalizeNwsCollection(
        nwsCollection({ ...nwsFeature(), geometry: broken }),
        TEST_NOW,
      )[0].geometry,
    ).toBeNull();
  });

  test("rejects third-party warning links from the official data adapter", () => {
    expect(() =>
      normalizeNwsCollection(
        nwsCollection({
          ...nwsFeature(),
          id: "https://example.com/fake-alert",
        }),
        TEST_NOW,
      ),
    ).toThrow();
  });
});

describe("provider timestamps", () => {
  test("requires valid ISO dates with a timezone", () => {
    expect(validTimestamp("2026-10-09T19:00:00Z")).toBe(true);
    expect(validTimestamp("2026-10-09T14:00:00-05:00")).toBe(true);
    expect(validTimestamp("2026-02-30T19:00:00Z")).toBe(false);
    expect(validTimestamp("2026-10-09T19:00:00")).toBe(false);
    expect(validTimestamp("2026-10-09T24:00:00Z")).toBe(false);
  });
});
