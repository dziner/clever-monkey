// Token-budget helpers that keep Gemini prompts lean without losing
// document coverage — the product's core promise is that quizzes,
// summaries and answers reflect the WHOLE document, so oversized content
// is sampled evenly across its length rather than truncated at the tail.

/**
 * Local token estimate, replacing the countTokens API round-trip that was
 * being made purely for the on-screen counter. CJK text runs ~1 token per
 * character on Gemini tokenizers; Latin text ~4 characters per token.
 * Accurate to within a few percent — plenty for a usage display.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    let cjk = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0)!;
        if (
            (code >= 0x1100 && code <= 0x11ff) ||   // Hangul Jamo
            (code >= 0x3040 && code <= 0x30ff) ||   // Hiragana / Katakana
            (code >= 0x3400 && code <= 0x9fff) ||   // CJK ideographs
            (code >= 0xac00 && code <= 0xd7af)      // Hangul syllables
        ) cjk++;
    }
    const other = [...text].length - cjk;
    return Math.max(1, Math.round(cjk + other / 4));
}

/**
 * Cap `content` at `maxChars` by sampling evenly across the document:
 * the text is cut into contiguous segments taken at regular intervals
 * from start to end, joined with an ellipsis marker. Generation prompts
 * that promise full-document coverage (quiz, slides, mindmap) keep seeing
 * the beginning, middle AND end instead of just a truncated head.
 */
export function sampleEvenly(content: string, maxChars: number): string {
    if (content.length <= maxChars) return content;

    const SEGMENTS = 8;
    const sep = '\n[…]\n';
    const budget = maxChars - sep.length * (SEGMENTS - 1);
    const segLen = Math.floor(budget / SEGMENTS);
    const stride = (content.length - segLen) / (SEGMENTS - 1);

    const parts: string[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
        const start = Math.round(i * stride);
        parts.push(content.slice(start, start + segLen));
    }
    return parts.join(sep);
}

// Per-feature character budgets for document content embedded in prompts.
// Sized to what each task actually needs: a 500-word podcast script or a
// handful of preset questions gains nothing from 250k chars of input,
// while quiz generation must still see enough to spread questions evenly.
export const CONTENT_BUDGET = {
    summary: 200_000,        // full-document fidelity is the point
    presetQuestions: 20_000, // 3-4 questions; an even sample is plenty
    quiz: 120_000,
    flashcards: 120_000,
    mindmap: 80_000,
    slides: 80_000,
    podcast: 48_000,         // output is only 400-500 words
    studyTips: 24_000,       // grounded mostly in the wrong answers
} as const;
