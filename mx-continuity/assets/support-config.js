"use strict";
// Client-safe runtime settings. Never add TURNSTILE_SECRET_KEY or Supabase service_role keys.
window.MX_SUPPORT_CONFIG = Object.freeze({
  enabled: false, // requires all launch gates and backend status=live
  allowedOrigin: "https://mxcontinuity.com", // e.g. https://owned-and-verified-domain.example
  supabaseUrl: "https://xdaxbueyftyljsrhabpx.supabase.co",
  publishableKey: "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ", // Supabase publishable (NOT secret/service-role) key
  turnstileSiteKey: "", // Cloudflare public Turnstile site key; action matrix_support
  fallbackEmail: "TheUrbanMatrixLab@outlook.com" // verified temporary business support email
});
