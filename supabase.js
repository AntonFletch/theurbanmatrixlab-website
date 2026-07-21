const SUPABASE_URL = "https://xdaxbueyftyljsrhabpx.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("UMX OS connected to Supabase");
