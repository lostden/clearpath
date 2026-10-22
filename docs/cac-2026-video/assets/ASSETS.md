# Production graphics and usage

These are **presentation graphics, not app screenshots or captured footage**. Created locally by Codex on October 21, 2026. Use PNGs directly in CapCut/iMovie; SVGs are editable vector counterparts with embedded local fonts. Main cards are **1920×1080**, feature labels **1120×180**. [Contact sheet](contact_sheet.png) · [Label preview](labels_preview.png).

| Asset | Use in the planned cut |
| --- | --- |
| [01_title.png](01_title.png) / [SVG](01_title.svg) | Title reference/optional replacement only; use a small title over actual app footage in scene 1. Do not prepend another intro. |
| [02_architecture.png](02_architecture.png) / [SVG](02_architecture.svg) | Scene 7, 1:41–1:46; core selected-point warning→Prepare data flow, with separate fictional source. |
| [03_stack.png](03_stack.png) / [SVG](03_stack.svg) | Backup stack explanation; replace equivalent graphic seconds if used. Broader inventory does not imply every layer is shown. |
| [04_roles_ai.png](04_roles_ai.png) / [SVG](04_roles_ai.svg) | Attribution reference or optional replacement inside scene 9; no added scene. Default keeps the actual app visible with concise role titles. |
| [05_end.png](05_end.png) / [SVG](05_end.svg) | Scene 10 final one-second hold, 2:44–2:45. |
| [06_phone_canvas.png](06_phone_canvas.png) / [SVG](06_phone_canvas.svg) | Background for the iMovie phone-in-picture workflow; the left area stays blank until genuine footage is added. Provides persistent simulation provenance. |
| [label_01_simulated.png](label_01_simulated.png) | Persistent separate editing label for all fictional warning/map shots, especially when an in-app badge scrolls out of view. |
| [label_02_order.png](label_02_order.png) | Scene 3 feature label in the empty landscape margin. |
| [label_03_guide.png](label_03_guide.png) | Scene 4. |
| [label_04_prepare.png](label_04_prepare.png) | Scene 6. |
| [label_05_ai.png](label_05_ai.png) | Scenes 7–9 with code/AI narration. |

Use one feature label at a time; the simulation provenance label takes precedence. Keep genuine source labels visible whenever present; never draw a fake replacement badge inside the phone UI. Do not use these graphics to imply an unrecorded app interaction.

## Brand and legibility

- Current app tokens: black `#000000`, surface `#111111`, white `#FFFFFF`, secondary `#C8C8C8`, orange `#FF5A00`, yellow `#FFD400`. Hard edges and restrained rules follow the existing tactical interface.
- The square orange mark/two tilted black bars reproduce the current `Brand` component in `src/ui/components.tsx`. The older blue `assets/brand/clearpath.svg` remains untouched and is not used as a new redesign.
- Local Archivo Black headings and Roboto Mono regular/bold match app typography. Font software is unmodified. Licenses: [Archivo Black OFL](licenses/ArchivoBlack-OFL.txt) and [Roboto Mono OFL](licenses/RobotoMono-OFL.txt). Preserve these source licenses with a shared asset package.
- Main-card safe margins are about 96 px; text is intentionally sparse. Display cards still, with Fit, no Ken Burns. At actual export size verify labels/code/captions remain readable on a phone and laptop.

The local generator is [build_assets.mjs](../tools/build_assets.mjs). It uses the already bundled `@napi-rs/canvas` runtime and local fonts; no application dependency was installed. Embedded font data make SVGs self-contained; use the visually checked PNGs for predictable video import. Rebuilding on another machine requires adjusting the bundled-runtime path in the generator, not editing app code. The verifier checks final PNG dimensions and SVG validity.
