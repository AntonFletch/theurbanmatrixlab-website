import assert from "node:assert/strict";
import {billingConfigured,createCheckoutHandler} from "../server-functions/veil-create-checkout/_shared/billing.mjs";
const origin="https://theurbanmatrixlab.com";
const tiers=[
  {tier:"basic_setup",price:"price_mock_basic",amount:8900},
  {tier:"business_setup",price:"price_mock_business",amount:19900},
  {tier:"continuity_setup",price:"price_mock_continuity",amount:40000}
];
const prices=Object.fromEntries(tiers.map(t=>[t.tier,t.price]));
const config={mode:"test",origin,apiKey:"sk_test_mock",webhookSecret:"whsec_mock",prices};
assert.equal(billingConfigured(config),true);
assert.equal(billingConfigured({...config,mode:"disabled"}),false);
assert.equal(billingConfigured({...config,prices:{...prices,continuity_setup:""}}),false);
const calls=[];
const stripe={prices:{retrieve:async id=>{const tier=tiers.find(t=>t.price===id);calls.push(["price",id]);return{id,livemode:false,active:true,unit_amount:tier?.amount,currency:"usd",recurring:null};}},checkout:{sessions:{create:async(params,opts)=>{calls.push(["checkout",params,opts.idempotencyKey]);return{id:"cs_test_mock",url:"https://checkout.stripe.com/c/pay/test"};}}}};
const admin={rpc:async(name,args)=>{calls.push(["rpc",name,args]);return name==="veil_reserve_setup_checkout"?{data:{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",parameters:{mode:"payment"},session_url:null}}:{data:{ok:true,url:"https://checkout.stripe.com/c/pay/test"}};}};
for(const tier of tiers){
 const handler=createCheckoutHandler({config,stripe,admin,verifiedUser:async()=>({id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})});
 const response=await handler(new Request(origin+"/functions/v1/veil-create-checkout",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({invoice_id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",tier:tier.tier})}));
 assert.equal(response.status,200, tier.tier+" approved test price should pass");
 const result=await response.json();assert.equal(result.test_mode,true);assert.equal(result.url,"https://checkout.stripe.com/c/pay/test");
 assert.ok(calls.some(x=>x[0]==="price"&&x[1]===tier.price));
}
const badStripe={...stripe,prices:{retrieve:async()=>({livemode:false,active:true,unit_amount:8900,currency:"usd",recurring:null})}};
const badHandler=createCheckoutHandler({config,stripe:badStripe,admin,verifiedUser:async()=>({id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})});
const bad=await badHandler(new Request(origin+"/functions/v1/veil-create-checkout",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({invoice_id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",tier:"business_setup"})}));
assert.equal(bad.status,503,"checkout must refuse a price that does not match its approved package");
assert.equal(billingConfigured({...config,origin:"https://matrix-continuity-demo.example.invalid"}),false,"checkout must reject unapproved origins");
console.log("MX Continuity checkout function: PASS (three approved sandbox package prices, test-only gate, idempotent setup session, wrong-price rejection)");
