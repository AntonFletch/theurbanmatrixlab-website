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
    const { data: aal, error: ae } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (ae) throw ae;
    if (aal.currentLevel !== 'aal2') { await secondFactor(host, status); return authorize(host, { staffOnly, onLost }); }
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
async function secondFactor(host, status) {
  const { data, error } = await supabase.auth.mfa.listFactors(); if (error) throw error;
  let factor = data.totp.find(f => f.status === 'verified');
  const panel = el('div'); panel.className = 'mfa-panel'; (host.querySelector('.gate-inner') || host.querySelector(':scope > div') || host).append(panel);
  if (!factor) {
    status.textContent = 'Protect this workspace with two-step sign-in.';
    const enable = el('button', 'Set up authenticator'); enable.type = 'button'; panel.append(enable);
    await new Promise(resolve => enable.addEventListener('click', resolve, { once: true })); enable.remove();
    const { data: enrolled, error: ee } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'UMX ' + new Date().toISOString().slice(0, 16) });
    if (ee) throw ee; factor = { id: enrolled.id };
    const qr = el('img'); qr.alt = 'Scan with your authenticator app'; qr.width = 200; qr.height = 200; qr.src = enrolled.totp.qr_code; panel.append(qr);
    const key = el('details'); key.append(el('summary', 'Manual setup key'), el('code', enrolled.totp.secret)); panel.append(key);
    status.textContent = 'Scan the QR code, then enter your six-digit authenticator code.';
  } else status.textContent = 'Enter your six-digit authenticator code.';
  const form = el('form'), input = el('input'), submit = el('button', 'Verify access'), label = el('label', 'Authenticator code');
  input.id = 'mfa-code'; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code'; input.pattern = '[0-9]{6}'; input.required = true; input.maxLength = 6; label.htmlFor = input.id;
  submit.type = 'submit'; form.append(label, input, submit); panel.append(form); input.focus();
  await new Promise(resolve => form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return; submit.disabled = true;
    try { const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.value.trim() }); input.value = ''; if (ve) throw ve; panel.remove(); resolve(); }
    catch { status.textContent = 'Code could not be verified. Try the current code from your authenticator.'; }
    finally { submit.disabled = false; }
  }));
}
