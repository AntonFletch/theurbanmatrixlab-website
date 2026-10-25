import test from 'node:test';
import assert from 'node:assert/strict';
import {readFlags,writeFlag} from '../sector-sync.mjs';
test('status history loads beyond the API row limit without crossing owners or sectors',async()=>{
 const filters=[];let pages=0;
 const client={from(){return {
  select(){return this},eq(k,v){filters.push([k,v]);return this},order(){return this},
  async range(start,end){pages++;return {data:Array.from({length:start?7:1000},(_,i)=>({property_id:String(start+i)}))}}
 }}};
 const flags=await readFlags(client,'owner-a','Northside');assert.equal(flags.size,1007);assert.equal(pages,2);
 assert.deepEqual(filters,[['sector','Northside'],['user_id','owner-a'],['sector','Northside'],['user_id','owner-a']]);
});
test('another device cannot silently overwrite a newer saved status',async()=>{
 const filters=[];let inserted=false;
 const client={from(){return {update(){return this},insert(){inserted=true;return this},eq(k,v){filters.push([k,v]);return this},select(){return this},async maybeSingle(){return {data:null,error:null}}}}};
 await assert.rejects(writeFlag(client,{user_id:'a',property_id:'p'},{updated_at:'old-version'}),/Another device/);
 assert.equal(inserted,false);assert.deepEqual(filters,[['user_id','a'],['property_id','p'],['updated_at','old-version']]);
});
test('failed database requests never produce a saved result',async()=>{
 const client={from(){return {insert(){return this},select(){return this},async maybeSingle(){return {data:null,error:{message:'Offline'}}}}}};
 await assert.rejects(writeFlag(client,{user_id:'a',property_id:'p'}),e=>e.message==='Offline');
});
