import type { HandlerEvent } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getUserIdFromToken } from './shared';

export const STRIPE_API_VERSION = '2026-05-27.dahlia' as const;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ServerCache = typeof globalThis & {
  __cmStripeClient?: Stripe;
};

const serverCache = globalThis as ServerCache;

export interface BillingProfile {
  id: string;
  email: string;
  tier: 'free' | 'pro';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
  stripe_cancel_at_period_end: boolean | null;
}

export const BILLING_PROFILE_COLUMNS = [
  'id',
  'email',
  'tier',
  'stripe_customer_id',
  'stripe_subscription_id',
  'stripe_subscription_status',
  'stripe_price_id',
  'stripe_current_period_end',
  'stripe_cancel_at_period_end',
].join(', ');

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export function getHeader(event: HandlerEvent, name: string): string | undefined {
  const lower = name.toLowerCase();
  return event.headers[name] ?? event.headers[lower];
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(event: HandlerEvent): string {
  return (
    normalizeBaseUrl(process.env.APP_BASE_URL) ??
    normalizeBaseUrl(process.env.PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.URL) ??
    normalizeBaseUrl(getHeader(event, 'origin')) ??
    'http://localhost:5173'
  );
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw Object.assign(new Error('Server missing STRIPE_SECRET_KEY'), { status: 500 });
  }

  return serverCache.__cmStripeClient ?? (serverCache.__cmStripeClient = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  }));
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw Object.assign(new Error('Server missing Supabase service credentials'), { status: 500 });
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getAuthedBillingProfile(event: HandlerEvent, admin = getSupabaseAdmin()) {
  const userId = await getUserIdFromToken(getHeader(event, 'authorization'));
  if (!userId) return { error: json(401, { error: 'Not authenticated' }) };

  const { data, error } = await admin
    .from('profiles')
    .select(BILLING_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[billing] profile select failed', error);
    return { error: json(500, { error: 'Billing profile columns are not available. Run the Stripe billing migration.' }) };
  }
  if (!data) return { error: json(404, { error: 'Profile not found' }) };

  return { profile: data as unknown as BillingProfile };
}

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  profile: BillingProfile,
): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: profile.email || undefined,
    metadata: { userId: profile.id },
  });

  const { error } = await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', profile.id);

  if (error) {
    console.error('[billing] failed to store Stripe customer', error);
    throw Object.assign(new Error('Failed to save Stripe customer'), { status: 500 });
  }

  profile.stripe_customer_id = customer.id;
  return customer.id;
}

const ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function subscriptionAllowsPro(status: string | null | undefined): boolean {
  return Boolean(status && ACCESS_STATUSES.has(status));
}

export function subscriptionCustomerId(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;
  if (typeof customer === 'string') return customer;
  return customer?.id ?? null;
}

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  return typeof price?.id === 'string' ? price.id : null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacySubscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (typeof legacySubscription === 'string') return legacySubscription;
  if (legacySubscription?.id) return legacySubscription.id;

  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSubscription === 'string') return parentSubscription;
  return parentSubscription?.id ?? null;
}

export function subscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const periodEnd = subscription.items.data
    .map(item => item.current_period_end)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => b - a)[0];

  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

export async function syncSubscriptionToProfile(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  userIdHint?: string | null,
): Promise<boolean> {
  const customerId = subscriptionCustomerId(subscription);
  if (!customerId) return false;

  const tier = subscriptionAllowsPro(subscription.status) ? 'pro' : 'free';
  const patch = {
    tier,
    tier_expires_at: tier === 'pro' ? subscriptionCurrentPeriodEnd(subscription) : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    stripe_price_id: subscriptionPriceId(subscription),
    stripe_current_period_end: subscriptionCurrentPeriodEnd(subscription),
    stripe_cancel_at_period_end: subscription.cancel_at_period_end,
  };

  let query = admin.from('profiles').update(patch);
  query = userIdHint ? query.eq('id', userIdHint) : query.eq('stripe_customer_id', customerId);

  const { error } = await query;
  if (error) {
    console.error('[billing] failed to sync subscription', error);
    return false;
  }

  return true;
}

export function rawBodyBuffer(event: HandlerEvent): Buffer {
  return Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
}

export function statusFromError(error: unknown): number {
  const status = (error as { status?: number; statusCode?: number } | null)?.status
    ?? (error as { status?: number; statusCode?: number } | null)?.statusCode;
  return typeof status === 'number' && status >= 400 && status <= 599 ? status : 500;
}
