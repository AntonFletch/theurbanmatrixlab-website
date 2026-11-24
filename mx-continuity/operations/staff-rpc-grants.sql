-- MX Continuity UMX OS — staff-only RPC execution grants.
-- Deployed Nov 24, 2026; verified via has_function_privilege.
-- Each RPC also contains its own rank>=3 authorization check.
-- Revoking anonymous access provides defense in depth.
-- This does not enable intake, checkout, customer receipts or public indexing.
REVOKE EXECUTE ON FUNCTION public.veil_complete_project_step(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veil_complete_project_step(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.veil_confirm_booking_request(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veil_confirm_booking_request(uuid,timestamptz,timestamptz,uuid) TO authenticated;
-- service_role retains explicit execution privileges on these functions.

-- Read-only verification (all expected false / true / true):
SELECT p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_expected_false,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authorized_login_expected_true,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_expected_true
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('veil_create_quote_for_lead','veil_complete_project_step','veil_confirm_booking_request')
ORDER BY p.proname;
