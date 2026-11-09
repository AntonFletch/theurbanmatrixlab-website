"use strict";
(() => {
 const f=document.getElementById("support-form");
 const btn=document.getElementById("email-support-btn");
 const status=document.getElementById("support-status");
 if(!f||!btn)return;
 const say=message=>{if(status)status.textContent=message;};
 btn.addEventListener("click",()=>{
   if(!f.reportValidity())return;
   if(!f.elements.privacy_ack.checked){say("Please acknowledge the Privacy Policy.");return;}
   const subject="MX Continuity support — "+f.elements.subject.value.trim().slice(0,110);
   const body=[
     "MX Continuity website support request",
     "",
     "Name: "+f.elements.requester_name.value.trim(),
     "Reply email: "+f.elements.requester_email.value.trim(),
     "Urgency: "+f.elements.priority.value,
     "Issue: "+f.elements.subject.value.trim(),
     "",
     "Description:",
     f.elements.description.value.trim(),
     "",
     "Please reply to this email. Do not ask me to send passwords or payment card details."
   ].join("\n");
   const href="mailto:TheUrbanMatrixLab@outlook.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
   say("Your email app should open a message with these details. Review and press Send to submit your request; no ticket number has been issued.");
   window.location.href=href;
 });
})();