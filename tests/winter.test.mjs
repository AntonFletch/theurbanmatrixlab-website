import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord, summarize, currentHistory, imageURL, tileBBox, parcelURL, csvCell, exportCSV, activeContract, validGeometry, denverTime } from '../winter-command-preview/core.mjs';
const valid = { measured_at: '2026-10-23T20:00:00Z', ground_f: '28', air_f: '', surface_condition: 'Ice', event_type: 'Inspection', method: 'IR thermometer', quantity: '', material: '', area_sqft: '', notes: '' };
const now = Date.parse('2026-10-24T00:00:00Z');
test('manual readings reject blank, NaN, infinity, impossible temperatures and future time', () => {
  assert.deepEqual(validateRecord(valid, now), []);
  for (const bad of ['', ' ', 'NaN', 'Infinity', '141', '-71']) assert.ok(validateRecord({ ...valid, ground_f: bad }, now).length);
  assert.ok(validateRecord({ ...valid, measured_at: '2026-10-24T01:00:00Z' }, now).length);
  assert.ok(validateRecord({ ...valid, method: ' ' }, now).length);
});
test('treatment requires material, amount, correct unit, and treatment area', () => {
  const treatment = { ...valid, event_type: 'Ice treatment', material: 'CMA', quantity: 3, unit: 'lb', area_sqft: 600 };
  assert.deepEqual(validateRecord(treatment, now), []);
  for (const change of [{ quantity: 0 }, { material: '' }, { area_sqft: 0 }, { unit: 'kg' }, { quantity: -1 }]) assert.ok(validateRecord({ ...treatment, ...change }, now).length);
  assert.ok(validateRecord({ ...valid, material: 'CMA', quantity: 0 }, now).length);
});
test('later inspection does not erase latest deicer; corrections supersede but preserve originals', () => {
  const rows = [
    { id: 'a', measured_at: '2026-10-23T16:00:00Z', material: 'CMA', quantity: 2 },
    { id: 'b', measured_at: '2026-10-23T17:00:00Z', material: null, quantity: 0 },
    { id: 'c', correction_of: 'a', measured_at: '2026-10-23T16:00:00Z', material: 'CMA', quantity: 3 }
  ];
  assert.equal(summarize(rows).latest.id, 'b'); assert.equal(summarize(rows).treatment.id, 'c'); assert.equal(currentHistory(rows).length, 2); assert.equal(rows.length, 3);
  const correction = { id: 'd', correction_of: 'c', measured_at: '2026-10-23T16:00:00Z', material: null, quantity: 0 };
  assert.equal(summarize([...rows, correction]).treatment, undefined);
});
test('map tiles use Web Mercator extent and explicit true-color bands', () => {
  const bbox = tileBBox({ x: 0, y: 0, z: 0 }); assert.ok(Math.abs(bbox[0] + 20037508.342789244) < .01); assert.ok(Math.abs(bbox[3] - 20037508.342789244) < .01);
  const left = tileBBox({ x: 12345, y: 23123, z: 16 }), right = tileBBox({ x: 12346, y: 23123, z: 16 }); assert.ok(Math.abs(left[2] - right[0]) < .001);
  const url = new URL(imageURL({ x: 12345, y: 23123, z: 16 })); assert.equal(url.searchParams.get('bboxSR'), '3857'); assert.equal(url.searchParams.get('bandIds'), '0,1,2');
  assert.equal(new URL(parcelURL([-114, 46.8, -113.9, 46.9])).searchParams.get('outSR'), '4326');
});
test('CSV contains UTC, units, area, correction and neutralizes spreadsheet formulas', () => {
  for (const text of ['=CMD()', '+SUM(A1)', '@SUM(A1)', '  =bad', '-2+3']) assert.ok(csvCell(text).startsWith('"\''));
  const csv = exportCSV([{ ...valid, id: 'x', area_id: 'p', quantity: 3, area_sqft: 600, notes: 'a,"b"\nline' }], [{ id: 'p', property_name: 'Property', address: 'Test address' }]);
  assert.ok(csv.includes('Property')); assert.ok(csv.includes('Test address')); assert.ok(csv.includes('5.000')); assert.ok(csv.includes('correction_of')); assert.ok(csv.includes('2026-10-23T20:00:00Z')); assert.ok(csv.includes('""b""'));
});
test('an accepted label without executed signatures never becomes a current client', () => {
  const c = { status: 'active', signature_status: 'executed', executed_at: '2026-10-23', customer_signed_at: '2026-10-23', umx_signed_at: '2026-10-23', executed_document_sha256: 'a'.repeat(64), start_date: '2026-10-01', end_date: '2026-12-01' };
  assert.equal(activeContract(c, new Date(now)), true);
  for (const change of [{ signature_status: 'draft' }, { executed_at: null }, { status: 'cancelled' }, { end_date: '2026-10-01' }]) assert.equal(activeContract({ ...c, ...change }, new Date(now)), false);
});
test('geographic scope needs closed finite rings; display uses Denver timezone', () => {
  const ring = [[-114,46],[-113,46],[-113,47],[-114,46]];
  assert.equal(validGeometry({ type: 'Polygon', coordinates: [ring] }), true);
  assert.equal(validGeometry({ type: 'Polygon', coordinates: [ring.slice(0, 3)] }), false);
  assert.equal(validGeometry({ type: 'Point', coordinates: [-114,46] }), false);
  assert.equal(validGeometry({ type: 'Polygon', coordinates: [[[Infinity, 46], ...ring]] }), false);
  assert.ok(denverTime('2026-10-24T00:00:00Z').includes('Oct 23'));
});

import {readFile} from 'node:fs/promises';
import {sectorNames,containsPoint,sectorMask,closedScope} from '../winter-command-preview/geography.mjs';
test('all twenty approved neighborhood names resolve to the official saved boundaries',async()=>{
 const data=JSON.parse(await readFile(new URL('../winter-command-preview/neighborhoods.geojson',import.meta.url),'utf8'));
 assert.equal(data.features.length,20);assert.deepEqual(new Set(data.features.map(f=>f.properties.FeatureName)),new Set(sectorNames));
 for(const feature of data.features){const mask=sectorMask(feature.geometry);assert.equal(mask.type,'MultiPolygon');assert.ok(mask.coordinates[0].length>=2);}
});
test('sector point selection respects islands, interior holes and exterior edges',()=>{
 const geo={type:'MultiPolygon',coordinates:[[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]],[[[6,0],[7,0],[7,1],[6,1],[6,0]]]]};
 assert.equal(containsPoint(geo,[.5,.5]),true);assert.equal(containsPoint(geo,[1.5,1.5]),false);assert.equal(containsPoint(geo,[6.5,.5]),true);assert.equal(containsPoint(geo,[5,.5]),false);assert.equal(sectorMask(geo).coordinates.length,2);
});
test('drawn scopes close automatically and reject crossing edges or collapsed areas',()=>{
 assert.equal(closedScope([[0,0],[1,0]]),null);
 const drawn=closedScope([[-114,46],[-113.99,46],[-113.99,46.01]]);assert.equal(validGeometry(drawn),true);assert.deepEqual(drawn.coordinates[0][0],drawn.coordinates[0].at(-1));
 assert.equal(validGeometry(closedScope([[0,0],[1,1],[0,1],[1,0]])),false);
 assert.equal(validGeometry(closedScope([[0,0],[1,0],[2,0]])),false);
});
