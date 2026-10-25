// Published by Missoula County GIS. County records are inventory, not UMX clients.
export const addressSource = 'https://services1.arcgis.com/NQWYt9dWr9BlL9QE/arcgis/rest/services/AddressStructurePoint/FeatureServer/0';
export const boundarySource = 'https://services.arcgis.com/HfwHS0BxZBQ1E5DY/ArcGIS/rest/services/Neighborhoods_mso/FeatureServer/0/query';
export const sectorNames = ['Northside','Westside','Captain John Mullan','Grant Creek','Upper Rattlesnake','Lower Rattlesnake','Marshall Canyon','Heart of Missoula','Riverfront','River Road','Two Rivers','Franklin to the Fort','Rose Park','University District','Lewis & Clark','Southgate Triangle','South 39th Street','Moose Can Gully','Miller Creek','Farviews / Pattee Canyon'];
export const geometryRings = geo => geo.type === 'Polygon' ? geo.coordinates : geo.coordinates.flat();
export function pointInRing(point, ring) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    const cross=(point[0]-a[0])*(b[1]-a[1])-(point[1]-a[1])*(b[0]-a[0]);
    if (Math.abs(cross)<1e-12 && point[0]>=Math.min(a[0],b[0]) && point[0]<=Math.max(a[0],b[0]) && point[1]>=Math.min(a[1],b[1]) && point[1]<=Math.max(a[1],b[1])) return true;
    if ((a[1]>point[1]) !== (b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function containsPoint(geo, point) {
  const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.coordinates;
  return polygons.some(p=>pointInRing(point,p[0])&&!p.slice(1).some(h=>pointInRing(point,h)));
}
export function sectorMask(geo) {
  const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.coordinates;
  const world=[[-180,-85],[-180,85],[180,85],[180,-85],[-180,-85]];
  return {type:'MultiPolygon',coordinates:[[world,...polygons.map(p=>p[0])],...polygons.flatMap(p=>p.slice(1).map(h=>[h]))]};
}
export async function getJSON(url,{signal,fetcher=fetch,form}={}) {
  signal?.throwIfAborted();
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,25000);
  try {
    const response=await fetcher(url,{signal:controller.signal,mode:'cors',...(form?{method:'POST',body:new URLSearchParams(form)}:{})});
    if(!response.ok)throw Error('GIS service HTTP '+response.status);
    const data=await response.json();
    if(data.error)throw Error(data.error.message||'GIS service error');
    signal?.throwIfAborted();
    return data;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function loadBoundaries(options={}) {
  let data,reference=false;
  try {
    data=await getJSON(boundarySource+'?'+new URLSearchParams({where:'1=1',outFields:'FeatureName',returnGeometry:'true',outSR:'4326',f:'geojson'}),options);
  } catch(error) {
    options.signal?.throwIfAborted();
    data=await getJSON(new URL('./sector-reference/neighborhoods.geojson',import.meta.url),options);reference=true;
  }
  const boundaries=Object.fromEntries((data.features||[]).map(f=>[f.properties?.FeatureName,f.geometry]));
  if(sectorNames.some(n=>!['Polygon','MultiPolygon'].includes(boundaries[n]?.type)))throw Error('City neighborhood boundaries are incomplete');
  return {boundaries,reference};
}
export function countyPropertyId(value) {
  const id=String(value||'').replace(/^\{|\}$/g,'').toLowerCase();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw Error('County record has no stable GlobalID');
  return 'county:'+id;
}
export function addressKind(type) {
  const n=Number(type);
  if(n>=1000&&n<=1020)return 'home';
  if((n>=5000&&n<6000)||n===2001)return 'biz';
  return null;
}
export function addressRows(features,geo) {
  const rows=new Map();
  for(const feature of features) {
    const p=feature.properties||{},point=feature.geometry?.coordinates,kind=addressKind(p.structtype);
    if(!kind||Number(p.status)===4||feature.geometry?.type!=='Point'||!Array.isArray(point)||!point.slice(0,2).every(Number.isFinite)||point.length<2||!containsPoint(geo,point))continue;
    const id=countyPropertyId(p.globalid);
    rows.set(id,{id,address:String(p.fulladdress||'').trim()||'(Unnamed county address)',kind,postal:Number(p.postalverified),countyStatus:Number(p.status),parcelId:String(p.parcelid||''),type:Number(p.structtype),lat:point[1],lng:point[0],objectId:Number(p.OBJECTID??p.objectid)});
  }
  return [...rows.values()].sort((a,b)=>a.address.localeCompare(b.address,undefined,{numeric:true})||a.id.localeCompare(b.id));
}
export function addressEnvelope(geo) {
  const coords=geometryRings(geo).flat(),xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
  return {xmin:Math.min(...xs),ymin:Math.min(...ys),xmax:Math.max(...xs),ymax:Math.max(...ys),spatialReference:{wkid:4326}};
}
export async function loadAddresses(geo,options={}) {
  const common={where:'(status IS NULL OR status <> 4)',geometry:JSON.stringify(addressEnvelope(geo)),geometryType:'esriGeometryEnvelope',spatialRel:'esriSpatialRelIntersects',inSR:'4326'};
  const manifest=await getJSON(addressSource+'/query?'+new URLSearchParams({...common,returnIdsOnly:'true',f:'json'}),options);
  if(!Array.isArray(manifest.objectIds)||manifest.exceededTransferLimit)throw Error('County address inventory is incomplete');
  const ids=[...new Set(manifest.objectIds)].sort((a,b)=>a-b),features=[];
  for(let start=0;start<ids.length;start+=400) {
    const batch=ids.slice(start,start+400);
    const data=await getJSON(addressSource+'/query',{...options,form:{objectIds:batch.join(','),outFields:'OBJECTID,globalid,fulladdress,structtype,status,postalverified,parcelid',returnGeometry:'true',outSR:'4326',f:'geojson'}});
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('County address batch is incomplete');
    const returned=new Set(data.features.map(f=>Number(f.properties?.OBJECTID??f.properties?.objectid)));
    if(returned.size!==batch.length||batch.some(id=>!returned.has(id)))throw Error('County inventory changed during loading. Reload this sector.');
    features.push(...data.features);
    options.onProgress?.(Math.min(start+batch.length,ids.length),ids.length);
  }
  const rows=addressRows(features,geo);
  return {rows,checkedAt:new Date().toISOString(),sourceRecords:ids.length};
}
