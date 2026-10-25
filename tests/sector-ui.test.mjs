import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('locked map layout, color controls and all 20 sectors remain available',async()=>{
 const html=await readFile(new URL('../map.html',import.meta.url),'utf8');
 for(const id of ['flag-contacted','flag-declined','flag-excluded','flag-active','flag-vip','sector-cards','print-contract','streets','satellite','tilt-view'])assert.ok(html.includes('id="'+id+'"'));
 const {sectorNames}=await import('../sector-data.mjs');assert.equal(sectorNames.length,20);
 const data=JSON.parse(await readFile(new URL('../sector-reference/neighborhoods.geojson',import.meta.url)));
 assert.deepEqual(new Set(data.features.map(f=>f.properties.FeatureName)),new Set(sectorNames));
});
