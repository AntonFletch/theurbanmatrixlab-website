-- Preserve owned outreach flags; require an active password session and trusted staff role.
create or replace function private.sector_staff()
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce(
    auth.uid() is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    and private.umx_staff()
    and exists (
      select 1 from auth.sessions s
      where s.id=nullif(auth.jwt()->>'session_id','')::uuid
        and s.user_id=auth.uid()
        and (s.not_after is null or s.not_after>now())
    ),false);
$$;
revoke all on function private.sector_staff() from public,anon;
grant execute on function private.sector_staff() to authenticated;
create policy sector_staff_active_session on public.sector_property_statuses
as restrictive for all to authenticated
using ((select private.sector_staff()))
with check ((select private.sector_staff()));
revoke all on public.sector_property_statuses from public,anon,authenticated;
grant select,insert,update on public.sector_property_statuses to authenticated;
notify pgrst,'reload schema';

