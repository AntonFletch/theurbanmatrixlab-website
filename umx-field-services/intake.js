"use strict";
// Public pre-launch interest only. This browser never accesses UMX customer tables directly.
const ENDPOINT='https://xdaxbueyftyljsrhabpx.supabase.co/functions/v1/public-service-request';
const form=document.getElementById('interest-form');
const submit=document.getElementById('submit-interest');
const message=document.getElementById('form-message');
const allowedServices=new Set([
  'Leaf cleanup and full hauling','Snow removal','Ice control','Winter property checks',
  'Vehicle snow and driveway exit','Roof snow and icicle interest only','Multiple winter services'
]);
function setMessage(content,state=''){
  message.textContent=content;message.dataset.state=state;
}
function clean(value,max){
  return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(submit.disabled)return;
  setMessage('');
  if(!form.reportValidity()){setMessage('Please finish the required fields.','error');return}
  const values=new FormData(form);
  const address=clean(values.get('address'),250);
  const name=clean(values.get('name'),120);
  const email=clean(values.get('email'),254);
  const phone=clean(values.get('phone'),35);
  const type=clean(values.get('property_type'),75);
  const service=clean(values.get('service'),120);
  const method=clean(values.get('contact_method'),20);
  const notes=clean(values.get('details'),1800);
  const honey=clean(values.get('website'),200);
  if(!name||!email||address.length<5||!allowedServices.has(service)||!type||notes.length<5||
    values.get('northside')!=='on'||values.get('permission')!=='on'){
    setMessage('Please complete the Northside property information.','error');return
  }
  if(method==='Phone'&&!phone){setMessage('Enter a phone number if you prefer a phone reply.','error');return}
  const payload={
    name,email,company:type==='Property manager / multiple locations'?'Property management inquiry':null,
    service:'Northside pre-launch: '+service,
    location:address,
    details:[
      'UMX FIELD SERVICES — NORTHSIDE INTEREST ONLY. Not a booking.',
      'Property type: '+type,
      'Preferred response: '+method,
      'Contact phone: '+(phone||'Not supplied'),
      'Northside location: self-attested; staff verification required',
      'Customer notes: '+notes
    ].join('\n'),
    website:honey
  };
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),20000);
  submit.disabled=true;submit.textContent='Sending securely…';
  try{
    const response=await fetch(ENDPOINT,{
      method:'POST',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:controller.signal
    });
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok||data.ok!==true){
      if(response.status===429)throw Error('Too many attempts. Please try later or email UMX.');
      if(response.status===400)throw Error('Some details were not accepted. Please review the form.');
      throw Error('We could not confirm your submission. Please try again or contact UMX.');
    }
    setMessage('Your Northside interest is recorded. This is not a service booking. UMX will review the request.','success');
    form.reset();
  }catch(error){
    setMessage(error?.name==='AbortError'?'The connection timed out. Please check with UMX before submitting again.':error.message||'Submission unavailable.','error');
  }finally{
    clearTimeout(deadline);
    submit.disabled=false;submit.textContent='Submit Northside interest →';
  }
});