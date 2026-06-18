# Stripe Billing Setup

This app uses Stripe Checkout for Pro subscriptions and Stripe Billing Portal for subscription management.

## Architecture

- Browser: calls Netlify Functions and redirects to Stripe-hosted Checkout or Billing Portal.
- Netlify Functions:
  - `create-checkout-session`: authenticated user -> Stripe Checkout subscription session.
  - `create-billing-portal-session`: authenticated Pro/customer -> Stripe Billing Portal session.
  - `stripe-webhook`: verifies Stripe signature, then syncs subscription state to Supabase.
- Supabase: `profiles.tier` remains the product-access source of truth.
- Security: browser clients can update only safe profile fields (`email`, `display_name`, `language`). Tier, role, and `stripe_*` fields are changed by service-role Functions or admin RPCs.

## 1. Create Stripe product and price

1. Stripe Dashboard -> Product catalog -> Add product.
2. Product name: `Clever Monkey Pro`.
3. Add a recurring monthly or yearly price.
4. Copy the Price ID, for example `price_...`.

## 2. Apply Supabase migration

Run this in Supabase SQL Editor:

```sql
-- supabase/add_stripe_billing.sql
```

It adds Stripe subscription columns, locks down sensitive profile updates, and creates the admin profile update RPC.

## 3. Configure environment variables

Set these in Netlify and local `.env`/`.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://your-production-domain
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Keep using the existing client env vars:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 4. Register the webhook endpoint

In Stripe Dashboard -> Webhooks, add:

```text
https://your-production-domain/.netlify/functions/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`

Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

## 5. Configure the Billing Portal

Stripe Dashboard -> Settings -> Billing -> Customer portal:

- Enable payment method updates.
- Enable invoice history.
- Enable subscription cancellation if self-serve cancellation is desired.
- Set branding and return URL to the app domain.

## 6. Local verification

Run Netlify dev so Functions are available:

```bash
netlify dev
```

Forward Stripe webhooks:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET`, then restart `netlify dev`.

Test flow:

1. Sign in.
2. Open Profile or an Upgrade prompt.
3. Click `Pro로 업그레이드`.
4. Pay with Stripe test card `4242 4242 4242 4242`.
5. Confirm `profiles.tier = 'pro'` and `stripe_subscription_status = 'active'`.
6. Open Profile -> `결제 관리` and verify the Billing Portal opens.
7. Cancel in the portal, then confirm webhook syncs the profile back according to subscription status.

## Notes

- Access is granted for `active`, `trialing`, and `past_due` subscription statuses. Access is revoked for terminal or non-access statuses such as `canceled`, `unpaid`, and `incomplete`.
- Stripe webhook signature verification requires the raw request body. Do not parse JSON before verification in `stripe-webhook`.
- Checkout success redirects are not treated as proof of payment. The webhook is the source of truth.
