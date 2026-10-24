// Version-pinned browser dependency. Only the public publishable key belongs here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
export const supabase = createClient('https://xdaxbueyftyljsrhabpx.supabase.co', 'sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const STAFF = ['owner', 'admin', 'dispatcher', 'manager'];
export const WORKERS = [...STAFF, 'employee', 'staff', 'worker'];
const el = (tag, text = '') => { const n = document.createElement(tag); n.textContent = text; return n; };
export async function authorize(host, { staffOnly = false, onLost = () => {} } = {}) {
  const status = host.querySelector('[role=status]') || host.appendChild(el('p'));
  status.setAttribute('role', 'status');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { status.textContent = 'Sign in to your UMX account to continue.'; return null; }
    const { data: profile, error: pe } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (pe) throw Error('Your UMX role could not be verified.');
    const role = String(profile.role).toLowerCase();
    if (!(staffOnly ? STAFF : WORKERS).includes(role) || user.is_anonymous) throw Error('This account is not authorized for this workspace.');
    let lost = false;
    const lose = () => { if (!lost) { lost = true; onLost(); } };
    supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) lose(); });
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const { data, error: ue } = await supabase.auth.getUser();
      if (ue) { if (navigator.onLine) lose(); return; }
      if (data.user?.id !== user.id) { lose(); return; }
      const { data: p, error: re } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (re) { if (navigator.onLine) lose(); return; }
      if (!p || String(p.role).toLowerCase() !== role) lose();
    }, 60000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    return { user, role, staff: STAFF.includes(role) };
  } catch (error) { status.textContent = error.message || 'UMX access is unavailable. Reload to retry.'; return null; }
}
