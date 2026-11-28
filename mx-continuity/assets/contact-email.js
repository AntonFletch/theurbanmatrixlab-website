"use strict";
(() => {
  const form = document.getElementById("inquiry-form");
  const button = document.getElementById("email-inquiry-btn");
  const status = document.getElementById("form-status");
  if (!form || !button) return;

  // Fail closed: the live form must follow the separate prelaunch configuration.
  // The project and origin checks prevent this switch from routing another site
  // or a misconfigured preview into MX Continuity's production inquiry endpoint.
  const config = window.MX_INTAKE_CONFIG;
  const expectedSupabaseOrigin = "https://xdaxbueyftyljsrhabpx.supabase.co";
  let supabaseBase = "";
  try {
    const parsed = new URL(config?.supabaseUrl || "");
    if (parsed.protocol === "https:" && parsed.origin === expectedSupabaseOrigin) {
      supabaseBase = parsed.origin;
    }
  } catch {}
  const intakeReady =
    config?.enabled === true &&
    config.allowedOrigin === location.origin &&
    supabaseBase === expectedSupabaseOrigin &&
    typeof config.publishableKey === "string" &&
    config.publishableKey.startsWith("sb_publishable_") &&
    typeof config.turnstileSiteKey === "string" &&
    config.turnstileSiteKey.length > 10;

  const notify = message => { if (status) status.textContent = message; };
  if (!intakeReady) {
    button.disabled = true;
    button.textContent = "Online inquiries paused";
    notify("Online inquiry intake is paused. Nothing is submitted or saved through this form right now. Please use the business email listed on this page.");
    return;
  }

  const API = supabaseBase + "/functions/v1/mx-project-inquiry";
  const PUBLIC_KEY = config.publishableKey;
  // The prelaunch-disabled page never loads Turnstile or accepts submissions.
  // Once explicitly activated, require a solved widget and server validation.
  button.disabled = true;
  button.textContent = "Loading security check";
  const challengeBox = document.createElement("div");
  challengeBox.className = "field";
  challengeBox.setAttribute("aria-label", "Project inquiry security verification");
  form.insertBefore(challengeBox, button);
  let widgetId = null;
  const challengeScript = document.createElement("script");
  challengeScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  challengeScript.async = true;
  challengeScript.onerror = () => notify("The security check could not load. Please use the business email listed on this page.");
  challengeScript.onload = () => {
    if (typeof window.turnstile?.render !== "function") {
      notify("The security check is unavailable. Please try again later.");
      return;
    }
    try {
      widgetId = window.turnstile.render(challengeBox, {
        sitekey: config.turnstileSiteKey,
        action: "mx_project_inquiry",
        theme: "dark"
      });
      button.disabled = false;
      button.textContent = "Submit project inquiry";
      notify("Complete the security check before submitting your inquiry.");
    } catch {
      notify("Unable to initialize the security check. Please try again later.");
    }
  };
  document.head.appendChild(challengeScript);
  let requestId = null;
  let pending = false;
  let completed = false;

  form.addEventListener("input", () => {
    if (completed) {
      completed = false;
      requestId = null;
      button.textContent = "Submit project inquiry";
      notify("Review your details and submit to the secure inquiry records.");
    }
  });

  button.addEventListener("click", async () => {
    if (pending) return;
    if (completed) {
      notify("This inquiry has already been received. Edit the form to submit a new request.");
      return;
    }
    if (!form.reportValidity()) return;
    if (!form.elements.contact_consent.checked) {
      notify("Please acknowledge the Privacy Policy before submitting.");
      return;
    }
    const name = form.elements.contact_name.value.trim();
    const email = form.elements.email.value.trim();
    const business = form.elements.business_name.value.trim();
    const plan = form.elements.package.value.trim();
    const details = form.elements.description.value.trim();
    const turnstileToken = widgetId === null ? "" : (window.turnstile?.getResponse?.(widgetId) || "");
    if (!turnstileToken) {
      notify("Complete the security check before submitting.");
      return;
    }
    if (!requestId) requestId = crypto.randomUUID();
    const payload = {
      request_id: requestId,
      contact_name: name,
      contact_email: email,
      business_name: business,
      package_interest: plan,
      project_details: details,
      company_website: form.elements.company_website.value,
      contact_consent: true,
      consent_version: "contact-v1",
      turnstile_token: turnstileToken
    };

    pending = true;
    button.disabled = true;
    notify("Saving your project inquiry securely…");
    try {
      const response = await fetch(API, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "apikey": PUBLIC_KEY,
          "Authorization": "Bearer " + PUBLIC_KEY
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true ||
          !/^[0-9a-f-]{36}$/i.test(result.inquiry_id || "")) {
        throw new Error(response.status === 429 ? "Too many requests; try again later." :
          "The system could not confirm saving your inquiry. Nothing has been marked as received.");
      }
      completed = true;
      button.textContent = "Inquiry received";
      notify("Inquiry received and saved securely. Reference: " +
        result.inquiry_id.slice(0, 8) + ". No email app or second send is needed. " +
        "The MX Continuity team will reply to the email you provided.");
    } catch (error) {
      if (widgetId !== null) window.turnstile?.reset?.(widgetId);
      notify(error.message || "Submission was not confirmed. Try again; we will not create duplicate records for retries.");
    } finally {
      pending = false;
      button.disabled = false;
    }
  });
})();
