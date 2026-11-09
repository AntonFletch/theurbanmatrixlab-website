"use strict";
const MX_CONFIG={prelaunch:true,checkoutEnabled:false,contactEnabled:false};
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
