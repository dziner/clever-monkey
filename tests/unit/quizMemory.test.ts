import { describe, expect, it } from 'vitest';
import { buildQuizAvoidanceBlock, QUIZ_HISTORY_LIMIT } from '../../utils/quizMemory';

describe('buildQuizAvoidanceBlock', () => {
    it('returns empty string when there is no history (first quiz)', () => {
        // No header means generateQuiz can concatenate unconditionally
        // without producing a stray "AVOID THESE" section for a learner
        // who has never seen a question yet.
        expect(buildQuizAvoidanceBlock([])).toBe('');
        expect(buildQuizAvoidanceBlock(['', '  ', '\n'])).toBe('');
    });

    it('lists previously seen stems with explicit avoidance instructions', () => {
        const block = buildQuizAvoidanceBlock([
            'What is photosynthesis?',
            'Define mitochondria.',
        ]);
        // Both stems present, numbered, with the directive that tells
        // the model these are the user's history (the actual signal).
        expect(block).toContain('AVOID THESE PREVIOUSLY ASKED QUESTIONS');
        expect(block).toContain('1. What is photosynthesis?');
        expect(block).toContain('2. Define mitochondria.');
    });

    it(`caps the block at ${QUIZ_HISTORY_LIMIT} entries even with a long history`, () => {
        const overflowing = Array.from({ length: QUIZ_HISTORY_LIMIT + 10 }, (_, i) => `Question #${i + 1}?`);
        const block = buildQuizAvoidanceBlock(overflowing);
        // The 20th appears, the 21st does not — so the prompt stays
        // bounded even after the learner has done many quiz attempts.
        expect(block).toContain(`${QUIZ_HISTORY_LIMIT}. Question #${QUIZ_HISTORY_LIMIT}?`);
        expect(block).not.toContain(`${QUIZ_HISTORY_LIMIT + 1}. Question #${QUIZ_HISTORY_LIMIT + 1}?`);
    });

    it('truncates individual long stems so token budget stays sane', () => {
        const long = 'x'.repeat(500);
        const block = buildQuizAvoidanceBlock([long]);
        // 200-char cap (helper's internal RECENT_QUESTION_CHAR_CAP);
        // a 500-char dump would bloat the prompt unnecessarily.
        const xCount = (block.match(/x/g) ?? []).length;
        expect(xCount).toBeLessThanOrEqual(200);
        expect(xCount).toBeGreaterThan(150);
    });
});
