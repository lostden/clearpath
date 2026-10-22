# 01 — Final feature selection

## Editorial decision

Show one coherent sequence: **fictional North Texas warning → explanation → existing guide → map context → household preparation**. Five features get screen time. Two short code examples explain how the workflow is engineered. The 2:45 cut spends about **116 seconds (70%) on actual app footage**, before optional presenter overlays; the rest is code, one architecture graphic and short camera shots. Decorative assets never substitute for product evidence.

| Selected feature | Why it earns time | Exact evidence and boundary |
| --- | --- | --- |
| Warning detail with instructions/classifications | Establishes the core information problem and what the user can read | NWS adapter and warning UI tests; historical live adapter retrieval. Recorded example is an invented `demo:frisco-*` warning, not a current NWS alert. |
| Explained ordering | Shows meaningful logic through a visible result | `prioritizeWarnings`, 41 engine tests and Home integration tests; later simulator explanation check. Urgency → severity → certainty is display policy, not a personal danger estimate. |
| Warning → Flooding guide | Gives the story a useful destination in one tap | Navigation tests, simulator and October 14 user-reported physical pass. Uses existing source-linked bundled guidance; does not generate advice. |
| Frisco-area fictional map | Shows native interaction and local context | Two supplied fixture areas; Apple basemap/fixture simulator evidence and user-reported physical pan/zoom pass. Not actual flood extent or navigation. |
| Kit, family plan, contacts and official local links | Demonstrates practical preparation beyond reading a warning | Component/state tests; three saved values restored in simulator and by user report with Metro available. New filming steps for source labels/local links still need a short phone rehearsal. |

## What the latest repository supports

Source/config/dependency comparison against `33d9b50` is empty. All later commits through reviewed HEAD `18971d2` are documentation/handoff work; no newly implemented feature is being inferred from the elapsed week. October 21 verification passed 46 application suites / 924 tests, typecheck and lint, plus 37 mocked watcher tests after loopback permission was granted. Full detail: [10](10_VIDEO_READINESS_REPORT.md).

| Inventory item | Implemented / verified state | Decision for this cut |
| --- | --- | --- |
| NWS official alerts / selected location | Actual/Public point response, lifecycle/time guards, original text/times; independent manual/GPS point and exact-point cache. Automated tests; dated live retrieval; current physical GPS unverified | Explain source architecture; demonstrate equivalent UI with explicit fixtures. Do not wait for a live warning. |
| Relevance / priority | Pure, deterministic, source-aware ordering and explanations; all remaining current warnings accessible | Hero feature; do not describe polygon-derived personal risk. |
| Texas/U.S. regional weather map | Separate regional query/coverage and supplied polygons/list; records without polygons remain listed | Inventory only. Do not toggle TX/U.S. inside the Frisco demo: those live controls are hidden in demo. |
| Rivers | Nearby Texas stations/observations, actual units/status/source clocks, up to 12 within 50 km; automated adapter/hook tests and older Android reports | Omit. No Frisco demo river fixture; gage height is not local flood depth. |
| Earthquakes | USGS worldwide past-day events with separate generation/retrieval/event times; automated checks and older Android reports | Omit: an additional feed distracts from the flood story. |
| Wildfire perimeters | Optional off-by-default bounded NIFC layer, independent incident scope/times; automated checks and older Android reports | Omit. No claim of current fire edge or complete coverage. |
| Guides / checklist / plan / contacts | Five bundled guides, 12 kit items, local plan/contact state, explicit save feedback and source dates | Hero feature; no encrypted-storage or independent offline-startup promise. |
| Notifications | Foreground/local opt-in policy and test control; old Android test display confirmed | Omit: current iPhone permission/delivery and real-event delivery unverified. Cloud watcher is inactive. |
| Offline | Bundled text and local preparation; exact-point NWS cache retains original timestamp; regional/USGS/NIFC layers are RAM-only | Omit from narration. Expo Go restart kept Metro online; not a standalone offline cold start. |
| Scenarios | North Texas flood, Flood, Tornado, No alerts, Outage are local isolated fixtures | Show only North Texas flood. Outage is simulated, not a physical airplane-mode test. |

## Lessons from previous winners

Reviewed the official winner pages and both accessible public **caption transcripts** on October 21 using vidIQ (two transcript calls, 10 existing credits). Captions can mistranscribe names; official CAC pages establish identity. This is transcript review, not a fresh frame-by-frame visual review, code inspection or app execution. No transcript, competitor footage, statistics or adoption claim is reused in our video.

- [Piggy Pal — official TX-04 winner page](https://www.congressionalappchallenge.us/25-tx04/) / [demo](https://www.youtube.com/watch?v=_RqE7QWNvXA): its spoken walkthrough connects tax calculation with budgeting and identifies its mobile stack. Our editorial inference: show one linked user task and explain the code that makes it work. Keep our opening shorter and use no borrowed statistics.
- [HawaiiAlert.jp — official winner page](https://www.congressionalappchallenge.us/25-hi01/) / [demo](https://www.youtube.com/watch?v=ifxGTRVAL0c): the narration links a specific language-access problem to an official-feed pipeline and delivered output. Our inference: name our Texas audience, follow data to a visible result, and use a concise technical example. Its deployment/user-count claims are its own; ClearPath makes none.

ClearPath's defensible distinction is **original-source context + explained display order + direct preparedness workflow + local resources**, not an unsupported claim to be first, safest or better than FEMA/Red Cross or these winners.
