// Quiz-history prompt helpers. Pure (no network) so they live in utils/
// and the unit test imports them without dragging in supabaseClient.
//
// Network fetch / persistence lives in services/quizMemoryService.ts.

/** Cap each previously-seen question in the prompt block so the avoidance
 *  list stays under a sane token budget even when the user has a long
 *  history. 200 chars covers a realistic question stem with room for
 *  punctuation; full answers and explanations are not included. */
const RECENT_QUESTION_CHAR_CAP = 200;

/** How many of the most recent same-type questions the avoidance block
 *  injects. 20 × ~200 chars ≈ 1500 tokens — small enough that even
 *  Flash-Lite's context is barely touched, large enough to discourage
 *  repeats across the last several quiz attempts. */
export const QUIZ_HISTORY_LIMIT = 20;

/**
 * Build the "AVOID THESE PREVIOUSLY ASKED QUESTIONS" block injected into
 * the generation prompt. Returns "" for an empty history so the caller
 * can concatenate unconditionally without producing a stray header.
 *
 * Per-question text is truncated to keep the block bounded; the model
 * only needs the stem to recognize topic overlap, not the full options.
 */
export function buildQuizAvoidanceBlock(recentQuestions: string[]): string {
    const cleaned = recentQuestions
        .map(q => q?.trim())
        .filter((q): q is string => !!q);
    if (cleaned.length === 0) return '';

    const lines = cleaned
        .slice(0, QUIZ_HISTORY_LIMIT)
        .map((q, i) => `${i + 1}. ${q.slice(0, RECENT_QUESTION_CHAR_CAP)}`)
        .join('\n');

    return `
AVOID THESE PREVIOUSLY ASKED QUESTIONS — the user has already seen these and will lose motivation if they appear again. Every new question MUST test a DIFFERENT concept/fact/section than every entry below. If your draft overlaps with any of these (even paraphrased), replace it with a question on an untested part of the document:
${lines}
`;
}
