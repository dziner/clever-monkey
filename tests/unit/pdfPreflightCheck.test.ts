import { describe, expect, it, vi } from 'vitest';
import { checkPdfPreflightLimits, SCANNED_PDF_PAGE_LIMIT } from '../../utils/pdfPreflightCheck';

// Mock pdf.js-backed extractor so the test doesn't need pdf.js loaded
// (it's only available as a window global in the browser).
vi.mock('../../utils/pdfText', () => ({
    extractPdfTextDetailsLocally: vi.fn(),
}));
import { extractPdfTextDetailsLocally } from '../../utils/pdfText';
const mockProbe = vi.mocked(extractPdfTextDetailsLocally);

function makePdf(name = 'doc.pdf'): File {
    return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
}

describe('checkPdfPreflightLimits', () => {
    it('lets non-PDFs through unchecked', async () => {
        const img = new File([new Uint8Array([0xff])], 'a.png', { type: 'image/png' });
        const res = await checkPdfPreflightLimits(img);
        expect(res).toEqual({ ok: true, classification: 'not_pdf' });
        expect(mockProbe).not.toHaveBeenCalled();
    });

    it('lets text-layer PDFs of any page count through', async () => {
        mockProbe.mockResolvedValueOnce({ text: 'Lorem ipsum '.repeat(40), numPages: 10000, pagesScanned: 10 });
        expect(await checkPdfPreflightLimits(makePdf())).toEqual({
            ok: true,
            classification: 'text_layer',
            numPages: 10000,
            pagesScanned: 10,
            textLayerChars: 479,
        });
    });

    it(`rejects PDFs whose pages are image content over the ${SCANNED_PDF_PAGE_LIMIT}-page ceiling with an actionable message`, async () => {
        mockProbe.mockResolvedValueOnce({ text: '', numPages: 500, pagesScanned: 10 });
        const res = await checkPdfPreflightLimits(makePdf());
        expect(res.ok).toBe(false);
        if (res.ok === false) {
            // Both the ceiling and the actual page count appear so the
            // user immediately knows why and by how much.
            expect(res.reason).toContain('페이지의 내용이 이미지로 구성된 PDF 파일');
            expect(res.reason).toContain(String(SCANNED_PDF_PAGE_LIMIT));
            expect(res.reason).toContain('500');
            expect(res.classification).toBe('scanned_or_image');
            expect(res.numPages).toBe(500);
        }
    });

    it('lets PDFs whose pages are image content at or under the ceiling through', async () => {
        mockProbe.mockResolvedValueOnce({ text: '', numPages: SCANNED_PDF_PAGE_LIMIT, pagesScanned: 10 });
        expect(await checkPdfPreflightLimits(makePdf())).toEqual({
            ok: true,
            classification: 'scanned_or_image',
            numPages: SCANNED_PDF_PAGE_LIMIT,
            pagesScanned: 10,
            textLayerChars: 0,
        });
    });

    it('passes through on probe error so a pdf.js glitch never blocks uploads', async () => {
        mockProbe.mockRejectedValueOnce(new Error('pdf.js failed'));
        expect(await checkPdfPreflightLimits(makePdf())).toEqual({ ok: true, classification: 'probe_failed' });
    });
});
