// Approved three-package sandbox mapping. Billing remains fail-closed until all test prices, credentials and owner checks are configured.
export const TEST_BILLING_DEFAULTS = Object.freeze({
  origin:'https://theurbanmatrixlab.com',
  prices:Object.freeze({})
});
export function checkoutRuntimeConfig(getEnv) {
  return {
    mode:getEnv('MATRIX_BILLING_MODE') || 'disabled',
    origin:getEnv('MATRIX_ALLOWED_ORIGIN') || TEST_BILLING_DEFAULTS.origin,
    prices:Object.freeze({
      basic_setup:getEnv('MX_STRIPE_TEST_PRICE_BASIC') || '',
      business_setup:getEnv('MX_STRIPE_TEST_PRICE_BUSINESS') || '',
      continuity_setup:getEnv('MX_STRIPE_TEST_PRICE_CONTINUITY') || ''
    }),
    apiKey:getEnv('MATRIX_STRIPE_TEST_KEY'),
    webhookSecret:getEnv('MATRIX_STRIPE_TEST_WEBHOOK_SECRET')
  };
}
