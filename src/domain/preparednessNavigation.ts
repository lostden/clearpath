import { safetyGuides, type SafetyGuide } from "@/data/preparedness";

// Deliberately bounded event names. Headline/body keywords and marine
// hurricane-force winds do not establish which bundled guide applies.
const eventGuides: ReadonlyMap<string, SafetyGuide["id"]> = new Map([
  ["flash flood warning", "flood"],
  ["flood warning", "flood"],
  ["flood watch", "flood"],
  ["flood advisory", "flood"],
  ["tornado warning", "tornado"],
  ["tornado watch", "tornado"],
  ["hurricane warning", "hurricane"],
  ["hurricane watch", "hurricane"],
  ["tropical storm warning", "hurricane"],
  ["tropical storm watch", "hurricane"],
  ["winter storm warning", "winter"],
  ["winter storm watch", "winter"],
  ["winter weather advisory", "winter"],
  ["blizzard warning", "winter"],
  ["ice storm warning", "winter"],
  ["red flag warning", "wildfire"],
  ["fire weather watch", "wildfire"],
]);

export function guideForEvent(event: string): SafetyGuide | null {
  return guideFromParam(eventGuides.get(event.trim().toLowerCase()));
}

export function guideFromParam(guide: unknown): SafetyGuide | null {
  return typeof guide === "string"
    ? safetyGuides.find((item) => item.id === guide) ?? null
    : null;
}
