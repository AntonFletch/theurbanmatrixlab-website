import { createMap } from './map.mjs';
const $ = id => document.getElementById(id);
const viewer = createMap('winter-map', message => $('map-status').textContent = message);
if (viewer) {
  $('aerial').onclick = () => viewer.setBase('aerial'); $('street').onclick = () => viewer.setBase('street'); $('reset').onclick = viewer.reset;
  $('parcel-toggle').onchange = e => viewer.toggleParcels(e.target.checked);
  setInterval(() => $('counts').textContent = 'Loaded tiles: ' + viewer.counts.tilesLoaded + ' · Failed tiles: ' + viewer.counts.tilesFailed + ' · Reference parcels: ' + viewer.counts.parcels + ' · Parcel requests: ' + viewer.counts.parcelRequests + ' · Source: ' + viewer.counts.source + ' · NAIP failures: ' + viewer.counts.naipFailures, 1000);
}
