# Release checklist — October 24, 2026

## Verified
- [x] Reconciled PR with current main; preserved neighborhood-map work and marketing homepage.
- [x] JavaScript syntax and twelve domain/validation tests.
- [x] Real Supabase RLS integration tests; MFA, staff/worker authorization, append-only records, correction conflicts, actor attribution and scope audit.
- [x] Test fixtures rolled back; real property/contract/winter counts remain zero.
- [x] Real Montana parcel GeoJSON response and browser rendering (300-feature cap).
- [x] Real Esri image bytes and complete browser fallback rendering with source attribution.
- [x] Real NWS air observation response; timestamp/unit/freshness validation implemented.
- [x] Signed-out browser cannot open winter records; map diagnostic exposes only public reference data.

- [x] All 20 city neighborhood names and boundaries verified against the source; three cards and clipping restored in Winter Command.
- [x] Connected browser: neighborhood selection, three-card count, phone overflow, start/undo/finish/clear drawing component (no account or company records involved).
- [x] Real database: valid sidewalk scope outside building point accepted; crossing polygons and invalid holes rejected; replacement preserves original history.

- [x] Actual hosted county address responses for all 20 neighborhoods; exact polygon filtering and complete pagination. Public house/business pins restored with search, address selection and visible request errors.

## Exact production gates
- [ ] Actual owner MFA, authenticated form/CSV/correction/retry tests and same-account phone/desktop persistence.
- [ ] Actual assigned-worker account/session-revocation test (only one account currently exists).
- [ ] Coordinated updated sector frontend plus `db/sector_security.sql`; verify current per-user status ownership and MFA afterward.
- [ ] Dashboard security/recovery: compromised-password protection, PostgreSQL security upgrade, backup retention and restore drill.
- [ ] First real property coordinates, executed contract, approved service geometry and operator field trial.
- [ ] Full 2025 NAIP imagery works, or owner accepts labeled fallback; primary provider failures remain recorded.
- [ ] Merge/publish only the exact candidate that passed the outstanding acceptance gates.

An HTTP 200/Cloudflare success is deployment evidence, not proof of authentication, boundary approval, or field readiness. No sample record is an actual client.
