# 08 — Editing package

**Default: CapCut Desktop on Mac if you want SRT import; iMovie is equally usable with manual title captions.** No account connection, cloud sync, paid effect or publication is required by this plan. Keep raw files, project and exports in the prepared local folder `/Users/shivengarisa/clearpath/artifacts/cac-video/`, with `raw/phone`, `raw/mac`, `raw/camera`, `audio`, `project`, `exports` subfolders. It is under the existing Git-ignored artifacts directory. These folders are empty staging destinations; this package contains no footage.

## Exact edit

See [timeline.csv](timeline.csv) for every clip/cut. Scene narration is in file 04 and the JSON; quote it exactly. Preserve raw takes separately and retain original extensions.

| Time | Picture | Audio | Edit note |
| --- | --- | --- | --- |
| 0:00–0:10 | A01_home.mov | V01_Manas | Small title overlay; prepared actual demo Home |
| 0:10–0:14 | C01_intro.mov | Camera audio: Manas then Shiven | Both names; landscape faces |
| 0:14–0:24 | A01_home.mov | C01 audio continues | Simulation/public training point; warning opens |
| 0:24–0:44 | A02_warning.mov | V03_Shiven | Instructions/explanation/classifications |
| 0:44–1:02 | A03_guide.mov | V04_Manas | Guide opens; source/date |
| 1:02–1:19 | A04_map.mov | V05_Shiven | Both fictional areas; pan/zoom |
| 1:19–1:24 | A05_kit.mov | V06_Manas | Actual checkbox/save feedback |
| 1:24–1:29 | A06_plan.mov | V06_Manas continues | Fictional meeting place |
| 1:29–1:34 | A07_contacts.mov | V06_Manas continues | Fictional contact only |
| 1:34–1:41 | A08_links.mov | V06_Manas continues | In-app official links |
| 1:41–1:46 | assets/02_architecture.png | V07_Shiven | Core flow graphic |
| 1:46–1:51 | M01a_context.mov | V07_Shiven continues | Priority context |
| 1:51–1:58 | M01b_priority.mov | V07_Shiven continues | Lifecycle/order/explanations |
| 1:58–2:04 | M02_issuance.mov | V08_Manas | Issue-time guard |
| 2:04–2:09 | M03_current.mov | V08_Manas continues | Admission before replacement |
| 2:09–2:15 | M04_regression.mov | V08_Manas continues | Two input orders in real regression |
| 2:15–2:34 | A09_recap.mov | V09a_Manas then V09b_Shiven | Working app + roles and extensive AI disclosure |
| 2:34–2:44 | C02_close.mov | Camera audio: Manas, Shiven, Manas | Learning + closing |
| 2:44–2:45 | assets/05_end.png | No new speech | One-second final hold; no added outro |

## Layout and transitions

Create a **1920×1080 / 16:9 / 30 fps / SDR** project. For iMovie, add a genuine landscape 1080p/30 camera clip first to establish project format, then use the specific phone-background/Picture-in-Picture steps below. CapCut can place phone clips directly over the background. Portrait phone footage uses **Fit**, original aspect ratio and full frame; never stretch it to landscape. Place it approximately x=120, y=60, height=960. Preserve the real app’s source/demo/footer labels whenever visible. Warning detail scrolls can move the badge off-screen: keep a separate SIMULATED DEMO editing label in the margin throughout every fictional warning/map shot and show the actual badge before scrolling. Do not draw a fake app badge into the capture. Use the empty right margin for feature labels and subtitles. If text is too small, duplicate a real detail crop into that margin while retaining the original uncropped source view. Do not build fake app screens with graphics.

The phone-canvas background is an editing graphic, not an app screenshot. In CapCut, keep the larger 960-pixel phone height and put captions in the right margin; iMovie’s alternative reserves a lower caption band. Use hard cuts. A 4–6 frame dissolve into a presenter shot is optional; keep the overall duration fixed. No Ken Burns movement on code, architecture or end cards; still assets remain still. Do not add a separate title sequence: the first ten seconds show the actual app and purpose. The 01 title/03 stack/04 roles cards are useful backups and graphical references; they are **not extra scenes to append**. If used, replace equivalent planned seconds without adding runtime. The architecture card is a schematic, clearly labelled as such in context, not an app screenshot.

## CapCut Desktop steps

1. New project → import selected raw clips, voice takes and PNGs. Set ratio 16:9 and 30 fps; place clips at the table’s exact starts. Set portrait clips to Fit/original proportions, with black background.
2. Mute silent screen-recording tracks. Use camera audio only for scenes 2 and 10, real voiceover for the others. Scene 9 uses two labelled voice segments. Align a spoken action phrase to the visible tap, then extend readable final holds rather than speeding up voices.
3. Import `draft_subtitles.srt` via **Captions → Add Captions / Import file**, following the current [CapCut Desktop guide](https://www.capcut.com/help/how-to-import-subtitles). It creates editable caption blocks. This file is **estimated**, not synchronized to a recording. Shift, split and resize every cue against the actual waveform; correct names and terminology. Do not rely on automatic caption timing.
4. Use simple high-contrast captions, about 42–48 px at 1080p, two lines maximum. Place them in the landscape margin or in an opaque lower band without covering app source/simulation/call controls. Avoid word-by-word bouncing text. Keep feature labels shorter than narration; do not speak them twice.
5. Export locally at 1080p, 30 fps, H.264/MP4 and roughly 12–16 Mb/s if bitrate controls are offered. Choose available free/local equivalents; no paid template is needed. Keep SDR colour and normal voice speed. Do not click Share/Publish.

## iMovie steps

1. Create a Movie and import the real 1080p/30 camera seed, then arrange scenes to the table. For each app segment use `assets/06_phone_canvas.png` as the main timeline clip for the required seconds, with Cropping → **Fit** (no Ken Burns). Drag the actual portrait phone clip above that background; select Video Overlay Settings → **Picture in Picture**, then Cropping → **Fit**. Resize/drag it to the empty left area, roughly x=100, y=30, height=820, leaving the lower band clear for captions. Keep its whole source frame, original proportions and real controls visible. Set no border/shadow and disable overlay animation if offered. The background keeps SIMULATED DEMO legible even when the real badge scrolls away. Use ordinary full-frame primary clips for code/camera/architecture/end shots. A ten-second test export confirms placement before assembling the whole edit. [Apple project setup](https://support.apple.com/guide/imovie/create-a-new-movie-project-move6ccb3330/mac) and [cropping controls](https://support.apple.com/guide/imovie/crop-clips-mova56757e7e/mac) and [Picture in Picture controls](https://support.apple.com/guide/imovie/create-a-picture-in-picture-effect-mova1aaa682b/mac).
2. Add recorded voice tracks beneath the picture. For new voiceover, move the playhead → Record Voiceover / microphone control, select the input, mute project sound while recording, then stop/Done. Do not leave both original camera dialogue and a duplicate voice take audible.
3. Use the SRT as a **caption text/timing worksheet**: recreate cues with Titles and adjust to the actual narration. This workflow does not assume iMovie imports SRT. The same retimed SRT can later accompany a platform upload after human approval. Add simple role/AI titles; choose a plain lower title in the reserved lower band for manual subtitles. The phone already uses the overlay lane, so skip an additional face PiP during app scenes in iMovie. If a title template overlaps the phone footer, choose a lower template or reduce the phone height slightly and inspect the test export. [Apple titles](https://support.apple.com/guide/imovie/add-titles-mov4d3dce7ba/mac).
4. Share → Export File / File: Video and Audio, **1080p**, High quality, Better Quality compression where offered. Save locally; retain the extension/container iMovie actually produces. Do not rename a .mov file to .mp4 as a conversion. [Apple export instructions](https://support.apple.com/guide/imovie/export-a-quicktime-file-move6e0cb2ad/mac).

## Audio targets and final caption pass

These are production targets, not CAC rules. Record with headroom (rough speech peaks around **−12 to −6 dBFS**), avoid clipping/red meters, and match both voices by ear. For an editor with loudness meters, a final speech-led mix around **−16 to −14 LUFS integrated**, with true peaks below **−1 dBTP**, is a useful starting point. iMovie users can match comfortable speech levels without installing a meter. Listen on headphones and an ordinary phone speaker; remove hum, abrupt level changes and doubled speech. No music is needed. If you choose licensed music later, it must stay well below speech and its rights must be documented.

The draft SRT contains the exact narration without speaker labels, with estimated per-scene windows. Retiming can change every cue. Keep proper nouns, match spoken wording, check reading speed, and inspect caption boundaries across cuts. Do not add an “all tests passed” subtitle to an unrelated result screen or preserve a line whose feature/role was removed.

## Actual-file duration gate

- Open the **exported** file in QuickTime → Window → Show Movie Inspector; inspect actual dimensions and duration. [Apple inspector](https://support.apple.com/guide/quicktime-player/view-information-about-a-movie-file-qtp65619118c/mac).
- Target **2:35–2:50**, planned **2:45**, strict maximum **under 3:00** including every title/end frame. If longer than 2:50, trim redundant waits/holds first, then revise narration honestly and retime captions. Do not accelerate voices or hide failures.
- Watch beginning-to-end for frozen/missing frames, readable instructions/code, simulation labels, real save feedback, correct roles/AI disclosure, no private values and balanced audio. Reopen the final saved export, not just the timeline. Keep a private review copy; no publication is performed by this package.
