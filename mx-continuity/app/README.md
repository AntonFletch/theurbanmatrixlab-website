# MX Continuity — Client & Checkup Center

A separate, mobile-friendly web app under `mx-continuity/app/`. It does not replace or modify the original approved public MX Continuity homepage, packages, or legal pages.

## Screens
- Sign in: existing approved Supabase Auth account only (no automatic sign-up)
- Overview: active care sites, recorded inspections, alerts and new customer inquiries
- Checkups: 20-second read-only polling of actual inspection results, manual-review status, and check-in conversation
- Customer inquiries: per-client messages and status updates once a separately approved website intake is connected
- Support: existing maintenance tickets; public support contact page remains available

## Source of truth
Project: UMX OS (Supabase). This app uses the **publishable** key and the user's Auth session, never a service-role/secret key. Access is enforced with Row Level Security:
- Staff: existing `veil_memberships` with rank >= 3, plus controlled updates on existing tables
- Clients: existing `veil_client_users` active membership, restricted to assigned client ID
- New `mx_ops_check_comments`: immutable authenticated client/staff conversation for an inspection
- New `mx_client_inquiries`: authenticated client/staff viewing and status-only updates; no public insert grant
- Existing `mx_ops_inspections` and `mx_ops_monitor_targets` exposed to assigned client users only for SELECT
- Existing `veil_support_tickets` provides support history

## Actual monitoring behavior
- Basic and Business: Monday at 9:00 AM America/Denver
- Continuity: Monday and Friday at 9:00 AM America/Denver
- Supabase Cron invokes `app_private.mx_ops_enqueue()` at both 15:00 and 16:00 UTC; the function gates execution to **9 AM local**, so daylight saving time is respected.
- `app_private.mx_ops_poll()` runs every five minutes and processes the HTTPS probe.
- A `healthy` check means the HTTPS endpoint responded; **not** a complete security, backup, mobile or form test. Other checks remain `not_tested` until manually reviewed.
- Only active, authorized, entitled care targets with live/care client status and MX Continuity live status are queued.

## Release gates
- [x] Separate app files in feature branch
- [x] Database tables and client-scoped RLS policies applied
- [x] Fixed local-time cron schedule applied and independently read back
- [x] JS syntax parsed; no existing website files changed
- [ ] Review and merge feature PR; verify GitHub Pages app route
- [ ] Provision/verify MX Continuity staff account and invite client accounts
- [ ] Configure Auth redirect allowlist for the final app domain
- [ ] Conduct role separation tests with real test staff/client sessions
- [ ] Verify live browser flows, including login, comment post, comment privacy, and inquiry status changes
- [ ] Configure and test each client's website inquiry form with consent, anti-spam, notification routing and an end-to-end delivery test
- [ ] Verify monitoring with an authorized paid/live test client before claiming customer monitoring is operational

No sample leads, invented monitoring passes, or automatic website intake activations are added.
