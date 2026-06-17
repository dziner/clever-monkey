// Upfront limits for uploaded PDFs — surfaced BEFORE storage upload so
// the user finds out a file is over the line in seconds, not minutes.
//
// Why these numbers:
// - PDFs whose pages are images are OCR'd by Gemini Files API. The 34MB / 500-page
//   case took 5+ minutes and still returned a RECITATION block. Follow-up
//   real-file cuts showed 50 pages succeeded while 80 and 100 pages failed,
//   so 50 is the current conservative ceiling until chunk OCR is introduced
//   or more boundary logs prove a higher value safe.
// - Gemini's document-understanding path also has a 50MB PDF ceiling. A file
//   can upload successfully and still fail when the model tries to read it,
//   so image-content PDFs get a file-size guard before storage upload too.
// - Text-layer PDFs are extracted client-side and have no equivalent
//   ceiling — they don't go through Gemini OCR at all.

import { extractPdfTextDetailsLocally } from './pdfText';

export const SCANNED_PDF_PAGE_LIMIT = 50;
export const SCANNED_PDF_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;
export const SCANNED_PDF_FILE_SIZE_WARN_BYTES = 35 * 1024 * 1024;
export const SCANNED_PDF_BYTES_PER_PAGE_WARN_BYTES = 1024 * 1024;

/** Enough text from the first few pages to confidently call a PDF
 *  "text-layer". Same threshold the OCR fallback uses. */
const MIN_TEXT_LAYER_CHARS = 200;

const formatMb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

export type PdfPreflightClassification =
    | 'not_pdf'
    | 'text_layer'
    | 'scanned_or_image'
    | 'probe_failed';

export type PdfPreflightRiskFlag =
    | 'near_file_size_limit'
    | 'high_bytes_per_page';

export type PdfPreflightRejectReason =
    | 'too_many_pages'
    | 'file_too_large';

export type PdfPreflightResult =
    | {
        ok: true;
        classification: PdfPreflightClassification;
        numPages?: number;
        pagesScanned?: number;
        textLayerChars?: number;
        fileSizeBytes?: number;
        bytesPerPage?: number;
        riskFlags?: PdfPreflightRiskFlag[];
      }
    | {
        ok: false;
        reason: string;
        reasonCode: PdfPreflightRejectReason;
        classification: 'scanned_or_image';
        numPages: number;
        pagesScanned: number;
        textLayerChars: number;
        fileSizeBytes: number;
        bytesPerPage: number;
        riskFlags: PdfPreflightRiskFlag[];
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
    const bytesPerPage = probe.numPages > 0 ? Math.ceil(file.size / probe.numPages) : file.size;

    // Text-layer PDF: extracted locally regardless of page count. No
    // upper bound makes sense for these (no OCR, no Gemini round trip).
    if (textLayerChars >= MIN_TEXT_LAYER_CHARS) {
        return {
            ok: true,
            classification: 'text_layer',
            numPages: probe.numPages,
            pagesScanned: probe.pagesScanned,
            textLayerChars,
            fileSizeBytes: file.size,
            bytesPerPage,
        };
    }

    const riskFlags: PdfPreflightRiskFlag[] = [];
    if (file.size >= SCANNED_PDF_FILE_SIZE_WARN_BYTES) {
        riskFlags.push('near_file_size_limit');
    }
    if (bytesPerPage >= SCANNED_PDF_BYTES_PER_PAGE_WARN_BYTES) {
        riskFlags.push('high_bytes_per_page');
    }

    // PDF pages are image content — would route to OCR. Reject up front if too big.
    if (file.size > SCANNED_PDF_FILE_SIZE_LIMIT_BYTES) {
        return {
            ok: false,
            reason: `페이지의 내용이 이미지로 구성된 PDF 파일은 OCR 처리량이 커서 현재 ${formatMb(SCANNED_PDF_FILE_SIZE_LIMIT_BYTES)}MB 이하만 안정적으로 처리할 수 있어요. 이 파일은 ${formatMb(file.size)}MB, ${probe.numPages}페이지예요. 파일을 압축하거나 단원/장 단위로 나눠서 다시 업로드해 주세요.`,
            reasonCode: 'file_too_large',
            classification: 'scanned_or_image',
            numPages: probe.numPages,
            pagesScanned: probe.pagesScanned,
            textLayerChars,
            fileSizeBytes: file.size,
            bytesPerPage,
            riskFlags,
        };
    }

    if (probe.numPages > SCANNED_PDF_PAGE_LIMIT) {
        return {
            ok: false,
            reason: `페이지의 내용이 이미지로 구성된 PDF 파일은 페이지 이미지를 분석해야 해서 처리량이 큽니다. 현재 안정적인 처리를 위해 ${SCANNED_PDF_PAGE_LIMIT}페이지 이하로 나누어 업로드해 주세요. 이 파일은 ${probe.numPages}페이지, ${formatMb(file.size)}MB예요. 같은 페이지 수라도 스캔 해상도, 표/그림 밀도, 판형, 파일 용량에 따라 처리 시간이 크게 달라질 수 있습니다.`,
            reasonCode: 'too_many_pages',
            classification: 'scanned_or_image',
            numPages: probe.numPages,
            pagesScanned: probe.pagesScanned,
            textLayerChars,
            fileSizeBytes: file.size,
            bytesPerPage,
            riskFlags,
        };
    }
    return {
        ok: true,
        classification: 'scanned_or_image',
        numPages: probe.numPages,
        pagesScanned: probe.pagesScanned,
        textLayerChars,
        fileSizeBytes: file.size,
        bytesPerPage,
        riskFlags,
    };
}
