import { supabase } from './supabaseClient';

type BillingResult = { url: string; error: null } | { url: null; error: string };

async function postBillingEndpoint(path: string): Promise<BillingResult> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { url: null, error: 'NO_SESSION' };

    try {
        const res = await fetch(path, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({}),
        });
        const body = await res.json().catch(() => ({})) as { url?: string; error?: string };
        if (!res.ok || !body.url) return { url: null, error: body.error || `HTTP ${res.status}` };
        return { url: body.url, error: null };
    } catch (error) {
        return { url: null, error: error instanceof Error ? error.message : 'Network error' };
    }
}

export async function createCheckoutSessionUrl(): Promise<BillingResult> {
    return postBillingEndpoint('/api/create-checkout-session');
}

export async function createBillingPortalSessionUrl(): Promise<BillingResult> {
    return postBillingEndpoint('/api/create-billing-portal-session');
}
