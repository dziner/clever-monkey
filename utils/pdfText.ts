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

export async function extractPdfTextLocally(file: File): Promise<string> {
    const pdfjsLib = (window as { pdfjsLib?: { getDocument?: (data: ArrayBuffer) => { promise: Promise<PdfDoc> } } }).pdfjsLib;
    if (!pdfjsLib?.getDocument) return '';

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
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = (await page.getTextContent()) as TextContent;
            const pageText = content.items
                .map(item => item.str ?? '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (pageText) pages.push(pageText);
        }
        return pages.join('\n\n').trim();
    } finally {
        doc.destroy?.();
    }
}

interface PdfPage { getTextContent(): Promise<unknown> }
interface PdfDoc {
    numPages: number;
    getPage(n: number): Promise<PdfPage>;
    destroy?(): void;
}
