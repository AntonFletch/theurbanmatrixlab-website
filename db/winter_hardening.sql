begin;
create or replace function private.winter_staff() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and private.umx_staff(),false)
$$;
create or replace function private.winter_contract_active(contract uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and
    (private.umx_staff() or exists(select 1 from public.winter_service_areas a where a.contract_id=contract and private.winter_access(a.id))) and
    exists(select 1 from public.umx_contracts c where c.id=contract and c.status in ('active','signed') and c.signature_status='executed'
      and c.executed_at is not null and c.customer_signed_at is not null and c.umx_signed_at is not null
      and c.executed_document_sha256 ~ '^[0-9a-fA-F]{64}$'
      and (c.start_date is null or c.start_date <= (now() at time zone 'America/Denver')::date)
      and (c.end_date is null or c.end_date >= (now() at time zone 'America/Denver')::date)),false)
$$;
revoke all on sequence public.winter_area_audit_id_seq from public,anon,authenticated;
revoke all on function private.winter_audit_area() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
