import { describe, expect, test } from "@jest/globals";
import { normalizeNwsCollection, validTimestamp } from "../src/data/nws";
import {
  nwsCollection,
  nwsFeature,
  officialAlert,
  TEST_NOW,
} from "./fixtures/alerts";

describe("NWS adapter", () => {
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
