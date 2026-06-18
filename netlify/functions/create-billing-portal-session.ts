import type { Handler } from '@netlify/functions';
import {
  getAppBaseUrl,
  getAuthedBillingProfile,
  getStripe,
  getSupabaseAdmin,
  json,
  statusFromError,
} from './lib/billing';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const admin = getSupabaseAdmin();
    const auth = await getAuthedBillingProfile(event, admin);
    if ('error' in auth) return auth.error;
    if (!auth.profile.stripe_customer_id) {
      return json(409, { error: 'No Stripe customer is linked to this account yet.' });
    }

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl(event);
    const session = await stripe.billingPortal.sessions.create({
      customer: auth.profile.stripe_customer_id,
      return_url: `${baseUrl}/profile?billing=portal_return`,
    });

    return json(200, { url: session.url });
  } catch (error) {
    console.error('[create-billing-portal-session] failed', error);
    return json(statusFromError(error), { error: error instanceof Error ? error.message : 'Billing portal failed' });
  }
};
