import { withSupabase } from 'npm:@supabase/server@1.9.2';
import Stripe from 'npm:stripe@23.0.0';
import { billingConfigured, createCheckoutHandler } from '../_shared/billing.mjs';
import { checkoutRuntimeConfig } from '../_shared/billing-config.mjs';

Deno.serve(withSupabase({ auth:'user' },async (req,ctx) => {
  const config=checkoutRuntimeConfig(key => Deno.env.get(key));
  if (!billingConfigured(config)) return Response.json({ error:'test_billing_not_configured' },{ status:503 });
  const stripe=new Stripe(config.apiKey,{ apiVersion:'2026-09-30.endive',maxNetworkRetries:0,timeout:15000 });
  return createCheckoutHandler({ config,stripe,admin:ctx.supabaseAdmin,verifiedUser:async () => {
    const { data,error }=await ctx.supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } })(req);
}));

