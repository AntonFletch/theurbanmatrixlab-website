import test from 'node:test';
import assert from 'node:assert/strict';
import {addressRows,loadAddresses,containsPoint,sectorMask,countyPropertyId} from '../sector-data.mjs';
const geo={type:'Polygon',coordinates:[[[0,0],[5,0],[5,5],[0,5],[0,0]],[[2,2],[3,2],[3,3],[2,3],[2,2]]]};
const feature=(id,x=1,y=1)=>({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:{OBJECTID:id,globalid:'00000000-0000-0000-0000-'+String(id).padStart(12,'0'),fulladdress:id+' Test',structtype:1001,status:2,postalverified:1}});
test('official inventory filters outside addresses, polygon holes and retired records',()=>{
 const retired=feature(4);retired.properties.status=4;
 const rows=addressRows([feature(1),feature(1),feature(2,8,1),feature(3,2.5,2.5),retired],geo);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'county:00000000-0000-0000-0000-000000000001');
 assert.equal(rows[0].countyStatus,2);assert.ok(containsPoint(geo,[0,1]));assert.equal(containsPoint(geo,[2.5,2.5]),false);
 assert.equal(sectorMask(geo).coordinates.length,2);
});
test('stable GlobalID survives county object-number changes and invalid identifiers fail closed',()=>{
 const f=feature(1),renumbered=structuredClone(f);renumbered.properties.OBJECTID=9080;
 assert.equal(addressRows([f],geo)[0].id,addressRows([renumbered],geo)[0].id);
 assert.throws(()=>countyPropertyId('c123'),/GlobalID/);
});
test('loads all manifest batches and rejects truncated or changing inventories',async()=>{
 const calls=[],ids=Array.from({length:905},(_,i)=>i+1);
 const fetcher=async (url,options)=>{const p=options.body||new URL(url).searchParams;calls.push(p);return {ok:true,json:async()=>p.has('returnIdsOnly')?{objectIds:ids}:{type:'FeatureCollection',features:p.get('objectIds').split(',').map(n=>feature(Number(n)))}}};
 const result=await loadAddresses(geo,{fetcher});assert.equal(result.rows.length,905);assert.equal(calls.length,4);
 const incomplete=async url=>({ok:true,json:async()=>new URL(url).searchParams.has('returnIdsOnly')?{objectIds:[1,2]}:{type:'FeatureCollection',features:[feature(1)]}});
 await assert.rejects(loadAddresses(geo,{fetcher:incomplete}),/changed during loading/);
 const repeated=async url=>({ok:true,json:async()=>new URL(url).searchParams.has('returnIdsOnly')?{objectIds:[1,2]}:{type:'FeatureCollection',features:[feature(1),feature(1)]}});
 await assert.rejects(loadAddresses(geo,{fetcher:repeated}),/changed during loading/);
});
test('aborted sector requests cannot return old data',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(loadAddresses(geo,{signal:controller.signal,fetcher:async()=>{called=true}}));assert.equal(called,false);
});
