# Safety and privacy

ClearPath helps people read official information and prepare. It does not replace emergency authorities, emergency services, Wireless Emergency Alerts, NOAA Weather Radio, or local evacuation instructions. In immediate danger, call 911 and follow authorities' instructions. No phone, network, feed, or app can guarantee continuous delivery. [National 911 Program](https://www.911.gov/).

## Required presentation behavior

| Data condition | Meaning presented to the user |
| --- | --- |
| Successful live query, no current alerts | "No active official alerts found for this location." |
| Failed query without usable snapshot | "Unable to verify current alerts." |
| Previously retrieved response | Cached, with its original retrieval time; current verification unavailable |
| Simulated scenario | Persistent "SIMULATED DEMO" label, including full-warning and map views |
| Expired warning | Excluded from the current list; clearly marked if historical information is retained |

An empty response is not proof that an area is safe. A timeout is not an empty response. A cached unexpired warning is still cached information. Do not change its freshness based on a relaunch, mode switch, or local clock rendering.

Show agency classifications and original instructions without rewriting them into unverified personalized advice. Display ordering organizes text; it is not a danger probability. Offer every applicable warning, not only the first card. If normalization rejects malformed records, that limitation must not silently become an assurance of complete coverage.

## Geography, rivers, and routes

An official warning polygon describes its reported coverage, not the extent of every physical hazard. Draw only supplied/verified geometry. A missing polygon must remain explicit. A selected city's center is a point, not coverage of the whole city.

River observations belong to their station and observation time. A nearest station can be in another drainage area. Never convert raw gage height or streamflow into an evacuation order, flood classification, or personal safety statement without suitable official, station-specific evidence.

Standard Google Maps directions are general navigation. Do not label them flood-safe or verified evacuation routes. Missing reported road closures cannot establish passability. Follow official barriers and authorities; do not walk or drive into floodwater. [NWS flood safety](https://www.weather.gov/safety/flood-during).

General offline preparedness summaries are references, not a substitute for incident-specific official instructions. Source attribution remains visible. Do not place static preparation advice in the official instruction field of a live warning.

## Privacy

Foreground location is used to request point-specific alerts; no background tracking or location history is needed. Precise coordinates are disclosed to the official NWS service when requesting alerts. Manual location supports people who deny GPS access. No account, analytics SDK, sale of data, or custom location backend is required.

Checklist progress, a selected location, and user-entered contacts remain in local app storage. AsyncStorage is not encrypted storage; the phone's protections apply. Explain this in About, support local deletion, and avoid collecting unnecessary personal details. Opening an external source or Google Maps subjects that visit to that provider's privacy practices; transmitting coordinates in a map link should follow a deliberate user action.

Keys must not be committed. Restricted native map API keys are visible in mobile binaries and require correct platform/API restrictions. An environment variable cannot protect a server secret inside a client app.

## Verification boundary

This checkpoint is development code. Automated checks cannot confirm location permission behavior, map rendering, screen-reader usability, telephone handoff, or emergency reliability on a real phone. TESTING.md records exactly what ran and what remains. Do not make a test call to 911 during the demonstration; inspect and cancel the app's confirmation before handing off to the dialer.
