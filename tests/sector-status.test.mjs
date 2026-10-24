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
test('Sector Command keeps its locked controls and the obsolete preview routes to that workspace',async()=>{
 const html=await readFile(new URL('../map.html',import.meta.url),'utf8'),css=await readFile(new URL('../sector-command.css',import.meta.url),'utf8');
 for(const id of ['flag-contacted','flag-declined','flag-excluded','flag-active','flag-vip','sector-cards','print-contract'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('class="stamp"'));assert.ok(css.includes('.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
 const routes=await readFile(new URL('../_redirects',import.meta.url),'utf8');assert.ok(routes.includes('/winter-command-preview/map-check /map 302'));assert.ok(routes.includes('/winter-command-preview/map-check.html /map 302'));
});
