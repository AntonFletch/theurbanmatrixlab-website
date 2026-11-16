"use strict";
const MX_CONFIG={prelaunch:true,checkoutEnabled:false,contactEnabled:true};
const mobileButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.main-nav');
if(mobileButton&&nav){
 const close=()=>{nav.classList.remove('open');mobileButton.setAttribute('aria-expanded','false')};
 mobileButton.addEventListener('click',()=>{const opening=!nav.classList.contains('open');nav.classList.toggle('open',opening);mobileButton.setAttribute('aria-expanded',String(opening));});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('click',e=>{if(!nav.contains(e.target)&&!mobileButton.contains(e.target))close()});
}
// Checkout remains disabled until written project orders and production payment controls are verified.
// Smith.ai Live Chat — MX Continuity public pages only.
// Chat service is billed separately by Smith.ai; installation does not change MX checkout settings.
(function installSmithAiChat(){
  if(window.SMITH?.smithChatAccount==="61dbafef-826c-45bc-a7a3-055fe772f8b0")return;
  window.SMITH=window.SMITH||{};
  window.SMITH.smithChatAccount="61dbafef-826c-45bc-a7a3-055fe772f8b0";
  window.SMITH.baseUrl="https://app.smith.ai";
  const script=document.createElement("script");
  script.async=true;
  script.type="text/javascript";
  script.src="https://app.smith.ai/chat/widget-latest.js";
  document.head.appendChild(script);
})();

