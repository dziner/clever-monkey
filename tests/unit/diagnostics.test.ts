import { describe, expect, it } from 'vitest';
import { createDiagnosticErrorInfo, createFileDiagnosticInfo } from '../../utils/diagnostics';

describe('createFileDiagnosticInfo', () => {
    it('captures only file metadata needed for upload diagnostics', () => {
        const file = new File(['hello'], 'lecture.final.PDF', { type: 'application/pdf' });

        expect(createFileDiagnosticInfo(file, 'pdf')).toEqual({
            name: 'lecture.final.PDF',
            sizeBytes: 5,
            mimeType: 'application/pdf',
            extension: 'pdf',
            fileType: 'pdf',
        });
    });
});

describe('createDiagnosticErrorInfo', () => {
    it('normalizes errors without leaking arbitrary objects', () => {
        const error = Object.assign(new Error('Storage upload failed'), { status: 413, code: 'too_large' });

        expect(createDiagnosticErrorInfo(error)).toMatchObject({
            name: 'Error',
            message: 'Storage upload failed',
            status: 413,
            code: 'too_large',
        });
    });
});
