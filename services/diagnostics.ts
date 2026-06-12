import { supabase } from './supabaseClient';
import type { DiagnosticEvent } from '../utils/diagnostics';

const SESSION_KEY = 'cm.diagnostic.session.v1';

function getClientSessionId(): string {
    try {
        const existing = sessionStorage.getItem(SESSION_KEY);
        if (existing) return existing;
        const next = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, next);
        return next;
    } catch {
        return 'session-unavailable';
    }
}

export async function logDiagnosticEvent(event: DiagnosticEvent): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/diagnostics', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({
                ...event,
                clientSessionId: getClientSessionId(),
                urlPath: window.location.pathname,
                userAgent: navigator.userAgent,
                occurredAt: new Date().toISOString(),
            }),
            keepalive: true,
        }).catch(() => undefined);
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[diagnostics] failed to submit event', error, event);
        }
    }
}
