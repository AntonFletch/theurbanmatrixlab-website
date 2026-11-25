import { withSupabase } from "npm:@supabase/server@1.9.2";

const ALLOWED_ORIGIN = "https://theurbanmatrixlab.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKAGE_NAMES = new Set(["Basic — $89 setup", "Business — $199 setup", "Continuity — $400 setup", "Custom quote"]);
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";
const goodEmail = (v: string) => /^[^\s@<>\\,;]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(v);

Deno.serve(withSupabase({ auth: "publishable" }, async (req, ctx) => {
  const trusted = req.headers.get("origin") === ALLOWED_ORIGIN;
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Vary": "Origin",
    ...(trusted ? {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    } : {})
  };
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (req.method === "OPTIONS") return trusted ? new Response(null, { status: 204, headers }) : reply({ error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!trusted) return reply({ error: "origin_not_allowed" }, 403);
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return reply({ error: "invalid_request" }, 415);
  if (Number(req.headers.get("content-length") || 0) > 8000) return reply({ error: "request_too_large" }, 413);

  // Defense in depth: the public page is disabled, and the server independently
  // requires an explicit function secret plus an active MX Continuity business.
  // Missing secrets or database errors fail closed before parsing or storing input.
  if (Deno.env.get("MX_PROJECT_INQUIRY_ENABLED") !== "true") return reply({ error: "intake_paused" }, 503);
  const { data: business, error: businessError } = await ctx.supabaseAdmin
    .from("veil_businesses")
    .select("status")
    .eq("public_label", "MX Continuity")
    .maybeSingle();
  if (businessError) return reply({ error: "service_unavailable" }, 503);
  if (business?.status !== "live") return reply({ error: "intake_paused" }, 503);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 8000) return reply({ error: "request_too_large" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "invalid_request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return reply({ error: "invalid_request" }, 400); }
  if (clean(body.company_website)) return reply({ error: "invalid_request" }, 400);
  const requestId = clean(body.request_id);
  const contactName = clean(body.contact_name);
  const contactEmail = clean(body.contact_email).toLowerCase();
  const businessName = clean(body.business_name);
  const packageInterest = clean(body.package_interest);
  const projectDetails = clean(body.project_details);
  if (!UUID.test(requestId) ||
      !(contactName.length >= 1 && contactName.length <= 120) ||
      !(contactEmail.length >= 5 && contactEmail.length <= 254 && goodEmail(contactEmail)) ||
      !(businessName.length >= 1 && businessName.length <= 160) ||
      !PACKAGE_NAMES.has(packageInterest) ||
      !(projectDetails.length >= 1 && projectDetails.length <= 3000) ||
      body.contact_consent !== true ||
      body.consent_version !== "contact-v1") return reply({ error: "invalid_request" }, 400);
  const payload = {
    request_id: requestId,
    contact_name: contactName,
    contact_email: contactEmail,
    business_name: businessName,
    package_interest: packageInterest,
    project_details: projectDetails,
    contact_consent: true,
    consent_version: "contact-v1",
    source: "website",
    is_test: false
  };
  const { data: prior, error: priorError } = await ctx.supabaseAdmin.from("mx_project_inquiries")
    .select("id,contact_name,contact_email,business_name,package_interest,project_details")
    .eq("request_id", requestId).maybeSingle();
  if (priorError) return reply({ error: "service_unavailable" }, 503);
  if (prior) {
    const same = prior.contact_name === contactName && prior.contact_email === contactEmail &&
                 prior.business_name === businessName && prior.package_interest === packageInterest &&
                 prior.project_details === projectDetails;
    return same ? reply({ ok: true, inquiry_id: prior.id, replayed: true }, 200) :
                  reply({ error: "request_id_conflict" }, 409);
  }
  const ip = (req.headers.get("cf-connecting-ip") ||
              req.headers.get("x-forwarded-for")?.split(",")[0] ||
              req.headers.get("x-real-ip") || "unknown").trim().slice(0,160);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const keyHash = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error: rateError } = await ctx.supabaseAdmin.rpc("veil_rate_limit_take", {
    p_route: "mx_project_inquiry",
    p_key_hash: keyHash,
    p_max_hits: 6
  });
  if (rateError) return reply({ error: "service_unavailable" }, 503);
  if (!allowed) return reply({ error: "rate_limited" }, 429);

  // A publishable key and Origin header alone cannot prevent bot submissions.
  // A new inquiry must pass server-verified Turnstile on the UMX host. Never
  // persist the token or expose the secret; retries of saved IDs short-circuit above.
  const token = clean(body.turnstile_token);
  if (token.length < 5 || token.length > 2048) return reply({ error: "bot_check_required" }, 400);
  const turnstileSecret = Deno.env.get("MX_TURNSTILE_SECRET");
  if (!turnstileSecret) return reply({ error: "intake_paused" }, 503);
  let verification: { success?: boolean; hostname?: string; action?: string } | null = null;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        idempotency_key: requestId
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return reply({ error: "bot_check_unavailable" }, 503);
    verification = await response.json();
  } catch {
    return reply({ error: "bot_check_unavailable" }, 503);
  }
  if (verification?.success !== true ||
      verification.hostname !== "theurbanmatrixlab.com" ||
      verification.action !== "mx_project_inquiry")
    return reply({ error: "bot_check_failed" }, 400);

  const { data: saved, error } = await ctx.supabaseAdmin.from("mx_project_inquiries")
    .insert(payload).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await ctx.supabaseAdmin.from("mx_project_inquiries")
        .select("id,contact_name,contact_email,business_name,package_interest,project_details")
        .eq("request_id", requestId).maybeSingle();
      if (existingError) return reply({ error: "service_unavailable" }, 503);
      if (existing) {
        const same = existing.contact_name === contactName && existing.contact_email === contactEmail &&
          existing.business_name === businessName && existing.package_interest === packageInterest &&
          existing.project_details === projectDetails;
        return same ? reply({ ok: true, inquiry_id: existing.id, replayed: true }, 200) :
          reply({ error: "request_id_conflict" }, 409);
      }
    }
    return reply({ error: "service_unavailable" }, 503);
  }
  await ctx.supabaseAdmin.from("veil_audit_events").insert({
    action: "mx_project_inquiry_received", object_type: "mx_project_inquiry", object_ref: saved.id,
    detail: { source: "website", package_interest: packageInterest }
  });
  return reply({ ok: true, inquiry_id: saved.id, replayed: false }, 201);
}));

