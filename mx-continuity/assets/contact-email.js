"use strict";
(() => {
  const form = document.getElementById("inquiry-form");
  const button = document.getElementById("email-inquiry-btn");
  const status = document.getElementById("form-status");
  if (!form || !button) return;

  const API = "https://xdaxbueyftyljsrhabpx.supabase.co/functions/v1/mx-project-inquiry";
  const PUBLIC_KEY = "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ";
  let requestId = null;
  let pending = false;
  let completed = false;
  const notify = message => { if (status) status.textContent = message; };

  const params = new URLSearchParams(location.search);
  const requested = (params.get("package") || "").toLowerCase();
  const select = form.elements.package;
  if (["basic", "business", "continuity"].includes(requested)) {
    const option = [...select.options].find(x => x.text.toLowerCase().startsWith(requested));
    if (option) select.value = option.value;
  }

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
      consent_version: "contact-v1"
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
      notify(error.message || "Submission was not confirmed. Try again; we will not create duplicate records for retries.");
    } finally {
      pending = false;
      button.disabled = false;
    }
  });
})();
