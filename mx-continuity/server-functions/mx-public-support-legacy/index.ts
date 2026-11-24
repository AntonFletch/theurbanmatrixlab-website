import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://theurbanmatrixlab.com";
const HEADERS = {
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve((req: Request) => {
  if (req.headers.get("origin") !== ALLOWED_ORIGIN) {
    return Response.json({ error: "origin_not_allowed" }, {
      status: 403,
      headers: { "Cache-Control": "no-store", "Vary": "Origin" }
    });
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: HEADERS });
  }
  return Response.json({ error: "endpoint_retired" }, { status: 410, headers: HEADERS });
});
