import { containsPoint } from './geography.mjs';

// Public county inventory hosted by MCGISData; never UMX property/contract IDs.
export const addressSource = 'https://services1.arcgis.com/NQWYt9dWr9BlL9QE/arcgis/rest/services/AddressStructurePoint/FeatureServer/0';
export const addressSourceItem = 'https://www.arcgis.com/home/item.html?id=2cc878f55cbb492c9388026aec382e58';
export function addressKind(type) {
  const value = Number(type);
  if (value >= 1000 && value <= 1020) return 'home';
  if ((value >= 5000 && value < 6000) || value === 2001) return 'biz';
  return null;
}
export function addressQueryURL(geometry, offset = 0, pageSize = 1000) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const points = polygons.flat(2), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const envelope = { xmin: Math.min(...xs), ymin: Math.min(...ys), xmax: Math.max(...xs), ymax: Math.max(...ys), spatialReference: { wkid: 4326 } };
  return addressSource + '/query?' + new URLSearchParams({
    where: 'status <> 4', geometry: JSON.stringify(envelope), geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects', inSR: '4326', outSR: '4326',
    outFields: 'OBJECTID,globalid,fulladdress,structtype,status,postalverified', returnGeometry: 'true',
    resultOffset: String(offset), resultRecordCount: String(pageSize), orderByFields: 'OBJECTID', f: 'geojson'
  });
}
export function addressRows(features, geometry) {
  const rows = new Map();
  for (const feature of features) {
    const p = feature.properties || {}, point = feature.geometry?.coordinates;
    const id = p.globalid || p.OBJECTID || p.objectid, kind = addressKind(p.structtype);
    if (!id || !kind || Number(p.status) === 4 || feature.geometry?.type !== 'Point' || !Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90 || !containsPoint(geometry, point)) continue;
    rows.set(String(id), { id: String(id), address: String(p.fulladdress || '').trim() || '(Unnamed county address)', kind, postal: Number(p.postalverified), type: Number(p.structtype), lat: point[1], lng: point[0] });
  }
  return [...rows.values()].sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }) || a.id.localeCompare(b.id));
}
export async function loadAddresses(geometry, { signal, fetcher = fetch, pageSize = 1000 } = {}) {
  const features = [], seen = new Set();
  for (let offset = 0; offset < 50000; offset += pageSize) {
    signal?.throwIfAborted();
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    let data;
    try {
      const response = await fetcher(addressQueryURL(geometry, offset, pageSize), { signal: controller.signal, mode: 'cors' });
      if (!response.ok) throw Error('County address service HTTP ' + response.status);
      data = await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    signal?.throwIfAborted();
    if (data.error || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw Error('County address service returned an invalid response.');
    const page = data.features, limited = data.exceededTransferLimit ?? data.properties?.exceededTransferLimit;
    let added = 0;
    for (const feature of page) {
      const p = feature.properties || {}, id = p.globalid || p.OBJECTID || p.objectid;
      if (!id) throw Error('County address service returned a record without an identifier.');
      if (!seen.has(String(id))) { seen.add(String(id)); features.push(feature); added++; }
    }
    if (limited === false || (limited !== true && page.length < pageSize)) return addressRows(features, geometry);
    if (!added) throw Error('County address service pagination is incomplete. Retry the neighborhood.');
  }
  throw Error('County address inventory exceeded the request limit. Retry the neighborhood.');
}
