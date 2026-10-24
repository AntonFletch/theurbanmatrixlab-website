import { imageURL, parcelURL } from './core.mjs';
export function createMap(id, notify = () => {}) {
  if (!window.L) { notify('Map library could not load. Records remain available.'); return null; }
  const map = L.map(id, { minZoom: 10, maxZoom: 21 }).setView([46.8788, -113.9972], 17);
  map.createPane('references'); map.getPane('references').style.zIndex = 350;
  map.createPane('clients'); map.getPane('clients').style.zIndex = 450;
  const references = L.geoJSON(null, { pane: 'references', interactive: false, style: { color: '#f2cc7d', weight: 1, fillOpacity: 0, opacity: .65 } }), clients = L.layerGroup().addTo(map);
  let base, modeEpoch = 0, fallback = false, refOn = false, controller, debounce, epoch = 0;
  const counts = { tilesLoaded: 0, tilesFailed: 0, naipFailures: 0, source: 'naip2025', parcels: 0, parcelRequests: 0 };
  const Aerial = L.TileLayer.extend({ getTileUrl(coords) { return imageURL({ x: coords.x, y: coords.y, z: this._tileZoom ?? coords.z }); } });
  function setBase(mode) {
    if (base) map.removeLayer(base); const mine=++modeEpoch; fallback=mode==='fallback'; counts.source=mode==='fallback'?'esri-fallback':mode==='street'?'osm':'naip2025'; counts.tilesLoaded = 0; counts.tilesFailed = 0;
    base = mode === 'fallback' ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:21,maxNativeZoom:19,attribution:'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community · capture dates vary'}) : mode === 'street' ? L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }) : new Aerial('', { tileSize: 256, maxZoom: 21, maxNativeZoom: 20, keepBuffer: 1, attribution: '<a href="https://msl.mt.gov/geoinfo/data/Aerial_Photos/NAIP_2025">Montana State Library · USDA NAIP 2025 · 30 cm provisional</a>' });
    base.on('tileload', () => { if(mine!==modeEpoch)return; counts.tilesLoaded++; notify((mode === 'street' ? 'Street map' : mode==='fallback' ? '2025 NAIP unavailable · Esri aerial fallback (capture dates vary)' : '2025 aerial imagery') + ' loaded · ' + counts.tilesLoaded + ' tiles'); });
    base.on('tileerror', () => { if(mine!==modeEpoch)return; counts.tilesFailed++; if(mode==='aerial')counts.naipFailures++; if(mode==='aerial'&&counts.tilesFailed>=2){notify('2025 NAIP unavailable · loading Esri aerial fallback');setBase('fallback');return}notify('Some map tiles failed. Retry or switch basemap.'); }); base.addTo(map);
  }
  async function parcels() {
    if (!refOn) return; controller?.abort(); const token = ++epoch;
    if (map.getZoom() < 16) { references.clearLayers(); notify('Zoom to level 16 or closer for parcel reference lines.'); return; }
    controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const b = map.getBounds(); counts.parcelRequests++;
      const response = await fetch(parcelURL([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]), { signal: controller.signal }); if (!response.ok) throw Error('Parcel service HTTP ' + response.status);
      const data = await response.json(); if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.error) throw Error('Invalid parcel response'); if (token !== epoch || !refOn) return;
      references.clearLayers(); references.addData(data); counts.parcels = data.features.length; notify(counts.parcels + ' reference parcels loaded' + (counts.parcels >= 300 || data.exceededTransferLimit ? ' · limited; zoom closer' : ''));
    } catch (error) { if (token === epoch && refOn) { references.clearLayers(); counts.parcels = 0; notify('Parcel reference unavailable. ' + (error.name === 'AbortError' ? 'Request timed out.' : error.message)); } }
    finally { clearTimeout(timer); }
  }
  function toggleParcels(on) { refOn = on; if (on) { references.addTo(map); void parcels(); } else { epoch++; controller?.abort(); references.clearLayers(); map.removeLayer(references); counts.parcels = 0; } }
  map.on('moveend', () => { clearTimeout(debounce); debounce = setTimeout(parcels, 350); }); setBase('aerial');
  return { map, clients, counts, setBase, toggleParcels, retry: () => fallback ? setBase('aerial') : base.redraw(), reset: () => map.setView([46.8788, -113.9972], 17) };
}
