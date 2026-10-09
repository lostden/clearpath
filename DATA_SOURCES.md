# Data sources

Sources reviewed October 9, 2026. A documentation review is not evidence that a mobile integration succeeded. Executed requests and tests belong in TESTING.md.

## NWS: official weather alerts

Use `https://api.weather.gov/alerts/active?point={latitude},{longitude}` with a unique User-Agent and `Accept: application/geo+json`. The API is free, cache-oriented, and subject to limits. [API service](https://www.weather.gov/documentation/services-web-api).

NWS recommends alert requests no more often than every 30 seconds. ClearPath refreshes in the foreground every minute and gates manual requests for the same point for at least 30 seconds; Retry-After can extend the delay. Network/timeout/429/5xx failures receive at most two retries with minimum 30/60-second backoff. Requests have a timeout and cancellation. A response becomes cached after a failed verification, loss of connectivity, or 90 seconds without a new successful response. These policies do not guarantee alert-delivery latency. [Alerts service](https://www.weather.gov/documentation/services-web-alerts).

Retain identity, agency, event, headline, description, instructions, classifications, sent/onset/expiration times, source link, and supplied geometry. Missing instructions mean no specific instruction was supplied; do not fill the gap with an invented imperative. Some alerts use zones/counties instead of polygons, so missing polygon geometry is not absence of an alert. [NWS geolocation guide](https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf).

The successful retrieval time belongs to the client snapshot; the alert's issuance/expiration times belong to its source. Expiration must be evaluated again as time passes and after restart. A failed refresh cannot turn a previous response into current verified data. Response parsing cannot guarantee complete coverage of every local emergency; NWS is not a universal wildfire/evacuation feed.

## USGS: milestone 6 roadmap

No USGS observation integration is claimed at this checkpoint. The current documentation points to the **v1** OGC API. Recheck it when milestone 6 begins. [USGS API documentation](https://api.waterdata.usgs.gov/docs/), [current OpenAPI](https://api.waterdata.usgs.gov/ogcapi/v1/openapi?f=html).

| Future need | Documented collection |
| --- | --- |
| Discover station metadata/location | [monitoring-locations](https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations?f=html) |
| Latest measurement for each time series | [latest-continuous](https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous?f=html) |
| Recent series for possible trends | [continuous](https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous?f=html) |

Discovery should query a bounding box, follow pagination, then apply the configured radius locally; a bounding-box match alone is not a radius match. Validate permitted query parameters using current OpenAPI/schema before implementation. Join observations by monitoring-location identifier and parameter. Show units, observation time, qualifiers/status, and an official station link; distinguish missing data from zero.

USGS continuous sensors often sample at 15-minute intervals, but collection/transmission timing varies and measurements can be delayed. [Latest continuous documentation](https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous?f=html). A gauge measures a station, not conditions at the user's precise point. Gage height is not a universal flood-depth measurement. Flood-stage labels require verified station-specific official thresholds and datum interpretation; do not infer them from height alone.

## Roads and navigation

DriveTexas API access requires a key and may require TxDOT approval. No approval is assumed or requested by this implementation. The documented feed refresh is five minutes, and consumers must request at five-minute or longer intervals. [DriveTexas API documentation](https://api.drivetexas.org/api-docs), [key request](https://api.drivetexas.org/request-key).

Until approved terms have been reviewed, link to [official DriveTexas](https://drivetexas.org/). Do not scrape or relabel its content as a ClearPath live feed. Construction-only WZDx is not an equivalent comprehensive emergency-road feed. The terms must be read in the approval process; the documentation review here does not grant redistribution permission.

[Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) can open a standard map/directions experience without a Maps API key. These external links do not establish road passability, an evacuation route, or flood safety. Native map tiles require separate platform setup as described in README.md.

## Offline preparation and numbers

Bundled summaries cite [NWS flood](https://www.weather.gov/safety/flood-during), [tornado](https://www.weather.gov/safety/tornado-during), [hurricane](https://www.weather.gov/safety/hurricane-action), [winter](https://www.weather.gov/safety/winter-during), and [wildfire](https://www.weather.gov/safety/wildfire-set) guidance. Supply checklist references [FEMA Ready.gov's list](https://www.ready.gov/sites/default/files/documents/files/checklist3.pdf); communication planning references [FEMA's plan](https://www.weather.gov/media/afc/Hydro/FloodSafety/family-emergency-communication-plan.pdf). Source websites may need internet access even though summaries do not.

911 is for emergencies; Texas 211 and 877-541-7905 provide community-resource information. [National 911 Program](https://www.911.gov/), [2-1-1 Texas](https://www.211texas.org/contact-2-1-1/). Availability depends on telephone service. Local user contacts are not official emergency resources unless independently confirmed.
