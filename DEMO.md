# ClearPath demo walkthrough

Start the app using the [README setup steps](README.md#run-the-project). The demo uses bundled fictional data; no current emergency is represented. No login, GPS permission or API key is required. Native basemap tiles and external source links still need internet.

## 1. Explore a warning

On **Home**, scroll to **Training demo** and select **Explore simulated demo**. This starts **North Texas flood** at the Frisco training point.

- Confirm **SIMULATED DEMO** is visible.
- Read the flash-flood example and its original fixture instructions.
- Select **Read simulated warning**, then **Why this warning is shown here** to inspect the source classifications and display-order explanation.
- Select **Read Flooding guide** to open the matching bundled preparedness guidance. Its source and review date are visible.

The warning text, times and areas are invented training fixtures. Display ordering keeps other current warnings available; it is not a personal-risk prediction.

## 2. Inspect the map

Open **Map** and explore the two fictional warning areas. Inspect the warning list and available detail controls.

The browser uses a coordinate map labeled **NO BASEMAP / COORDINATE VIEW** and **SCHEMATIC / NOT NAVIGATION**. Mobile uses its configured native basemap when available. Supplied warning areas do not measure flood extent, water depth or safe travel routes.

## 3. Try preparedness tools

Open **Prepare** and try:

1. **Field Guides:** general preparation guidance with official-source links.
2. **Kit:** mark an item and inspect the local save status.
3. **Family Plan:** enter a fictional meeting place and contact.
4. **Contacts:** add a fictional contact and check the save status.
5. **Local Links:** inspect the Frisco and regional reference resources.

Return to another tab and reopen **Prepare** to inspect saved values. A phone restart test using Expo Go requires the development server to remain available. Do not place a real emergency call while testing.

## 4. Compare scenarios or live information

On **Home**, the demo controls also offer **Flood**, **Tornado**, **No alerts** and **Outage**. The outage fixture demonstrates cached presentation; an actual offline cold-start test is a separate check.

Choose **Exit demo** or **Return to live mode** to leave the fixtures. Select a public city reference point or enter coordinates to request official warnings. A result with no active warnings does not establish personal safety. Regional map records and selected-point warnings remain separate.

[Project overview](README.md) · [Source and test review](README.md#code-to-inspect) · [Executed verification](TESTING.md) · [Historical filming notes](docs/development/DEMO_HISTORY.md)
