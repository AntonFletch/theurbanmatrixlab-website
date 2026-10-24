-- Additive deployment. Existing clients, contracts, map flags, and accounts are preserved.
begin;
create table public.winter_service_areas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.umx_properties(id) on delete restrict,
  contract_id uuid not null references public.umx_contracts(id) on delete restrict,
  property_name text not null, address text not null,
  latitude numeric not null, longitude numeric not null,
  geometry jsonb not null,
  geometry_source text not null check (length(trim(geometry_source)) between 5 and 2000),
  service_scope text not null check (length(trim(service_scope)) between 5 and 2000),
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  enabled boolean not null default true,
  unique (property_id, contract_id)
);
create index winter_areas_contract on public.winter_service_areas(contract_id);
create index winter_areas_verifier on public.winter_service_areas(verified_by);
create table public.winter_assignments (
  area_id uuid not null references public.winter_service_areas(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(area_id,user_id)
);
create index winter_assignments_user on public.winter_assignments(user_id);
create index winter_assignments_creator on public.winter_assignments(assigned_by);
create table public.winter_records (
  id uuid primary key, -- Client-generated id is retained across uncertain network retries.
  area_id uuid not null references public.winter_service_areas(id) on delete restrict,
  measured_at timestamptz not null,
  ground_f numeric not null check (ground_f between -70 and 140),
  air_f numeric check (air_f between -70 and 140),
  surface_condition text not null check (surface_condition in ('Dry','Wet','Snow','Slush','Ice','Refreeze risk')),
  event_type text not null check (event_type in ('Inspection','Follow-up','Pre-treatment','Ice treatment','Snow removal')),
  method text not null check (length(trim(method)) between 1 and 200),
  material text check (material is null or length(trim(material)) between 1 and 200),
  quantity numeric not null default 0 check (quantity between 0 and 100000),
  unit text check (unit in ('lb','gal')),
  area_sqft numeric check (area_sqft between 0 and 10000000),
  notes text not null default '' check (length(notes) <= 4000),
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  correction_of uuid references public.winter_records(id) on delete restrict,
  constraint winter_material_pair check ((quantity=0 and material is null and unit is null) or (quantity>0 and material is not null and unit is not null and area_sqft>0)),
  constraint winter_treatment_material check (event_type not in ('Pre-treatment','Ice treatment') or quantity>0),
  constraint winter_not_self_correction check (correction_of is distinct from id)
);
create index winter_records_area_time on public.winter_records(area_id,measured_at desc,id);
create index winter_records_actor on public.winter_records(recorded_by);
create unique index winter_records_one_correction on public.winter_records(correction_of) where correction_of is not null;
create table public.winter_area_audit (
  id bigint generated always as identity primary key,
  area_id uuid not null references public.winter_service_areas(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  action text not null,
  before_row jsonb, after_row jsonb not null
);
create index winter_audit_area on public.winter_area_audit(area_id);
create index winter_audit_actor on public.winter_area_audit(actor_id);

create function private.winter_staff() returns boolean language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and private.umx_staff()
$$;
create function private.winter_access(area uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and (
    private.umx_staff() or (
      exists(select 1 from public.profiles p where p.id=auth.uid() and lower(p.role) in ('employee','staff','worker'))
      and exists(select 1 from public.winter_assignments a where a.area_id=area and a.user_id=auth.uid())
    ))
$$;
create function private.winter_contract_active(contract uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and
    (private.umx_staff() or exists(select 1 from public.winter_service_areas a where a.contract_id=contract and private.winter_access(a.id))) and
    exists(select 1 from public.umx_contracts c where c.id=contract and c.status in ('active','signed') and c.signature_status='executed'
      and c.executed_at is not null and c.customer_signed_at is not null and c.umx_signed_at is not null
      and length(c.executed_document_sha256)=64
      and (c.start_date is null or c.start_date <= (now() at time zone 'America/Denver')::date)
      and (c.end_date is null or c.end_date >= (now() at time zone 'America/Denver')::date))
$$;
-- Validate closed geographic rings and require the verified property point within the scope.
create function private.winter_geometry_valid(g jsonb, lon numeric, lat numeric) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare polys jsonb; poly jsonb; ring jsonb; pt jsonb; prev jsonb; x numeric; y numeric; px numeric; py numeric; inside boolean; poly_inside boolean; outer_ring boolean; answer boolean:=false; signed_area numeric;
begin
  if g is null or lon is null or lat is null or lon not between -180 and 180 or lat not between -85 and 85 or length(g::text)>300000 then return false; end if;
  if g->>'type'='Polygon' then polys:=jsonb_build_array(g->'coordinates'); elsif g->>'type'='MultiPolygon' then polys:=g->'coordinates'; else return false; end if;
  if jsonb_typeof(polys)<>'array' or jsonb_array_length(polys)=0 then return false; end if;
  for poly in select value from jsonb_array_elements(polys) loop
    if jsonb_typeof(poly)<>'array' or jsonb_array_length(poly)=0 then return false; end if;
    outer_ring:=true; poly_inside:=false;
    for ring in select value from jsonb_array_elements(poly) loop
      if jsonb_typeof(ring)<>'array' or jsonb_array_length(ring)<4 or ring->0 <> ring->(jsonb_array_length(ring)-1) then return false; end if;
      inside:=false; signed_area:=0; prev:=ring->(jsonb_array_length(ring)-1);
      for pt in select value from jsonb_array_elements(ring) loop
        if jsonb_typeof(pt)<>'array' or jsonb_array_length(pt)<>2 or jsonb_typeof(pt->0)<>'number' or jsonb_typeof(pt->1)<>'number' then return false; end if;
        x:=(pt->>0)::numeric; y:=(pt->>1)::numeric; px:=(prev->>0)::numeric; py:=(prev->>1)::numeric;
        if x not between -180 and 180 or y not between -85 and 85 then return false; end if;
        signed_area:=signed_area+px*y-x*py;
        if (y>lat)<>(py>lat) then if lon < (px-x)*(lat-y)/(py-y)+x then inside:=not inside; end if; end if;
        prev:=pt;
      end loop;
      if signed_area=0 then return false; end if;
      if outer_ring then poly_inside:=inside; outer_ring:=false; elsif inside then poly_inside:=false; end if;
    end loop;
    answer:=answer or poly_inside;
  end loop;
  return answer;
exception when others then return false;
end $$;

create function private.winter_guard_area() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.umx_properties;
begin
  if not private.winter_staff() then raise exception 'Staff with two-step access required'; end if;
  if tg_op='UPDATE' then
    if (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Verified scope is immutable; create a separately verified contract scope'; end if;
    return new;
  end if;
  if not private.winter_contract_active(new.contract_id) then raise exception 'An executed current contract is required'; end if;
  select * into p from public.umx_properties where id=new.property_id;
  if p.id is null or p.latitude is null or p.longitude is null or length(trim(coalesce(p.address,'')))=0 then raise exception 'Verify property address and coordinates first'; end if;
  if not private.winter_geometry_valid(new.geometry,p.longitude,p.latitude) then raise exception 'Closed geographic boundary must contain the verified property point'; end if;
  new.property_name:=coalesce(p.name,p.address); new.address:=p.address; new.latitude:=p.latitude; new.longitude:=p.longitude;
  new.verified_by:=auth.uid(); new.verified_at:=now();
  return new;
end $$;
create trigger winter_guard_area before insert or update on public.winter_service_areas for each row execute function private.winter_guard_area();
create function private.winter_audit_area() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not private.winter_staff() then raise exception 'Authorized staff required'; end if;
  insert into public.winter_area_audit(area_id,actor_id,action,before_row,after_row) values(new.id,auth.uid(),lower(tg_op),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end $$;
create trigger winter_audit_area after insert or update on public.winter_service_areas for each row execute function private.winter_audit_area();
create function private.winter_guard_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not private.winter_access(new.area_id) then raise exception 'Area authorization and two-step access required'; end if;
  if not exists(select 1 from public.winter_service_areas a where a.id=new.area_id and a.enabled and private.winter_contract_active(a.contract_id)) then raise exception 'Service area is inactive or contract not current'; end if;
  if new.measured_at>now()+interval '1 minute' then raise exception 'Measurement cannot be in the future'; end if;
  if new.correction_of is not null and not exists(select 1 from public.winter_records r where r.id=new.correction_of and r.area_id=new.area_id) then raise exception 'Correction must reference history in this service area'; end if;
  if new.correction_of is not null and length(trim(new.notes))<5 then raise exception 'Explain the correction'; end if;
  new.recorded_by:=auth.uid(); new.created_at:=now(); return new;
end $$;
create trigger winter_guard_record before insert on public.winter_records for each row execute function private.winter_guard_record();

alter table public.winter_service_areas enable row level security;
alter table public.winter_assignments enable row level security;
alter table public.winter_records enable row level security;
alter table public.winter_area_audit enable row level security;
create policy winter_areas_read on public.winter_service_areas for select to authenticated using ((select private.winter_access(id)));
create policy winter_areas_create on public.winter_service_areas for insert to authenticated with check ((select private.winter_staff()) and verified_by=(select auth.uid()));
create policy winter_areas_update on public.winter_service_areas for update to authenticated using ((select private.winter_staff())) with check ((select private.winter_staff()));
create policy winter_assignments_read on public.winter_assignments for select to authenticated using ((select private.winter_staff()) or (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2'));
create policy winter_assignments_create on public.winter_assignments for insert to authenticated with check ((select private.winter_staff()) and assigned_by=(select auth.uid()) and exists(select 1 from public.profiles where id=user_id and lower(role) in ('employee','staff','worker','owner','admin','dispatcher','manager')));
create policy winter_assignments_remove on public.winter_assignments for delete to authenticated using ((select private.winter_staff()));
create policy winter_records_read on public.winter_records for select to authenticated using ((select private.winter_access(area_id)));
create policy winter_records_append on public.winter_records for insert to authenticated with check ((select private.winter_access(area_id)) and recorded_by=(select auth.uid()));
create policy winter_audit_read on public.winter_area_audit for select to authenticated using ((select private.winter_staff()));
revoke all on public.winter_service_areas, public.winter_assignments, public.winter_records, public.winter_area_audit from public,anon,authenticated;
grant select,insert,update on public.winter_service_areas to authenticated;
grant select,insert,delete on public.winter_assignments to authenticated;
grant select,insert on public.winter_records to authenticated;
grant select on public.winter_area_audit to authenticated;
-- Invoker view retains underlying RLS, returns only authorized area snapshots and current status.
create view public.winter_area_status with (security_invoker=true) as select a.*,private.winter_contract_active(a.contract_id) as contract_active from public.winter_service_areas a;
revoke all on public.winter_area_status from public,anon;
grant select on public.winter_area_status to authenticated;
revoke all on function private.winter_staff(),private.winter_access(uuid),private.winter_contract_active(uuid),private.winter_geometry_valid(jsonb,numeric,numeric),private.winter_guard_area(),private.winter_audit_area(),private.winter_guard_record() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.winter_staff(),private.winter_access(uuid),private.winter_contract_active(uuid),private.winter_geometry_valid(jsonb,numeric,numeric),private.winter_guard_area(),private.winter_guard_record() to authenticated;
notify pgrst,'reload schema';
commit;
