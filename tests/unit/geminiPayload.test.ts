import { describe, expect, it } from 'vitest';
import {
    modelForPayload,
    storagePathForPayload,
    summarizeGeminiPayload,
    type GeminiPayload,
} from '../../services/geminiPayload';

describe('geminiPayload diagnostics', () => {
    it('summarizes generateContent without leaking full contents', () => {
        const payload: GeminiPayload = {
            action: 'generateContent',
            model: 'gemini-2.5-flash',
            contents: 'abcdef',
            config: { responseMimeType: 'application/json' },
            task: 'quiz',
        };

        expect(summarizeGeminiPayload(payload)).toEqual({
            action: 'generateContent',
            model: 'gemini-2.5-flash',
            task: 'quiz',
            contentsKind: 'string',
            contentsLength: 6,
            responseMimeType: 'application/json',
        });
    });

    it('summarizes inline extraction by size and mime type only', () => {
        expect(summarizeGeminiPayload({
            action: 'extractText',
            model: 'gemini-2.5-flash',
            inlineData: { data: 'base64-data', mimeType: 'application/pdf' },
        })).toEqual({
            action: 'extractText',
            model: 'gemini-2.5-flash',
            mimeType: 'application/pdf',
            inlineDataLength: 11,
        });
    });

    it('keeps storage path available only for storage OCR payloads', () => {
        const storagePayload: GeminiPayload = {
            action: 'extractTextFromStorage',
            model: 'gemini-2.5-flash',
            storagePath: 'user/doc.pdf',
            mimeType: 'application/pdf',
            fileName: 'doc.pdf',
        };
        const chatPayload: GeminiPayload = {
            action: 'chat',
            model: 'gemini-2.5-flash',
            systemInstruction: 'sys',
            history: [],
            message: 'hi',
        };

        expect(storagePathForPayload(storagePayload)).toBe('user/doc.pdf');
        expect(storagePathForPayload(chatPayload)).toBeUndefined();
    });

    it('does not attach model metadata to TTS payloads', () => {
        const payload: GeminiPayload = { action: 'tts', text: 'hello', voice: 'Zephyr' };

        expect(modelForPayload(payload)).toBeUndefined();
        expect(summarizeGeminiPayload(payload)).toEqual({
            action: 'tts',
            textLength: 5,
            voice: 'Zephyr',
        });
    });
});
