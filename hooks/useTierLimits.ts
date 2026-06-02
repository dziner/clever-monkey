import { useUser } from '../contexts/UserContext';
import { TIER_LIMITS, GUEST_LIMITS } from '../types';

export interface TierLimits {
    tier: 'guest' | 'free' | 'pro';
    isGuest: boolean;
    maxDocuments: number;
    maxFileSizeBytes: number;            // Infinity for authed users (no per-file cap currently)
    maxAiActionsPerDay: number;
    aiActionsToday: number;
    aiActionsRemaining: number;
    isAtDocumentLimit: (currentCount: number) => boolean;
    isAtAiLimit: boolean;
    isPro: boolean;
    isAdmin: boolean;
    label: string;
}

/**
 * Tier limits. If the user is signed out we return GUEST_LIMITS so
 * upload validation can branch on the same shape. AI-actions tracking
 * is N/A for guests (the Netlify Gemini function falls back to IP
 * rate limiting), so we report 0/0.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useTierLimits(_documentCount = 0): TierLimits {
    const { userId, userProfile } = useUser();
    const isGuest = !userId;

    if (isGuest) {
        return {
            tier: 'guest',
            isGuest: true,
            maxDocuments: GUEST_LIMITS.maxDocuments,
            maxFileSizeBytes: GUEST_LIMITS.maxFileSizeBytes,
            maxAiActionsPerDay: Infinity,
            aiActionsToday: 0,
            aiActionsRemaining: Infinity,
            isAtDocumentLimit: (count: number) => count >= GUEST_LIMITS.maxDocuments,
            isAtAiLimit: false,
            isPro: false,
            isAdmin: false,
            label: GUEST_LIMITS.label,
        };
    }

    const tier = userProfile?.tier ?? 'free';
    const limits = TIER_LIMITS[tier];
    const aiActionsToday = userProfile?.aiActionsToday ?? 0;
    const aiActionsRemaining =
        limits.maxAiActionsPerDay === Infinity
            ? Infinity
            : Math.max(0, limits.maxAiActionsPerDay - aiActionsToday);

    return {
        tier,
        isGuest: false,
        maxDocuments: limits.maxDocuments,
        maxFileSizeBytes: Infinity,
        maxAiActionsPerDay: limits.maxAiActionsPerDay,
        aiActionsToday,
        aiActionsRemaining,
        isAtDocumentLimit: (count: number) =>
            limits.maxDocuments !== Infinity && count >= limits.maxDocuments,
        isAtAiLimit: limits.maxAiActionsPerDay !== Infinity && aiActionsToday >= limits.maxAiActionsPerDay,
        isPro: tier === 'pro',
        isAdmin: userProfile?.role === 'admin',
        label: limits.label,
    };
}
