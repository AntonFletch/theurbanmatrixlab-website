export const AERIAL = 'https://gisservice.mt.gov/arcgis/rest/services/MSDI_Framework/msdi_naip2025_provisional_image_v1/ImageServer/exportImage';
export const PARCELS = 'https://gisservice.mt.gov/arcgis/rest/services/msdi_cadastral_map_v1/MapServer/1/query';
export const conditions = ['Dry', 'Wet', 'Snow', 'Slush', 'Ice', 'Refreeze risk'];
export const events = ['Inspection', 'Follow-up', 'Pre-treatment', 'Ice treatment', 'Snow removal'];
export function escapeHTML(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function tileBBox({ x, y, z }) { const half = 20037508.342789244, span = 2 * half / 2 ** z; return [x * span - half, half - (y + 1) * span, (x + 1) * span - half, half - y * span]; }
export function imageURL(coords) { return AERIAL + '?' + new URLSearchParams({ f: 'image', bbox: tileBBox(coords).join(','), bboxSR: '3857', imageSR: '3857', size: '256,256', format: 'jpg', bandIds: '0,1,2', interpolation: 'RSP_BilinearInterpolation' }); }
export function parcelURL(bounds) { return PARCELS + '?' + new URLSearchParams({ f: 'geojson', where: '1=1', geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'OBJECTID', returnGeometry: 'true', outSR: '4326', resultRecordCount: '300' }); }
export const denverTime = v => v ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : 'Not recorded';
export function currentHistory(rows) { const replaced = new Set(rows.map(r => r.correction_of).filter(Boolean)); return rows.filter(r => !replaced.has(r.id)).sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at) || Date.parse(b.created_at) - Date.parse(a.created_at)); }
export function summarize(rows) { const active = currentHistory(rows); return { latest: active[0], treatment: active.find(r => r.material && Number(r.quantity) > 0) }; }
export function activeContract(c, now = new Date()) { const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now); const part = name => parts.find(p=>p.type===name).value; const day = part('year')+'-'+part('month')+'-'+part('day'); return Boolean(c && ['active', 'signed'].includes(c.status) && c.signature_status === 'executed' && c.executed_at && c.customer_signed_at && c.umx_signed_at && /^[0-9a-f]{64}$/i.test(c.executed_document_sha256 || '') && (!c.start_date || c.start_date <= day) && (!c.end_date || c.end_date >= day)); }
export function validateRecord(v, now = Date.now()) {
  const errors = [], ground = String(v.ground_f ?? '').trim(), air = String(v.air_f ?? '').trim(), measured = Date.parse(v.measured_at);
  if (!Number.isFinite(measured) || measured > now + 60000) errors.push('Use a valid measurement time, no more than one minute ahead.');
  if (!ground || !Number.isFinite(Number(ground)) || Number(ground) < -70 || Number(ground) > 140) errors.push('Enter a measured pavement temperature from -70 to 140 °F.');
  if (air && (!Number.isFinite(Number(air)) || Number(air) < -70 || Number(air) > 140)) errors.push('Check the optional measured air temperature.');
  if (!conditions.includes(v.surface_condition) || !events.includes(v.event_type)) errors.push('Select a surface condition and event.');
  const qty = Number(v.quantity || 0), area = Number(v.area_sqft || 0);
  if (!Number.isFinite(qty) || qty < 0 || qty > 100000 || !Number.isFinite(area) || area < 0 || area > 10000000) errors.push('Check the quantity and treated area.');
  if (!String(v.method || '').trim() || String(v.method).length > 200) errors.push('Enter the measurement method/device.');
  if (String(v.notes || '').length > 4000 || String(v.material || '').length > 200) errors.push('Shorten the notes or material name.');
  if (['Pre-treatment', 'Ice treatment'].includes(v.event_type) && (!v.material?.trim() || qty <= 0)) errors.push('A treatment needs a material and positive quantity.');
  if ((qty > 0) !== Boolean(v.material?.trim())) errors.push('Enter both a material and positive quantity, or leave both empty.');
  if (qty > 0 && (!['lb', 'gal'].includes(v.unit) || area <= 0)) errors.push('Select lb or gal and enter the treated square feet.');
  return errors;
}
export function csvCell(v) { let text = String(v ?? ''); if (typeof v === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }
export function exportCSV(rows, areas) {
  const fields = ['id', 'area_id', 'property', 'address', 'measured_at', 'ground_f', 'air_f', 'surface_condition', 'event_type', 'method', 'material', 'quantity', 'unit', 'area_sqft', 'rate_per_1000_sqft', 'recorded_by', 'created_at', 'correction_of', 'notes'];
  return [fields.map(csvCell).join(','), ...rows.map(r => fields.map(k => csvCell(k === 'property' ? areas.find(a => a.id === r.area_id)?.property_name : k === 'address' ? areas.find(a => a.id === r.area_id)?.address : k === 'rate_per_1000_sqft' ? (r.quantity > 0 && r.area_sqft > 0 ? (r.quantity * 1000 / r.area_sqft).toFixed(3) : '') : r[k])).join(','))].join('\r\n');
}
export function validGeometry(g) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) return false;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return Array.isArray(polys) && polys.length > 0 && polys.every(poly => Array.isArray(poly) && poly.length > 0 && poly.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -180 && p[0] <= 180 && p[1] >= -85 && p[1] <= 85) && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]));
}
