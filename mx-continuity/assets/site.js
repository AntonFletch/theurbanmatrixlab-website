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
// No checkout URLs are embedded in the pre-launch package. Payment activation requires a durable signed Project Order, server-side consent verification, and a reviewed live integration.
const form=document.querySelector('#inquiry-form');
if(form){
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const status=document.querySelector('#form-status');
  if(status){status.setAttribute('role','status');status.textContent='Inquiry intake is not yet enabled. No information has been submitted. We are preparing the secure contact process before launch.';}
 });
}
