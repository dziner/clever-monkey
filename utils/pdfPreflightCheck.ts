// Upfront limits for uploaded PDFs — surfaced BEFORE storage upload so
// the user finds out a file is over the line in seconds, not minutes.
//
// Why these numbers:
// - PDFs whose pages are images are OCR'd by Gemini Files API. The 34MB / 500-page
//   case took 5+ minutes and still returned a RECITATION block. Empirically,
//   ~200 pages is the comfortable ceiling where end-to-end OCR succeeds
//   reliably inside the background function's 15-min budget AND fits
//   under Gemini's response token cap. Splitting a bigger scan is the
//   user's job.
// - Text-layer PDFs are extracted client-side and have no equivalent
//   ceiling — they don't go through Gemini OCR at all.

import { extractPdfTextDetailsLocally } from './pdfText';

export const SCANNED_PDF_PAGE_LIMIT = 200;

/** Enough text from the first few pages to confidently call a PDF
 *  "text-layer". Same threshold the OCR fallback uses. */
const MIN_TEXT_LAYER_CHARS = 200;

export type PdfPreflightClassification =
    | 'not_pdf'
    | 'text_layer'
    | 'scanned_or_image'
    | 'probe_failed';

export type PdfPreflightResult =
    | {
        ok: true;
        classification: PdfPreflightClassification;
        numPages?: number;
        pagesScanned?: number;
        textLayerChars?: number;
      }
    | {
        ok: false;
        reason: string;
        classification: 'scanned_or_image';
        numPages: number;
        pagesScanned: number;
        textLayerChars: number;
      };

/**
 * Decide BEFORE upload whether a PDF will be accepted. Text-layer PDFs
 * pass unconditionally (local extract is fast and free); PDFs whose pages
 * are image content over SCANNED_PDF_PAGE_LIMIT are rejected with an
 * actionable Korean message so the user doesn't waste minutes waiting
 * for OCR that we already know won't finish cleanly.
 *
 * Returns ok:true if not a PDF (image / text uploads bypass this check)
 * or if probing fails (we don't want a flaky pdf.js error to block
 * uploads — the existing per-step pipeline catches real issues).
 */
export async function checkPdfPreflightLimits(file: File): Promise<PdfPreflightResult> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return { ok: true, classification: 'not_pdf' };

    let probe: { text: string; numPages: number; pagesScanned: number };
    try {
        probe = await extractPdfTextDetailsLocally(file, {
            maxPages: 10,
            stopAfterChars: MIN_TEXT_LAYER_CHARS,
        });
    } catch {
        // pdf.js choked — let the downstream pipeline produce a real
        // error rather than blocking the upload here on a maybe-issue.
        return { ok: true, classification: 'probe_failed' };
    }

    const textLayerChars = probe.text.trim().length;

    // Text-layer PDF: extracted locally regardless of page count. No
    // upper bound makes sense for these (no OCR, no Gemini round trip).
    if (textLayerChars >= MIN_TEXT_LAYER_CHARS) {
        return {
            ok: true,
            classification: 'text_layer',
            numPages: probe.numPages,
            pagesScanned: probe.pagesScanned,
            textLayerChars,
        };
    }

    // PDF pages are image content — would route to OCR. Reject up front if too big.
    if (probe.numPages > SCANNED_PDF_PAGE_LIMIT) {
        return {
            ok: false,
            reason: `페이지의 내용이 이미지로 구성된 PDF 파일은 현재 최대 ${SCANNED_PDF_PAGE_LIMIT}페이지까지 안정적으로 처리할 수 있어요. 이 파일은 ${probe.numPages}페이지예요. ${SCANNED_PDF_PAGE_LIMIT}페이지 이하로 나눠서 다시 업로드해 주세요.`,
            classification: 'scanned_or_image',
            numPages: probe.numPages,
            pagesScanned: probe.pagesScanned,
            textLayerChars,
        };
    }
    return {
        ok: true,
        classification: 'scanned_or_image',
        numPages: probe.numPages,
        pagesScanned: probe.pagesScanned,
        textLayerChars,
    };
}
