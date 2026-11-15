"use strict";
(() => {
  const form=document.getElementById("support-form");
  const button=document.getElementById("email-support-btn");
  const status=document.getElementById("support-status");
  if(!form||!button)return;
  const cfg=window.MX_SUPPORT_CONFIG||{};
  const say=value=>{if(status)status.textContent=value;};
  const endpoint=cfg.supabaseUrl+"/functions/v1/mx-public-support";
  let requestId=null, busy=false, savedCode=null;
  function preparedEmail(){
    const recipient=cfg.fallbackEmail||"TheUrbanMatrixLab@outlook.com";
    const subject="MX Continuity support — "+form.elements.subject.value.trim().slice(0,100);
    const body=[
      "MX Continuity support request","",
      "Name: "+form.elements.requester_name.value.trim(),
      "Reply email: "+form.elements.requester_email.value.trim(),
      "Priority: "+form.elements.priority.value,
      "Subject: "+form.elements.subject.value.trim(),"",
      "Description:",
      form.elements.description.value.trim(),"",
      "Do not send passwords, secret keys or payment details."
    ].join("\n");
    return "mailto:"+recipient+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  }
  const valid=()=>{if(!form.reportValidity())return false;
    if(!form.elements.privacy_ack.checked){say("Privacy acknowledgment is required.");return false;}
    return true;};
  form.addEventListener("input",()=>{if(savedCode){
    savedCode=null;requestId=null;button.textContent="Submit support request";
    say("Review the details and submit a new support ticket.");}});
  if(!cfg.enabled||location.origin!==cfg.allowedOrigin){
    button.textContent="Prepare support email";
    button.addEventListener("click",()=>{if(valid())window.location.href=preparedEmail();});
    say("Online ticketing isn't enabled at this address. Use your email app to contact support.");
    return;
  }
  button.textContent="Submit support request";
  const intro=document.getElementById("support-intro");
  if(intro)intro.textContent="Describe the issue and submit a tracked support ticket.";
  say("Submit to receive a ticket reference. No password or payment information should be entered.");
  button.addEventListener("click",async()=>{
    if(busy)return;
    if(savedCode){say("Support ticket "+savedCode+" is already recorded. Edit the form to submit a new issue.");return;}
    if(!valid())return;
    if(!requestId)requestId=crypto.randomUUID();
    const payload={
      request_id:requestId,
      requester_name:form.elements.requester_name.value.trim(),
      requester_email:form.elements.requester_email.value.trim(),
      subject:form.elements.subject.value.trim(),
      priority:form.elements.priority.value,
      description:form.elements.description.value.trim(),
      privacy_ack:true,
      company_website:form.elements.company_website.value
    };
    busy=true;button.disabled=true;say("Recording your support request…");
    try{
      const response=await fetch(endpoint,{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",
        headers:{"Content-Type":"application/json","apikey":cfg.publishableKey,
                 "Authorization":"Bearer "+cfg.publishableKey},
        body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.ok!==true||!/^TKT-[A-Z0-9]{10}$/.test(result.ticket_code||""))
        throw new Error(response.status===429?"Too many requests. Try again later.":"The ticket could not be confirmed.");
      savedCode=result.ticket_code;
      button.textContent="Ticket recorded";
      say("Support ticket recorded: "+savedCode+". Keep this reference. The MX Continuity team can view it in the secure owner dashboard.");
    }catch(err){
      say((err.message||"Submission failed")+" No ticket has been confirmed; retry or email "+(cfg.fallbackEmail||"support")+".");
    }finally{busy=false;button.disabled=false;}
  });
})();