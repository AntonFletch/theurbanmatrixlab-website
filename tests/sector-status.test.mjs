import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {propertyFlags,propertyColor,propertyStatus,countyPropertyId} from '../sector-status.mjs';
const home={id:'803fbaa2-aeb7-4625-92e5-5da65c59f1dd',kind:'home',type:1001,postal:1}, business={...home,kind:'biz',type:5085};
test('locked outreach colors, independent VIP stars and hospital exclusion are preserved',()=>{
 assert.equal(propertyColor(home),'#49a9ff');assert.equal(propertyColor(business),'#a876ed');
 assert.equal(propertyColor(home,{contacted:true}),'#f5c75c');assert.equal(propertyColor(business,{active_business:true}),'#08df8b');
 assert.equal(propertyColor(business,{active_business:true,contacted:true}),'#08df8b');assert.equal(propertyStatus(business,{active_business:true,contacted:true}),'Operating confirmed');
 assert.equal(propertyColor(business,{active_business:true,declined:true,vip:true}),'#ff273b');assert.equal(propertyFlags(business,{declined:true,vip:true}).vip,true);
 assert.equal(propertyColor(business,{excluded:true,active_business:true}),'#7c8798');assert.equal(propertyColor({...business,type:2001}),'#7c8798');
 assert.equal(propertyColor(home,{active_business:true}),'#49a9ff');assert.equal(propertyStatus(home,{vip:true}),'★ VIP');
 assert.equal(propertyFlags({...home,postal:3}).postal,false);
});
test('private outreach status uses stable county GlobalIDs and never guesses legacy numeric IDs',()=>{
 assert.equal(countyPropertyId(home),'county:803fbaa2-aeb7-4625-92e5-5da65c59f1dd');
 assert.equal(countyPropertyId({id:'{803FBAA2-AEB7-4625-92E5-5DA65C59F1DD}'}),countyPropertyId(home));
 for(const id of ['6624','c6624','',undefined])assert.throws(()=>countyPropertyId({id}),/stable GlobalID/);
});
