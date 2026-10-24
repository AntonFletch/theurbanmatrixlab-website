begin;
-- Keep GIS system objects out of the exposed public schema.
create extension if not exists postgis with schema extensions;
create or replace function private.winter_geometry_valid(g jsonb, lon numeric, lat numeric) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare shape extensions.geometry;
begin
  if g is null or lon is null or lat is null or lon not between -180 and 180 or lat not between -85 and 85
    or length(g::text)>300000 or g->>'type' not in ('Polygon','MultiPolygon') then return false; end if;
  shape:=extensions.st_geomfromgeojson(jsonb_build_object('type',g->>'type','coordinates',g->'coordinates'));
  if extensions.st_isempty(shape) or extensions.st_ndims(shape)<>2 or extensions.st_npoints(shape)>2000
    or not extensions.st_isvalid(shape,0) then return false; end if;
  if exists(select 1 from extensions.st_dumppoints(shape) p
    where extensions.st_x(p.geom) not between -180 and 180 or extensions.st_y(p.geom) not between -85 and 85) then return false; end if;
  -- A sidewalk/parking service area can legitimately exclude the building/address point.
  -- Property/contract association still requires verified staff, source notes and audit.
  return true;
exception when others then return false;
end $$;
create or replace function private.winter_guard_area() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.umx_properties;
begin
  if not private.winter_staff() then raise exception 'Staff with two-step access required'; end if;
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
-- Allow a newly verified replacement after an old scope is disabled; retain its history.
alter table public.winter_service_areas drop constraint winter_service_areas_property_id_contract_id_key;
create unique index winter_one_current_scope on public.winter_service_areas(property_id,contract_id) where enabled;
notify pgrst,'reload schema';
commit;
