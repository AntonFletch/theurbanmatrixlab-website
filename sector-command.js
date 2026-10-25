import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs';
const DB='https://xdaxbueyftyljsrhabpx.supabase.co';
const KEY='sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ';
const supabase=createClient(DB,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
import {loadAddresses,loadBoundaries,sectorMask,sectorNames} from './sector-data.mjs';
import {readFlags,writeFlag} from './sector-sync.mjs';
import {propertyFlags,propertyColor,propertyStatus} from './sector-status.mjs';
const NAMES=sectorNames;
const $=id=>document.getElementById(id),state={sector:'Northside',kind:'home',base:'street',page:0,visible:8,search:'',boundaries:{},cache:new Map(),flags:new Map(),user:null,dbReady:false,map:null,tiles:null,mask:null,outline:null,markers:null,selection:null,serial:0,checks:new Map(),dirty:false,saving:false,syncing:false,flagSerial:0,editVersion:0};
const escapeText=t=>String(t??'').trim();
function label(t){return escapeText(t)||'(Unnamed county address)'}
function statusKey(id){return String(id)}
function flagFor(id){return state.flags.get(statusKey(id))||{}}
function rings(geo){return geo.type==='Polygon'?geo.coordinates:geo.coordinates.flat()}
function getStats(row){return propertyFlags(row,flagFor(row.id))}
function pointColor(row){return propertyColor(row,flagFor(row.id))}
function countLabel(n){const rows=state.cache.get(n)||[];return {h:rows.filter(x=>x.kind==='home').length,b:rows.filter(x=>x.kind==='biz').length}}
function countText(n){const c=countLabel(n);return c.h||c.b?c.h.toLocaleString()+' homes · '+c.b.toLocaleString()+' business addresses':'GIS inventory loads when selected'}
function statusText(row){return propertyStatus(row,flagFor(row.id))}
function setNotice(t){$('loading-map').textContent=t}
const STAFF=['owner','admin','dispatcher','manager'];
async function verifyAccess(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user||user.is_anonymous)throw Error('Sign-in required');
 const {data:profile,error:pErr}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(pErr||!STAFF.includes(String(profile?.role||'').toLowerCase()))throw Error('Authorized UMX staff access required');
 return user;
}
function lockSector(message='Your access changed or expired. Sign in again.'){
 state.serial++;state.flagSerial++;state.addressRequest?.abort();state.user=null;state.dbReady=false;state.flags.clear();state.cache.clear();state.map?.remove();state.map=null;$('record-list').replaceChildren();$('flag-reason').value='';$('profile').hidden=true;
 clearInterval(state.syncTimer);$('app').hidden=true;$('lock').hidden=false;$('auth-message').textContent=message;
}
async function bootstrap(){
 try{
  state.user=await verifyAccess();$('lock').hidden=true;$('app').hidden=false;
  supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==state.user?.id))setTimeout(()=>lockSector(),0)});
  await init();state.syncTimer=setInterval(syncCurrent,30000);
 }catch(e){if($('app').hidden){$('auth-message').textContent=e.message+'. Use UMX Sign in.'}else setNotice('UMX could not finish loading: '+e.message)}
}
async function init(){
 buildList();connectEvents();
 if(typeof maplibregl.supported==='function'&&!maplibregl.supported())throw Error('3D WebGL map unavailable in this browser. Enable hardware acceleration or use an updated Chrome.');
 state.map=new maplibregl.Map({
  container:'map',style:'https://tiles.openfreemap.org/styles/dark',
  center:[-113.995,46.881],zoom:13,pitch:50,bearing:-19,
  antialias:true,renderWorldCopies:false,maxPitch:70,attributionControl:true
 });
 state.map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
 state.map.addControl(new maplibregl.ScaleControl({maxWidth:90,unit:'imperial'}),'bottom-left');
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('3D basemap could not load')),23000);
  state.map.once('load',()=>{clearTimeout(timeout);resolve()});
  state.map.once('error',e=>{if(!state.map.isStyleLoaded()){clearTimeout(timeout);reject(Error(e.error?.message||'Map tile service error'))}});
 });
 installMapLayers();state.loadedBase='street';
 state.map.on('click',e=>{
  if(!state.map.getLayer('umx-pins'))return;
  const hits=state.map.queryRenderedFeatures(e.point,{layers:['umx-pins']});
  const id=hits?.[0]?.properties?.id;
  const row=id&&(state.cache.get(state.sector)||[]).find(p=>p.id===id);
  if(row&&row.kind===state.kind)selectRow(row)
 });
 state.map.on('mousemove',e=>{if(!state.map.getLayer('umx-pins'))return;const hits=state.map.queryRenderedFeatures(e.point,{layers:['umx-pins']});state.map.getCanvas().style.cursor=hits.length?'pointer':''});
 state.map.on('error',e=>{console.warn('MapLibre tile problem',e.error?.message||e)});
 try{
  const result=await loadBoundaries();state.boundaries=result.boundaries;state.boundaryReference=result.reference;
  await loadSector(state.sector);
 }catch(e){setNotice('City neighborhood boundaries unavailable: '+e.message)}
 fetch('./sector-reference/audit.json').then(r=>r.ok?r.json():null).then(a=>{if(a){$('audit-homes').textContent=a.totals.homes.toLocaleString();$('audit-businesses').textContent=a.totals.businesses.toLocaleString();$('audit-method').textContent='County GIS audit: '+a.checkedDate+' · address records, not verified occupied homes or operating companies. Boundary overlaps are counted once in city totals.'}}).catch(()=>{});
}

function makeSatelliteStyle(){return {version:8,sources:{
 'satellite':{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Imagery © Esri'},
 'openmaptiles':{type:'vector',url:'https://tiles.openfreemap.org/planet'}
 },layers:[{id:'sat-bg',type:'background',paint:{'background-color':'#07121e'}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-brightness-max':0.62,'raster-saturation':-0.5}}]};}
function installMapLayers(){
 const m=state.map;
 /* install after the MapLibre style.load event */
 if(!m.getSource('openmaptiles'))m.addSource('openmaptiles',{type:'vector',url:'https://tiles.openfreemap.org/planet'});
 // Geometry heights come from actual OSM/OpenMapTiles features, with a modest fallback for unmapped buildings.
 const labels=m.getStyle().layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
 if(!m.getLayer('umx-buildings'))m.addLayer({
 id:'umx-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',
 minzoom:13,filter:['!=',['get','hide_3d'],true],
 paint:{'fill-extrusion-color':'#32495b','fill-extrusion-opacity':0.84,
 'fill-extrusion-height':['interpolate',['linear'],['zoom'],13,0,14.5,['coalesce',['get','render_height'],9]],
 'fill-extrusion-base':['coalesce',['get','render_min_height'],0]}
 },labels);
 try{if(typeof m.setLight==='function')m.setLight({anchor:'viewport',color:'#a6bce2',intensity:0.62,position:[1.3,225,32]})}catch(e){}
 const blank={type:'FeatureCollection',features:[]};
 if(!m.getSource('umx-zone-mask'))m.addSource('umx-zone-mask',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
 if(!m.getLayer('umx-zone-mask'))m.addLayer({id:'umx-zone-mask',type:'fill',source:'umx-zone-mask',paint:{'fill-color':'#080d16','fill-opacity':0.995}});
 if(!m.getSource('umx-zone'))m.addSource('umx-zone',{type:'geojson',data:blank});
 if(!m.getLayer('umx-zone-glow'))m.addLayer({id:'umx-zone-glow',type:'line',source:'umx-zone',paint:{'line-color':'#dfb95e','line-width':6,'line-blur':7,'line-opacity':0.68}});
 if(!m.getLayer('umx-zone-line'))m.addLayer({id:'umx-zone-line',type:'line',source:'umx-zone',paint:{'line-color':'#f1cf80','line-width':2.5,'line-opacity':0.94}});
 if(!m.getSource('umx-points'))m.addSource('umx-points',{type:'geojson',data:blank});
 if(!m.getLayer('umx-pin-halos'))m.addLayer({id:'umx-pin-halos',type:'circle',source:'umx-points',paint:{
 'circle-radius':['interpolate',['linear'],['zoom'],10,2,15,8,18,13],
 'circle-color':['get','color'],'circle-opacity':0.16,'circle-blur':0.85}});
 if(!m.getLayer('umx-pins'))m.addLayer({id:'umx-pins',type:'circle',source:'umx-points',paint:{
 'circle-radius':['interpolate',['linear'],['zoom'],10,2,15,4.7,18,7],
 'circle-color':['get','color'],'circle-opacity':0.94,
 'circle-stroke-width':['case',['get','postalUnverified'],2.1,1],
 'circle-stroke-color':['case',['get','postalUnverified'],'#efa943','#0b1220']}});
 if(!m.getLayer('umx-vip-stars'))m.addLayer({id:'umx-vip-stars',type:'symbol',source:'umx-points',
 filter:['==',['get','vip'],true],layout:{'text-field':'★','text-size':20,'text-allow-overlap':true,'text-offset':[0,-.9]},
 paint:{'text-color':'#ffdf70','text-halo-color':'#181522','text-halo-width':1.2}});
 const current=state.boundaries[state.sector];if(current)applyGeometry(current);
 drawPins();
}
function applyGeometry(geo){
 const cover={type:'Feature',geometry:sectorMask(geo),properties:{}};
 const zone={type:'Feature',geometry:geo,properties:{}};
 state.map.getSource('umx-zone-mask')?.setData(cover);
 state.map.getSource('umx-zone')?.setData(zone);
}

function buildList(){const select=$('sector-select');for(const n of NAMES){const opt=document.createElement('option');opt.value=n;opt.textContent=n;select.append(opt)}renderStrip()}
function renderStrip(){const root=$('sector-cards');root.replaceChildren();$('strip-label').textContent='Showing '+(state.page*3+1)+'–'+Math.min(state.page*3+3,NAMES.length)+' of '+NAMES.length;$('sector-prev').disabled=state.page===0;$('sector-next').disabled=(state.page+1)*3>=NAMES.length;for(let i=state.page*3;i<Math.min(state.page*3+3,NAMES.length);i++){const n=NAMES[i],b=document.createElement('button');b.className='sectorbtn'+(state.sector===n?' selected':'');const num=document.createElement('b');num.textContent=String(i+1).padStart(2,'0');const content=document.createElement('span');const name=document.createElement('strong');name.textContent=n;const count=document.createElement('small');count.textContent=countText(n);content.append(name,count);const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent='›';b.append(num,content,arrow);b.onclick=()=>loadSector(n);root.append(b)}$('sector-select').value=state.sector}
function setTiles(t){
 state.base=t;
 $('streets').classList.toggle('on',t==='street');$('satellite').classList.toggle('on',t==='satellite');
 const m=state.map;if(!m)return;
 setNotice('Switching map imagery…');
 if(t===state.loadedBase&&m.getLayer('umx-zone-line')){setNotice('');return;}
 m.once('style.load',()=>{try{installMapLayers();state.loadedBase=t;setNotice('')}catch(e){setNotice('Map style unavailable: '+e.message)}});
 m.setStyle(t==='satellite'?makeSatelliteStyle():'https://tiles.openfreemap.org/styles/dark');
}
async function loadSector(n,{force=false}={}){
 if(!state.boundaries[n]){setNotice('Boundary not available: '+n);return}
 const token=++state.serial;state.flagSerial++;state.addressRequest?.abort();state.addressRequest=new AbortController();
 state.sector=n;state.kind='home';state.search='';state.visible=8;state.selection=null;state.flags.clear();state.dbReady=false;state.dirty=false;
 if(force)state.cache.delete(n);
 $('profile').hidden=true;$('search-address').value='';$('sector-number').textContent=String(NAMES.indexOf(n)+1).padStart(2,'0');$('sector-name').textContent=n;
 document.querySelectorAll('.tabs button').forEach(b=>{const on=b.dataset.kind==='home';b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on))});
 renderStrip();drawSectorBoundary(n);refresh();setNotice('Checking '+n+' county inventory…');
 try{
  if(!state.cache.has(n)){
   const inventory=await loadAddresses(state.boundaries[n],{signal:state.addressRequest.signal,onProgress:(loaded,total)=>{if(token===state.serial)setNotice('Checking county addresses: '+loaded.toLocaleString()+' / '+total.toLocaleString())}});
   if(token!==state.serial)return;state.cache.set(n,inventory.rows);state.checks.set(n,inventory);
  }
  await loadFlags(n);if(token!==state.serial)return;refresh();
  setNotice(state.dbReady?(state.boundaryReference?'Using city boundary reference from October 25, 2026.':''):'County inventory loaded. Private status sync unavailable — reload data to retry.');
 }catch(e){if(token!==state.serial)return;state.cache.delete(n);refresh();setNotice('County inventory unavailable for '+n+': '+e.message+'. Reload data to retry.');}
}
function drawSectorBoundary(n){
 const geo=state.boundaries[n],coords=rings(geo).flat();
 const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
 const bbox=[[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]];
 applyGeometry(geo);
 state.map.setMaxBounds(null);
 state.map.setMaxBounds([[bbox[0][0]-.009,bbox[0][1]-.007],[bbox[1][0]+.009,bbox[1][1]+.007]]);
 state.map.fitBounds(bbox,{padding:{top:35,bottom:35,left:30,right:30},maxZoom:15.2,duration:0});
 $('map-sector-name').textContent=n.toUpperCase()+' / SECTOR '+String(NAMES.indexOf(n)+1).padStart(2,'0');
}
async function loadFlags(n,{background=false}={}){
 const token=++state.flagSerial,user=state.user;
 if(!user)return;
 try{
  const flags=await readFlags(supabase,user.id,n);
  if(token!==state.flagSerial||n!==state.sector||user!==state.user||(background&&(state.dirty||state.saving)))return;
  state.flags=flags;state.dbReady=true;
 }catch(e){if(token!==state.flagSerial||n!==state.sector)return;state.dbReady=false;console.warn('UMX status sync unavailable',e.message)}
}
async function syncCurrent(){
 if(!state.user||state.syncing||state.saving||state.dirty||document.hidden||!navigator.onLine)return;
 state.syncing=true;const sector=state.sector,serial=state.serial;
 try{
  await verifyAccess();if(state.saving||state.dirty)return;await loadFlags(sector,{background:true});
  if(serial!==state.serial)return;
  refresh();
  if(state.selection&&!state.dirty)fillProfile(state.selection);
 }catch(e){if(serial===state.serial)lockSector(e.message)}finally{state.syncing=false}
}
function visibleRows(){const list=state.cache.get(state.sector)||[];return list.filter(x=>x.kind===state.kind).filter(x=>!state.search||x.address.toLowerCase().includes(state.search))}
function refresh(){const n=state.sector;const list=visibleRows();$('records-title').textContent=(state.kind==='home'?'Homes':'Businesses')+' · '+n;$('data-source').textContent='County GIS checked '+(state.checks.get(n)?new Date(state.checks.get(n).checkedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'when loaded')+' · '+(state.dbReady?'private status synced':'private status sync unavailable');$('record-count').textContent=list.length.toLocaleString()+' address records';$('show-more').hidden=list.length<=state.visible;const root=$('record-list');root.replaceChildren();for(const row of list.slice(0,state.visible)){const b=document.createElement('button');b.className='record';const a=document.createElement('span');const pin=document.createElement('i');pin.style.background=pointColor(row);pin.style.outline=row.postal===1?'none':'2px solid #ffae39';a.append(pin,document.createTextNode(row.address));const status=document.createElement('em');status.textContent=statusText(row);b.append(a,status);b.onclick=()=>selectRow(row);root.append(b)}if(!list.length){const p=document.createElement('p');p.style.padding='14px';p.style.color='#a7b1bd';p.textContent='No matching county address records for this sector / tab.';root.append(p)}drawPins();renderStrip();}
function drawPins(){
 const m=state.map;if(!m?.getSource('umx-points'))return;
 const list=visibleRows();
 const features=list.map(x=>{const s=getStats(x);return {type:'Feature',geometry:{type:'Point',coordinates:[x.lng,x.lat]},properties:{
  id:x.id,color:pointColor(x),vip:s.vip&&!s.declined&&!s.excluded,postalUnverified:!s.postal,declined:s.declined,excluded:s.excluded,kind:x.kind
 }}});
 m.getSource('umx-points').setData({type:'FeatureCollection',features});
 const all=state.cache.get(state.sector)||[];
 $('insight-homes').textContent=all.filter(x=>x.kind==='home').length.toLocaleString();
 $('insight-biz').textContent=all.filter(x=>x.kind==='biz').length.toLocaleString();
 $('insight-vip').textContent=all.filter(x=>getStats(x).vip).length.toLocaleString();
 $('insight-blocked').textContent=all.filter(x=>{const f=getStats(x);return f.declined||f.excluded}).length.toLocaleString();
}

function fillProfile(row){
 state.editVersion++;
 $('profile-address').textContent=row.address;
 $('profile-detail').textContent=(row.kind==='home'?'Residential address':'Commercial-coded address')+' • County postal: '+(row.postal===1?'Verified':'Unverified')+' • County structure: '+(row.countyStatus===2?'Field verified by county':'Unverified')+(row.parcelId?' • Parcel reference: '+row.parcelId:'')+' • UMX service measurements and client authorization pending.'+(row.type===2001?' • Hospital: automatically excluded.':'');
 const f=flagFor(row.id);for(const [name,prop] of [['contacted','contacted'],['declined','declined'],['excluded','excluded'],['active','active_business'],['vip','vip']])$('flag-'+name).checked=!!f[prop];
 $('flag-active').disabled=row.kind!=='biz';$('flag-excluded').disabled=row.type===2001;$('flag-excluded').checked=!!f.excluded||row.type===2001;$('flag-reason').value=f.notes||'';
 $('save-message').textContent=state.dbReady?'Private status synced · updates every 30 seconds':'Private status sync unavailable — reload data before saving';
 $('save-flags').disabled=!state.dbReady||!navigator.onLine;
 $('reload-status').disabled=!navigator.onLine;
}
function selectRow(row){state.selection=row;state.dirty=false;$('profile').hidden=false;fillProfile(row);state.map.easeTo({center:[row.lng,row.lat],zoom:Math.max(15,state.map.getZoom()),duration:480});$('profile').scrollIntoView({behavior:'smooth',block:'nearest'})}
async function saveFlags(){
 if(!state.selection||!state.user||!state.dbReady||state.saving)return;
 const row=state.selection,sector=state.sector,serial=state.serial,editVersion=state.editVersion;
 const f={user_id:state.user.id,property_id:row.id,sector,contacted:$('flag-contacted').checked,declined:$('flag-declined').checked,excluded:$('flag-excluded').checked||row.type===2001,active_business:row.kind==='biz'&&$('flag-active').checked,vip:$('flag-vip').checked,notes:$('flag-reason').value.trim(),updated_at:new Date().toISOString()};
 state.flagSerial++;state.saving=true;$('save-flags').disabled=true;$('save-message').textContent='Saving…';
 try{
  if(!navigator.onLine)throw Error('Device is offline. Your changes remain on screen; reconnect and save again.');
  await verifyAccess();
  const saved=await writeFlag(supabase,f,flagFor(row.id));
  if(serial!==state.serial||state.selection?.id!==row.id)return;
  state.flags.set(row.id,saved);state.dirty=state.editVersion!==editVersion;$('save-message').textContent=state.dirty?'Earlier values saved. Your newer changes are still unsaved.':'Saved to private UMX OS · available on your other signed-in devices';refresh();
 }catch(e){if(serial===state.serial&&state.selection?.id===row.id)$('save-message').textContent='NOT SAVED: '+e.message}
 finally{state.saving=false;if(serial===state.serial)$('save-flags').disabled=!state.dbReady||!navigator.onLine}
}
function connectEvents(){
 $('refresh-data').onclick=()=>loadSector(state.sector,{force:true});
 $('reload-status').onclick=async()=>{const row=state.selection,serial=state.serial;if(!row)return;state.dirty=false;await loadFlags(state.sector);if(serial===state.serial&&state.selection?.id===row.id){fillProfile(row);refresh()}};
 $('flag-reason').maxLength=4000;
 document.querySelectorAll('.checkgrid input,#flag-reason').forEach(e=>e.addEventListener('input',()=>{state.editVersion++;state.dirty=true;$('save-message').textContent='Unsaved changes'}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncCurrent()});
 window.addEventListener('online',()=>{if(state.selection)$('save-flags').disabled=!state.dbReady;syncCurrent()});
 window.addEventListener('offline',()=>{if(state.selection){$('save-flags').disabled=true;$('save-message').textContent='Offline — changes are not saved. Reconnect to save.'}});
 document.querySelectorAll('.tabs [data-kind]').forEach(b=>b.onclick=()=>{state.kind=b.dataset.kind;state.visible=8;state.search='';$('search-address').value='';$('profile').hidden=true;document.querySelectorAll('.tabs button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',String(x===b))});refresh()});$('streets').onclick=()=>setTiles('street');$('satellite').onclick=()=>setTiles('satellite');$('tilt-view').onclick=()=>{const flat=state.map.getPitch()>10;state.map.easeTo({pitch:flat?0:52,bearing:flat?0:-19,duration:600});$('tilt-view').textContent=flat?'3D View':'2D View'};$('sector-prev').onclick=()=>{state.page=Math.max(0,state.page-1);renderStrip()};$('sector-next').onclick=()=>{state.page=Math.min(Math.ceil(NAMES.length/3)-1,state.page+1);renderStrip()};$('all-sectors-toggle').onclick=()=>{$('all-sectors').hidden=!$('all-sectors').hidden};$('sector-select').onchange=e=>{state.page=Math.floor(NAMES.indexOf(e.target.value)/3);loadSector(e.target.value)};$('search-address').oninput=e=>{state.search=e.target.value.trim().toLowerCase();state.visible=8;refresh()};$('show-more').onclick=()=>{state.visible+=24;refresh()};$('profile-close').onclick=()=>{$('profile').hidden=true};$('save-flags').onclick=saveFlags;$('print-contract').onclick=()=>window.print()}
bootstrap();
