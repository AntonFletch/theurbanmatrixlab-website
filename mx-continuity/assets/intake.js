"use strict";
(() => {
  const form=document.getElementById("inquiry-form");
  if(!form)return;
  const config=window.MX_INTAKE_CONFIG||{};
  const submit=form.querySelector('[type="submit"]');
  const status=document.getElementById("form-status");
  const captcha=document.getElementById("inquiry-captcha");
  const say=(message,error=false)=>{if(status){status.textContent=message;status.setAttribute("role",error?"alert":"status");}};
  const active=typeof MX_CONFIG!=="undefined" &&
    MX_CONFIG.prelaunch===false && MX_CONFIG.contactEnabled===true &&
    config.enabled===true && location.protocol==="https:" &&
    location.origin===config.allowedOrigin &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||"") &&
    typeof config.publishableKey==="string" && config.publishableKey.startsWith("sb_publishable_") &&
    typeof config.turnstileSiteKey==="string" && config.turnstileSiteKey.length>0;
  if(!active){submit.disabled=true;say("Online inquiries are not accepting submissions. Please use the business email listed on this page.");return;}
  let turnstileToken="",widget=null,requestId="",busy=false;
  submit.disabled=false;submit.textContent="Send project inquiry";
  say("Complete the fields, contact consent and bot verification.");
  const script=document.createElement("script");
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async=true;script.defer=true;
  script.onload=()=>{
    if(!window.turnstile)return say("Bot verification is unavailable. Please use email.",true);
    widget=window.turnstile.render(captcha,{
      sitekey:config.turnstileSiteKey,action:"matrix_intake",
      callback:token=>{turnstileToken=token;},
      "expired-callback":()=>{turnstileToken="";},
      "error-callback":()=>{turnstileToken="";say("Verification failed. Please retry.",true);}
    });
  };
  script.onerror=()=>say("Bot verification could not load. Please use email.",true);
  document.head.appendChild(script);
  form.addEventListener("input",()=>{requestId="";});
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy||!form.reportValidity())return;
    if(form.elements.company_website.value.trim())return say("Verification failed.",true);
    if(!form.elements.contact_consent.checked)return say("Please authorize contact.",true);
    if(!turnstileToken)return say("Complete bot verification first.",true);
    if(!requestId)requestId=crypto.randomUUID();
    const data={
      request_id:requestId,contact_name:form.elements.contact_name.value.trim(),
      email:form.elements.email.value.trim(),business_name:form.elements.business_name.value.trim(),
      package_interest:form.elements.package.value.trim(),problems:form.elements.description.value.trim(),
      phone:"",website:"",industry:"",current_process:"",desired_features:"",
      contact_consent:true,consent_version:"contact-v1",turnstileToken
    };
    busy=true;submit.disabled=true;say("Sending securely…");
    try{
      const res=await fetch(config.supabaseUrl+"/functions/v1/veil-public-intake",{
        method:"POST",mode:"cors",credentials:"omit",redirect:"error",cache:"no-store",
        headers:{"Content-Type":"application/json",apikey:config.publishableKey},
        body:JSON.stringify(data),signal:AbortSignal.timeout(15000)
      });
      const result=await res.json().catch(()=>({}));
      if(res.ok&&result.ok===true&&typeof result.lead_id==="string"){
        say("Inquiry received. Reference: "+result.lead_id+". Save this number; an email confirmation is not yet guaranteed.");
        form.reset();requestId="";
      }else if(res.status===503&&result.error==="prelaunch"){
        say("Online inquiries are not yet available. No request was accepted.",true);
      }else if(res.status===429){
        say("Too many requests. Please use email.",true);
      }else{
        say("Receipt could not be confirmed. Please email us before retrying.",true);
      }
    }catch(_){say("Connection failed; receipt is unconfirmed. Please use email before retrying.",true);}
    finally{
      busy=false;submit.disabled=false;turnstileToken="";
      if(widget!==null&&window.turnstile)window.turnstile.reset(widget);
    }
  });
})();
