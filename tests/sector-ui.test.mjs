import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('locked map layout, color controls and all 20 sectors remain available',async()=>{
 const html=await readFile(new URL('../map.html',import.meta.url),'utf8');
 for(const id of ['flag-contacted','flag-pending','property-history','flag-declined','flag-excluded','flag-active','flag-vip','sector-cards','print-contract','streets','satellite','tilt-view'])assert.ok(html.includes('id="'+id+'"'));
 const {sectorNames}=await import('../sector-data.mjs');assert.equal(sectorNames.length,20);
 const data=JSON.parse(await readFile(new URL('../sector-reference/neighborhoods.geojson',import.meta.url)));
 assert.deepEqual(new Set(data.features.map(f=>f.properties.FeatureName)),new Set(sectorNames));
});

test('Northside map inquiry matching remains staff-controlled',async()=>{
 const html=await readFile(new URL('../map.html',import.meta.url),'utf8');
 const code=await readFile(new URL('../sector-command.js',import.meta.url),'utf8');
 for(const id of ['request-match-search','request-to-link','link-inquiry','linked-inquiries'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(code,/from\('umx_northside_inquiry_links'\)\.insert/);
 assert.match(code,/state\.sector!=='Northside'/);
 assert.match(code,/Save the Pending reply status/);
 assert.match(code,/readAllStaffRows/);
});
