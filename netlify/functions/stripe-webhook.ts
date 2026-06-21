import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import {
  getHeader,
  getStripe,
  getSupabaseAdmin,
  invoiceSubscriptionId,
  json,
  rawBodyBuffer,
  syncSubscriptionToProfile,
} from './lib/billing';

async function syncSubscriptionOrThrow(
  admin: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription,
  userIdHint?: string | null,
) {
  const synced = await syncSubscriptionToProfile(admin, subscription, userIdHint);
  if (!synced) {
    throw new Error(`Failed to sync Stripe subscription ${subscription.id} to a profile`);
  }
}

async function syncInvoiceSubscription(stripe: Stripe, admin = getSupabaseAdmin(), invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  await syncSubscriptionOrThrow(admin, subscription);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return json(500, { error: 'Server missing STRIPE_WEBHOOK_SECRET' });

  const stripe = getStripe();
  const signature = getHeader(event, 'stripe-signature');
  if (!signature) return json(400, { error: 'Missing Stripe signature' });

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBodyBuffer(event), signature, webhookSecret);
  } catch (error) {
    console.error('[stripe-webhook] signature verification failed', error);
    return json(400, { error: 'Invalid Stripe signature' });
  }

  try {
    const admin = getSupabaseAdmin();

    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price'],
          });
          await syncSubscriptionOrThrow(admin, subscription, session.metadata?.userId ?? session.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscriptionOrThrow(admin, stripeEvent.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        await syncInvoiceSubscription(stripe, admin, stripeEvent.data.object as Stripe.Invoice);
        break;
      }
      default:
        break;
    }

    return json(200, { received: true });
  } catch (error) {
    console.error('[stripe-webhook] handler failed', error);
    return json(500, { error: 'Webhook handler failed' });
  }
};
