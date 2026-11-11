import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyFlags,propertyColor,propertyStatus,countyPropertyId} from '../sector-status.mjs';
const home={id:'803fbaa2-aeb7-4625-92e5-5da65c59f1dd',kind:'home',type:1001,postal:1},
 business={...home,kind:'biz',type:5085};
test('gray unverified, yellow outreach/pending, green customers, red declined, independent VIP',()=>{
 assert.equal(propertyColor(home),'#9199a7');
 assert.equal(propertyColor(business),'#9199a7');
 assert.equal(propertyColor(home,{contacted:true}),'#f0bd3e');
 assert.equal(propertyColor(business,{pending:true}),'#f0bd3e');
 assert.equal(propertyStatus(business,{pending:true}),'Pending reply');
 assert.equal(propertyColor(business,{active_business:true}),'#35bb7b');
 assert.equal(propertyColor(home,{active_business:true}),'#35bb7b');
 assert.equal(propertyStatus(home,{active_business:true}),'Active UMX client');
 assert.equal(propertyColor(business,{active_business:true,declined:true,vip:true}),'#e76168');
 assert.equal(propertyFlags(business,{declined:true,vip:true}).vip,true);
 assert.equal(propertyColor(business,{excluded:true,active_business:true}),'#7c8798');
 assert.equal(propertyColor({...business,type:2001}),'#7c8798');
 assert.equal(propertyFlags({...home,postal:3}).postal,false);
});
test('private outreach status uses stable county GlobalIDs and never guesses legacy numeric IDs',()=>{
 assert.equal(countyPropertyId(home),'county:803fbaa2-aeb7-4625-92e5-5da65c59f1dd');
 assert.equal(countyPropertyId({id:'{803FBAA2-AEB7-4625-92E5-5DA65C59F1DD}'}),countyPropertyId(home));
 for(const id of ['6624','c6624','',undefined])assert.throws(()=>countyPropertyId({id}),/stable GlobalID/);
});
