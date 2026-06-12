import { afterEach, describe, expect, it } from 'vitest';
import {
    assertPdfCanOpenWithoutPassword,
    isPasswordProtectedPdfError,
    PasswordProtectedPdfError,
} from '../../utils/pdfPassword';

interface TestPdfJsGlobal {
    getDocument?: (source: { data: ArrayBuffer; password: string }) => {
        promise: Promise<{ destroy?: () => void }>;
        destroy?: () => void;
    };
}

const getWindowWithPdfJs = () => window as Window & { pdfjsLib?: TestPdfJsGlobal };
const originalPdfJsLib = getWindowWithPdfJs().pdfjsLib;

afterEach(() => {
    if (originalPdfJsLib) getWindowWithPdfJs().pdfjsLib = originalPdfJsLib;
    else delete getWindowWithPdfJs().pdfjsLib;
});

describe('isPasswordProtectedPdfError', () => {
    it('recognizes pdf.js password exceptions', () => {
        expect(isPasswordProtectedPdfError({ name: 'PasswordException', code: 1 })).toBe(true);
        expect(isPasswordProtectedPdfError({ message: 'No password given' })).toBe(true);
        expect(isPasswordProtectedPdfError({ reason: 'INCORRECT_PASSWORD' })).toBe(true);
    });

    it('does not treat ordinary PDF parse errors as password protection', () => {
        expect(isPasswordProtectedPdfError({ name: 'InvalidPDFException', message: 'Invalid PDF structure' })).toBe(false);
    });
});

describe('assertPdfCanOpenWithoutPassword', () => {
    it('throws a policy error for password-protected PDFs', async () => {
        getWindowWithPdfJs().pdfjsLib = {
            getDocument: () => ({
                promise: Promise.reject({ name: 'PasswordException', code: 1 }),
            }),
        };

        const file = new File(['%PDF-1.7'], 'locked.pdf', { type: 'application/pdf' });

        await expect(assertPdfCanOpenWithoutPassword(file)).rejects.toBeInstanceOf(PasswordProtectedPdfError);
    });

    it('allows non-password PDF parse failures to continue through normal processing', async () => {
        getWindowWithPdfJs().pdfjsLib = {
            getDocument: () => ({
                promise: Promise.reject({ name: 'InvalidPDFException', message: 'Invalid PDF structure' }),
            }),
        };

        const file = new File(['not actually a pdf'], 'broken.pdf', { type: 'application/pdf' });

        await expect(assertPdfCanOpenWithoutPassword(file)).resolves.toBeUndefined();
    });
});
