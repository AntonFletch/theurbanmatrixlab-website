# UMX Winter Command — aerial upgrade verification

Build date: October 18, 2026.

## Verified through local automated testing
- JavaScript syntax: pass (`node --check`).
- EPSG:3857 tile bounding box conversion around Missoula: pass.
- URL construction for Montana 2025 NAIP 30cm ArcGIS image service: pass (network-independent test).
- Default aerial map mode, street/demo switch, parcel reference toggle, zoom and reset: pass (mocked map-library/service responses).
- Both active green and noncontract red crossed-out demo features: pass.
- Live-map hover formatting preserves latest ground temperature and latest deicer application independently: pass.
- New manual ground measurement displayed in property record, worker field, historical display, CSV download: pass.
- 390px mobile layout without horizontal overflow: pass.
- No JavaScript errors in the simulated online desktop/mobile test: pass.
- Mapping library offline fallback to usable illustrated view: pass.

## Pending live network acceptance
- Actual raster image tiles returned by Montana State Library ImageServer under browser CORS/connectivity conditions.
- Actual GeoJSON parcel geometry query, scale/accuracy and public service availability.
- Weather.gov observation API cross-origin availability from the deployed domain.
- Official cadastral geometry alignment with individual real client contracts.
- Authentication, access control, realtime database, routing and sensor data integration.

This is a private-development review build, not a live operational service. All sample service records and colored client areas are fictional.