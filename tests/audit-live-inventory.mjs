import {readFile,writeFile} from 'node:fs/promises';
import {addressRows,addressSource,sectorNames} from '../sector-data.mjs';
const features=JSON.parse(await readFile('/tmp/umx-county-audit.geojson')).features;
const boundaries=JSON.parse(await readFile(new URL('../sector-reference/neighborhoods.geojson',import.meta.url)));
const byName=new Map(boundaries.features.map(f=>[f.properties.FeatureName,f.geometry]));
const unique=new Map(),sectors=[];
for(const name of sectorNames){
 const rows=addressRows(features,byName.get(name));
 for(const row of rows)unique.set(row.id,row);
 sectors.push({name,homes:rows.filter(r=>r.kind==='home').length,businesses:rows.filter(r=>r.kind==='biz').length,countyStructureVerified:rows.filter(r=>r.countyStatus===2).length,postalVerified:rows.filter(r=>r.postal===1).length,parcelReferences:rows.filter(r=>r.parcelId).length});
}
const all=[...unique.values()];
const audit={checkedDate:'October 25, 2026',checkedAt:new Date().toISOString(),source:addressSource,boundarySource:'https://services.arcgis.com/HfwHS0BxZBQ1E5DY/ArcGIS/rest/services/Neighborhoods_mso/FeatureServer/0',method:'Complete object-ID manifest, 400-record batches checked against manifest, exact point-in-polygon filtering including holes; stable county GlobalIDs; citywide totals deduplicated.',sourceRecords:features.length,totals:{homes:all.filter(r=>r.kind==='home').length,businesses:all.filter(r=>r.kind==='biz').length,countyStructureVerified:all.filter(r=>r.countyStatus===2).length,postalVerified:all.filter(r=>r.postal===1).length,parcelReferences:all.filter(r=>r.parcelId).length},sectors,umxFieldVerification:false,umxClientAuthorization:false};
await writeFile(new URL('../sector-reference/audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
