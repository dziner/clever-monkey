import { describe, it, expect } from 'vitest';
import { buildErrorDoc } from '../../utils/buildErrorDoc';

describe('buildErrorDoc', () => {
    it('returns a DocumentData in the error state with the given message', () => {
        const doc = buildErrorDoc({
            id: 'd-1',
            fileName: 'test.pdf',
            fileSize: 1234,
            folderId: null,
            errorMessage: 'nope',
        });
        expect(doc.processingState).toBe('error');
        expect(doc.errorMessage).toBe('nope');
        expect(doc.id).toBe('d-1');
        expect(doc.fileName).toBe('test.pdf');
        expect(doc.fileSize).toBe(1234);
    });

    it('uses pdf as the fallback fileType when none is provided', () => {
        const doc = buildErrorDoc({
            id: 'd-2', fileName: 'x', fileSize: 0,
            folderId: null, errorMessage: '',
        });
        expect(doc.fileType).toBe('pdf');
    });

    it('preserves a caller-supplied fileType (image / text)', () => {
        const img = buildErrorDoc({
            id: 'd-3', fileName: 'x', fileSize: 0, fileType: 'image',
            folderId: null, errorMessage: '',
        });
        const txt = buildErrorDoc({
            id: 'd-4', fileName: 'x', fileSize: 0, fileType: 'text',
            folderId: null, errorMessage: '',
        });
        expect(img.fileType).toBe('image');
        expect(txt.fileType).toBe('text');
    });

    it('pins every constant field that the four old inline copies shared', () => {
        // These were the fields most at risk of drifting between sites.
        // Locking them in a test catches future edits that accidentally
        // change behaviour on only one of the four error paths.
        const doc = buildErrorDoc({
            id: 'x', fileName: 'x', fileSize: 0,
            folderId: null, errorMessage: '',
        });
        expect(doc.file).toBeNull();
        expect(doc.summary).toBe('');
        expect(doc.chat).toBeNull();
        expect(doc.chatHistory).toEqual([]);
        expect(doc.model).toBe('gemini-2.5-flash');
        expect(doc.answerScope).toBe('document');
        expect(doc.monkeyMode).toBe(false);
        expect(doc.currentPage).toBe(1);
    });
});
