-- MX CONTINUITY ONLY. Source copy of the deployed Supabase UMX OS support-alert trigger.
-- Verified 2026-11-24. This file is documentation/recovery source; not executed by GitHub Pages.
-- Do not apply to another business, enable launch gates, or send email from this trigger.
-- The separate Outlook alert worker confirms owner mailbox and filters synthetic requests.
-- Purpose: restrict alert queue writes to the two MX Continuity support entrypoints.
CREATE OR REPLACE FUNCTION app_private.mx_enqueue_support_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.category = 'support'
     AND NEW.source IN ('public_web', 'client_portal')
     AND EXISTS (
       SELECT 1
       FROM public.veil_businesses b
       WHERE b.public_label = 'MX Continuity'
         AND lower(b.support_email) = 'theurbanmatrixlab@outlook.com'
     )
  THEN
    INSERT INTO app_private.mx_support_alert_queue(ticket_id)
    VALUES (NEW.id)
    ON CONFLICT (ticket_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$function$;

-- Existing trigger: mx_queue_new_support_ticket_alert
--  AFTER INSERT ON public.veil_support_tickets
--  FOR EACH ROW EXECUTE FUNCTION app_private.mx_enqueue_support_alert();
--
-- On 2026-11-24 the deployed function was tested with isolated, fully rolled-back
-- transactions:
--   public_web/support -> exactly one alert
--   client_portal/support -> exactly one alert
--   manual/support -> no alert
--   public_web/general -> no alert
-- All synthetic source rows and alert rows were confirmed absent after rollback.
-- Do not change RLS, customer receipt settings, business status, or payment controls.
