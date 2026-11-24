import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../assets/support-email.js",import.meta.url),"utf8");
function harness({failFirst=false,siteKey="1x00000000000000000000AA"}={}){
  const listeners={},buttonListeners={},requests=[],scriptOptions=[];
  const status={textContent:""},button={textContent:"",disabled:false,addEventListener:(e,fn)=>buttonListeners[e]=fn};
  const fields={requester_name:{value:"QA User"},requester_email:{value:"qa@example.invalid"},priority:{value:"normal"},subject:{value:"Internal support QA"},description:{value:"Mock-only test; no real ticket."},privacy_ack:{checked:true},company_website:{value:""}};
  const form={elements:fields,reportValidity:()=>true,addEventListener:(e,fn)=>listeners[e]=fn,insertBefore(){}};
  let resets=0,ids=0,href="";
  const mock={window:{MX_SUPPORT_CONFIG:{enabled:true,allowedOrigin:"https://theurbanmatrixlab.com",supabaseUrl:"https://xdaxbueyftyljsrhabpx.supabase.co",publishableKey:"sb_publishable_test",turnstileSiteKey:siteKey,fallbackEmail:"support@example.invalid"},turnstile:{render:(el,opts)=>{scriptOptions.push(opts);return "qa-widget";},getResponse:()=>"qa-turnstile-token",reset:()=>{resets++;}}},
    document:{head:{appendChild:s=>s.onload?.()},createElement:()=>({setAttribute(){}}),getElementById:id=>({"support-form":form,"email-support-btn":button,"support-status":status,"support-intro":{textContent:""}}[id]||null)},
    location:{origin:"https://theurbanmatrixlab.com",set href(v){href=v},get href(){return href}},crypto:{randomUUID:()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++ids).padStart(12,"0")}`},
    fetch:async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});if(failFirst&&requests.length===1)return{ok:false,status:503,json:async()=>({error:"support_failed"})};return{ok:true,status:201,json:async()=>({ok:true,ticket_code:"TKT-ABC1234567"})};}};
  mock.window.location=mock.location;
  vm.runInNewContext(source,mock,{filename:"assets/support-email.js"});
  return {button,status,requests,scriptOptions,get resets(){return resets},get href(){return href},click:()=>buttonListeners.click?.()};
}
const success=harness();
assert.equal(success.scriptOptions[0]?.action,"matrix_support");
await success.click();
assert.equal(success.requests.length,1);
assert.equal(success.requests[0].url,"https://xdaxbueyftyljsrhabpx.supabase.co/functions/v1/veil-public-support");
assert.equal(success.requests[0].body.turnstileToken,"qa-turnstile-token");
assert.match(success.status.textContent,/TKT-ABC1234567/);
await success.click();assert.equal(success.requests.length,1,"duplicate click must not create a second ticket");
const retry=harness({failFirst:true});await retry.click();await retry.click();
assert.equal(retry.requests.length,2);assert.equal(retry.requests[0].body.request_id,retry.requests[1].body.request_id);
assert.equal(retry.resets,1);assert.match(retry.status.textContent,/TKT-ABC1234567/);
const noKey=harness({siteKey:""});await noKey.click();
assert.equal(noKey.requests.length,0,"support must not submit without Turnstile configured");
assert.match(noKey.href,/^mailto:/);
console.log("MX Continuity support flow: PASS (Turnstile, deployed endpoint, ticket receipt, duplicate guard, retry idempotency, email fallback)");
