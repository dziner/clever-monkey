import { languageDirective } from './languageService';
import { sampleEvenly, CONTENT_BUDGET } from '../utils/promptBudget';

export type PodcastScriptLength = 'standard' | 'long';

export const PODCAST_SCRIPT_LENGTH_GUIDE: Record<PodcastScriptLength, { prompt: string }> = {
  standard: {
    prompt: 'about 750 words by default, roughly 4-5 minutes of spoken narration',
  },
  long: {
    prompt: 'about 1,200 words by default, roughly 7-8 minutes of spoken narration',
  },
};

export function buildPodcastScriptPrompt(params: {
  documentContent: string;
  language?: string | null;
  instructions?: string;
  length?: PodcastScriptLength;
}): string {
  const lengthGuide = PODCAST_SCRIPT_LENGTH_GUIDE[params.length ?? 'standard'] ?? PODCAST_SCRIPT_LENGTH_GUIDE.standard;
  const trimmedInstructions = params.instructions?.trim();
  const instructionBlock = trimmedInstructions
    ? `\nUSER DIRECTION (follow scope, tone, emphasis, and length requests; it must NOT override the one-narrator format):
"""
${trimmedInstructions}
"""\n`
    : '';

  return `Write an engaging podcast-style audio script based on the DOCUMENT CONTENT.
A single narrator presents the material in a conversational, educational style.

Rules:
- Open with a friendly welcome line equivalent to: "Welcome to today's study session. Today we're exploring..." (translated naturally into the target language).
- Use natural transitions equivalent to: "Moving on to...", "Here's something interesting...", "Let's now look at..." (translated naturally).
- Explain concepts clearly — assume the listener hasn't read the document.
- Close with a 2-sentence recap and sign-off.
- Length preset: ${lengthGuide.prompt}. If the USER DIRECTION specifies a duration (e.g. "30 seconds") or word count, follow that instead — use ~100 words per 30 seconds of audio as a guide.
- One narrator only. Do not write host/guest dialogue, panel discussions, interviews, speaker labels, role names, stage directions, or back-and-forth turns.
- If the USER DIRECTION asks for multiple speakers or a dialogue format, convert that request into a single-narrator explanation while preserving the requested topic, tone, and length.
- Plain prose only — absolutely no markdown, no headers, no bullet points, no speaker labels.
- ALWAYS finish the closing sentence with proper punctuation; never end mid-sentence.

${languageDirective(params.language)}
${instructionBlock}
DOCUMENT CONTENT:
"""
${sampleEvenly(params.documentContent, CONTENT_BUDGET.podcast)}
"""`;
}
