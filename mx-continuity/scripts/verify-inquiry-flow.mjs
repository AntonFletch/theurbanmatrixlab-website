import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../assets/contact-email.js", import.meta.url), "utf8");
const assert = (condition, why) => { if (!condition) throw Error("MX inquiry flow FAIL: " + why); };

function createHarness({ valid=true, consent=true, failFirst=false }={}) {
  const callbacks = {};
  const buttonCallbacks = {};
  const status = { textContent: "" };
  const fields = {
    contact_name: { value: "QA Visitor" },
    email: { value: "qa@example.invalid" },
    business_name: { value: "MX Internal Form Test" },
    package: { value: "Custom quote", options: [
      { text:"Basic — $89 setup",value:"Basic — $89 setup" },
      { text:"Business — $199 setup",value:"Business — $199 setup" },
      { text:"Continuity — $400 setup",value:"Continuity — $400 setup" },
      { text:"Custom quote",value:"Custom quote" }
    ] },
    description: { value: "Internal UI test only; no real submission." },
    company_website: { value: "" },
    contact_consent: { checked: consent }
  };
  const form = {
    elements:fields,
    reportValidity:()=>valid,
    addEventListener:(event,fn)=>{callbacks[event]=fn;}
  };
  const button = {
    disabled:false,textContent:"Submit project inquiry",
    addEventListener:(event,fn)=>{buttonCallbacks[event]=fn;}
  };
  const requests = [];
  let ids = 0;
  const location = { search:"?package=basic",origin:"https://theurbanmatrixlab.com",href:"https://theurbanmatrixlab.com/mx-continuity/contact.html" };
  const mock = {
    window:{MX_INTAKE_CONFIG:{enabled:true,allowedOrigin:"https://theurbanmatrixlab.com",supabaseUrl:"https://xdaxbueyftyljsrhabpx.supabase.co",publishableKey:"sb_publishable_test"}},
    document:{getElementById(id){
      return {"inquiry-form":form,"email-inquiry-btn":button,"form-status":status}[id]||null;
    }},
    URL,URLSearchParams,location,
    crypto:{randomUUID:()=> `aaaaaaaa-aaaa-4aaa-8aaa-${String(++ids).padStart(12,"0")}`},
    fetch:async (url,options)=>{
      assert(url==="https://xdaxbueyftyljsrhabpx.supabase.co/functions/v1/mx-project-inquiry","unexpected endpoint");
      assert(options.method==="POST","not a POST");
      assert(options.headers["apikey"]?.startsWith("sb_publishable_"),"missing publishable key");
      const payload=JSON.parse(options.body);requests.push(payload);
      if (failFirst && requests.length===1) return {ok:false,status:503,json:async()=>({error:"unavailable"})};
      return {ok:true,status:201,json:async()=>({ok:true,inquiry_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"})};
    }
  };
  vm.runInNewContext(source,mock,{filename:"assets/contact-email.js"});
  assert(typeof buttonCallbacks.click==="function","submit click handler not installed");
  return {form,button,status,fields,requests,location,
    click:()=>buttonCallbacks.click(),
    edit:()=>callbacks.input?.()
  };
}

const empty=createHarness({valid:false});
await empty.click();
assert(empty.requests.length===0,"invalid form submitted");

const noConsent=createHarness({consent:false});
await noConsent.click();
assert(noConsent.requests.length===0,"unconsented form submitted");

const success=createHarness();
assert(success.fields.package.value==="Basic — $89 setup","package deep-link preselection broken");
await success.click();
assert(success.requests.length===1,"valid submission did not send exactly once");
assert(success.requests[0].package_interest==="Basic — $89 setup","wrong package submitted");
assert(success.requests[0].contact_consent===true,"privacy consent omitted");
assert(success.status.textContent.includes("Inquiry received and saved securely"),"success confirmation missing");
assert(success.status.textContent.includes("No email app or second send is needed"),"unnecessary second email step");
assert(success.button.textContent==="Inquiry received","submit button not acknowledged");
assert(success.button.disabled===false,"submit button left locked");
assert(success.location.href==="https://theurbanmatrixlab.com/mx-continuity/contact.html","submission navigated away");
await success.click();
assert(success.requests.length===1,"duplicate submission on repeated click");
success.fields.description.value="A new request";
success.edit();
await success.click();
assert(success.requests.length===2,"edited inquiry not allowed");
assert(success.requests[0].request_id!==success.requests[1].request_id,"new inquiry reused idempotency key");

const retry=createHarness({failFirst:true});
await retry.click();
assert(retry.requests.length===1 && retry.button.textContent==="Submit project inquiry","error incorrectly marked complete");
await retry.click();
assert(retry.requests.length===2,"retry did not resubmit");
assert(retry.requests[0].request_id===retry.requests[1].request_id,"retry incorrectly changed idempotency key");
assert(retry.button.textContent==="Inquiry received","retry did not confirm success");
console.log("MX Continuity inquiry form: PASS (validation, privacy, package preselection, one-click confirmation, no email redirect, idempotency, retry)");
