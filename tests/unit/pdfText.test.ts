import { afterEach, describe, expect, it } from 'vitest';
import { extractPdfTextDetailsLocally } from '../../utils/pdfText';

interface MockPdfPage {
    getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}

interface MockPdfDoc {
    numPages: number;
    getPage: (page: number) => Promise<MockPdfPage>;
    destroy: () => void;
}

interface MockPdfJsGlobal {
    getDocument: (data: ArrayBuffer) => { promise: Promise<MockPdfDoc> };
}

const getWindowWithPdfJs = () => window as Window & { pdfjsLib?: MockPdfJsGlobal };
const originalPdfJsLib = getWindowWithPdfJs().pdfjsLib;

afterEach(() => {
    if (originalPdfJsLib) getWindowWithPdfJs().pdfjsLib = originalPdfJsLib;
    else delete getWindowWithPdfJs().pdfjsLib;
});

describe('extractPdfTextDetailsLocally', () => {
    it('can probe only the first pages of image-heavy PDFs', async () => {
        const visited: number[] = [];
        getWindowWithPdfJs().pdfjsLib = {
            getDocument: () => ({
                promise: Promise.resolve({
                    numPages: 20,
                    destroy: () => undefined,
                    getPage: async (page: number) => {
                        visited.push(page);
                        return { getTextContent: async () => ({ items: [] }) };
                    },
                }),
            }),
        };

        const result = await extractPdfTextDetailsLocally(
            new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' }),
            { maxPages: 3 },
        );

        expect(result).toEqual({ text: '', numPages: 20, pagesScanned: 3 });
        expect(visited).toEqual([1, 2, 3]);
    });

    it('stops probing once enough text is found', async () => {
        getWindowWithPdfJs().pdfjsLib = {
            getDocument: () => ({
                promise: Promise.resolve({
                    numPages: 10,
                    destroy: () => undefined,
                    getPage: async (page: number) => ({
                        getTextContent: async () => ({ items: [{ str: page === 1 ? 'a'.repeat(120) : 'later' }] }),
                    }),
                }),
            }),
        };

        const result = await extractPdfTextDetailsLocally(
            new File(['%PDF'], 'text.pdf', { type: 'application/pdf' }),
            { maxPages: 8, stopAfterChars: 100 },
        );

        expect(result.text.length).toBeGreaterThanOrEqual(100);
        expect(result.pagesScanned).toBe(1);
    });
});
