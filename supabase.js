const SUPABASE_URL = "https://xdaxbueyftyljsrhabpx.supabase.co";

const SUPABASE_ANON_KEY = "PASTE_YOUR_PUBLISHABLE_ANON_KEY_HERE";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("UMX OS connected to Supabase");
