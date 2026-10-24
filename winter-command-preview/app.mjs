import { supabase, authorize } from '../umx-auth.js';
import { escapeHTML as esc, denverTime, summarize, currentHistory, validateRecord, exportCSV, activeContract, validGeometry } from './core.mjs';
import { createMap } from './map.mjs';
const $ = id => document.getElementById(id);
const state = { auth: null, areas: [], records: [], selected: null, map: null, busy: false, ready: false, locked: false, draft: null, pending: null };
const areaActive = a => Boolean(a?.enabled && a.contract_active);
const selected = () => state.areas.find(a => a.id === state.selected);
const history = id => state.records.filter(r => r.area_id === id);
function lock() {
  state.locked = true; state.areas = []; state.records = []; state.auth = null; state.ready = false; state.draft = null; state.pending = null;
  state.map?.clients.clearLayers(); state.map?.map.remove(); state.map = null;
  document.querySelectorAll('dialog').forEach(d => d.close()); $('record-form').reset();
  $('property-list').replaceChildren(); $('history').replaceChildren(); $('summary').replaceChildren();
  $('selected-name').textContent = 'Select a service area'; $('selected-address').textContent = '';
  $('app').hidden = true; $('lock').hidden = false;
  $('lock').querySelector('[role=status]').textContent = 'Your access changed or expired. Sign in again.';
}
async function pages(table, fields = '*', order = 'id') {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(fields).order(order).range(offset, offset + 499);
    if (error) throw error; all.push(...data); if (data.length < 500) return all;
    if (all.length >= 100000) throw Error('History exceeds the interactive limit. Request a scoped export.');
  }
}
async function refresh() {
  if (state.busy || !state.auth || state.locked) return; state.busy = true; $('refresh').disabled = true;
  try {
    const areas = await pages('winter_area_status'), records = await pages('winter_records');
    if (state.locked) return; state.areas = areas; state.records = records; state.ready = true;
    if (!selected()) state.selected = areas[0]?.id || null;
    $('sync').textContent = 'Synced with UMX OS · ' + denverTime(new Date()) + (areas.length ? ' · refreshes every 30 seconds' : ' · No verified service areas yet. Add a property and executed contract in Owner Command, then verify its service scope.');
    render();
  } catch (error) { state.ready = false; $('sync').textContent = 'Sync unavailable — records may be stale; saving disabled. ' + error.message; $('log-check').disabled = true; }
  finally { state.busy = false; $('refresh').disabled = false; }
}
function tooltip(area) {
  const { latest, treatment } = summarize(history(area.id));
  return '<strong>' + esc(area.property_name) + '</strong><p>' + (areaActive(area) ? 'Current verified service area' : 'Inactive — do not dispatch') + '</p><p>Pavement: ' + (latest ? esc(latest.ground_f) + ' °F · ' + esc(denverTime(latest.measured_at)) : 'Not measured') + '</p><p>Last material: ' + (treatment ? esc(treatment.material) + ' · ' + esc(treatment.quantity) + ' ' + esc(treatment.unit) + ' · ' + esc(denverTime(treatment.measured_at)) : 'None recorded') + '</p>';
}
function render() {
  $('area-count').textContent = state.areas.filter(areaActive).length; $('record-count').textContent = state.records.length;
  const query = $('search').value.toLowerCase().trim(), filter = $('status-filter').value;
  const areas = state.areas.filter(a => (!query || (a.property_name + ' ' + a.address).toLowerCase().includes(query)) && (filter === 'all' || areaActive(a) === (filter === 'active')));
  $('property-list').replaceChildren(); state.map?.clients.clearLayers();
  for (const area of areas) {
    const button = document.createElement('button'); button.className = 'property';
    const name = document.createElement('span'); name.textContent = area.property_name;
    const badge = document.createElement('span'); badge.className = areaActive(area) ? 'active' : 'inactive'; badge.textContent = areaActive(area) ? '● Current' : '✕ Inactive';
    button.append(name, badge); button.onclick = () => choose(area.id); $('property-list').append(button);
    if (state.map && validGeometry(area.geometry)) {
      const color = areaActive(area) ? '#4be99d' : '#ff304e';
      const layer = L.geoJSON(area.geometry, { pane: 'clients', style: { color, weight: area.id === state.selected ? 4 : 2, fillColor: color, fillOpacity: .15 } }).addTo(state.map.clients);
      layer.bindTooltip(tooltip(area), { sticky: true }); layer.on('click', () => choose(area.id));
      if (!areaActive(area)) { const b = layer.getBounds(); L.polyline([b.getSouthWest(), b.getNorthEast()], { pane: 'clients', color, weight: 3, interactive: false }).addTo(state.map.clients); L.polyline([b.getNorthWest(), b.getSouthEast()], { pane: 'clients', color, weight: 3, interactive: false }).addTo(state.map.clients); }
    }
  }
  if (!areas.length) { const p = document.createElement('p'); p.textContent = state.areas.length ? 'No service areas match your filter.' : 'No client areas are approved yet. The aerial map shows reference imagery only.'; $('property-list').append(p); }
  renderDetails();
}
function choose(id) { state.selected = id; const a = selected(); if (state.map && a) state.map.map.fitBounds(L.geoJSON(a.geometry).getBounds(), { maxZoom: 19, padding: [35, 35] }); render(); }
function renderDetails() {
  const a = selected(); $('summary').replaceChildren(); $('history').replaceChildren();
  $('selected-name').textContent = a?.property_name || 'Select a service area'; $('selected-address').textContent = a?.address || '';
  $('log-check').disabled = !a || !areaActive(a) || !state.ready;
  if (!a) return;
  const rows = history(a.id), { latest, treatment } = summarize(rows), activeIDs = new Set(currentHistory(rows).map(r => r.id));
  $('summary').innerHTML = '<div class="reading"><strong>' + (latest ? esc(latest.ground_f) + ' °F' : 'No pavement reading') + '</strong><small>' + (latest ? esc(denverTime(latest.measured_at)) + ' · manual · ' + esc(latest.method) : 'A ground measurement is required') + '</small></div><div class="reading"><strong>' + (treatment ? esc(treatment.quantity) + ' ' + esc(treatment.unit) + ' ' + esc(treatment.material) : 'No treatment recorded') + '</strong><small>' + (treatment ? esc(denverTime(treatment.measured_at)) : 'No application amount is assumed') + '</small></div><p class="' + (areaActive(a) ? 'active' : 'inactive') + '">' + (areaActive(a) ? 'Current executed contract' : 'Inactive — do not dispatch') + '</p><p>' + esc(a.service_scope) + '</p><p class="fine">Boundary: ' + esc(a.geometry_source) + '<br>Verified ' + esc(denverTime(a.verified_at)) + '</p>';
  if (state.auth.staff) {
    const disable = document.createElement('button'); disable.textContent = a.enabled ? 'Disable service area' : 'Re-enable verified area';
    disable.onclick = async () => { disable.disabled = true; const { error } = await supabase.from('winter_service_areas').update({ enabled: !a.enabled }).eq('id', a.id); if (error) $('sync').textContent = 'Area status not saved. ' + error.message; await refresh(); }; $('summary').append(disable);
    const assign = document.createElement('button'); assign.textContent = 'Worker access'; assign.onclick = () => void workerAccess(a); $('summary').append(assign);
  }
  for (const row of [...rows].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at))) {
    const div = document.createElement('div'); div.className = 'historyrow' + (activeIDs.has(row.id) ? '' : ' superseded');
    const heading = document.createElement('strong'); heading.textContent = row.ground_f + ' °F · ' + row.event_type;
    const detail = document.createElement('p'); detail.textContent = denverTime(row.measured_at) + ' · ' + row.surface_condition + '\nManual · ' + row.method + (row.material ? '\n' + row.quantity + ' ' + row.unit + ' ' + row.material + ' / ' + row.area_sqft + ' sq ft' : '') + '\n' + row.notes + (row.correction_of ? '\nCorrection of ' + row.correction_of : '') + (!activeIDs.has(row.id) ? '\nSuperseded; original preserved' : '');
    div.append(heading, detail);
    if (activeIDs.has(row.id) && areaActive(a)) { const correct = document.createElement('button'); correct.textContent = 'Add correction'; correct.onclick = () => openRecord(row); div.append(correct); }
    $('history').append(div);
  }
}
function openRecord(previous) {
  const a = selected(); if (!a || !areaActive(a) || !state.ready) return;
  const form = $('record-form'); form.reset(); form.querySelectorAll('input,select,textarea').forEach(e => e.disabled = false);
  const date = previous ? new Date(previous.measured_at) : new Date();
  form.elements.measured_at.value = new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (previous) for (const key of ['ground_f', 'air_f', 'surface_condition', 'event_type', 'method', 'material', 'quantity', 'unit', 'area_sqft']) if (previous[key] != null) form.elements[key].value = previous[key];
  state.draft = { id: crypto.randomUUID(), area_id: a.id, correction_of: previous?.id || null }; state.pending = null;
  $('record-property').textContent = a.property_name + (previous ? ' · correction; original preserved' : ''); $('record-status').textContent = ''; $('record-dialog').showModal();
}
async function saveRecord(event) {
  event.preventDefault(); const form = $('record-form'), button = $('save-record'); if (button.disabled || !state.draft || !state.auth) return;
  if (!state.pending) {
    const v = Object.fromEntries(new FormData(form)); v.measured_at = new Date(v.measured_at).toISOString(); const errors = validateRecord(v);
    if (state.draft.correction_of && v.notes.trim().length < 5) errors.push('Explain what this correction changes.');
    if (errors.length) { $('record-status').textContent = errors.join('\n'); return; }
    state.pending = { ...state.draft, measured_at: v.measured_at, ground_f: Number(v.ground_f), air_f: v.air_f === '' ? null : Number(v.air_f), surface_condition: v.surface_condition, event_type: v.event_type, method: v.method.trim(), material: v.material.trim() || null, quantity: Number(v.quantity || 0), unit: Number(v.quantity) > 0 ? v.unit : null, area_sqft: v.area_sqft ? Number(v.area_sqft) : null, notes: v.notes.trim(), recorded_by: state.auth.user.id };
  }
  const payload = state.pending; button.disabled = true; $('record-status').textContent = 'Saving…';
  form.querySelectorAll('input,select,textarea').forEach(e => e.disabled = true);
  try {
    const { error } = await supabase.from('winter_records').insert(payload);
    if (error) {
      // A retry following a lost response must find the original identical record.
      if (error.code !== '23505') throw error;
      const { data, error: re } = await supabase.from('winter_records').select('*').eq('id', payload.id).maybeSingle();
      if (re || !data || Object.keys(payload).some(k => k === 'measured_at' ? Date.parse(data[k]) !== Date.parse(payload[k]) : data[k] !== payload[k])) throw Error('Could not confirm this submission. Refresh history before creating another.');
    }
    if (state.locked) return; state.draft = null; state.pending = null; $('record-dialog').close(); form.reset(); await refresh();
  } catch (error) { if (!state.locked) $('record-status').textContent = 'Save not confirmed. Retry sends the same record ID and content. ' + error.message; }
  finally { button.disabled = false; }
}
async function setupArea() {
  $('area-form').reset(); $('area-status').textContent = 'Loading existing properties and executed contracts…'; $('area-dialog').showModal();
  try {
    const properties = await pages('umx_properties', 'id,name,address,latitude,longitude'), contracts = (await pages('umx_contracts')).filter(c => activeContract(c));
    for (const [id, rows, label] of [['setup-property', properties.filter(p => p.latitude != null && p.longitude != null), p => p.name + ' · ' + p.address], ['setup-contract', contracts, c => c.contract_title + ' · ' + (c.service_location || 'scope must be verified')]]) {
      $(id).replaceChildren(); const first = document.createElement('option'); first.value = ''; first.textContent = 'Select…'; $(id).append(first);
      rows.forEach(row => { const option = document.createElement('option'); option.value = row.id; option.textContent = label(row); $(id).append(option); });
    }
    $('area-status').textContent = !properties.length || !contracts.length ? 'Create a property with verified coordinates and an executed current contract in Owner Command first. No examples will be imported.' : 'Confirm the property matches the signed contract and exact service scope.';
  } catch (error) { $('area-status').textContent = 'Setup unavailable. ' + error.message; }
}
async function saveArea(event) {
  event.preventDefault(); const form = $('area-form'), button = form.querySelector('[type=submit]'); if (button.disabled) return;
  try {
    const values = Object.fromEntries(new FormData(form)), geometry = JSON.parse(values.geometry);
    if (!validGeometry(geometry)) throw Error('Enter a closed GeoJSON Polygon or MultiPolygon in longitude/latitude order.');
    button.disabled = true;
    const { error } = await supabase.from('winter_service_areas').insert({ property_id: $('setup-property').value, contract_id: $('setup-contract').value, geometry, geometry_source: values.geometry_source.trim(), service_scope: values.service_scope.trim(), verified_by: state.auth.user.id });
    if (error) throw error; $('area-dialog').close(); await refresh();
  } catch (error) { $('area-status').textContent = 'Area not saved. ' + error.message; }
  finally { button.disabled = false; }
}
async function workerAccess(area) {
  const dialog = document.createElement('dialog'), title = document.createElement('h2'), close = document.createElement('button'), message = document.createElement('p');
  title.textContent = 'Worker access · ' + area.property_name; close.textContent = 'Close'; close.onclick = () => dialog.close(); dialog.append(title, close, message); document.body.append(dialog); dialog.showModal(); dialog.onclose = () => dialog.remove();
  try {
    const users = await pages('profiles', 'id,role,Full_Name'), { data: assignments, error } = await supabase.from('winter_assignments').select('user_id').eq('area_id', area.id); if (error) throw error;
    const assigned = new Set(assignments.map(a => a.user_id));
    const workers = users.filter(u => ['employee', 'staff', 'worker'].includes(String(u.role).toLowerCase()));
    if (!workers.length) message.textContent = 'Create employee accounts through Owner Command first. No employee accounts exist yet.';
    for (const user of workers) {
      const label = document.createElement('label'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = assigned.has(user.id); label.append(check, document.createTextNode(user.Full_Name || user.id)); dialog.append(label);
      check.onchange = async () => { check.disabled = true; const request = check.checked ? supabase.from('winter_assignments').insert({ area_id: area.id, user_id: user.id, assigned_by: state.auth.user.id }) : supabase.from('winter_assignments').delete().eq('area_id', area.id).eq('user_id', user.id); const { error: ae } = await request; if (ae) { check.checked = !check.checked; message.textContent = 'Access not saved. ' + ae.message; } else message.textContent = 'Worker access saved.'; check.disabled = false; };
    }
  } catch (error) { message.textContent = error.message; }
}
async function weather() {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.weather.gov/stations/KMSO/observations/latest', { signal: controller.signal, headers: { Accept: 'application/geo+json' } }); if (!response.ok) throw Error();
    const { properties: p } = await response.json(), value = p.temperature?.value, age = Date.now() - Date.parse(p.timestamp);
    if (!Number.isFinite(value) || !Number.isFinite(age) || age > 2 * 3600000 || age < -60000 || p.temperature.unitCode !== 'wmoUnit:degC') throw Error();
    $('weather').textContent = Math.round(value * 9 / 5 + 32) + ' °F'; $('weather-detail').textContent = 'KMSO air · ' + denverTime(p.timestamp) + ' · not pavement';
  } catch { $('weather').textContent = 'Unavailable'; $('weather-detail').textContent = 'NWS air feed missing or stale · no value assumed'; }
  finally { clearTimeout(timeout); }
}
async function start() {
  state.auth = await authorize($('lock'), { onLost: lock }); if (!state.auth) return;
  $('lock').hidden = true; $('app').hidden = false; $('setup-area').hidden = !state.auth.staff;
  state.map = createMap('winter-map', text => $('map-status').textContent = text);
  $('search').oninput = render; $('status-filter').onchange = render; $('refresh').onclick = refresh; $('log-check').onclick = () => openRecord();
  $('record-form').onsubmit = saveRecord; $('setup-area').onclick = setupArea; $('area-form').onsubmit = saveArea;
  $('sign-out').onclick = async () => { lock(); await supabase.auth.signOut(); };
  for (const [id, mode] of [['aerial', 'aerial'], ['streets', 'street']]) $(id).onclick = () => { state.map?.setBase(mode); $('aerial').setAttribute('aria-pressed', String(mode === 'aerial')); $('streets').setAttribute('aria-pressed', String(mode === 'street')); };
  $('parcels').onchange = e => state.map?.toggleParcels(e.target.checked); $('retry-map').onclick = () => state.map?.retry(); $('reset').onclick = () => state.map?.reset();
  $('export').onclick = () => { if (!state.ready) { $('sync').textContent = 'Refresh successfully before exporting current history.'; return; } const url = URL.createObjectURL(new Blob(['\uFEFF' + exportCSV(state.records, state.areas)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'UMX-winter-history-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('record-dialog').addEventListener('close', () => { state.draft = null; state.pending = null; $('record-form').reset(); });
  window.addEventListener('beforeunload', e => { if (state.draft) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('offline', () => { state.ready = false; $('sync').textContent = 'Offline · displayed records may be stale. Keep an open unsaved check to retry when connected.'; $('log-check').disabled = true; });
  window.addEventListener('online', () => void refresh());
  const tick = () => $('clock').textContent = denverTime(new Date()); tick();
  await refresh(); void weather(); const poll = setInterval(() => { if (!document.hidden) void refresh(); }, 30000), clock = setInterval(tick, 60000), weatherPoll = setInterval(weather, 15 * 60000);
  window.addEventListener('pagehide', () => { clearInterval(poll); clearInterval(clock); clearInterval(weatherPoll); }, { once: true });
}
start().catch(() => { $('lock').querySelector('[role=status]').textContent = 'Winter Command could not start. Reload to retry.'; });
