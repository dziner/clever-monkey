import { useUser } from '../contexts/UserContext';
import { TIER_LIMITS } from '../types';

export interface TierLimits {
    tier: 'free' | 'pro';
    maxDocuments: number;
    maxAiActionsPerDay: number;
    aiActionsToday: number;
    aiActionsRemaining: number;
    isAtDocumentLimit: (currentCount: number) => boolean;
    isAtAiLimit: boolean;
    isPro: boolean;
    isAdmin: boolean;
}

export function useTierLimits(documentCount = 0): TierLimits {
    const { userProfile } = useUser();

    const tier = userProfile?.tier ?? 'free';
    const limits = TIER_LIMITS[tier];
    const aiActionsToday = userProfile?.aiActionsToday ?? 0;
    const aiActionsRemaining =
        limits.maxAiActionsPerDay === Infinity
            ? Infinity
            : Math.max(0, limits.maxAiActionsPerDay - aiActionsToday);

    return {
        tier,
        maxDocuments: limits.maxDocuments,
        maxAiActionsPerDay: limits.maxAiActionsPerDay,
        aiActionsToday,
        aiActionsRemaining,
        isAtDocumentLimit: (count: number) =>
            limits.maxDocuments !== Infinity && count >= limits.maxDocuments,
        isAtAiLimit: limits.maxAiActionsPerDay !== Infinity && aiActionsToday >= limits.maxAiActionsPerDay,
        isPro: tier === 'pro',
        isAdmin: userProfile?.role === 'admin',
    };
}
