import { describe, expect, it } from 'vitest';
import { buildPodcastScriptPrompt } from '../../services/podcastPrompt';

describe('buildPodcastScriptPrompt', () => {
    it('uses the standard length guide by default', () => {
        const prompt = buildPodcastScriptPrompt({
            documentContent: 'Photosynthesis converts light into chemical energy.',
            language: 'en',
        });

        expect(prompt).toContain('about 750 words by default');
        expect(prompt).toContain('A single narrator presents the material');
        expect(prompt).toContain('Photosynthesis converts light into chemical energy.');
    });

    it('uses the long length guide when requested', () => {
        const prompt = buildPodcastScriptPrompt({
            documentContent: 'A long lecture',
            language: 'en',
            length: 'long',
        });

        expect(prompt).toContain('about 1,200 words by default');
        expect(prompt).toContain('roughly 7-8 minutes');
    });

    it('keeps user direction explicit while preserving single narrator constraints', () => {
        const prompt = buildPodcastScriptPrompt({
            documentContent: 'Cell respiration notes',
            language: 'ko',
            instructions: 'Make it conversational with two hosts.',
        });

        expect(prompt).toContain('USER DIRECTION (follow scope, tone, emphasis, and length requests; it must NOT override the one-narrator format)');
        expect(prompt).toContain('Make it conversational with two hosts.');
        expect(prompt).toContain('One narrator only.');
        expect(prompt).toContain('convert that request into a single-narrator explanation');
        expect(prompt).toContain('Plain prose only');
    });
});
