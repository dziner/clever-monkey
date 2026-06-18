import type { Handler } from '@netlify/functions';
import {
  getAppBaseUrl,
  getAuthedBillingProfile,
  getOrCreateStripeCustomer,
  getStripe,
  getSupabaseAdmin,
  json,
  statusFromError,
} from './lib/billing';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) return json(500, { error: 'Server missing STRIPE_PRO_PRICE_ID' });

    const admin = getSupabaseAdmin();
    const auth = await getAuthedBillingProfile(event, admin);
    if ('error' in auth) return auth.error;

    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer(stripe, admin, auth.profile);
    const baseUrl = getAppBaseUrl(event);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: auth.profile.id,
      metadata: { userId: auth.profile.id },
      subscription_data: { metadata: { userId: auth.profile.id } },
      success_url: `${baseUrl}/profile?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/profile?billing=cancelled`,
    });

    if (!session.url) return json(500, { error: 'Stripe did not return a checkout URL' });
    return json(200, { url: session.url });
  } catch (error) {
    console.error('[create-checkout-session] failed', error);
    return json(statusFromError(error), { error: error instanceof Error ? error.message : 'Checkout failed' });
  }
};
