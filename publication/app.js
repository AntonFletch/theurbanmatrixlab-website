const PROJECT_URL='https://xdaxbueyftyljsrhabpx.supabase.co';
const KEY='sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ';
async function ntrGet(path){
  const r=await fetch(PROJECT_URL+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!r.ok) throw new Error('NTR data unavailable');
  return r.json();
}
window.NTR={get:ntrGet,project:PROJECT_URL,key:KEY};
