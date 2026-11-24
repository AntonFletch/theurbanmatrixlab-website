import assert from 'node:assert/strict';
import { BILLING_EVENTS, createWebhookHandler, eventReceipt } from '../server-functions/veil-create-checkout/_shared/billing.mjs';

const origin='https://theurbanmatrixlab.com';
const eventBase=(type,id='evt_test_001')=>({
  id, type, livemode:false, api_version:'2026-09-30.endive',
  data:{ object:{id:'cs_test_mock',mode:'payment',payment_status:'paid',currency:'usd',
    amount_total:29900,amount:29900,payment_intent:'pi_test_mock',
    customer_email:'not-to-be-persisted@example.invalid',customer_details:{name:'NOT FOR STORAGE'}}}
});
const records=new Map();
const calls=[];
const admin={rpc:async(name,args)=>{
  assert.equal(name,'veil_record_setup_event');
  assert.ok(!JSON.stringify(args).includes('NOT FOR STORAGE'));
  assert.ok(!JSON.stringify(args).includes('customer_email'));
  const ev=args.p_event;
  calls.push(ev);
  const replayed=records.has(ev.id);
  records.set(ev.id,ev);
  return {data:{ok:true,replayed},error:null};
}};
const verifyEvent=async(raw,signature,secret)=>{
  assert.equal(secret,'whsec_mock_test');
  if(signature!=='sig_mock_valid')throw new Error('invalid_signature');
  return JSON.parse(raw);
};
const config={mode:'test',webhookSecret:'whsec_mock_test'};
const req=(event,signature='sig_mock_valid')=>new Request(origin+'/stripe-webhook',{
  method:'POST',headers:{'content-type':'application/json',
  ...(signature?{'stripe-signature':signature}:{})},
  body:JSON.stringify(event)
});
const handle=createWebhookHandler({config,verifyEvent,admin});

assert.deepEqual([...BILLING_EVENTS],[
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','charge.refunded',
  'charge.dispute.created','radar.early_fraud_warning.created'
]);

const noSig=await handle(req(eventBase('checkout.session.completed'),null));
assert.equal(noSig.status,400,'missing signature must fail');

const badSig=await handle(req(eventBase('checkout.session.completed'),'sig_bad'));
assert.equal(badSig.status,400,'invalid signature must fail');

const wrongMode=await handle(req({...eventBase('checkout.session.completed'),livemode:true}));
assert.equal(wrongMode.status,400,'livemode webhooks must not reach sandbox records');

const ignored=await handle(req(eventBase('customer.created','evt_unapproved')));
assert.equal(ignored.status,200);
assert.equal((await ignored.json()).ignored,true);
assert.equal(calls.length,0,'unexpected events must not be recorded');

for(let i=0;i<BILLING_EVENTS.length;i++){
  const event=eventBase(BILLING_EVENTS[i],`evt_mock_${i}`);
  const res=await handle(req(event));
  assert.equal(res.status,200,`event ${event.type} failed`);
  assert.equal((await res.json()).replayed,false);
}
assert.equal(calls.length,6);

const duplicate=await handle(req(eventBase(BILLING_EVENTS[0],'evt_mock_0')));
assert.equal(duplicate.status,200);
assert.equal((await duplicate.json()).replayed,true,'idempotent duplicate must be marked replayed');

const notConfigured=createWebhookHandler({config:{mode:'disabled',webhookSecret:''},verifyEvent,admin});
assert.equal((await notConfigured(req(eventBase(BILLING_EVENTS[0])))).status,503,'disabled mode must fail closed');

const failure=createWebhookHandler({config,verifyEvent,admin:{rpc:async()=>({error:{message:'mock_down'},data:null})}});
assert.equal((await failure(req(eventBase(BILLING_EVENTS[0],'evt_unavailable')))).status,503,'failed database write must return retryable error');

const receipt=eventReceipt(eventBase('charge.refunded','evt_redact'));
assert.equal(receipt.object.amount_total,29900);
assert.equal(receipt.object.customer_email,undefined);
assert.equal(receipt.object.customer_details,undefined);

console.log('MX Continuity sandbox webhook: PASS (six event types, signature gating, mode isolation, replay, 503 retry, data minimization)');
