import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const supabase=createClient('https://xdaxbueyftyljsrhabpx.supabase.co','sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ');
const authBox=document.getElementById('authBox'),libraryBox=document.getElementById('libraryBox'),posts=document.getElementById('posts'),accessCards=document.getElementById('accessCards'),msg=document.getElementById('loginMessage');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const body=s=>esc(s).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');

async function render(session){
 if(!session){authBox.style.display='block';libraryBox.style.display='none';return}
 authBox.style.display='none';libraryBox.style.display='block';
 const [{data:ents},{data:rows,error}]=await Promise.all([
   supabase.from('publication_entitlements').select('sku,access_scope,granted_at,expires_at').order('granted_at',{ascending:false}),
   supabase.from('publication_posts').select('slug,title,subtitle,excerpt,body_md,access_tier,published_at').order('sort_order',{ascending:true})
 ]);
 const entList=ents||[];
 accessCards.innerHTML=entList.length?entList.map(e=>'<article class="card"><span class="pill">OWNED ACCESS</span><h3>'+esc(e.sku)+'</h3><p>'+esc(e.access_scope)+'</p><small>Granted '+new Date(e.granted_at).toLocaleDateString()+'</small></article>').join(''):'<article class="card"><span class="pill">ACCOUNT</span><h3>No paid access yet.</h3><p>Your free account is working. Purchased Record Drops and Volume Pass access will appear here after checkout is connected.</p><a class="btn secondary" href="/publication/store.html">SEE STORE</a></article>';
 if(error){posts.innerHTML='<article class="card"><h3>Reader data unavailable</h3><p>'+esc(error.message)+'</p></article>';return}
 posts.innerHTML=(rows||[]).map(p=>'<article class="card"><span class="pill">'+esc(p.access_tier.toUpperCase())+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.excerpt||'')+'</p><details><summary style="cursor:pointer;color:#d4a94a">READ</summary><div style="margin-top:18px;color:#d8ced8;line-height:1.78"><p>'+body(p.body_md||'')+'</p></div></details></article>').join('')||'<article class="card"><h3>No accessible pages yet.</h3></article>';
}
document.getElementById('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg.textContent='Sending…';const email=document.getElementById('email').value.trim();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/publication/library.html'}});msg.textContent=error?error.message:'Check your email for the secure sign-in link.'});
document.getElementById('signOut').addEventListener('click',async()=>{await supabase.auth.signOut();await render(null)});
const {data:{session}}=await supabase.auth.getSession();await render(session);supabase.auth.onAuthStateChange((_e,s)=>render(s));