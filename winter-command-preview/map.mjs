import { imageURL, parcelURL } from './core.mjs';
import { sectorMask } from './geography.mjs';
export function createMap(id, notify = () => {}) {
  if (!window.L) { notify('Map library could not load. Records remain available.'); return null; }
  const map = L.map(id, { minZoom:10,maxZoom:21,zoomSnap:.25,maxBoundsViscosity:1 }).setView([46.8788, -113.9972], 17);
  map.createPane('references'); map.getPane('references').style.zIndex = 350;
  map.createPane('clients'); map.getPane('clients').style.zIndex = 450;
  map.createPane('sectorMask'); map.getPane('sectorMask').style.zIndex=500; map.getPane('sectorMask').style.pointerEvents='none';
  const references = L.geoJSON(null, { pane: 'references', interactive: false, style: { color: '#f2cc7d', weight: 1, fillOpacity: 0, opacity: .65 } }), clients = L.layerGroup().addTo(map);
  let boundaryMask, boundaryLine, selectedBounds, drawingLayer, drawCallback, points=[];
  let base, modeEpoch = 0, fallback = false, refOn = false, controller, debounce, epoch = 0;
  const counts = { tilesLoaded: 0, tilesFailed: 0, naipFailures: 0, source: 'naip2025', parcels: 0, parcelRequests: 0 };
  const Aerial = L.TileLayer.extend({ getTileUrl(coords) { return imageURL({ x: coords.x, y: coords.y, z: this._tileZoom ?? coords.z }); } });
  function setBase(mode) {
    if (base) map.removeLayer(base); const mine=++modeEpoch; fallback=mode==='fallback'; counts.source=mode==='fallback'?'esri-fallback':mode==='street'?'osm':'naip2025'; counts.tilesLoaded = 0; counts.tilesFailed = 0;
    base = mode === 'fallback' ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:21,maxNativeZoom:19,attribution:'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community · capture dates vary'}) : mode === 'street' ? L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }) : new Aerial('', { tileSize: 256, maxZoom: 21, maxNativeZoom: 20, keepBuffer: 1, attribution: '<a href="https://msl.mt.gov/geoinfo/data/Aerial_Photos/NAIP_2025">Montana State Library · USDA NAIP 2025 · 30 cm provisional</a>' });
    base.on('tileload', () => { if(mine!==modeEpoch)return; counts.tilesLoaded++; notify((mode==='street'?'Street map ready':mode==='fallback'?'2025 source unavailable · Esri aerial imagery (capture dates vary)':'2025 NAIP aerial imagery ready')); });
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
  function selectSector(feature) {
    if (boundaryMask) map.removeLayer(boundaryMask); if(boundaryLine)map.removeLayer(boundaryLine);
    boundaryMask=L.geoJSON(sectorMask(feature.geometry),{pane:'sectorMask',interactive:false,style:{stroke:false,fillColor:'#0d1018',fillOpacity:1,fillRule:'evenodd'}}).addTo(map);
    boundaryLine=L.geoJSON(feature.geometry,{pane:'sectorMask',interactive:false,style:{color:'#e5bd66',weight:2,fill:false}}).addTo(map);
    selectedBounds=boundaryLine.getBounds(); map.setMaxBounds(selectedBounds.pad(.08)); map.fitBounds(selectedBounds,{padding:[20,20],maxZoom:16,animate:false});
  }
  function focus(point) {map.setMaxBounds(null);selectedBounds=L.latLngBounds([point[0]-.0015,point[1]-.002],[point[0]+.0015,point[1]+.002]);map.setMaxBounds(selectedBounds.pad(.2));map.fitBounds(selectedBounds,{padding:[15,15],maxZoom:19,animate:false});}
  function repaintDrawing(){if(drawingLayer)map.removeLayer(drawingLayer);drawingLayer=L.layerGroup().addTo(map);if(points.length)L.polyline(points.map(p=>[p[1],p[0]]),{color:'#e5bd66',weight:3,interactive:false}).addTo(drawingLayer);points.forEach((p,i)=>L.circleMarker([p[1],p[0]],{radius:6,color:'#f7d584',fillOpacity:1,interactive:false}).bindTooltip('Corner '+(i+1)).addTo(drawingLayer));}
  function draw(event){if(points.length>=100)return;const p=[Number(event.latlng.lng.toFixed(7)),Number(event.latlng.lat.toFixed(7))];if(points.some(v=>v[0]===p[0]&&v[1]===p[1]))return;points.push(p);repaintDrawing();drawCallback?.(points);}
  function beginDraw(callback){map.off('click',draw);clients.clearLayers();points=[];drawCallback=callback;map.on('click',draw);map.doubleClickZoom.disable();repaintDrawing();}
  function stopDraw(){map.off('click',draw);drawCallback=null;map.doubleClickZoom.enable();}
  return {map,clients,counts,setBase,toggleParcels,selectSector,focus,beginDraw,stopDraw,
    undoDraw(){points.pop();repaintDrawing();drawCallback?.(points);},
    clearDraw(){clients.clearLayers();points=[];repaintDrawing();drawCallback?.(points);},
    drawing:()=>points.map(p=>[...p]),
    retry:()=>fallback?setBase('aerial'):base.redraw(),
    reset:()=>selectedBounds?map.fitBounds(selectedBounds,{padding:[20,20],maxZoom:19}):map.setView([46.8788,-113.9972],17)};
}
