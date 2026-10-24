-- Apply only with the updated Sector Command frontend.
begin;
-- Existing personal outreach flags retain ownership checks; require verified staff + MFA too.
create policy sector_staff_mfa on public.sector_property_statuses as restrictive for all to authenticated using ((select private.winter_staff())) with check ((select private.winter_staff()));
revoke all on public.sector_property_statuses from public,anon,authenticated;
grant select,insert,update on public.sector_property_statuses to authenticated;
notify pgrst,'reload schema';
commit;
