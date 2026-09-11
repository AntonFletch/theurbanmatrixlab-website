let sessionUser=null,filter='all',map,markers=[];let targets=[],jobs=[],contracts=[],leads=[];const $=s=>document.querySelector(s);const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
async function boot(){const {data:{session}}=await umxDb.auth.getSession();if(!session){location.href='login.html';return}sessionUser=session.user;const {data:profile}=await umxDb.from('profiles').select('Full_Name,role').eq('id',sessionUser.id).maybeSingle();$('#employee-name').textContent=profile?.Full_Name||sessionUser.email;initMap();await loadData()}
function initMap(){
  const touchDevice=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
  map=L.map('mission-map',{zoomControl:false,dragging:!touchDevice,touchZoom:false,doubleClickZoom:!touchDevice,boxZoom:!touchDevice,keyboard:!touchDevice}).setView([46.8721,-113.994],12);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri'}).addTo(map);
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(map);

  if(touchDevice){
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();

    const el=map.getContainer();
    el.classList.remove('leaflet-touch-drag','leaflet-touch-zoom');
    el.style.setProperty('touch-action','pan-y','important');

    // Keep the touch controller OUTSIDE Leaflet's event tree. This is the key:
    // one-finger gestures belong to the webpage; only two-finger gestures are
    // intercepted and translated into map pan/zoom.
    const wrapper=document.createElement('div');
    wrapper.className='umx-map-touch-wrapper';
    wrapper.style.position='relative';
    wrapper.style.width='100%';
    el.parentNode.insertBefore(wrapper,el);
    wrapper.appendChild(el);

    const shield=document.createElement('div');
    shield.setAttribute('aria-label','Map touch control. One finger scrolls the page. Use two fingers to move or zoom the map.');
    Object.assign(shield.style,{position:'absolute',inset:'0',zIndex:'700',background:'transparent'});
    shield.style.setProperty('touch-action','pan-y','important');
    wrapper.appendChild(shield);

    let active=false,lastMid=null,lastDist=0,startPoint=null,moved=false;
    const mid=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
    const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);

    shield.addEventListener('touchstart',e=>{
      // Never let a one-finger touch reach Leaflet. Do not preventDefault:
      // the browser is therefore free to scroll the webpage normally.
      e.stopPropagation();
      if(e.touches.length===1){
        active=false;lastMid=null;lastDist=0;moved=false;
        startPoint={x:e.touches[0].clientX,y:e.touches[0].clientY};
        return;
      }
      if(e.touches.length>=2){
        active=true;lastMid=mid(e.touches);lastDist=dist(e.touches);moved=true;
        if(e.cancelable)e.preventDefault();
      }
    },{passive:false});

    shield.addEventListener('touchmove',e=>{
      e.stopPropagation();
      if(e.touches.length===1){
        if(startPoint){const dx=e.touches[0].clientX-startPoint.x,dy=e.touches[0].clientY-startPoint.y;if(Math.hypot(dx,dy)>8)moved=true;}
        // Intentionally no preventDefault here: one finger scrolls the page.
        return;
      }
      if(e.touches.length<2)return;
      if(!active){active=true;lastMid=mid(e.touches);lastDist=dist(e.touches);moved=true;}
      if(e.cancelable)e.preventDefault();
      const rect=el.getBoundingClientRect();
      const nextMid=mid(e.touches),nextDist=dist(e.touches);
      if(lastMid)map.panBy([lastMid.x-nextMid.x,lastMid.y-nextMid.y],{animate:false});
      if(lastDist>0&&nextDist>0){
        const ratio=nextDist/lastDist;
        if(Math.abs(ratio-1)>.02){
          const delta=Math.log(ratio)/Math.log(1.22);
          const center=map.containerPointToLatLng([nextMid.x-rect.left,nextMid.y-rect.top]);
          const z=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+delta));
          map.setZoomAround(center,z,{animate:false});
        }
      }
      lastMid=nextMid;lastDist=nextDist;
    },{passive:false});

    shield.addEventListener('touchend',e=>{
      e.stopPropagation();
      if(active&&e.touches.length<2){active=false;lastMid=null;lastDist=0;}
      // Preserve ordinary single-tap marker/control use without allowing the
      // overlay to trap a one-finger swipe.
      if(!active&&e.touches.length===0&&!moved&&startPoint){
        const x=startPoint.x,y=startPoint.y;
        shield.style.pointerEvents='none';
        const under=document.elementFromPoint(x,y);
        shield.style.pointerEvents='auto';
        const target=under?.closest?.('.leaflet-interactive,.leaflet-control a,.leaflet-control button');
        if(target)target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
      }
      if(e.touches.length===0){startPoint=null;moved=false;}
    },{passive:true});
    shield.addEventListener('touchcancel',e=>{e.stopPropagation();active=false;lastMid=null;lastDist=0;startPoint=null;moved=false;},{passive:true});
  }
}
async function loadData(){const [t,j,c,l]=await Promise.all([umxDb.from('umx_business_targets').select('*'),umxDb.from('umx_jobs').select('*,umx_properties(address,city,state,latitude,longitude),umx_services(name),umx_job_assignments(employee_id)'),umxDb.from('umx_contracts').select('*'),umxDb.from('umx_employee_leads').select('*').eq('employee_id',sessionUser.id)]);targets=t.data||[];jobs=j.data||[];contracts=c.data||[];leads=l.data||[];render()}
function items(){const jobItems=jobs.map(j=>({id:j.id,type:'job',name:j.title,status:String(j.status).replaceAll('_',' '),address:j.umx_properties?.address||'Assigned property',lat:Number(j.umx_properties?.latitude),lng:Number(j.umx_properties?.longitude),summary:j.description||j.umx_services?.name||'Open the job record for approved scope.',data:j})).filter(x=>x.lat&&x.lng);const opportunities=targets.map(t=>({id:t.id,type:'opportunity',name:t.business_name,status:t.outreach_status.replaceAll('_',' '),address:t.address||'Missoula',lat:Number(t.latitude),lng:Number(t.longitude),summary:t.summary||'Potential UMX service opportunity.',data:t})).filter(x=>x.lat&&x.lng);const mine=leads.map(l=>({id:l.id,type:'lead',name:l.business_name,status:l.status.replaceAll('_',' '),address:l.address||'Missoula',lat:Number(l.latitude),lng:Number(l.longitude),summary:l.fit_reason,data:l})).filter(x=>x.lat&&x.lng);return [...jobItems,...opportunities,...mine]}
const color=x=>x.type==='job'?'#43d49b':x.type==='lead'?'#8b5cf6':'#e5bd58';function visible(){return items().filter(x=>filter==='all'||x.type===filter)}
function render(){markers.forEach(m=>m.remove());markers=[];visible().forEach(x=>{const marker=L.circleMarker([x.lat,x.lng],{radius:10,color:'#0b0711',weight:3,fillColor:color(x),fillOpacity:1}).addTo(map);marker.bindPopup(`<div class="popup"><h3>${esc(x.name)}</h3><b>${esc(x.status)}</b><p>${esc(x.summary)}</p><button onclick="openDetail('${x.type}','${x.id}')">Open record</button></div>`);markers.push(marker)});$('#mission-list').innerHTML=visible().map(x=>`<button class="mission-item" onclick="focusItem('${x.type}','${x.id}')"><i style="background:${color(x)}"></i><span><em>${esc(x.status)}</em><b>${esc(x.name)}</b><small>${esc(x.address)}</small></span></button>`).join('')||'<div class="empty">No records in this view yet.</div>';const activeContracts=contracts.filter(c=>['signed','active'].includes(c.status)),mrr=activeContracts.reduce((s,c)=>s+Number(c.monthly_value||0),0),points=leads.reduce((s,l)=>s+Number(l.reward_points||0),0);$('#reward-points').textContent=points;$('#command-stats').innerHTML=`<div class="command-stat"><small>Mapped businesses</small><b>${targets.length}</b></div><div class="command-stat"><small>Assigned jobs</small><b>${jobs.length}</b></div><div class="command-stat"><small>My leads</small><b>${leads.length}</b></div><div class="command-stat"><small>Contracted monthly</small><b>${money(mrr)}</b></div>`}
window.focusItem=(type,id)=>{const x=items().find(i=>i.type===type&&i.id===id);if(!x)return;map.setView([x.lat,x.lng],15);const index=visible().indexOf(x);markers[index]?.openPopup()};window.openDetail=(type,id)=>{const x=items().find(i=>i.type===type&&i.id===id);if(!x)return;let extra='';if(type==='opportunity'){const c=contracts.find(row=>row.target_id===id);extra=c?`<h3>Contract</h3><p><b>${esc(c.contract_title)}</b><br>Status: ${esc(c.status)}<br>Monthly value: ${money(c.monthly_value)}<br>Deposit: ${money(c.deposit_amount)}<br>${esc(c.service_scope||'')}</p>`:'<p>No contract attached.</p>'}if(type==='lead')extra=`<h3>Reward status</h3><p>${esc(x.data.bonus_status.replaceAll('_',' '))} · ${money(x.data.bonus_amount)} · ${x.data.reward_points} points</p>`;$('#detail-content').innerHTML=`<p class="eyebrow">${esc(type)}</p><h2>${esc(x.name)}</h2><p>${esc(x.address)}</p><h3>Summary</h3><p>${esc(x.summary)}</p>${extra}<p class="form-intro">Employees cannot change scope, quote final pricing, promise dates, or sign agreements without written authorization.</p>`;$('#detail-dialog').showModal()};
document.querySelectorAll('.map-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.map-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()}));$('#propose-lead').onclick=()=>$('#lead-dialog').showModal();$('#lead-form').addEventListener('submit',async e=>{e.preventDefault();const m=$('#lead-message'),d=Object.fromEntries(new FormData(e.target));m.textContent='Submitting…';const {error}=await umxDb.from('umx_employee_leads').insert({...d,latitude:Number(d.latitude),longitude:Number(d.longitude),employee_id:sessionUser.id});if(error){m.textContent=error.message;return}e.target.reset();$('#lead-dialog').close();await loadData()});$('#sign-out').onclick=async()=>{await umxDb.auth.signOut();location.href='login.html'};boot();
// map-touch-control-v2: 2026-09-10