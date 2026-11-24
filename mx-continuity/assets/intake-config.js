"use strict";
// Client-safe MX Continuity intake settings. Keep disabled until legal, domain,
// sender, Turnstile, privacy, and end-to-end acceptance checks are complete.
// Never put API secrets, Stripe keys, or email provider credentials here.
window.MX_INTAKE_CONFIG=Object.freeze({
  enabled:false,
  allowedOrigin:"https://theurbanmatrixlab.com",
  supabaseUrl:"https://xdaxbueyftyljsrhabpx.supabase.co",
  publishableKey:"sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ",
  turnstileSiteKey:"",
  fallbackEmail:"TheUrbanMatrixLab@outlook.com"
});
