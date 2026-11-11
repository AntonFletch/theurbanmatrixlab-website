import test from 'node:test';
import assert from 'node:assert/strict';
import {readFlags,writeFlag} from '../sector-sync.mjs';
test('company-wide Northside history is paginated without filtering by individual user',async()=>{
 const filters=[];let pages=0;const tables=[];
 const client={from(name){tables.push(name);return {
  select(){return this},eq(k,v){filters.push([k,v]);return this},order(){return this},
  async range(start,end){pages++;return {data:Array.from({length:start?7:1000},(_,i)=>({property_id:String(start+i)}))}}
 }}};
 const flags=await readFlags(client,'Northside');
 assert.equal(flags.size,1007);assert.equal(pages,2);
 assert.deepEqual(tables,['umx_northside_statuses','umx_northside_statuses']);
 assert.deepEqual(filters,[['sector','Northside'],['sector','Northside']]);
});
test('other sectors cannot write until expansion is authorized',async()=>{
 await assert.rejects(readFlags({},'Downtown'),/Only Northside/);
 await assert.rejects(writeFlag({}, {sector:'Downtown'},null),/Only Northside/);
});
test('a concurrent team update cannot silently overwrite a newer version',async()=>{
 const filters=[];let inserted=false;
 const client={from(){return {update(){return this},insert(){inserted=true;return this},eq(k,v){filters.push([k,v]);return this},select(){return this},async maybeSingle(){return {data:null,error:null}}}}};
 await assert.rejects(writeFlag(client,{updated_by:'a',property_id:'p',sector:'Northside'},{updated_at:'old-version'}),/Another staff member/);
 assert.equal(inserted,false);assert.deepEqual(filters,[['property_id','p'],['updated_at','old-version']]);
});
test('failed database requests never produce a saved result',async()=>{
 const client={from(){return {insert(){return this},select(){return this},async maybeSingle(){return {data:null,error:{message:'Offline'}}}}}};
 await assert.rejects(writeFlag(client,{updated_by:'a',property_id:'p',sector:'Northside'}),e=>e.message==='Offline');
});
