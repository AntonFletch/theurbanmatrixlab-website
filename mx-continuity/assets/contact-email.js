"use strict";
(() => {
 const f=document.getElementById("inquiry-form");
 const btn=document.getElementById("email-inquiry-btn");
 const status=document.getElementById("form-status");
 if(!f||!btn)return;
 const params=new URLSearchParams(location.search);
 const requested=(params.get("package")||"").toLowerCase();
 const select=f.elements.package;
 if(["basic","business","continuity"].includes(requested)){
   const option=[...select.options].find(x=>x.text.toLowerCase().startsWith(requested));
   if(option)select.value=option.value;
 }
 const message=s=>{if(status)status.textContent=s;};
 btn.addEventListener("click",()=>{
   if(!f.reportValidity())return;
   if(!f.elements.contact_consent.checked){
     message("Please acknowledge the Privacy Policy before preparing your inquiry.");
     return;
   }
   const name=f.elements.contact_name.value.trim();
   const email=f.elements.email.value.trim();
   const business=f.elements.business_name.value.trim();
   const plan=f.elements.package.value.trim();
   const details=f.elements.description.value.trim();
   const subject="MX Continuity project inquiry — "+plan.split(" — ")[0];
   const body=[
      "MX Continuity website project inquiry",
      "",
      "Name: "+name,
      "Contact email: "+email,
      "Business: "+business,
      "Package: "+plan,
      "",
      "Project details:",
      details,
      "",
      "Please contact me to discuss scope and a written project order.",
      "I consent to contact about this inquiry; this is not a subscription or purchase."
   ].join("\n");
   const href="mailto:TheUrbanMatrixLab@outlook.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
   message("Your email application should open a prepared message. Review and press Send in your email app; this website does not send it automatically.");
   window.location.href=href;
 });
})();