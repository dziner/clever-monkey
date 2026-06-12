import { isPasswordProtectedPdfError, PasswordProtectedPdfError } from './pdfPassword';

// Extract a PDF's text layer entirely client-side using pdf.js (already
// loaded as window.pdfjsLib for the viewer). Text-based PDFs — the common
// case — extract instantly and locally, so we avoid shipping the whole
// file to the Gemini proxy for OCR. That server round-trip is what blew
// past the serverless function timeout (504) on larger documents.
//
// Returns '' when the PDF has no usable text layer (e.g. a scanned /
// image-only PDF), so the caller can fall back to Gemini OCR.

interface TextItem { str?: string }
interface TextContent { items: TextItem[] }

export interface PdfTextExtractionOptions {
    maxPages?: number;
    stopAfterChars?: number;
}

export interface PdfTextExtractionResult {
    text: string;
    numPages: number;
    pagesScanned: number;
}

export async function extractPdfTextDetailsLocally(
    file: File,
    options: PdfTextExtractionOptions = {},
): Promise<PdfTextExtractionResult> {
    const pdfjsLib = (window as { pdfjsLib?: { getDocument?: (data: ArrayBuffer) => { promise: Promise<PdfDoc> } } }).pdfjsLib;
    if (!pdfjsLib?.getDocument) return { text: '', numPages: 0, pagesScanned: 0 };

    const arrayBuffer = await file.arrayBuffer();
    let doc: PdfDoc;
    try {
        doc = await pdfjsLib.getDocument(arrayBuffer).promise;
    } catch (error) {
        if (isPasswordProtectedPdfError(error)) throw new PasswordProtectedPdfError();
        throw error;
    }
    try {
        const pages: string[] = [];
        let pagesScanned = 0;
        const pageLimit = Math.min(doc.numPages, options.maxPages ?? doc.numPages);
        for (let i = 1; i <= pageLimit; i++) {
            const page = await doc.getPage(i);
            const content = (await page.getTextContent()) as TextContent;
            const pageText = content.items
                .map(item => item.str ?? '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (pageText) pages.push(pageText);
            pagesScanned = i;
            if (options.stopAfterChars && pages.join('\n\n').length >= options.stopAfterChars) break;
        }
        return { text: pages.join('\n\n').trim(), numPages: doc.numPages, pagesScanned };
    } finally {
        doc.destroy?.();
    }
}

export async function extractPdfTextLocally(
    file: File,
    options?: PdfTextExtractionOptions,
): Promise<string> {
    return (await extractPdfTextDetailsLocally(file, options)).text;
}

interface PdfPage { getTextContent(): Promise<unknown> }
interface PdfDoc {
    numPages: number;
    getPage(n: number): Promise<PdfPage>;
    destroy?(): void;
}
