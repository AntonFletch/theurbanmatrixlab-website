import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs';
const DB='https://xdaxbueyftyljsrhabpx.supabase.co';
const KEY='sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ';
const supabase=createClient(DB,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const ADDRESS='https://gis.missoulacounty.us/arcgis/rest/services/Base/Operational/MapServer/0';
const BOUNDARY='https://services.arcgis.com/HfwHS0BxZBQ1E5DY/ArcGIS/rest/services/Neighborhoods_mso/FeatureServer/0/query';
const NAMES=['Northside','Westside','Captain John Mullan','Grant Creek','Upper Rattlesnake','Lower Rattlesnake','Marshall Canyon','Heart of Missoula','Riverfront','River Road','Two Rivers','Franklin to the Fort','Rose Park','University District','Lewis & Clark','Southgate Triangle','South 39th Street','Moose Can Gully','Miller Creek','Farviews / Pattee Canyon'];
const $=id=>document.getElementById(id),state={sector:'Northside',kind:'home',base:'street',page:0,visible:8,search:'',boundaries:{},cache:new Map(),flags:new Map(),user:null,dbReady:false,map:null,tiles:null,mask:null,outline:null,markers:null,selection:null,serial:0};
const escapeText=t=>String(t??'').trim();
function label(t){return escapeText(t)||'(Unnamed county address)'}
function statusKey(id){return String(id)}
function flagFor(id){return state.flags.get(statusKey(id))||{}}
function classify(type){const t=Number(type);if(t>=1000&&t<=1020)return'home';if((t>=5000&&t<6000)||t===2001)return'biz';return'other'}
function pointInRing(pt,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function contains(geo,pt){const polys=geo.type==='Polygon'?[geo.coordinates]:geo.coordinates;return polys.some(poly=>pointInRing(pt,poly[0])&&!poly.slice(1).some(r=>pointInRing(pt,r)))}
function rings(geo){return geo.type==='Polygon'?geo.coordinates:geo.coordinates.flatMap(p=>p)}
function getStats(row){const f=flagFor(row.id);return {declined:!!f.declined,excluded:!!f.excluded||row.type===2001,contacted:!!f.contacted,active:!!f.active_business&&row.kind==='biz',vip:!!f.vip,postal:row.postal===1}}
function pointColor(row){const f=getStats(row);if(f.declined)return'#ff273b';if(f.excluded)return'#7c8798';if(f.contacted)return'#f5c75c';if(f.active)return'#08df8b';return row.kind==='home'?'#49a9ff':'#a876ed'}
function countLabel(n){const rows=state.cache.get(n)||[];return {h:rows.filter(x=>x.kind==='home').length,b:rows.filter(x=>x.kind==='biz').length}}
function countText(n){const c=countLabel(n);return c.h||c.b?c.h.toLocaleString()+' homes · '+c.b.toLocaleString()+' business addresses':'GIS inventory loads when selected'}
function statusText(row){const f=getStats(row);return f.declined?'Declined':f.excluded?'Excluded':f.vip?'★ VIP':f.contacted?'Contacted':f.active?'Operating confirmed':row.postal===1?'County postal verified':'Postal unverified'}
function setNotice(t){$('loading-map').textContent=t}
async function getJSON(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),28000);try{const r=await fetch(url,{signal:controller.signal,mode:'cors'});if(!r.ok)throw Error('County GIS HTTP '+r.status);const j=await r.json();if(j.error)throw Error(j.error.message||'GIS service error');return j}finally{clearTimeout(timer)}}
function params(obj){return new URLSearchParams(obj).toString()}
async function bootstrap(){try{const {data:{session},error}=await supabase.auth.getSession();if(error||!session){$('auth-message').textContent='Owner sign-in required. Redirecting to UMX Access…';setTimeout(()=>location.replace('login.html'),600);return}
const {data:profile,error:pErr}=await supabase.from('profiles').select('role').eq('id',session.user.id).maybeSingle();if(pErr)throw Error('Could not verify staff permissions');const role=String(profile?.role||'').toLowerCase();if(!['owner','admin','dispatcher','manager'].includes(role)){$('auth-message').textContent='Owner/staff access required. Your account cannot view this map.';return}state.user=session.user;$('lock').hidden=true;$('app').hidden=false;await init();}catch(e){$('auth-message').textContent='UMX database is unavailable or access could not be verified. '+e.message}}
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
 installMapLayers();
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
  const boundary=await getJSON(BOUNDARY+'?'+params({where:'1=1',outFields:'FeatureName',returnGeometry:'true',outSR:'4326',f:'geojson'}));
  for(const f of boundary.features||[])state.boundaries[f.properties.FeatureName]=f.geometry;
  if(!state.boundaries.Northside)throw Error('Northside boundary not found');
  await loadSector(state.sector);
 }catch(e){setNotice('City neighborhood boundaries unavailable: '+e.message)}
 try{const {error}=await supabase.from('sector_property_statuses').select('property_id').limit(1);state.dbReady=!error;if(error)console.warn('Status database',error.message)}
 catch(e){state.dbReady=false}
}
function makeSatelliteStyle(){return {version:8,sources:{
 'satellite':{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Imagery © Esri'},
 'openmaptiles':{type:'vector',url:'https://tiles.openfreemap.org/planet'}
 },layers:[{id:'sat-bg',type:'background',paint:{'background-color':'#07121e'}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-brightness-max':0.62,'raster-saturation':-0.5}}]};}
function installMapLayers(){
 const m=state.map;
 if(!m.isStyleLoaded())return;
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
 if(!m.getSource('umx-zone-mask'))m.addSource('umx-zone-mask',{type:'geojson',data:blank});
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
 const outer=[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]];
 const exteriors=geo.type==='Polygon'?[geo.coordinates[0]]:geo.coordinates.map(poly=>poly[0]);
 // GeoJSON polygon with sector exteriors as cutouts masks everything outside the selected section.
 const cover={type:'Feature',geometry:{type:'Polygon',coordinates:[outer,...exteriors.map(r=>
  [...r].map(p=>[p[0],p[1]]).reverse())]},properties:{}};
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
 m.setStyle(t==='satellite'?makeSatelliteStyle():'https://tiles.openfreemap.org/styles/dark');
 m.once('style.load',()=>{try{installMapLayers();setNotice('')}catch(e){setNotice('Map style unavailable: '+e.message)}});
}
async function loadSector(n){if(!state.boundaries[n]){setNotice('Boundary not available: '+n);return}const token=++state.serial;state.sector=n;state.kind='home';state.search='';state.visible=8;state.selection=null;$('profile').hidden=true;$('search-address').value='';const i=NAMES.indexOf(n);$('sector-number').textContent=String(i+1).padStart(2,'0');$('sector-name').textContent=n;document.querySelectorAll('.tabs button').forEach(b=>{const on=b.dataset.kind==='home';b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on))});renderStrip();setNotice('Loading '+n+' from county GIS…');drawSectorBoundary(n);if(state.cache.has(n)){await loadFlags(n);if(token!==state.serial)return;refresh();setNotice('');return}
try{const rows=await loadGIS(state.boundaries[n]);if(token!==state.serial)return;state.cache.set(n,rows);await loadFlags(n);if(token!==state.serial)return;refresh();setNotice('')}catch(e){if(token!==state.serial)return;state.cache.set(n,[]);refresh();setNotice('County GIS data unavailable for '+n+'. '+e.message)}}
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
async function loadGIS(geo){const coords=rings(geo).flat();const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]);const envelope=JSON.stringify({xmin:Math.min(...xs),ymin:Math.min(...ys),xmax:Math.max(...xs),ymax:Math.max(...ys),spatialReference:{wkid:4326}});let features=[];for(let offset=0;offset<40000;offset+=2500){const url=ADDRESS+'/query?'+params({where:'status <> 4',geometry:envelope,geometryType:'esriGeometryEnvelope',spatialRel:'esriSpatialRelIntersects',inSR:'4326',outSR:'4326',outFields:'objectid,fulladdress,structtype,status,postalverified,zipcode,numunits,name',returnGeometry:'true',resultOffset:String(offset),resultRecordCount:'2500',f:'geojson'});const result=await getJSON(url);const page=result.features||[];features.push(...page);if(page.length<2500&&!result.exceededTransferLimit)break;if(!page.length)break}return features.filter(x=>x.geometry?.type==='Point'&&contains(geo,x.geometry.coordinates)).map(x=>{const p=x.properties,k=classify(p.structtype);return {id:'c'+p.objectid,address:label(p.fulladdress||p.name),kind:k,postal:Number(p.postalverified),type:Number(p.structtype),lat:x.geometry.coordinates[1],lng:x.geometry.coordinates[0]}}).filter(x=>x.kind!=='other').sort((a,b)=>a.address.localeCompare(b.address))}
async function loadFlags(n){state.flags.clear();if(!state.user)return;try{const {data,error}=await supabase.from('sector_property_statuses').select('property_id,contacted,declined,excluded,active_business,vip,notes').eq('sector',n).eq('user_id',state.user.id).limit(10000);if(error)throw error;for(const r of data||[])state.flags.set(statusKey(r.property_id),r);state.dbReady=true}catch(e){state.dbReady=false;console.warn('UMX status sync unavailable',e.message)}}
function visibleRows(){const list=state.cache.get(state.sector)||[];return list.filter(x=>x.kind===state.kind).filter(x=>!state.search||x.address.toLowerCase().includes(state.search))}
function refresh(){const n=state.sector;const list=visibleRows();$('records-title').textContent=(state.kind==='home'?'Homes':'Businesses')+' · '+n;$('data-source').textContent='Current county GIS address records · personal outreach notes saved separately';$('record-count').textContent=list.length.toLocaleString()+' address records';$('show-more').hidden=list.length<=state.visible;const root=$('record-list');root.replaceChildren();for(const row of list.slice(0,state.visible)){const b=document.createElement('button');b.className='record';const a=document.createElement('span');const pin=document.createElement('i');pin.style.background=pointColor(row);pin.style.outline=row.postal===1?'none':'2px solid #ffae39';a.append(pin,document.createTextNode(row.address));const status=document.createElement('em');status.textContent=statusText(row);b.append(a,status);b.onclick=()=>selectRow(row);root.append(b)}if(!list.length){const p=document.createElement('p');p.style.padding='14px';p.style.color='#a7b1bd';p.textContent='No matching county address records for this sector / tab.';root.append(p)}drawPins();renderStrip();}
function drawPins(){
 const m=state.map;if(!m?.getSource('umx-points'))return;
 const list=visibleRows();
 const features=list.map(x=>{const s=getStats(x);return {type:'Feature',geometry:{type:'Point',coordinates:[x.lng,x.lat]},properties:{
  id:x.id,color:pointColor(x),vip:s.vip,postalUnverified:!s.postal,declined:s.declined,excluded:s.excluded,kind:x.kind
 }}});
 m.getSource('umx-points').setData({type:'FeatureCollection',features});
 const all=state.cache.get(state.sector)||[];
 $('insight-homes').textContent=all.filter(x=>x.kind==='home').length.toLocaleString();
 $('insight-biz').textContent=all.filter(x=>x.kind==='biz').length.toLocaleString();
 $('insight-vip').textContent=all.filter(x=>getStats(x).vip).length.toLocaleString();
 $('insight-blocked').textContent=all.filter(x=>{const f=getStats(x);return f.declined||f.excluded}).length.toLocaleString();
}

function selectRow(row){state.selection=row;$('profile').hidden=false;$('profile-address').textContent=row.address;$('profile-detail').textContent=(row.kind==='home'?'Residential address':'Commercial-coded address')+' • County postal: '+(row.postal===1?'Postal Verified':'Not currently certified by county')+(row.type===2001?' • Hospital: automatically excluded':'');const f=flagFor(row.id);for(const [name,prop] of [['contacted','contacted'],['declined','declined'],['excluded','excluded'],['active','active_business'],['vip','vip']])$('flag-'+name).checked=!!f[prop];$('flag-active').disabled=row.kind!=='biz';$('flag-excluded').disabled=row.type===2001;$('flag-excluded').checked=!!f.excluded||row.type===2001;$('flag-reason').value=f.notes||'';$('save-message').textContent=state.dbReady?'Stored in private UMX OS':'Status database not ready — saving disabled';$('save-flags').disabled=!state.dbReady;state.map.easeTo({center:[row.lng,row.lat],zoom:Math.max(15,state.map.getZoom()),duration:480});$('profile').scrollIntoView({behavior:'smooth',block:'nearest'})}
async function saveFlags(){if(!state.selection||!state.user||!state.dbReady)return;const row=state.selection;const f={user_id:state.user.id,property_id:row.id,sector:state.sector,contacted:$('flag-contacted').checked,declined:$('flag-declined').checked,excluded:$('flag-excluded').checked||row.type===2001,active_business:row.kind==='biz'&&$('flag-active').checked,vip:$('flag-vip').checked,notes:$('flag-reason').value.trim(),updated_at:new Date().toISOString()};$('save-flags').disabled=true;$('save-message').textContent='Saving…';try{const {error}=await supabase.from('sector_property_statuses').upsert(f,{onConflict:'user_id,property_id'});if(error)throw error;state.flags.set(row.id,f);$('save-message').textContent='Saved to UMX OS';refresh()}catch(e){$('save-message').textContent='NOT SAVED: '+e.message}finally{$('save-flags').disabled=false}}
function connectEvents(){document.querySelectorAll('.tabs [data-kind]').forEach(b=>b.onclick=()=>{state.kind=b.dataset.kind;state.visible=8;state.search='';$('search-address').value='';$('profile').hidden=true;document.querySelectorAll('.tabs button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',String(x===b))});refresh()});$('streets').onclick=()=>setTiles('street');$('satellite').onclick=()=>setTiles('satellite');$('tilt-view').onclick=()=>{const flat=state.map.getPitch()>10;state.map.easeTo({pitch:flat?0:52,bearing:flat?0:-19,duration:600});$('tilt-view').textContent=flat?'3D View':'2D View'};$('sector-prev').onclick=()=>{state.page=Math.max(0,state.page-1);renderStrip()};$('sector-next').onclick=()=>{state.page=Math.min(Math.ceil(NAMES.length/3)-1,state.page+1);renderStrip()};$('all-sectors-toggle').onclick=()=>{$('all-sectors').hidden=!$('all-sectors').hidden};$('sector-select').onchange=e=>{state.page=Math.floor(NAMES.indexOf(e.target.value)/3);loadSector(e.target.value)};$('search-address').oninput=e=>{state.search=e.target.value.trim().toLowerCase();state.visible=8;refresh()};$('show-more').onclick=()=>{state.visible+=24;refresh()};$('profile-close').onclick=()=>{$('profile').hidden=true};$('save-flags').onclick=saveFlags;$('print-contract').onclick=()=>window.print()}
bootstrap();
