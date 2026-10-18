# UMX Winter Command — Interactive Review Build

Prepared: October 18, 2026. Owner review required before deployment.

## Purpose
A working front-end prototype for The Urban Matrix Lab LLC winter property command center. The design includes two illustrative properties: an accepted client is highlighted green, while a property not under contract is outlined and crossed out in red. Demo parcel shapes do **not** represent official parcel boundaries or real contracted properties.

## Implemented and browser-tested
- Responsive black/gold operations dashboard, simulated neighborhood overview, property selection, zoom and pan, and property detail panels.
- Hover/tap property to see most recent measured pavement temperature and timestamp, surface condition, route priority, **latest deicer application even if later inspections occurred**, its amount and application time.
- Add a demo property, assign accepted/noncontracted status, route and priority; filter and search the map.
- Log thermal checks with measurement time, pavement/optional air temperature, pavement condition, event type, deicer/traction material, applied quantity, treatment area, inspector, and notes.
- Validation disallows invalid temperatures, future checks, inconsistent material quantities, and treatment events without a material.
- Displays complete records in the property panel; exports all properties or selected property thermal records as CSV, including application-rate calculation.
- Persists edits in browser localStorage only; records are **not shared, secure, or backed up**. Export data before clearing the browser.
- Attempts to retrieve actual *air observation* temperature from National Weather Service. API outages are displayed as unavailable, not as fabricated measurements.
- Optional real OpenStreetMap street basemap (requires connectivity and Leaflet CDN), with illustrative sample boundaries. Map tiles carry OpenStreetMap contributor attribution.
- No client data sent to UMX's inactive database, no user accounts, no deployed dispatch automation, no real-world service requests.

## Verification performed
Automated headless Chromium browser tests on desktop (1536 × 940) and phone (390 × 844): dashboard initial state, two colored/crossed parcel features, pointer hover panel, record creation, report CSV export, search, filter, new property, form validation, mobile width, page errors. A stubbed National Weather Service response demonstrated display of observed air temperature without changing the last measured pavement temperature.

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
Open `index.html` in a browser. Click the green property, hover for latest check and deicer history; click **Log Thermal Check** to add a measurement. Switch between accepted and not-contracted statuses, filter by status, and use **Property CSV** to export. The Street basemap button requires internet access.

## Important limitation
This is a review-ready functional **prototype**, not a live service, public customer portal, persistent multi-device system, or production-ready dispatch platform. All client records shown are fictional examples. **Do not enter real customer information** until authenticated storage and access controls have been implemented and tested.