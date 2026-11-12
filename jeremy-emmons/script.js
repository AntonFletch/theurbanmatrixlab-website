(()=>{'use strict';
const art=[
 {id:'JE-001',name:'Yellow Orbit',src:'art-01.jpg',unframed:695,desc:'A personally significant original by Jeremy Emmons, with expressive yellow, blue, and red forms.',alt:'Yellow, red and blue abstract painting signed by Jeremy Emmons'},
 {id:'JE-002',name:'Riverlight',src:'art-02.jpg',unframed:445,desc:'Cool blues and soft greens create the rhythm of an imagined landscape.',alt:'Blue and green landscape-like original painting'},
 {id:'JE-003',name:'Blue Motion',src:'art-03.jpg',unframed:545,desc:'Sweeping cerulean marks move across a white ground.',alt:'Energetic blue abstract painting with small touches of red'},
 {id:'JE-004',name:'The Archive',src:'art-04.jpg',unframed:445,desc:'Signs, intricate marks and circular forms in lavender and pale blue.',alt:'Purple and pale blue painting with flowers and cryptic symbols'},
 {id:'JE-005',name:'Sun Dial',src:'art-05.jpg',unframed:465,desc:'An architectural composition in yellow, blue and green.',alt:'Yellow blue and green original architectural abstract painting'},
 {id:'JE-006',name:'Electric Tree',src:'art-06.jpg',unframed:585,desc:'A branching blue tree erupts across a vivid yellow sky.',alt:'Blue branching tree against a bright yellow background'},
 {id:'JE-007',name:'Two Faces',src:'art-07.jpg',unframed:565,desc:'An expressive, figure-like painting layered with purple, red and black.',alt:'Expressionist painting with surreal figures and bold violet color'},
 {id:'JE-008',name:'Blue Fields',src:'art-08.jpg',unframed:475,desc:'Lines and gestures in a deep and luminous blue field.',alt:'Abstract original painting in layers of rich blue and white'},
 {id:'JE-009',name:'Golden Leaves',src:'art-09.jpg',unframed:425,desc:'A lyrical study of leaves and handwritten marks in gold.',alt:'Minimalist yellow gold leaves with Jeremy Emmons handwritten signature'},
 {id:'JE-010',name:'Wildwood',src:'art-10.jpg',unframed:515,desc:'A lively branching composition built from color and movement.',alt:'Bright red yellow and blue expressionist tree and branches'}
];
const finishes=[
 {id:'black',label:'Matte black',short:'Black',info:'Cardinali Renewal Core, black; a minimal floater frame for stretched canvas.',color:'linear-gradient(125deg,#333,#080808)',upgrade:55,product:'Cardinali Renewal Core • Black',sku:'V36647'},
 {id:'white',label:'White / black',short:'White',info:'Cardinali Renewal Core, black and white finish; a crisp contemporary edge.',color:'linear-gradient(130deg,#f9f9f8,#ccc,#222)',upgrade:55,product:'Cardinali Renewal Core • Black / White',sku:'V37254'},
 {id:'gold',label:'Black / antique gold',short:'Gold',info:'Cardinali Renewal Core with an antique-gold accented finish.',color:'linear-gradient(140deg,#111 50%,#b79a62 51%)',upgrade:65,product:'Cardinali Renewal Core • Black / Antique Gold',sku:'V37176'},
 {id:'walnutgold',label:'Walnut / gold',short:'Special',info:'Premium special-order finish. Supplier has a four-frame minimum; this selection is confirmed by quote before any order.',color:'linear-gradient(130deg,#70452a,#b99a5d)',upgrade:85,product:'Creative Mark Illusions • Gold / Walnut (special order)',sku:'69154'}
];
const storeConfig=window.JEREMY_STORE_CONFIG||{publicContactEmail:'',inquiryEndpoint:'',turnstileSiteKey:'',status:'PRELAUNCH'};
const total=(a,framed,index)=>a.unframed+(framed?finishes[index].upgrade:0);
const $=id=>document.getElementById(id),fmt=n=>'$'+n.toLocaleString('en-US');
const gallery=$('gallery'),dialog=$('artDialog'),splash=$('signatureSplash'),frameObject=$('frameObject');
let current=art[0],frameIndex=0,choice='unframed',phase='ask',start=null,toastTimer=null;
$('year').textContent=new Date().getFullYear();
const sendBtn=$('sendInquiry');
/* Send is intentionally held until complete verified anti-spam integration and seller approval. */
// No network transmission occurs in the unconfigured preview.
function buildCards(){
 for(const a of art){
  const card=document.createElement('article');card.className='art-card';
  const button=document.createElement('button');button.type='button';button.className='art-button';
  button.setAttribute('aria-label',`View ${a.name}, unframed ${fmt(a.unframed)}, framed from ${fmt(total(a,true,0))}`);
  const photo=document.createElement('div');photo.className='art-photo';
  const img=document.createElement('img');img.loading='eager';img.src='assets/'+(a.thumbnail||a.src);img.alt=a.alt;
  const count=document.createElement('span');count.className='art-number';count.textContent=a.id;
  const open=document.createElement('span');open.className='art-open';open.textContent='+';open.setAttribute('aria-hidden','true');
  photo.append(img,count,open);
  if(a.existing){const b=document.createElement('span');b.className='already';b.textContent='ALREADY FRAMED';photo.append(b);}
  const meta=document.createElement('div');meta.className='art-meta';meta.innerHTML=`<div><h3>${a.name}</h3><p>${a.id==='JE-001'?'FEATURED ORIGINAL · ONE OF ONE':'ONE-OF-ONE ORIGINAL'}</p></div><div class="art-pricing"><strong>${fmt(a.unframed)}</strong><small>Frame from +${fmt(finishes[0].upgrade)}</small></div>`;
  button.append(photo,meta);card.append(button);button.addEventListener('click',()=>openArt(a));gallery.append(card);
 }
}
buildCards();
function showSplash(){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){splash.classList.add('is-hidden');return;}
 splash.classList.remove('is-hidden','is-gone');void splash.offsetWidth;
 setTimeout(()=>splash.classList.add('is-gone'),2200);
 setTimeout(()=>splash.classList.add('is-hidden'),3300);
}
let seen=false;try{seen=sessionStorage.getItem('jeremy_signature_shown')==='1';sessionStorage.setItem('jeremy_signature_shown','1');}catch(_){seen=false;}
if(seen && !new URLSearchParams(location.search).has('intro')){splash.classList.add('is-hidden');}else{showSplash();}
splash.addEventListener('click',()=>{splash.classList.add('is-gone');setTimeout(()=>splash.classList.add('is-hidden'),1100);});
$('replaySignature').addEventListener('click',showSplash);
function step(s){phase=s;$('choiceStep').hidden=s!=='ask';$('frameStep').hidden=s!=='frames';$('summaryStep').hidden=s!=='summary';$('modalStepText').textContent=s==='ask'?'01 / THE PAINTING':s==='frames'?'02 / FRAME DESIGN':'03 / YOUR SELECTION';$('swipeNote').hidden=s!=='frames';}
function sizeToStage(){
 const im=$('modalImage'),stage=$('swipeArea');
 const r=(im.naturalWidth&&im.naturalHeight)?im.naturalWidth/im.naturalHeight:4/5;
 const fpad=choice==='framed'?40:0;
 const availableW=Math.max(150,Math.min(stage.clientWidth-54,460)-fpad);
 const availableH=Math.max(180,stage.clientHeight-48-fpad);
 const w=Math.max(70,Math.min(availableW,availableH*r));
 const h=w/r;
 frameObject.style.setProperty('--art-render-width',Math.floor(w)+'px');
 frameObject.style.setProperty('--art-render-height',Math.floor(h)+'px');
}
$('modalImage').addEventListener('load',sizeToStage);
window.addEventListener('resize',()=>{if(dialog.open)sizeToStage()});
function render(){
 const framed=choice==='framed',f=finishes[frameIndex];
 frameObject.className='framed-work frame-'+(framed?f.id:'none');
 if($('modalImage').dataset.assetName!==current.src){$('modalImage').dataset.assetName=current.src;$('modalImage').src='assets/'+current.src;}
 $('modalVisualLabel').textContent=framed?`${f.label.toUpperCase()} / RATIO-FITTED VISUAL PREVIEW`:'ORIGINAL / UNFRAMED';
 $('frameName').textContent=f.label+' · +'+fmt(f.upgrade);
 $('frameDesc').textContent=f.info;
 $('frameCount').textContent=String(frameIndex+1).padStart(2,'0')+' / '+String(finishes.length).padStart(2,'0');
 $('framedPrice').textContent=fmt(total(current,true,frameIndex));
 $('lineArtwork').textContent=fmt(current.unframed);
 $('lineUpgrade').textContent='+'+fmt(f.upgrade);
 $('productName').textContent=f.product;
 $('productSpecs').textContent='Supplier-listed 16 × 20 in. / ¾-in. canvas depth'+(f.id==='walnutgold'?' · SPECIAL ORDER (4-FRAME MINIMUM)':' · STANDARD CHOICE')+(f.sku?' · SKU '+f.sku:'');
 document.querySelectorAll('[data-frame]').forEach(b=>{const on=Number(b.dataset.frame)===frameIndex;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 requestAnimationFrame(sizeToStage);
}
function openArt(a){current=a;frameIndex=0;choice='unframed';$('modalNumber').textContent=a.id;$('modalTitle').textContent=a.name;$('modalDescription').textContent=a.desc;$('modalImage').alt=a.alt;$('modalBasePrice').textContent=fmt(a.unframed);$('framedNote').textContent=a.existing?'This artwork already has a physical black frame. Pricing for selling without it or changing its frame requires Jeremy’s approval. The other finishes are only visual simulations.':'These are stylized renderings of identifiable supplier products, not photos of those frames. Real-world dimensions and fit require verification.';step('ask');render();dialog.showModal();document.body.classList.add('lock');}
function closeArt(){dialog.close();document.body.classList.remove('lock');}
$('closeModal').addEventListener('click',closeArt);
dialog.addEventListener('click',event=>{if(event.target===dialog)closeArt();});dialog.addEventListener('close',()=>document.body.classList.remove('lock'));
$('frameYes').addEventListener('click',()=>{choice='framed';frameIndex=0;step('frames');render();});
$('frameNo').addEventListener('click',()=>{choice='unframed';step('summary');render();summary();});
function selectFrame(n){frameIndex=(n+finishes.length)%finishes.length;choice='framed';render();}
$('prevFrame').addEventListener('click',()=>selectFrame(frameIndex-1));$('nextFrame').addEventListener('click',()=>selectFrame(frameIndex+1));
for(let i=0;i<finishes.length;i++){
 const f=finishes[i];const dot=document.createElement('button');dot.type='button';dot.dataset.frame=i;dot.setAttribute('aria-label',`Preview ${f.label} frame`);dot.addEventListener('click',()=>selectFrame(i));$('frameDots').append(dot);
 const btn=document.createElement('button');btn.type='button';btn.dataset.frame=i;btn.className='swatch';btn.setAttribute('aria-label',`Choose ${f.label}`);btn.innerHTML=`<i style="background:${f.color}"></i><span>${f.short}</span>`;btn.addEventListener('click',()=>selectFrame(i));$('swatches').append(btn);
}
function summary(){$('summaryArt').textContent=current.name+' · '+current.id;$('summaryFrame').textContent=choice==='framed'?finishes[frameIndex].label:'Unframed';$('summaryPrice').textContent=fmt(total(current,choice==='framed',frameIndex));$('summaryBase').textContent=fmt(current.unframed);$('summaryUpgrade').textContent=choice==='framed'?'+'+fmt(finishes[frameIndex].upgrade):'None';}
$('frameConfirm').addEventListener('click',()=>{step('summary');summary();});$('frameBack').addEventListener('click',()=>{choice='unframed';step('ask');render();});$('editInquiry').addEventListener('click',()=>{step(choice==='framed'?'frames':'ask');render();});
const stage=$('swipeArea');
stage.addEventListener('pointerdown',ev=>{if(phase==='frames')start={x:ev.clientX,y:ev.clientY};});
stage.addEventListener('pointerup',ev=>{if(phase!=='frames'||!start)return;const dx=ev.clientX-start.x,dy=ev.clientY-start.y;start=null;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.2)selectFrame(frameIndex+(dx<0?1:-1));});
stage.addEventListener('pointercancel',()=>{start=null;});
dialog.addEventListener('keydown',e=>{if(phase==='frames'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();selectFrame(frameIndex+(e.key==='ArrowRight'?1:-1));}});
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}

function inquiryText(){
 const e=(id)=>$(id).value.trim();
 return `JEREMY EMMONS — ORIGINAL ARTWORK INQUIRY\n\nCustomer: ${e('buyerName')}\nReply email: ${e('buyerEmail')}\nFulfillment: ${e('buyerFulfillment')}\nNote: ${e('buyerMessage')||'None'}\n\nArtwork: ${current.name} (${current.id})\nPresentation: ${choice==='framed'?finishes[frameIndex].label:'Unframed'}\nOriginal art proposed price: ${fmt(current.unframed)}\nFraming proposed upgrade: ${choice==='framed'?fmt(finishes[frameIndex].upgrade):'None'}\nProposed total (excludes shipping): ${fmt(total(current,choice==='framed',frameIndex))}\nSelected frame style: ${choice==='framed'?finishes[frameIndex].product:'Not requested'}\n\nNOT AN ORDER OR RESERVATION. Price, artwork availability, canvas size/depth, compatibility, fulfillment and payment must be confirmed directly by Jeremy before any sale. No payment has been collected.`;
}
function checkInquiry(){const n=$('buyerName'),e=$('buyerEmail'),ok=n.value.trim()&&e.validity.valid&&e.value.trim()&&$('buyerConsent').checked; $('inquiryError').hidden=!!ok;if(!ok){(n.value.trim()?e.validity.valid&&e.value.trim()?$('buyerConsent'):e:n).focus()}return !!ok;}
// Live sending requires a separately deployed HTTPS endpoint and human-verification site key.
// The worker validates server-side; browser prices must never be trusted as a purchase charge.
sendBtn.addEventListener('click',async()=>{
 if(!checkInquiry())return;
 const out=$('sendResult');out.textContent='';out.classList.remove('is-error');
 if(!$('buyerWebsite').value && storeConfig.inquiryEndpoint && storeConfig.turnstileSiteKey){
  out.textContent='This feature requires a configured anti-spam verification widget before activation. Use Copy Inquiry for now.';
 }else{out.textContent='Please use Copy Inquiry until live sending is configured.';out.classList.add('is-error');}
});
$('inquiryForm').addEventListener('submit',async ev=>{ev.preventDefault();if(!checkInquiry())return;const message=inquiryText();try{await navigator.clipboard.writeText(message);toast('Inquiry copied. No request has been sent.');}catch(_){const ta=document.createElement('textarea');ta.value=message;document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Inquiry copied; nothing was sent.':'Copy unavailable. Use Save Inquiry instead.');}});
$('downloadInquiry').addEventListener('click',()=>{if(!checkInquiry())return;const blob=new Blob([inquiryText()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Jeremy-Emmons-Inquiry-'+current.id+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Inquiry saved on your device; nothing was sent.');});
})();