import { createMap } from './map.mjs';
import { sectorPicker } from './sectors.mjs';
const $=id=>document.getElementById(id);
const viewer=createMap('winter-map',message=>$('map-status').textContent=message);
if(viewer){
  $('aerial').onclick=()=>viewer.setBase('aerial');$('street').onclick=()=>viewer.setBase('street');$('reset').onclick=viewer.reset;
  $('parcel-toggle').onchange=e=>viewer.toggleParcels(e.target.checked);
  try{await sectorPicker({cards:$('sector-cards'),select:$('sector-select'),previous:$('sector-prev'),next:$('sector-next'),label:$('sector-page'),onSelect:feature=>{$('sector-name').textContent=feature.properties.FeatureName;viewer.selectSector(feature);}});}catch(error){$('map-status').textContent=error.message;}
  setInterval(()=>$('counts').textContent='Source: '+viewer.counts.source+' · Loaded tiles: '+viewer.counts.tilesLoaded+' · Failed tiles: '+viewer.counts.tilesFailed+' · Parcel references: '+viewer.counts.parcels+' · 2025 source errors: '+viewer.counts.naipFailures,1000);
}
