const PROJECT_URL='https://xdaxbueyftyljsrhabpx.supabase.co';
const KEY='sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ';

async function get(path){
  const r=await fetch(PROJECT_URL+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!r.ok) throw new Error('request failed');
  return r.json();
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function mdParagraphs(md){
  return String(md||'')
    .split(/\n\s*\n/)
    .map(x=>x.trim())
    .filter(Boolean)
    .map(x=>{
      if(/^#{1,3}\s/.test(x)) return '<h3>'+esc(x.replace(/^#{1,3}\s+/,''))+'</h3>';
      return '<p>'+esc(x).replace(/\n/g,'<br>')+'</p>';
    }).join('');
}

(async()=>{
  try{
    const posts=await get('publication_posts?select=title,excerpt,slug,body_md&access_tier=eq.free&status=eq.published&order=sort_order.desc&limit=1');
    if(posts[0]){
      const p=posts[0];
      const title=document.getElementById('free-title');
      const excerpt=document.getElementById('free-excerpt');
      const body=document.querySelector('.excerpt');
      if(title) title.textContent=p.title;
      if(excerpt) excerpt.textContent=p.excerpt||'';
      if(body) body.innerHTML=mdParagraphs(p.body_md);
    }

    const teasers=await get('publication_teasers?select=slug,title,excerpt,access_tier&is_visible=eq.true&order=sort_order.asc');
    const locked=document.getElementById('locked-list');
    if(locked&&teasers.length){
      locked.innerHTML=teasers.map(t=>'<article><span>'+esc(t.access_tier).toUpperCase()+'</span><h3>'+esc(t.title)+'</h3><p>'+esc(t.excerpt)+'</p><a href="/publication/library.html">ENTER THE DOOR</a></article>').join('');
    }

    const plans=await get('publication_plans?select=tier,price_cents,billing_interval&is_active=eq.true');
    for(const p of plans){
      const el=document.querySelector('[data-price="'+p.tier+'"]');
      if(el&&p.price_cents>0) el.innerHTML='$'+(p.price_cents/100).toFixed(0)+'<span>/'+p.billing_interval+'</span>';
    }
  }catch(e){
    console.warn('Publication data unavailable',e);
  }
})();