"use strict";
const MX_CONFIG={prelaunch:true,checkoutEnabled:false,contactEnabled:true};
const mobileButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.main-nav');
if(mobileButton&&nav){
 const close=()=>{nav.classList.remove('open');mobileButton.setAttribute('aria-expanded','false')};
 mobileButton.addEventListener('click',()=>{const opening=!nav.classList.contains('open');nav.classList.toggle('open',opening);mobileButton.setAttribute('aria-expanded',String(opening));});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){const restore=nav.contains(document.activeElement);close();if(restore)mobileButton.focus()}});
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
  // Repair known accessibility defects in the embedded chat's host-page markup.
  // Preserve the chat service and its behavior; do not alter its network requests.
  const repairChatAccessibility=()=>{
    document.querySelectorAll('button.standard-position-action-btn').forEach(button=>{
      if(!button.getAttribute('aria-label')&&!button.getAttribute('aria-labelledby')&&!button.textContent.trim())button.setAttribute('aria-label',button.getAttribute('title')||'Live chat');
    });
    document.querySelectorAll('.proactive-avatar-status-badge').forEach(badge=>{
      if(badge.style.getPropertyValue('color')!=='rgb(12, 35, 20)'||badge.style.getPropertyPriority('color')!=='important')badge.style.setProperty('color','#0c2314','important');
    });
    document.querySelectorAll('[data-testid^="tiled-avatar-"] img.img').forEach(img=>{
      // These are decorative tiled team portraits, not individual contact controls.
      if(!img.hasAttribute('alt')&&!img.hasAttribute('aria-label')&&!img.hasAttribute('aria-labelledby'))img.setAttribute('alt','');
    });
  };
  const observer=new MutationObserver(repairChatAccessibility);
  observer.observe(document.body,{childList:true,subtree:true});
  script.addEventListener('load',repairChatAccessibility);
  document.head.appendChild(script);
  repairChatAccessibility();
})();

