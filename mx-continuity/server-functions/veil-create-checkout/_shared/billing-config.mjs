// Approved $299 sandbox-only setup price. Billing remains fail-closed unless test-mode credentials, owner authentication and approved origin are configured.
export const TEST_BILLING_DEFAULTS = Object.freeze({
  origin:'https://theurbanmatrixlab.com',
  prices:Object.freeze({ website_setup:'price_1UfCIv2OkUQH95j4N25JJMoc' })
});
export function checkoutRuntimeConfig(getEnv) {
  return {
    mode:getEnv('MATRIX_BILLING_MODE') || 'disabled',
    origin:getEnv('MATRIX_ALLOWED_ORIGIN') || TEST_BILLING_DEFAULTS.origin,
    prices:Object.freeze({ website_setup:getEnv('MX_STRIPE_TEST_PRICE_SETUP') || TEST_BILLING_DEFAULTS.prices.website_setup }),
    apiKey:getEnv('MATRIX_STRIPE_TEST_KEY'),
    webhookSecret:getEnv('MATRIX_STRIPE_TEST_WEBHOOK_SECRET')
  };
}

