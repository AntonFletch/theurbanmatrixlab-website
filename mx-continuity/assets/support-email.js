"use strict";
(() => {
  const form = document.getElementById("support-form");
  const button = document.getElementById("email-support-btn");
  const status = document.getElementById("support-status");
  if (!form || !button) return;

  const cfg = window.MX_SUPPORT_CONFIG || {};
  const live = cfg.enabled === true;
  const say = message => { if (status) status.textContent = message; };
  let widgetId = null;
  let requestId = null;

  function validForm() {
    if (!form.reportValidity()) return false;
    if (!form.elements.privacy_ack.checked) {
      say("Please acknowledge the Privacy Policy.");
      return false;
    }
    return true;
  }

  function prepareEmail() {
    const subject = "MX Continuity support — " + form.elements.subject.value.trim().slice(0, 110);
    const body = [
      "MX Continuity website support request", "",
      "Name: " + form.elements.requester_name.value.trim(),
      "Reply email: " + form.elements.requester_email.value.trim(),
      "Urgency: " + form.elements.priority.value,
      "Issue: " + form.elements.subject.value.trim(), "",
      "Description:", form.elements.description.value.trim(), "",
      "Please reply to this email. Do not ask me to send passwords or payment card details."
    ].join("\n");
    const email = cfg.fallbackEmail || "TheUrbanMatrixLab@outlook.com";
    say("Your email app should open a prepared message. Review and press Send. No ticket number has been issued.");
    window.location.href = "mailto:" + encodeURIComponent(email) + "?subject=" +
      encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function readyForOnline() {
    return live &&
      location.protocol === "https:" &&
      cfg.allowedOrigin === location.origin &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || "") &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.publishableKey || "") &&
      typeof cfg.turnstileSiteKey === "string" && cfg.turnstileSiteKey.length > 8;
  }

  async function openTicket() {
    const token = window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : "";
    if (!token) { say("Complete the verification check before submitting."); return; }
    if (!requestId) requestId = crypto.randomUUID();
    const body = {
      request_id: requestId,
      requester_name: form.elements.requester_name.value.trim(),
      requester_email: form.elements.requester_email.value.trim(),
      priority: form.elements.priority.value,
      subject: form.elements.subject.value.trim(),
      description: form.elements.description.value.trim(),
      turnstileToken: token,
      company_website: ""
    };
    button.disabled = true;
    say("Submitting support request…");
    try {
      const response = await fetch(cfg.supabaseUrl + "/functions/v1/veil-public-support", {
        method: "POST",
        cache: "no-store",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.publishableKey,
          "Authorization": "Bearer " + cfg.publishableKey
        },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true || !/^TKT-[A-Z0-9]+$/.test(result.ticket_code || "")) {
        throw new Error(result.error || "support_unavailable");
      }
      say("Support ticket created: " + result.ticket_code + ". Save this reference for follow-up.");
      form.reset();
      requestId = null;
    } catch (error) {
      // Keep requestId for idempotent retry after network ambiguity.
      say("Ticket submission was not confirmed (" +
        (error.message || "connection problem") +
        "). No new ticket can be guaranteed. Please contact support by email if needed.");
    } finally {
      button.disabled = false;
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    }
  }

  if (!live) {
    button.addEventListener("click", () => { if (validForm()) prepareEmail(); });
    return;
  }
  if (!readyForOnline()) {
    button.disabled = true;
    say("Online support tickets are not configured. Please email TheUrbanMatrixLab@outlook.com instead.");
    return;
  }

  button.textContent = "Submit secure support ticket";
  const intro = document.getElementById("support-intro");
  if (intro) intro.textContent = "Describe the issue and submit a tracked support ticket securely.";
  say("Verify you are human, then submit. We will show a ticket reference only after the server confirms.");
  const holder = document.createElement("div");
  holder.id = "mx-support-turnstile";
  holder.className = "field";
  button.before(holder);
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.onload = () => {
    if (!window.turnstile) { say("Verification could not load. Please contact support by email."); button.disabled = true; return; }
    widgetId = window.turnstile.render(holder, { sitekey: cfg.turnstileSiteKey, action: "matrix_support", theme: "auto" });
  };
  script.onerror = () => { say("Verification service is unavailable. Please contact support by email."); button.disabled = true; };
  document.head.appendChild(script);
  button.addEventListener("click", () => { if (validForm()) openTicket(); });
})();
