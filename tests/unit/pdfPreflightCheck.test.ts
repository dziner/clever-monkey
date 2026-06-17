import { describe, expect, it, vi } from 'vitest';
import {
    checkPdfPreflightLimits,
    SCANNED_PDF_FILE_SIZE_LIMIT_BYTES,
    SCANNED_PDF_PAGE_LIMIT,
} from '../../utils/pdfPreflightCheck';

// Mock pdf.js-backed extractor so the test doesn't need pdf.js loaded
// (it's only available as a window global in the browser).
vi.mock('../../utils/pdfText', () => ({
    extractPdfTextDetailsLocally: vi.fn(),
}));
import { extractPdfTextDetailsLocally } from '../../utils/pdfText';
const mockProbe = vi.mocked(extractPdfTextDetailsLocally);

function makePdf(name = 'doc.pdf', size?: number): File {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
    if (typeof size === 'number') {
        Object.defineProperty(file, 'size', { value: size });
    }
    return file;
}

describe('checkPdfPreflightLimits', () => {
    it('uses the current conservative 50-page ceiling for image-content PDFs', () => {
        expect(SCANNED_PDF_PAGE_LIMIT).toBe(50);
    });

    it('uses the current 50MB file-size ceiling for image-content PDFs', () => {
        expect(SCANNED_PDF_FILE_SIZE_LIMIT_BYTES).toBe(50 * 1024 * 1024);
    });

    it('lets non-PDFs through unchecked', async () => {
        const img = new File([new Uint8Array([0xff])], 'a.png', { type: 'image/png' });
        const res = await checkPdfPreflightLimits(img);
        expect(res).toEqual({ ok: true, classification: 'not_pdf' });
        expect(mockProbe).not.toHaveBeenCalled();
    });

    it('lets text-layer PDFs of any page count or file size through', async () => {
        const fileSize = SCANNED_PDF_FILE_SIZE_LIMIT_BYTES * 2;
        mockProbe.mockResolvedValueOnce({ text: 'Lorem ipsum '.repeat(40), numPages: 10000, pagesScanned: 10 });
        expect(await checkPdfPreflightLimits(makePdf('huge-text.pdf', fileSize))).toEqual({
            ok: true,
            classification: 'text_layer',
            numPages: 10000,
            pagesScanned: 10,
            textLayerChars: 479,
            fileSizeBytes: fileSize,
            bytesPerPage: Math.ceil(fileSize / 10000),
        });
    });

    it(`rejects PDFs whose pages are image content over the ${SCANNED_PDF_PAGE_LIMIT}-page ceiling with an actionable message`, async () => {
        const fileSize = 35 * 1024 * 1024;
        mockProbe.mockResolvedValueOnce({ text: '', numPages: 500, pagesScanned: 10 });
        const res = await checkPdfPreflightLimits(makePdf('many-pages.pdf', fileSize));
        expect(res.ok).toBe(false);
        if (res.ok === false) {
            // The copy avoids implying that page count is the only factor.
            expect(res.reason).toContain('페이지의 내용이 이미지로 구성된 PDF 파일');
            expect(res.reason).toContain(String(SCANNED_PDF_PAGE_LIMIT));
            expect(res.reason).toContain('500');
            expect(res.reason).toContain('스캔 해상도');
            expect(res.reason).toContain('35.0MB');
            expect(res.reason).toContain('감지값: 500페이지, 35.0MB');
            expect(res.reason).toContain('현재 안정 처리 기준');
            expect(res.reasonCode).toBe('too_many_pages');
            expect(res.classification).toBe('scanned_or_image');
            expect(res.numPages).toBe(500);
            expect(res.fileSizeBytes).toBe(fileSize);
            expect(res.bytesPerPage).toBe(Math.ceil(fileSize / 500));
        }
    });

    it('rejects PDFs whose pages are image content over the OCR file-size ceiling', async () => {
        const fileSize = SCANNED_PDF_FILE_SIZE_LIMIT_BYTES + 1;
        mockProbe.mockResolvedValueOnce({ text: '', numPages: 10, pagesScanned: 10 });
        const res = await checkPdfPreflightLimits(makePdf('huge-scan.pdf', fileSize));
        expect(res.ok).toBe(false);
        if (res.ok === false) {
            expect(res.reason).toContain('페이지의 내용이 이미지로 구성된 PDF 파일');
            expect(res.reason).toContain('50.0MB');
            expect(res.reason).toContain('10페이지');
            expect(res.reason).toContain('감지값: 10페이지, 50.0MB');
            expect(res.reason).toContain('파일을 압축하거나 단원/장 단위');
            expect(res.reasonCode).toBe('file_too_large');
            expect(res.fileSizeBytes).toBe(fileSize);
            expect(res.bytesPerPage).toBe(Math.ceil(fileSize / 10));
            expect(res.riskFlags).toContain('near_file_size_limit');
        }
    });

    it('lets PDFs whose pages are image content at or under both ceilings through', async () => {
        const fileSize = SCANNED_PDF_FILE_SIZE_LIMIT_BYTES;
        mockProbe.mockResolvedValueOnce({ text: '', numPages: SCANNED_PDF_PAGE_LIMIT, pagesScanned: 10 });
        expect(await checkPdfPreflightLimits(makePdf('limit-scan.pdf', fileSize))).toEqual({
            ok: true,
            classification: 'scanned_or_image',
            numPages: SCANNED_PDF_PAGE_LIMIT,
            pagesScanned: 10,
            textLayerChars: 0,
            fileSizeBytes: fileSize,
            bytesPerPage: Math.ceil(fileSize / SCANNED_PDF_PAGE_LIMIT),
            riskFlags: ['near_file_size_limit', 'high_bytes_per_page'],
        });
    });

    it('passes through on probe error so a pdf.js glitch never blocks uploads', async () => {
        mockProbe.mockRejectedValueOnce(new Error('pdf.js failed'));
        expect(await checkPdfPreflightLimits(makePdf())).toEqual({ ok: true, classification: 'probe_failed' });
    });
});
