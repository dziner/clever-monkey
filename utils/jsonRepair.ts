// Robust JSON extraction from LLM output. Gemini (and other models) will
// occasionally:
//   - wrap JSON in Markdown fences (```json ... ```),
//   - prepend a sentence ("Sure! Here's the JSON: { ... }"),
//   - emit trailing commas or JS-style comments inside the JSON.
//
// repairJSON() handles the trailing-comma + comment cases.
// cleanAndParseJSON() handles the prose-wrapping case by hunting for the
// outermost braces/brackets, then falls back to fence-stripping and
// finally to a repair pass. Returns the parsed object on success; throws
// SyntaxError when every recovery path fails so callers can choose
// whether to log a diagnostic or substitute a default.

/** Strip trailing commas and JS-style comments that some models emit. */
export function repairJSON(text: string): string {
    return text
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Parse JSON from a string that may be wrapped in Markdown fences, have
 * leading/trailing prose, or contain minor syntactic noise (comments,
 * trailing commas). Throws if no recovery succeeds.
 */
export function cleanAndParseJSON(text: string): unknown {
    const firstOpenBrace = text.indexOf('{');
    const firstOpenBracket = text.indexOf('[');
    let startIndex = -1;

    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        startIndex = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
        startIndex = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket;
    }

    if (startIndex !== -1) {
        const lastCloseBrace = text.lastIndexOf('}');
        const lastCloseBracket = text.lastIndexOf(']');
        let endIndex = -1;

        if (lastCloseBrace !== -1 && lastCloseBracket !== -1) {
            endIndex = Math.max(lastCloseBrace, lastCloseBracket);
        } else if (lastCloseBrace !== -1) {
            endIndex = lastCloseBrace;
        } else if (lastCloseBracket !== -1) {
            endIndex = lastCloseBracket;
        }

        if (endIndex !== -1 && endIndex >= startIndex) {
            const candidate = text.substring(startIndex, endIndex + 1);
            try {
                return JSON.parse(candidate);
            } catch {
                try {
                    return JSON.parse(repairJSON(candidate));
                } catch {
                    // fall through to fence-stripping
                }
            }
        }
    }

    const stripped = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
    try {
        return JSON.parse(stripped);
    } catch {
        return JSON.parse(repairJSON(stripped));
    }
}
