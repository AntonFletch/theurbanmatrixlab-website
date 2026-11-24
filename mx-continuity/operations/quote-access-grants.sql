-- MX Continuity — quote generation RPC hardening
-- Deployed and verified on UMX OS November 24, 2026.
-- Purpose: disallow anonymous execution of quote creation, while retaining
-- role-gated authenticated staff and explicit service-role execution.
--
-- Before: public.veil_create_quote_for_lead(uuid,text,integer) had EXECUTE
-- granted to PUBLIC (which included anon).
-- The function already calls app_private.veil_current_rank() >= 3;
-- grant narrowing makes that staff gate defense in depth.
-- NO customer records, quotes, invoices, RLS policies or website flags changed.
REVOKE EXECUTE ON FUNCTION public.veil_create_quote_for_lead(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veil_create_quote_for_lead(uuid,text,integer) TO authenticated;
-- service_role already holds explicit EXECUTE in existing production grants.

-- Read-only verification:
SELECT
  has_function_privilege('anon','public.veil_create_quote_for_lead(uuid,text,integer)','EXECUTE')
    AS anon_execute_expected_false,
  has_function_privilege('authenticated','public.veil_create_quote_for_lead(uuid,text,integer)','EXECUTE')
    AS authenticated_execute_expected_true,
  has_function_privilege('service_role','public.veil_create_quote_for_lead(uuid,text,integer)','EXECUTE')
    AS service_execute_expected_true;
