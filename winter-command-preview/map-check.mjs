import { createMap } from './map.mjs';
import { sectorPicker } from './sectors.mjs';
import { loadAddresses, addressSourceItem } from './addresses.mjs';
const $ = id => document.getElementById(id);
const viewer = createMap('winter-map', message => $('map-status').textContent = message);
if (viewer) {
  const cache = new Map(), pins = L.layerGroup().addTo(viewer.map), markers = new Map();
  viewer.map.createPane('addresses'); viewer.map.getPane('addresses').style.zIndex = 460;
  const renderer = L.canvas({ pane: 'addresses', padding: .2 });
  let selected, rows = [], kind = 'home', query = '', visible = 12, controller, serial = 0, loading = false, failure = '';
  $('address-source').href = addressSourceItem;
  function chooseAddress(row) {
    const marker = markers.get(row.id); if (!marker) return;
    viewer.map.setView([row.lat, row.lng], Math.max(viewer.map.getZoom(), 18)); marker.openPopup();
  }
  function render() {
    const filtered = rows.filter(row => row.kind === kind && (!query || row.address.toLowerCase().includes(query)));
    const noun = kind === 'home' ? 'residential' : 'commercial-coded';
    $('homes').setAttribute('aria-pressed', String(kind === 'home')); $('businesses').setAttribute('aria-pressed', String(kind === 'biz'));
    $('address-count').textContent = loading ? 'Loading address pins…' : failure ? 'Address pins unavailable' : filtered.length.toLocaleString() + ' ' + noun + ' address pins';
    $('address-list-title').textContent = (kind === 'home' ? 'Homes' : 'Businesses') + (selected ? ' · ' + selected.properties.FeatureName : '');
    $('address-status').textContent = loading ? 'Loading ' + selected.properties.FeatureName + ' county addresses…' : failure || (rows.length ? rows.filter(r => r.kind === 'home').length.toLocaleString() + ' residential · ' + rows.filter(r => r.kind === 'biz').length.toLocaleString() + ' commercial-coded addresses in this neighborhood. Tap a pin or choose an address.' : 'No residential or commercial-coded address points returned for this neighborhood.');
    $('address-retry').hidden = !failure;
    pins.clearLayers(); markers.clear(); viewer.map.closePopup(); $('address-list').replaceChildren();
    for (const row of filtered) {
      const color = row.kind === 'home' ? '#49a9ff' : '#bb88ff';
      const marker = L.circleMarker([row.lat, row.lng], { pane: 'addresses', renderer, radius: 4.5, color: '#102238', weight: 1, fillColor: color, fillOpacity: 1 }).addTo(pins);
      const tooltip = document.createElement('span'); tooltip.textContent = row.address; marker.bindTooltip(tooltip, { sticky: true });
      const popup = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('p');
      title.textContent = row.address; detail.textContent = (row.kind === 'home' ? 'Residential address' : 'Commercial-coded address') + ' · Missoula County GIS'; popup.append(title, detail); marker.bindPopup(popup); markers.set(row.id, marker);
    }
    for (const row of filtered.slice(0, visible)) {
      const button = document.createElement('button'); button.className = 'address-row'; button.textContent = row.address; button.onclick = () => chooseAddress(row); $('address-list').append(button);
    }
    if (!filtered.length) { const text = document.createElement('p'); text.textContent = loading ? 'Loading addresses…' : failure ? 'Use Retry addresses to load this neighborhood.' : query ? 'No matching addresses. Try another search.' : 'No matching address points.'; $('address-list').append(text); }
    $('address-more').hidden = filtered.length <= visible;
  }
  async function selectSector(feature, retry = false) {
    const token = ++serial; controller?.abort(); controller = new AbortController();
    selected = feature; rows = []; query = ''; visible = 12; failure = ''; loading = true; $('address-search').value = '';
    $('sector-name').textContent = feature.properties.FeatureName; viewer.selectSector(feature); render();
    try {
      const name = feature.properties.FeatureName;
      const result = !retry && cache.has(name) ? cache.get(name) : await loadAddresses(feature.geometry, { signal: controller.signal });
      if (token !== serial) return;
      cache.set(name, result); rows = result;
    } catch (error) { if (token !== serial) return; failure = 'County address pins could not load. ' + (error.name === 'AbortError' ? 'The request timed out.' : error.message); }
    finally { if (token === serial) { loading = false; render(); } }
  }
  $('homes').onclick = () => { kind = 'home'; visible = 12; render(); };
  $('businesses').onclick = () => { kind = 'biz'; visible = 12; render(); };
  $('address-search').oninput = event => { query = event.target.value.trim().toLowerCase(); visible = 12; render(); };
  $('address-more').onclick = () => { visible += 24; render(); };
  $('address-retry').onclick = () => selected && void selectSector(selected, true);
  $('aerial').onclick = () => viewer.setBase('aerial'); $('street').onclick = () => viewer.setBase('street'); $('reset').onclick = viewer.reset;
  $('parcel-toggle').onchange = event => viewer.toggleParcels(event.target.checked);
  try { await sectorPicker({ cards: $('sector-cards'), select: $('sector-select'), previous: $('sector-prev'), next: $('sector-next'), label: $('sector-page'), onSelect: feature => void selectSector(feature) }); }
  catch (error) { loading = false; failure = error.message; render(); }
  setInterval(() => $('counts').textContent = 'Imagery source: ' + viewer.counts.source + ' · Loaded tiles: ' + viewer.counts.tilesLoaded + ' · Failed tiles: ' + viewer.counts.tilesFailed + ' · Parcel references: ' + viewer.counts.parcels + ' · 2025 source errors: ' + viewer.counts.naipFailures, 1000);
}
