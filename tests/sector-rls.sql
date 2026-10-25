begin;
do $$
declare uid uuid; sid uuid; pid text:='county:'||gen_random_uuid(); v timestamptz; n integer;
begin
 select p.id,s.id into uid,sid from public.profiles p join auth.sessions s on s.user_id=p.id where lower(p.role) in ('owner','admin') and(s.not_after is null or s.not_after>now()) limit 1;
 if sid is null then raise exception 'An existing owner password session is required';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated','aal','aal1','session_id',sid)::text,true);
 execute 'set local role authenticated';
 if not private.sector_staff() then raise exception 'Password session rejected';end if;
 insert into public.sector_property_statuses(user_id,property_id,sector,vip,notes)values(uid,pid,'Northside',true,'ROLLBACK TEST ONLY')returning updated_at into v;
 if(select count(*)from public.sector_property_statuses where property_id=pid)<>1 then raise exception 'Save/reload failed';end if;
 update public.sector_property_statuses set declined=true,updated_at=v+interval '1 second' where property_id=pid and updated_at=v;
 get diagnostics n=row_count;if n<>1 then raise exception 'Device save failed';end if;
 update public.sector_property_statuses set declined=false where property_id=pid and updated_at=v;
 get diagnostics n=row_count;if n<>0 then raise exception 'Stale device update allowed';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated','aal','aal1','session_id',gen_random_uuid())::text,true);
 if private.sector_staff()or(select count(*)from public.sector_property_statuses where property_id=pid)<>0 then raise exception 'Invalid session leaked flags';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated','aal','aal1','session_id',sid,'is_anonymous',true)::text,true);
 if private.sector_staff()or(select count(*)from public.sector_property_statuses where property_id=pid)<>0 then raise exception 'Anonymous session leaked flags';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated','aal','aal1','session_id',sid,'user_metadata',json_build_object('role','owner'))::text,true);
 if private.sector_staff()or(select count(*)from public.sector_property_statuses where property_id=pid)<>0 then raise exception 'Different identity leaked flags';end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: active password staff save/reload, stale update denied, anonymous/invalid-session/different-identity denied; fixtures rolled back' as result;
