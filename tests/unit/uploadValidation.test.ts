import { describe, it, expect } from 'vitest';
import {
    SUPPORTED_MIME_TYPES,
    isSupportedMimeType,
    sanitizeFileName,
    getUploadErrorMessage,
    getFileType,
} from '../../utils/uploadValidation';

describe('isSupportedMimeType', () => {
    it('accepts every type in the canonical list', () => {
        for (const t of SUPPORTED_MIME_TYPES) expect(isSupportedMimeType(t)).toBe(true);
    });

    it('rejects unsupported types', () => {
        expect(isSupportedMimeType('application/zip')).toBe(false);
        expect(isSupportedMimeType('video/mp4')).toBe(false);
        expect(isSupportedMimeType('')).toBe(false);
    });
});

describe('sanitizeFileName', () => {
    it('lower-cases the extension', () => {
        expect(sanitizeFileName('Report.PDF')).toBe('Report.pdf');
    });

    it('strips non-ASCII from the base name', () => {
        expect(sanitizeFileName('한글 문서.pdf')).toBe('file.pdf');
    });

    it('preserves ASCII letters, digits, dots, hyphens, underscores', () => {
        expect(sanitizeFileName('chapter_1-final.v2.pdf')).toBe('chapter_1-final.v2.pdf');
    });

    it('collapses runs of other characters into a single underscore', () => {
        expect(sanitizeFileName('hello!!world  notes.txt')).toBe('hello_world_notes.txt');
    });

    it('trims leading and trailing underscores from the base', () => {
        expect(sanitizeFileName('__draft__.md')).toBe('draft.md');
    });

    it('falls back to "file" when the sanitized base is empty', () => {
        expect(sanitizeFileName('한글.pdf')).toBe('file.pdf');
    });

    it('handles names without an extension', () => {
        expect(sanitizeFileName('README')).toBe('README');
    });
});

describe('getUploadErrorMessage', () => {
    it('maps 413 to "파일이 너무 큽니다"', () => {
        expect(getUploadErrorMessage({ status: 413 })).toContain('너무 큽니다');
    });

    it('maps 401/403 to a permission message', () => {
        expect(getUploadErrorMessage({ status: 401 })).toContain('권한');
        expect(getUploadErrorMessage({ status: 403 })).toContain('권한');
    });

    it('maps 409 to a duplicate-name message', () => {
        expect(getUploadErrorMessage({ status: 409 })).toContain('이미 있습니다');
    });

    it('maps status===0 to a network-error message', () => {
        expect(getUploadErrorMessage({ status: 0 })).toContain('네트워크');
    });

    it('falls back to the raw message when present and status is unknown', () => {
        expect(getUploadErrorMessage({ status: 500, message: 'oops' })).toBe('oops');
    });

    it('returns the generic fallback for an uncategorized status with no message', () => {
        // Note: an undefined status defaults to 0 (network error) per the
        // mapping — the generic fallback only fires for statuses that
        // aren't 0/401/403/409/413 AND when no `message` was set.
        expect(getUploadErrorMessage({ status: 500 })).toContain('업로드에 실패');
    });
});

describe('getFileType', () => {
    it('classifies PDFs', () => {
        expect(getFileType(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe('pdf');
    });

    it('classifies images by MIME prefix', () => {
        expect(getFileType(new File([''], 'a.png', { type: 'image/png' }))).toBe('image');
        expect(getFileType(new File([''], 'a.heic', { type: 'image/heic' }))).toBe('image');
    });

    it('treats anything else as text', () => {
        expect(getFileType(new File([''], 'a.md', { type: 'text/markdown' }))).toBe('text');
        expect(getFileType(new File([''], 'a.txt', { type: 'text/plain' }))).toBe('text');
    });
});
