"use strict";
(() => {
  const form = document.getElementById('support-form');
  if (!form) return;
  const msg = document.getElementById('support-status');
  const submit = form.querySelector('[type=submit]');
  const captcha = document.getElementById('support-captcha');
  const c = window.MX_SUPPORT_CONFIG || {};
  let captchaToken = '';
  let widgetId = null;
  let pendingId = '';
  let inFlight = false;
  function say(t, isError=false) {
    if (!msg) return;
    msg.textContent = t;
    msg.setAttribute('role', isError ? 'alert' : 'status');
  }
  const active = c.enabled === true && MX_CONFIG.prelaunch === false &&
    location.protocol === 'https:' &&
    location.origin === c.allowedOrigin &&
    /^https:\/\/[^\s]+\.supabase\.co$/.test(c.supabaseUrl || '') &&
    typeof c.publishableKey === 'string' && c.publishableKey.startsWith('sb_publishable_') &&
    typeof c.turnstileSiteKey === 'string' && c.turnstileSiteKey.length > 0;
  if (!active) {
    say('Online support is not accepting requests yet. For legal, cancellation, privacy, or urgent prelaunch inquiries, email the temporary contact shown below.');
    return;
  }
  submit.disabled = false;
  submit.textContent = 'Submit support request';
  say('Complete the fields and verification. We will give you a ticket number after the server confirms receipt.');
  const script = document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;
  script.defer=true;
  script.onload=() => {
    if (!window.turnstile) return say('Verification is currently unavailable.',true);
    widgetId=window.turnstile.render(captcha, {
      sitekey:c.turnstileSiteKey,action:'matrix_support',
      callback:token=>{captchaToken=token;},
      'expired-callback':()=>{captchaToken='';},
      'error-callback':()=>{captchaToken='';say('Verification failed. Please try again.',true);} 
    });
  };
  script.onerror=()=>say('Verification could not load. Use the temporary email contact below.',true);
  document.head.appendChild(script);
  form.addEventListener('input',() => {
    // New edits create a new logical support request; retries of the same details reuse the ID.
    pendingId='';
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(inFlight || !form.reportValidity()) return;
    if(!captchaToken) return say('Please complete the verification.',true);
    if (!form.elements.privacy_ack.checked) return say('Please confirm the privacy notice.',true);
    if (!pendingId) pendingId=crypto.randomUUID();
    const p={
      request_id:pendingId, requester_name:form.elements.requester_name.value.trim(),
      requester_email:form.elements.requester_email.value.trim(),
      subject:form.elements.subject.value.trim(),
      description:form.elements.description.value.trim(),
      priority:form.elements.priority.value,
      company_website:form.elements.company_website.value,
      turnstileToken:captchaToken
    };
    inFlight=true;submit.disabled=true;say('Sending securely…');
    try {
      const res=await fetch(c.supabaseUrl+'/functions/v1/veil-public-support',{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json','apikey':c.publishableKey},
        body:JSON.stringify(p),signal:AbortSignal.timeout(15000)
      });
      const out=await res.json().catch(()=>({}));
      if (res.ok && out.ok && typeof out.ticket_code==='string') {
        say('Request received. Ticket number: '+out.ticket_code+'. Save this number for follow-up; an email confirmation is not yet guaranteed.');
        form.reset();pendingId='';
      } else if(res.status===503 && out.error==='prelaunch') {
        say('Online support has not launched. No request was accepted.',true);
      } else if(res.status===429) {
        say('Too many requests. Please try later or email support.',true);
      } else {
        say('We could not confirm receipt. Check your inbox or contact the temporary support email before resubmitting.',true);
      }
    } catch {say('Network unavailable. Receipt is unconfirmed; use the temporary email contact if needed.',true);}
    finally {
      inFlight=false;submit.disabled=false;captchaToken='';
      if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);
    }
  });
})();
