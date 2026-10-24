-- Requested sign-in method: email and password; no authenticator requirement.
-- Keep staff roles, worker assignments, ownership and immutable records enforced.
begin;
create or replace function private.winter_staff() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and private.umx_staff(),false)
$$;
create or replace function private.winter_access(area uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and (
    private.umx_staff() or (
      exists(select 1 from public.profiles p where p.id=auth.uid() and lower(p.role) in ('employee','staff','worker'))
      and exists(select 1 from public.winter_assignments a where a.area_id=area and a.user_id=auth.uid())
    )),false)
$$;
create or replace function private.winter_contract_active(contract uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and
    (private.umx_staff() or exists(select 1 from public.winter_service_areas a where a.contract_id=contract and private.winter_access(a.id))) and
    exists(select 1 from public.umx_contracts c where c.id=contract and c.status in ('active','signed') and c.signature_status='executed'
      and c.executed_at is not null and c.customer_signed_at is not null and c.umx_signed_at is not null
      and c.executed_document_sha256 ~ '^[0-9a-fA-F]{64}$'
      and (c.start_date is null or c.start_date <= (now() at time zone 'America/Denver')::date)
      and (c.end_date is null or c.end_date >= (now() at time zone 'America/Denver')::date)),false)
$$;
alter policy winter_assignments_read on public.winter_assignments using (
  (select private.winter_staff()) or
  (user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
);
create or replace function private.winter_guard_area() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.umx_properties;
begin
  if not private.winter_staff() then raise exception 'Authorized staff required'; end if;
  if tg_op='UPDATE' then
    if (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Verified scope is immutable; disable it and verify a replacement scope'; end if;
    return new;
  end if;
  if not private.winter_contract_active(new.contract_id) then raise exception 'An executed current contract is required'; end if;
  select * into p from public.umx_properties where id=new.property_id;
  if p.id is null or p.latitude is null or p.longitude is null or length(trim(coalesce(p.address,'')))=0 then raise exception 'Verify property address and coordinates first'; end if;
  if not private.winter_geometry_valid(new.geometry,p.longitude,p.latitude) then raise exception 'Draw a valid closed service boundary without crossing edges'; end if;
  new.property_name:=coalesce(p.name,p.address); new.address:=p.address; new.latitude:=p.latitude; new.longitude:=p.longitude;
  new.verified_by:=auth.uid();new.verified_at:=now();return new;
end $$;
notify pgrst,'reload schema';
commit;
