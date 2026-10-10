# Texas Hill Country flood demonstration

ClearPath's flood scene is a **historically inspired simulation**, anchored near Hunt on the Guadalupe River. It is not a replay of archived warnings or a reconstruction of the July 2025 flood extent. Every simulated emergency screen carries the SIMULATED DEMO label.

## Sourced context

NOAA describes destructive flash flooding in the Texas Hill Country in the early hours of July 4, 2025, including rapid rises along the Guadalupe in Kerr County. This provides the setting, rather than the app's fictional warning content. [NOAA event overview](https://www.nesdis.noaa.gov/news/noaa-satellites-inform-warning-the-texas-hill-country-floods).

The NWS July 2025 hydrologic report documents record flooding at Hunt and major flooding downstream at Kerrville and Comfort. Its Hunt summary also records the loss of the gauge during the event. [NWS monthly report, Hunt summary on page 4](https://www.weather.gov/media/ewx/Hydro/MonthlyReports/E-5%20EWX%202025-07.pdf).

The selected scene point, **30.0699, −99.3328**, rounds the published coordinates of USGS station 08165495 on the South Fork near Highway 39. This station's page provides geographic metadata; it does not supply a July 2025 continuous observation feed for this demonstration. [USGS South Fork location](https://waterdata.usgs.gov/monitoring-location/USGS-08165495/).

The simulated gauge marker uses the rounded geographic location of USGS 08165500 at Hunt: **30.0699, −99.3217**. Its displayed measurements are invented. [USGS Hunt location](https://waterdata.usgs.gov/monitoring-location/USGS-08165500/).

## Invented presentation content

- The presentation clock is frozen at **July 4, 2025, 05:15 CDT**, equivalent to 10:15 UTC. This is a chosen scene time, not the timestamp of an archived warning.
- Both warning messages, CAP classifications, instructions, issue/expiration times, and irregular overlapping polygons are fictional. The outlines demonstrate warning overlays; they do not depict inundation, an official warning boundary, or an evacuation zone.
- The gauge values **18.6 ft** and **28,400 ft³/s**, including their 05:10 CDT observation time, are invented presentation values. ClearPath does not turn them into flood-stage classifications, local danger estimates, or route advice.
- The tornado and no-alert selections are alternate exercises. They make no claim about the actual conditions at Hunt on July 4. The outage selection uses fictional data retrieved 18 minutes earlier; one warning is expired and excluded from current display.

## Data separation

`src/data/demo.ts` supplies local fixtures with source `demo`, explicitly simulated agency labels, and no fabricated official warning URL. Simulated instruction headings remain labeled SIMULATED INSTRUCTIONS. Demo fixtures never enter the official-alert cache. Switching to Live Mode restores real coordinates, the real clock, and official NWS retrieval. Historical source links document inspiration only and are not used as live emergency data.

The fixed demo clock keeps the presentation repeatable. Unit tests may pass an explicit alternate clock to verify expiry and outage behavior. Real official alert expiration always uses the current device clock.
