# ClearPath — submission checklist and draft answers

Updated October 14, 2026. This is a **pre-submission audit**, not a claim that a film, registration or entry has been completed. Core app footage is accepted based on Shiven's four reported iPhone passes. App source: 1.1.0 / 33d9b50b9c8fab1953f28f88235b341b6adce301. [Script](VIDEO_SCRIPT.md) · [filming plan](VIDEO_PRODUCTION.md) · [full verification record](../../TESTING.md)

## Official requirements to check

Confirm middle/high-school enrollment on October 26, at least half the team living/attending school in the hosting district, one entry per person, and project creation after October 30, 2025; a 2.0 entry highlights new coding. The 1–3 minute public YouTube/Vimeo video needs participant names, app name, purpose/audience, tools/languages and functioning features. Judges may request app/source access. AI use needs full disclosure and significant student contribution/understanding; it cannot comprise the entire technical development. The rules PDF sets October 26 noon EDT (11 a.m. Central). [2026 rules, §§1–5 and 7](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf).

The registration page instead lists 9 p.m. ET. Plan to the earlier PDF time and submit with a buffer; do not depend on an extension. [Official registration page](https://www.congressionalappchallenge.us/students/student-registration/). Internal target: finished cut and portal review October 22–23, submission by October 24 if possible.

**Hosting district verified October 14:** the official 2026 participating list marks **TX04 (Pat Fallon)** as participating. This verifies the district is hosting; it does not verify either student's residence/school eligibility or team registration. [Official participating districts](https://www.congressionalappchallenge.us/students/participating-districts/).

## Current audit

| Item | Evidence / present status | Remaining action |
| --- | --- | --- |
| Application and functioning workflow | 924 app tests / 37 watcher tests, typecheck/lint, JS exports; simulator evidence; four core phone checks reported PASS | Freeze source for footage; repair any actual new failure |
| Current phone tests | Shiven is now identified as operator. Startup/tabs, warning→guide, map pan/zoom and saved preparation reopening passed by user report | Model and exact client/version metadata still incomplete; rehearse additional scene details |
| Team names / reported roles | Manas and Shiven supplied in that order; Shiven confirmed phone tester. Concept/product/review, AI-assisted baseline features and reported learning areas are recorded in STUDENT_CONTRIBUTIONS.md | Confirm name-to-role mapping and full names as required by the portal; do not publish private identity fields in Git |
| District / student eligibility | TX-04 hosting verified against the official 2026 list October 14; individual eligibility has not been verified here | Use the official portal/district lookup with your own residence/school information; confirm team district requirement and enrollment |
| Registration / team profile | No verified registration or invitation completion | Each student completes required personal steps; verify both members are attached to the same team entry |
| AI scope and personal understanding | Extensive Codex implementation/tests documented; user reports coordinator permission | Retain actual permission/scope privately if available. Each presenter must explain their real work and the implementation; do not certify an exception or invent student code |
| Narration / storyboard | Draft package prepared from repository and user reports; user confirms it has not been rehearsed yet | Both students review their own claims and rehearse aloud with a stopwatch |
| Finished video / measured duration | No finished or reviewed export exists | Film, edit and inspect actual 1080p file; target 2:40 |
| Public access / URL | No uploaded film or verified public link | Human publishes after review, then checks signed out on another device |
| Written application answers | Evidence-based drafts below, including the students' reported learning areas | Students revise in their own words, add a real example if available and match actual portal fields/limits |
| Source, dependencies and licenses | DATA_SOURCES.md, AI_USAGE.md and contribution history preserved | Provide only requested access; exclude .env, keys, signing materials, private contacts/location and raw personal footage |
| Final portal review / receipt | No entry submitted | Review the actual portal with both teammates, submit, retain confirmation privately |

Core acceptance does not cover independent offline startup, current iPhone GPS/notifications, background monitoring, complete accessibility or actual emergency delivery. The cut omits those claims. Security/dependency findings remain in DEPENDENCY_REVIEW.md; no successful upgrade or blanket security certification is implied.

## App/source access for review

Keep the tested branch and commit available. A judge can see the functioning app through the public demonstration and, if asked, an appropriate source/access handoff. Do not upload the older Android APK as though it contains 1.1.0. No current independent iOS binary exists; Expo Go requires a compatible client and reachable development transport for launch. If direct app access is requested, describe that setup honestly and agree an accessible method before promising one.

A public repository or app-store release is not assumed here. Before sharing a source archive, inspect tracked files for secrets and personal test data and preserve licenses/source references. Never send private signing materials. Do not change account permissions or deploy a service merely to finish the form.

## Draft application answers — review before pasting

These are editable factual drafts, not claims of personal experiences. The official portal may word or limit its questions differently. Check its actual fields before use.

### App title

ClearPath

### Purpose / audience

ClearPath helps Texas families view official National Weather Service warnings for a selected point and connect that information with preparedness guides, a locally saved emergency kit, family plan and contacts. It keeps current, cached, unavailable and simulated information visibly distinct and adds Frisco/North Texas reference resources.

### Inspiration

Manas proposed bringing official disaster information and practical preparedness into one mobile app. The project requirements focused on government alerts, location-based warnings, maps and disaster-specific information. The North Texas training workflow makes the app understandable without waiting for a real emergency. Do not add a personal flood experience or claimed community demand unless it actually occurred.

### Technical challenge / approach

A real reliability defect allowed a cancellation with an implausibly future issuance time to suppress a valid current warning. In the Codex-assisted repair, issuance is validated before resolving updates/cancellations, allowing a bounded 60-second clock skew while treating future onset separately. Regression tests cover cached messages in either input order, valid cancellations, malformed timestamps and clock rollback. Describe this as an AI-assisted project repair; neither student's independent debugging authorship has been established.

Another engineering choice is deterministic display ordering using source urgency, then severity, then certainty, with issuance and stable ties. It preserves original records and explains the order without predicting personal danger. Use one challenge in a short field; do not dump both if space is limited.

### What each student contributed and AI disclosure

Manas developed the original concept and requirements, directed product decisions including the tactical interface/map expansion, and reviewed implementation results. Shiven's reported earlier work used AI implementation for the demo, map and checklist; Shiven also performed the four core current-version iPhone checks and reported all passed.

OpenAI Codex extensively assisted implementation of the interface, APIs, maps, reliability repairs, priority algorithm, guide navigation, Frisco resources/demo, automated tests and documentation. Codex also drafted this video's storyboard, script and submission wording. These are not presented as independently student-written code or prose. The team reports coordinator permission for AI-assisted implementation; written permission/scope has not been verified in the repository. Disclose other tools actually used as well.

Students should personally review/revise this answer and be able to explain the code and their own decisions. Do not say AI generated only “a few suggestions” when it implemented substantial parts.

### Learning / biggest takeaway

Manas learned how to use mobile frameworks and build features. Shiven learned about testing, debugging, shipping features and backend development.

These learning areas were supplied by the user October 14 and are included in the closing script. Both students should revise this short answer in their own words and add an actual example if available. No independently authored backend code or production deployment is implied by reporting backend learning. Reading generated code does not change its authorship.

### Possible 2.0 direction — student review required

A sensible next version would prioritize observed family usability and accessibility feedback, broader physical-device acceptance and more robust app distribution before adding predictive features. Cloud push would need real infrastructure, consent, operating costs and device delivery/opt-out testing. This is a recommendation, not a claim that either student has already chosen or built it.

## Student understanding rehearsal

Before recording, each presenter should answer these in their own words while pointing to the actual source. This rehearses understanding; it does not retroactively establish independent authorship.

- What is the difference between an NWS selected-point response and a regional map record?
- How do original issue time, retrieval time and expiry differ?
- Why is a future onset allowed while an implausibly future-issued cancellation is rejected?
- What is the exact display-order convention, and what does Unknown mean?
- Why does the demo have its own namespace and point, and why can it never trigger an official notification?
- What exactly did Shiven's restart test prove with Metro available, and what did it not test?
- What did each presenter personally decide, implement with AI, review or test?

If an answer is uncertain, inspect that file and practice an accurate explanation before filming. A new feature is unnecessary to fill the explanation.

## Upload instructions — human action after film review

1. In YouTube Studio, choose Create → Upload videos and select the reviewed export. Use the title below; add the description/disclosure and corrected captions.
2. Complete required audience/other prompts truthfully for the actual video. Select a frame showing the app with its simulation label as the thumbnail; skip clickbait, disaster imagery and unrelated stock footage.
3. Let checks and HD processing finish. On Visibility choose **Public** for this CAC entry, then publish only after both students review the final file and disclosure. Do not assume the account's default visibility is appropriate.
4. Copy the actual watch-page URL. Open it signed out and on another device; play beginning, middle and end, verify 1080p availability and the exact duration.
5. Paste the working link into the correct portal field. A saved draft or uploaded private film is not a completed entry.

YouTube's official workflow and visibility controls are in [Upload YouTube videos](https://support.google.com/youtube/answer/57407?hl=en). The steps above are instructions; Codex has not performed this upload/publication.

Suggested title: **ClearPath | Manas & Shiven | Congressional App Challenge 2026**

Suggested description:

> ClearPath connects official selected-point weather warnings with practical preparation for Texas families. This demonstration uses a clearly labeled fictional North Texas training scenario.
>
> Manas: original concept, requirements, product direction and implementation review. Shiven: earlier AI-assisted demo/map/checklist development and four current-version iPhone checks.
>
> Built with TypeScript, React Native, Expo SDK 57 and Expo Router. OpenAI Codex extensively assisted application implementation, tests, documentation and preparation of this video/script. Generated work is not claimed as independently student-written.
>
> Map areas in the training scenario are fictional. The app does not predict disasters, certify safe routes or provide guaranteed closed-app alerts. Preparation restart testing kept Metro available. Official data/reference attribution: NWS, USGS, NIFC, FEMA/Ready.gov, City of Frisco and other linked agencies, as applicable to the shown feature. No official endorsement is claimed.

Do not paste an unverified source URL, permission statement or actual personal contact information into the description.

## Final human check and evidence to retain

- [ ] Both students approve names, roles, spoken AI disclosure and written answers, including their reported learning areas.
- [ ] Shiven completes the added explanation/source/local-link rehearsal and reviews the actual clips.
- [ ] Final file plays correctly at 1920×1080 and measured duration is within the required range, with target 2:30–2:50.
- [ ] All fictional data remain labeled, source/time text readable, and no real contact/GPS/key/notification appears.
- [ ] Public watch URL works signed out; no account/login requirement or privacy mistake.
- [ ] Both team members, district/eligibility answers and portal fields are verified by the students.
- [ ] Requested app/source access is accurate for 1.1.0; external tools, content/licenses and AI use disclosed.
- [ ] Students complete submission and retain the receipt, URL, final export, exact application commit and final answers privately before the earlier planned deadline.

**Current result: video package ready to rehearse; final film, access, registration, eligibility and actual submission remain unverified.** The overall goal is still incomplete.

