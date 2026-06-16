// Upfront limits for uploaded PDFs — surfaced BEFORE storage upload so
// the user finds out a file is over the line in seconds, not minutes.
//
// Why these numbers:
// - Scanned/image PDFs are OCR'd by Gemini Files API. The 34MB / 500-page
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

export type PdfPreflightResult =
    | { ok: true }
    | { ok: false; reason: string };

/**
 * Decide BEFORE upload whether a PDF will be accepted. Text-layer PDFs
 * pass unconditionally (local extract is fast and free); scanned PDFs
 * over SCANNED_PDF_PAGE_LIMIT are rejected with an actionable Korean
 * message so the user doesn't waste minutes waiting for OCR that we
 * already know won't finish cleanly.
 *
 * Returns ok:true if not a PDF (image / text uploads bypass this check)
 * or if probing fails (we don't want a flaky pdf.js error to block
 * uploads — the existing per-step pipeline catches real issues).
 */
export async function checkPdfPreflightLimits(file: File): Promise<PdfPreflightResult> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return { ok: true };

    let probe: { text: string; numPages: number; pagesScanned: number };
    try {
        probe = await extractPdfTextDetailsLocally(file, {
            maxPages: 10,
            stopAfterChars: MIN_TEXT_LAYER_CHARS,
        });
    } catch {
        // pdf.js choked — let the downstream pipeline produce a real
        // error rather than blocking the upload here on a maybe-issue.
        return { ok: true };
    }

    // Text-layer PDF: extracted locally regardless of page count. No
    // upper bound makes sense for these (no OCR, no Gemini round trip).
    if (probe.text.trim().length >= MIN_TEXT_LAYER_CHARS) return { ok: true };

    // Scanned/image PDF — would route to OCR. Reject up front if too big.
    if (probe.numPages > SCANNED_PDF_PAGE_LIMIT) {
        return {
            ok: false,
            reason: `스캔 PDF는 최대 ${SCANNED_PDF_PAGE_LIMIT}페이지까지 지원해요. 이 파일은 ${probe.numPages}페이지예요 — 파일을 더 작게 나눠서 다시 업로드해 주세요.`,
        };
    }
    return { ok: true };
}
