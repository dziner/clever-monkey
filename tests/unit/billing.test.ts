import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
    getAppBaseUrl,
    invoiceSubscriptionId,
    rawBodyBuffer,
    subscriptionAllowsPro,
    subscriptionCurrentPeriodEnd,
    subscriptionCustomerId,
    subscriptionPriceId,
} from '../../netlify/functions/lib/billing';

const event = (overrides: Record<string, unknown> = {}) => ({
    headers: {},
    body: '',
    isBase64Encoded: false,
    ...overrides,
}) as never;

const subscription = (overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription => ({
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_123',
    cancel_at_period_end: false,
    items: {
        object: 'list',
        data: [{
            id: 'si_123',
            object: 'subscription_item',
            current_period_end: 1_797_000_000,
            current_period_start: 1_794_408_000,
            price: { id: 'price_pro', object: 'price' },
        }],
    },
    ...overrides,
}) as Stripe.Subscription;

describe('billing helpers', () => {
    it('maps subscription statuses to product access conservatively', () => {
        expect(subscriptionAllowsPro('active')).toBe(true);
        expect(subscriptionAllowsPro('trialing')).toBe(true);
        expect(subscriptionAllowsPro('past_due')).toBe(true);
        expect(subscriptionAllowsPro('unpaid')).toBe(false);
        expect(subscriptionAllowsPro('canceled')).toBe(false);
        expect(subscriptionAllowsPro('incomplete')).toBe(false);
    });

    it('reads customer, price, and period end from a Stripe subscription', () => {
        const sub = subscription();

        expect(subscriptionCustomerId(sub)).toBe('cus_123');
        expect(subscriptionPriceId(sub)).toBe('price_pro');
        expect(subscriptionCurrentPeriodEnd(sub)).toBe(new Date(1_797_000_000 * 1000).toISOString());
    });

    it('reads invoice subscription ids from current and legacy invoice shapes', () => {
        expect(invoiceSubscriptionId({
            parent: { subscription_details: { subscription: 'sub_parent' } },
        } as Stripe.Invoice)).toBe('sub_parent');

        expect(invoiceSubscriptionId({
            subscription: 'sub_legacy',
        } as Stripe.Invoice & { subscription: string })).toBe('sub_legacy');
    });

    it('decodes raw webhook bodies without JSON parsing', () => {
        expect(rawBodyBuffer(event({ body: 'hello' })).toString('utf8')).toBe('hello');
        expect(rawBodyBuffer(event({ body: Buffer.from('hello').toString('base64'), isBase64Encoded: true })).toString('utf8')).toBe('hello');
    });

    it('uses configured app URL before request origin for redirects', () => {
        const previous = process.env.APP_BASE_URL;
        process.env.APP_BASE_URL = 'https://clevermonkey.app/some/path';
        try {
            expect(getAppBaseUrl(event({ headers: { origin: 'http://localhost:5173' } }))).toBe('https://clevermonkey.app');
        } finally {
            if (previous === undefined) delete process.env.APP_BASE_URL;
            else process.env.APP_BASE_URL = previous;
        }
    });
});
