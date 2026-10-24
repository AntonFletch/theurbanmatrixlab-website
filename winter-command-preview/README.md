# UMX Winter Command — secure release candidate

Updated October 24, 2026. The rebuild includes current main and preserves the October 23 neighborhood-map work. It replaces the fictional, browser-only winter prototype with an empty authenticated workspace. Real customers, contracts and boundaries are never inferred from county GIS.

## Locked map and entry point
- `/map` is the original color-coded Sector Command. Its approved `map.html` and `sector-command.css` are unchanged by this repair: Homes/Businesses, green operating businesses, gold contacted, bright red declined, gray excluded, orange postal ring, independent VIP stars, three neighborhood cards, and the UMX contract emblem remain in place.
- The alternate `/winter-command-preview/map-check` page redirects to `/map`; it is no longer presented as the finished workspace. The HTML fallback forwards there too. Sign-in and MFA still protect the actual workspace.
- Repaired the original map's county address loader using the county’s official MCGISData hosted service. Loads all pages, filters exact neighborhood geometry, uses verified saved city boundaries, cancels stale requests and preserves source errors.
- New outreach writes use canonical county GlobalIDs rather than an unverified mapping from a hosted numeric object ID to the former server. The database has zero outreach rows; no stored statuses were changed or deleted. Invalid/missing GlobalIDs block that inventory rather than associating a flag with the wrong address.
- Original color precedence and hospital exclusion are tested. VIP remains independent of declined/excluded status. The map template, colors and layout are preserved.

## Corrected winter field workflow
- Winter Command uses all 20 official city boundaries, a clipped map, neighborhood selector and three sector cards below the map.
- Service setup uses map drawing with start/undo/clear/finish controls. No raw GeoJSON is requested from the operator.
- Service geometry is validated by PostGIS in the non-public `extensions` schema. A contracted sidewalk/parking scope may exclude the building/address point. Invalid crossings and misplaced holes are rejected.
- Disable an incorrect scope and verify a replacement under the same agreement; old geometry, audit and field records are retained. Only one enabled scope per property/agreement is permitted.
- Unsaved-entry discard confirmation protects in-progress entries.

## Implemented
- Existing UMX sign-in and server-verified staff/worker roles; explicit authenticator setup and two-step sign-in. New winter RLS requires AAL2, independently of frontend visibility.
- Shared Supabase service areas, assignments, manual pavement checks, treatments and correction history. Workers can access only assigned areas. Every write records the authenticated actor and server creation time.
- Executed current contracts, verified property coordinates, approved service scope, closed geographic geometry and source notes are required before an area can be added. An owner/staff confirmation binds the chosen property to the chosen agreement; GIS outlines do not approve a contract.
- Immutable thermal history, linked corrections, treatment validation, replay-safe record IDs, UTC timestamps, America/Denver display, search, filters and formula-safe CSV export.
- Current/inactive green/red geometry and independent latest pavement/latest material history. Contract dates and paused/revoked status are evaluated by the database. Inactive scopes reject new field records.
- Historical Montana 2025 NAIP imagery attempted first. Real service calls currently fail for some Missoula tiles. After two errors, the entire layer switches to an explicitly labeled Esri aerial fallback, with provider attribution and no 2025/date claim. Streets remains available.
- Actual Montana parcel GeoJSON references, request cancellation/timeouts and a visible 300-feature limit. NWS KMSO air observations include timestamp and stale/missing detection; they never become pavement readings.
- Local Leaflet 1.9.4 assets and version-pinned Supabase browser dependency. Winter CSP, no-store, no-referrer, nosniff and frame restrictions. Session/access loss hides and clears private records. No operational records are kept in localStorage.
- The existing neighborhood-only sector maps, Homes/Businesses tabs, three sector cards, VIP flags and contract preview are preserved. Fixed tooltip HTML injection, truncated flag loading, stale neighborhood saves, active-business color precedence, unavailable-tile handling and status-sync errors.

## Database state
UMX OS is ACTIVE_HEALTHY. Applied additive migrations correspond to `db/winter_command.sql`, `db/winter_hardening.sql` and `db/winter_service_geometry.sql` (in that order). No existing records or accounts were deleted. Real properties, contracts and winter records remain empty. Transactional integration fixtures were fully rolled back; the existing account count remains one.

`db/sector_security.sql` is deliberately staged: apply it only alongside the updated Sector Command frontend, after final acceptance. Applying it to the old live frontend would require MFA that that frontend cannot collect. Winter tables already enforce MFA. This remaining coordinated rollout is a release gate, not completed production hardening of the old map.

## Evidence
- `node --test tests/winter.test.mjs tests/sector-status.test.mjs`: fifteen tests, including validation, independent deicer chronology/corrections, Mercator tiles, CSV formulas, contract checks and geography/timezone handling, all 20 neighborhood names, clipping holes/islands, drawn boundary validation, address filtering and address-service pagination/error/cancellation.
- `tests/winter_rls.sql`: actual database integration tests for staff/MFA, assigned vs unassigned workers, immutable records, actor spoofing, treatment/future-time validation, correction concurrency, scope audit, inactive/paused contracts and anonymous privileges. All fixtures roll back.
- `tests/results/database.json`: recorded pass and unchanged zero client/record counts.
- `python scripts/check-live-services.py`: real image/parcel/weather downloads; `tests/results/live-services.json` retains the NAIP error alongside passing Esri, Montana parcel and NWS checks. The script returns failure while any required source is broken; a fallback is never relabeled as a passing NAIP test.
- `node scripts/check-addresses.mjs`: actual county-hosted responses through the production address loader passed for all 20 neighborhoods; counts are in `tests/results/addresses.json`. These are address records, not occupied-house or operating-company counts.
- The former public map diagnostic routes to the locked `/map` workspace. Earlier public-map browser evidence is historical; it does not establish signed-in Sector Command acceptance.
- Connected browser: actual Esri fallback tiles, actual Montana reference polygons, layer controls and signed-out record gate tested. Authenticated editing/MFA and multi-device acceptance are still required; an SQL role test is not a real sign-in.
- GitHub workflow runs domain/syntax checks on this PR. A successful Cloudflare build only confirms deployment, not operational acceptance.

## Short release gates
1. Complete actual owner MFA/sign-in, same-account phone/desktop persistence, assigned-worker isolation, retry/correction/CSV and session-revocation acceptance on the exact Cloudflare candidate. Apply staged sector security with the corresponding frontend and retest.
2. Resolve platform security/recovery configuration: compromised-password protection is disabled; the database reports PostgreSQL 17.6 while Supabase documents the 17.11 security update. Confirm provider upgrade, backup retention and perform a restore drill. The connected MCP tools cannot change these dashboard settings. Existing unrelated publication tables have RLS with no policies, so remain denied by default.
3. Verify the first real property/contract and service boundary before any dispatch trial. None exist in the database. Complete an operator/phone field trial; no automated dispatch or sensor integration is shipped here.
4. Obtain reliable full 2025 NAIP coverage if that exact source/year is required; otherwise explicitly accept the labeled fallback. Then clear the release gate and merge/publish the tested commit.

Do not merge or publish as an operational dispatch system until these gates are recorded as passed. The public marketing homepage is not changed by this PR.

## Local checks
Run the two test files above, syntax checks and build with `python scripts/build-preview.py`. `sites-preview start <checkout>` serves the resulting static files for internal QA; this does not register a new Site or change Cloudflare hosting.

## Data references
- https://msl.mt.gov/geoinfo/data/Aerial_Photos/NAIP_2025
- https://gisservice.mt.gov/arcgis/rest/services/MSDI_Framework/msdi_naip2025_provisional_image_v1/ImageServer
- https://gisservice.mt.gov/arcgis/rest/services/msdi_cadastral_map_v1/MapServer/1
- https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
- https://api.weather.gov/stations/KMSO/observations/latest
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes

County address source: https://www.arcgis.com/home/item.html?id=2cc878f55cbb492c9388026aec382e58 (MCGISData, Missoula County). Only public address/classification/coordinate fields are requested; this layer does not import clients or expose private status notes.
