import { describe, it, expect } from 'vitest';
import { isGuestLocked } from '../../components/InteractionTabs';

describe('isGuestLocked', () => {
    it('unlocks Overview and Chat for guests', () => {
        expect(isGuestLocked('overview', true)).toBe(false);
        expect(isGuestLocked('chat', true)).toBe(false);
    });

    it('locks the rich tabs for guests', () => {
        expect(isGuestLocked('quiz', true)).toBe(true);
        expect(isGuestLocked('mindmap', true)).toBe(true);
        expect(isGuestLocked('flashcards', true)).toBe(true);
        expect(isGuestLocked('podcast', true)).toBe(true);
    });

    it('never locks anything for signed-in users', () => {
        for (const id of ['overview', 'chat', 'quiz', 'mindmap', 'flashcards', 'podcast'] as const) {
            expect(isGuestLocked(id, false)).toBe(false);
        }
    });
});
