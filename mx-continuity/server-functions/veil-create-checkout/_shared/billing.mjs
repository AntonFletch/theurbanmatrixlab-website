const APPROVED_ORIGIN = 'https://theurbanmatrixlab.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APPROVED_SETUP_AMOUNTS = Object.freeze({ website_setup:29900 });
export const BILLING_EVENTS = Object.freeze([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'charge.refunded', 'charge.dispute.created', 'radar.early_fraud_warning.created'
]);

export function billingConfigured(config) {
  try {
    const origin = new URL(config.origin);
    return config.mode === 'test' && /^(rk|sk)_test_/.test(config.apiKey || '') &&
      origin.protocol === 'https:' && origin.origin === config.origin && config.origin === APPROVED_ORIGIN &&
      config.prices && ['website_setup'].every(k => /^price_/.test(config.prices[k] || '')) && Boolean(config.webhookSecret?.startsWith('whsec_'));
  } catch { return false; }
}

// Test-mode setup only. Recurring checkout stays closed until its service-start terms are agreed.
export function createCheckoutHandler({ config, stripe, admin, verifiedUser }) {
  return async req => {
    const trustedOrigin = req.headers.get('origin') === config.origin;
    const headers = { 'Cache-Control':'no-store', 'Vary':'Origin', ...(trustedOrigin ? {
      'Access-Control-Allow-Origin':config.origin, 'Access-Control-Allow-Headers':'authorization, apikey, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS'
    } : {}) };
    const reply = (data,status=200) => Response.json(data,{ status,headers });
    if (req.method === 'OPTIONS') return trustedOrigin ? new Response(null,{ status:204,headers }) : reply({ error:'origin_not_allowed' },403);
    if (req.method !== 'POST') return reply({ error:'method_not_allowed' },405);
    if (!billingConfigured(config)) return reply({ error:'test_billing_not_configured' },503);
    if (!trustedOrigin) return reply({ error:'origin_not_allowed' },403);
    let user;
    try { user = await verifiedUser(); } catch { return reply({ error:'authentication_required' },401); }
    if (!UUID.test(user?.id || '')) return reply({ error:'authentication_required' },401);
    let body;
    try {
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 2000) return reply({ error:'invalid_request' },413);
      body = JSON.parse(raw);
    } catch { return reply({ error:'invalid_request' },400); }
    if (!UUID.test(body?.invoice_id || '') || !Object.hasOwn(APPROVED_SETUP_AMOUNTS,body?.tier) ||
        Object.keys(body).some(k=>!['invoice_id','tier'].includes(k)))
      return reply({ error:'invalid_request' },400);
    const selectedPrice = config.prices[body.tier];
    const expectedAmount = APPROVED_SETUP_AMOUNTS[body.tier];
    let price;
    try { price = await stripe.prices.retrieve(selectedPrice); }
    catch { return reply({ error:'processor_unavailable' },503); }
    if (price.livemode !== false || price.active !== true || price.unit_amount !== expectedAmount || price.currency !== 'usd' || price.recurring) return reply({ error:'price_not_approved' },503);
    const { data:order,error } = await admin.rpc('veil_reserve_setup_checkout',{
      p_invoice_id:body.invoice_id,p_user_id:user.id,p_price_id:selectedPrice,p_origin:config.origin
    });
    if (error || !UUID.test(order?.id || '')) return reply({ error:'invoice_not_payable' },409);
    if (order.session_url) return reply({ url:order.session_url,test_mode:true });
    try {
      const session = await stripe.checkout.sessions.create(order.parameters,{ idempotencyKey:`matrix-setup-v1/${order.id}` });
      const { data:bound,error:bindError } = await admin.rpc('veil_bind_setup_checkout',{ p_id:order.id,p_session:session });
      if (bindError || bound?.ok !== true) return reply({ error:'checkout_confirmation_pending' },503);
      return reply({ url:bound.url,test_mode:true });
    } catch { return reply({ error:'checkout_confirmation_pending' },503); }
  };
}

// Store only reconciliation fields; never persist customer addresses or payment-method data here.
export function eventReceipt(event) {
  const o = event?.data?.object || {};
  const idOf = value => typeof value === 'string' ? value : value?.id || null;
  return {
    id:event.id,type:event.type,livemode:event.livemode,api_version:event.api_version || null,
    object:{ id:o.id,mode:o.mode || null,client_reference_id:o.client_reference_id || null,
      payment_status:o.payment_status || null,currency:o.currency || null,
      amount_total:o.amount_total ?? null,amount:o.amount ?? null,amount_refunded:o.amount_refunded ?? null,
      payment_intent:idOf(o.payment_intent),charge:idOf(o.charge),invoice:idOf(o.invoice) }
  };
}

export function createWebhookHandler({ config, verifyEvent, admin }) {
  return async req => {
    const reply=(data,status=200)=>Response.json(data,{ status,headers:{ 'Cache-Control':'no-store' } });
    if (req.method !== 'POST') return reply({ error:'method_not_allowed' },405);
    if (config.mode !== 'test' || !config.webhookSecret?.startsWith('whsec_')) return reply({ error:'test_webhook_not_configured' },503);
    const signature=req.headers.get('stripe-signature');
    if (!signature) return reply({ error:'invalid_signature' },400);
    let event;
    try {
      const raw=await req.text();
      if (new TextEncoder().encode(raw).length>1000000) return reply({ error:'invalid_request' },413);
      // The Stripe SDK verifies the original raw text and enforces timestamp tolerance.
      event=await verifyEvent(raw,signature,config.webhookSecret);
    } catch { return reply({ error:'invalid_signature' },400); }
    if (event.livemode !== false) return reply({ error:'wrong_mode' },400);
    if (!BILLING_EVENTS.includes(event.type)) return reply({ received:true,ignored:true });
    const { data,error }=await admin.rpc('veil_record_setup_event',{ p_event:eventReceipt(event) });
    if (error || data?.ok !== true) return reply({ error:'event_not_recorded' },503);
    return reply({ received:true,replayed:data.replayed===true });
  };
}

