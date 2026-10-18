# UMX Winter Command — 2025 High-Resolution Aerial Review Build

Prepared: October 18, 2026. Owner review required before deployment.

## Purpose
A working front-end prototype for The Urban Matrix Lab LLC winter property command center. The design includes two illustrative properties: an accepted client is highlighted green, while a property not under contract is outlined and crossed out in red. Demo parcel shapes do **not** represent official parcel boundaries or real contracted properties.

## Implemented and browser-tested
- Responsive black/gold operations dashboard, real high-resolution Montana 2025 NAIP aerial basemap (public image service, 30cm/one-foot published resolution), street basemap, offline illustrated fallback, property selection, zoom and pan, and property detail panels.
- Hover/tap property to see most recent measured pavement temperature and timestamp, surface condition, route priority, **latest deicer application even if later inspections occurred**, its amount and application time.
- Add a demo property, assign accepted/noncontracted status, route and priority; filter and search the map.
- Log thermal checks with measurement time, pavement/optional air temperature, pavement condition, event type, deicer/traction material, applied quantity, treatment area, inspector, and notes.
- Validation disallows invalid temperatures, future checks, inconsistent material quantities, and treatment events without a material.
- Displays complete records in the property panel; exports all properties or selected property thermal records as CSV, including application-rate calculation.
- Persists edits in browser localStorage only; records are **not shared, secure, or backed up**. Export data before clearing the browser.
- Attempts to retrieve actual *air observation* temperature from National Weather Service. API outages are displayed as unavailable, not as fabricated measurements.
- Real Montana State Library 2025 provisional NAIP image service, loaded by default through ArcGIS `exportImage` (requires network and Leaflet CDN). Public 30 cm imagery was captured in 2025 and is not a live camera or guaranteed parcel survey.
- Optional Montana cadastral parcel geometry *reference* overlay via the State Library ArcGIS `MapServer/1/query` API. It is drawn as low-opacity outlines; its geometry is NOT bound to UMX's green/red fictitious client shapes. 300-feature limit; pan/zoom refresh; gracefully disabled if unavailable.
- Optional OpenStreetMap street basemap and a self-contained illustrated offline fallback, with appropriate visible map attributions.
- Map-mode controls, aerial tiles and query URL construction, responsive desktop/mobile, and full formatted thermal/deicer tooltip for real-map sample features (not only the illustration).
- Missoula County offers 2026 Nearmap imagery in its own viewer; commercial embedding is not included without verification of reuse permission and licensing. For the current UMX review we use public Montana NAIP instead.
- No client data sent to UMX's inactive database, no user accounts, no deployed dispatch automation, no real-world service requests.

## Verification performed
Automated headless Chromium browser tests on desktop (1536 × 940) and phone (390 × 844): dashboard initial state, both sample property colors/cross, real-map hover tooltip with historic ground temperature plus latest applied material independently, NOAA weather temperature stub, add a check, switch aerial/street/demo layers, toggle official parcel references, map zoom/reset, CSV export, and mobile width, no JavaScript page errors. We also validated the high-resolution NAIP image URL, bounding-box coordinate math, and service layer attribution. These tests used a network-independent map-library stub because the browser environment blocks external navigation. **A live end-to-end tile image download and the actual Montana parcel API response were NOT validated; both still require online deployment verification.** Earlier approved build browser tests covered record persistence and form validation; those tests were not repeated against live map services.

## Production prerequisites — not yet implemented
1. Private secure access for Owner, Justin/operations manager, authorized dispatchers, and field workers. Set up identity management and MFA; restrict personnel to their authorized work.
2. Activate/verify backend availability and running costs before any changes. UMX OS Supabase project was reported inactive on October 18, 2026. **No database restoration or schema modification has occurred**.
3. Backend tables: clients and contracts; properties/verified parcel geometry with source provenance; service areas; winter thermal checks (separate manual measurement vs sensor readings, time, method and device); field events and treatments; material inventory; route assignments; weather observations/forecasts; supporting images and audit trail.
4. Enforce server-side authorization, row-level security, append-only service history or correction entries, UTC storage plus America/Denver display, backups, photos with access control, and an appropriate retention policy. Never put privileged service keys in the browser.
5. Replace sample polygons with accurately sourced property/parcel geometries and permissioned live contracts. Add verification of public sidewalks versus contracted service areas. Do not treat illustrative polygons as legal boundaries.
6. Complete route management, property risk/dispatch rules, pre-treatment alerts, employee confirmation, and response thresholds. Forecast/air temperature is **not** pavement temperature; without installed sensors, ground checks are manual and historical.
7. Validate the Weather.gov observation endpoint and choose a production-grade imagery/tile service with suitable reliability and licensing for commercial use. OSM's community tile service has no uptime SLA.
8. Field acceptance trial with a few pilot properties, operator mobile usability, checks for offline/retry/duplicate submission, permission tests, record recovery, and supervisor review before operational launch.

## Quick demo use
Open `index.html` in a browser with internet connectivity. The 2025 Aerial mode loads automatically; use **Streets** for OSM or **Demo** for offline illustration. Click the green property, hover for latest check and last deicer application; click **Log Thermal Check** to add a measurement. Use **Parcel lines** to toggle the official reference overlay (it can be unavailable). Change accepted/not contracted, filter, and export CSV. Without connectivity, the page falls back to the offline illustrated map, retaining records and menus.

## Important limitation
This is a review-ready functional **prototype**, not a live service, public customer portal, persistent multi-device system, or production-ready dispatch platform. All client records shown are fictional examples. **Do not enter real customer information** until authenticated storage and access controls have been implemented and tested.

## Imagery/data references
- Montana State Library NAIP 2025 high-resolution statewide collection: https://msl.mt.gov/geoinfo/data/Aerial_Photos/NAIP_2025
- State NAIP provisional imagery API: https://gisservice.mt.gov/arcgis/rest/services/MSDI_Framework/msdi_naip2025_provisional_image_v1/ImageServer
- Montana cadastral parcel reference: https://gisservice.mt.gov/arcgis/rest/services/msdi_cadastral_map_v1/MapServer/1
- County 2026 Nearmap viewer (not embedded): https://gis.missoulacounty.us/propertyinformation/

Reference map imagery and cadastral geometry are not a boundary survey. Client service zones must be separately verified against contracts and field measurements before being used for dispatch.