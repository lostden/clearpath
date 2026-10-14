/** Offline summaries of official preparedness guidance, reviewed 2026-10-09.
 * These are general preparation references, never location-specific instructions.
 */
export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
}

export interface SafetyGuide {
  id: "flood" | "tornado" | "hurricane" | "winter" | "wildfire";
  title: string;
  body: string;
  sourceName: string;
  url: string;
}

export interface ImportantNumber {
  label: string;
  number: string;
}

export const preparednessReviewedOn = "2026-10-09";

export const checklistItems: readonly ChecklistItem[] = [
  {
    id: "water",
    title: "Drinking water",
    detail:
      "Store one gallon per person per day for at least three days, including sanitation needs.",
  },
  {
    id: "food",
    title: "Food and can opener",
    detail:
      "Keep at least three days of shelf-stable food and a manual can opener.",
  },
  {
    id: "radio",
    title: "Weather radio",
    detail:
      "Pack a battery-powered or hand-crank radio and NOAA Weather Radio.",
  },
  {
    id: "light",
    title: "Flashlight and batteries",
    detail: "Keep a flashlight and spare batteries where you can find them.",
  },
  {
    id: "first-aid",
    title: "First aid supplies",
    detail: "Prepare a first aid kit and supplies specific to your household.",
  },
  {
    id: "phone",
    title: "Chargers and backup power",
    detail: "Charge your phone and pack chargers plus a charged power bank.",
  },
  {
    id: "medicine",
    title: "Medicines and essential supplies",
    detail:
      "Plan for prescription medicines, glasses, infant needs, and pet supplies.",
  },
  {
    id: "hygiene",
    title: "Hygiene supplies",
    detail: "Pack moist wipes, garbage bags, and ties for personal sanitation.",
  },
  {
    id: "whistle",
    title: "Whistle",
    detail: "Include a whistle to signal for help.",
  },
  {
    id: "documents",
    title: "Copies of important documents",
    detail: "Keep essential documents protected and ready to take with you.",
  },
  {
    id: "contacts",
    title: "Paper contact list",
    detail:
      "Write down household contacts and an out-of-town contact; share a copy with everyone.",
  },
  {
    id: "meeting",
    title: "Family meeting plan",
    detail:
      "Choose meeting places, share your plan, and practice how to reconnect if separated.",
  },
];

export const checklistSource = {
  name: "FEMA Ready.gov — Emergency Supply List",
  url: "https://www.ready.gov/sites/default/files/documents/files/checklist3.pdf",
};

export const familyPlanSource = {
  name: "FEMA — Create Your Family Emergency Communication Plan",
  url: "https://www.weather.gov/media/afc/Hydro/FloodSafety/family-emergency-communication-plan.pdf",
};

export const safetyGuides: readonly SafetyGuide[] = [
  {
    id: "flood",
    title: "Flooding",
    body: "Do not walk or drive into floodwater. Do not bypass road barriers. Follow official evacuation instructions and monitor local authorities and NOAA Weather Radio.",
    sourceName: "National Weather Service — Flood safety",
    url: "https://www.weather.gov/safety/flood-during",
  },
  {
    id: "tornado",
    title: "Tornadoes",
    body: "During a tornado warning, move to a basement, safe room, or interior room away from windows. At school or work, follow the designated shelter plan. Mobile homes and tents do not provide adequate shelter.",
    sourceName: "National Weather Service — During a tornado",
    url: "https://www.weather.gov/safety/tornado-during",
  },
  {
    id: "hurricane",
    title: "Hurricanes",
    body: "Know local evacuation instructions before a storm. Leave promptly when officials order evacuation. Monitor your local emergency management office and weather radio. Temporary calm in the eye does not mean the storm has ended.",
    sourceName: "National Weather Service — Hurricane actions",
    url: "https://www.weather.gov/safety/hurricane-action",
  },
  {
    id: "winter",
    title: "Winter storms",
    body: "Seek shelter, stay dry, and cover exposed skin. Roads can be slippery even when they look wet. Keep a charged phone and emergency supplies in your vehicle. Use heating equipment with appropriate ventilation and fire safeguards.",
    sourceName: "National Weather Service — During a winter storm",
    url: "https://www.weather.gov/safety/winter-during",
  },
  {
    id: "wildfire",
    title: "Wildfires",
    body: "Prepare emergency items and stay informed through local emergency officials. Leave promptly if ordered to evacuate. Avoid activities that can start fires and obey burn bans. A fire-weather alert is not a map of an active fire perimeter.",
    sourceName: "National Weather Service — Wildfire readiness",
    url: "https://www.weather.gov/safety/wildfire-set",
  },
];

export const importantNumbers: readonly ImportantNumber[] = [
  { label: "Emergency services — immediate danger", number: "911" },
  { label: "2-1-1 Texas — community resources", number: "211" },
  { label: "2-1-1 Texas alternate number", number: "8775417905" },
];
