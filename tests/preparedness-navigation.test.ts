import { guideForEvent, guideFromParam } from "../src/domain/preparednessNavigation";

describe("bounded NWS event to bundled guide mapping", () => {
  test.each([
    ["Flash Flood Warning", "flood"],
    ["Flood Warning", "flood"],
    ["Flood Watch", "flood"],
    ["Flood Advisory", "flood"],
    ["Tornado Warning", "tornado"],
    ["Tornado Watch", "tornado"],
    ["Hurricane Warning", "hurricane"],
    ["Hurricane Watch", "hurricane"],
    ["Tropical Storm Warning", "hurricane"],
    ["Tropical Storm Watch", "hurricane"],
    ["Winter Storm Warning", "winter"],
    ["Winter Storm Watch", "winter"],
    ["Winter Weather Advisory", "winter"],
    ["Blizzard Warning", "winter"],
    ["Ice Storm Warning", "winter"],
    ["Red Flag Warning", "wildfire"],
    ["Fire Weather Watch", "wildfire"],
    ["  tornado warning  ", "tornado"],
  ])("%s offers the existing %s guide", (event, expected) => {
    expect(guideForEvent(event)?.id).toBe(expected);
  });

  test.each([
    "", "Severe Thunderstorm Warning", "Special Weather Statement",
    "Hurricane Force Wind Warning", "Floodplain Notice", "Fire Warning",
    "Tornado Warning Update", "constructor", "__proto__",
  ])("unsupported event %s falls back without guessing guidance", (event) => {
    expect(guideForEvent(event)).toBeNull();
  });
});

test.each(["flood", "tornado", "hurricane", "winter", "wildfire"])("valid route guide %s resolves to bundled text", (guide) => {
  expect(guideFromParam(guide)?.id).toBe(guide);
});

test.each([undefined, null, "", "FLOOD", "unsupported", ["flood"], ["flood", "tornado"], {}, "constructor"])("invalid or ambiguous route guide %# falls back to general Prepare", (guide) => {
  expect(guideFromParam(guide)).toBeNull();
});
