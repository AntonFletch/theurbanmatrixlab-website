import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const file=(name)=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('UMX Field Services is independent and stays in pre-launch',async()=>{
 const html=await file('umx-field-services/index.html');
 assert.match(html,/UMX Field Services/);
 assert.match(html,/NORTHSIDE, MISSOULA ONLY/);
 assert.match(html,/NO BOOKINGS OR PAYMENTS OPEN/);
 assert.match(html,/robots[^>]+noindex/);
 assert.match(html,/Northside property address/);
 assert.match(html,/privacy\.html/);
 assert.doesNotMatch(html,/Book now|Pay now|Guaranteed start date/);
});
test('Public intake uses the existing UMX-only endpoint, never private database keys',async()=>{
 const js=await file('umx-field-services/intake.js');
 assert.match(js,/functions\/v1\/public-service-request/);
 assert.match(js,/rate_limited|response.status===429/);
 assert.match(js,/controller.abort/);
 assert.match(js,/Not a booking/);
 assert.doesNotMatch(js,/service_role|sb_secret_|veil_clients|mx_ops/);
});
test('Map requires a manual staff matching step and an explicit pending-status save',async()=>{
 const html=await file('map.html'),code=await file('sector-command.js');
 for(const id of ['request-match-search','request-to-link','link-inquiry','linked-inquiries'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(code,/from\('umx_northside_inquiry_links'\)\.insert/);
 assert.match(code,/state\.sector!=='Northside'/);
 assert.match(code,/Save the Pending reply status/);
 assert.match(code,/readAllStaffRows/);
});
test('Parent site retains distinct business links and the artist',async()=>{
 const tech=await file('index.html');
 for(const link of ['/umx-field-services/','/mx-continuity/','/mx-visibility/'])assert.ok(tech.includes(link));
 assert.match(tech,/Jeremy Emmons/);
});