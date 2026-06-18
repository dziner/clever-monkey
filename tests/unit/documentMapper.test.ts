import { describe, expect, it } from 'vitest';
import { mapDocumentRow, mapFolderRow, type DocumentRow } from '../../services/documentMapper';
import type { ChatMessage } from '../../types';

const fallbackWelcome: ChatMessage = { sender: 'bot', text: 'Welcome back' };

const row = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
    id: 'doc-1',
    user_id: 'user-1',
    folder_id: 'folder-1',
    file_name: 'Algebra.pdf',
    file_size: 1234,
    file_mime: 'application/pdf',
    file_type: 'pdf',
    storage_path: 'user-1/doc-1.pdf',
    summary: 'Saved summary',
    chat_history: [{ sender: 'user', text: 'Question' }],
    preset_questions: ['What is x?'],
    token_count: 42,
    processing_state: 'done',
    error_message: null,
    model: 'gemini-2.5-flash',
    answer_scope: 'document',
    monkey_mode: true,
    document_content: 'Full extracted text',
    quiz_tab_data: null,
    mind_map_data: null,
    slides_data: null,
    podcast_data: null,
    created_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
});

describe('documentMapper', () => {
    it('maps folder rows into sidebar folders', () => {
        expect(mapFolderRow({
            id: 'folder-1',
            name: 'My Documents',
            user_id: 'user-1',
            created_at: '2026-06-17T00:00:00.000Z',
        })).toEqual({ id: 'folder-1', name: 'My Documents' });
    });

    it('maps persisted document rows without changing saved values', () => {
        const doc = mapDocumentRow(row(), fallbackWelcome);

        expect(doc.id).toBe('doc-1');
        expect(doc.file).toBeNull();
        expect(doc.fileName).toBe('Algebra.pdf');
        expect(doc.fileSize).toBe(1234);
        expect(doc.fileMime).toBe('application/pdf');
        expect(doc.storagePath).toBe('user-1/doc-1.pdf');
        expect(doc.uploadState).toBe('uploaded');
        expect(doc.summary).toBe('Saved summary');
        expect(doc.chatHistory).toEqual([{ sender: 'user', text: 'Question' }]);
        expect(doc.presetQuestions).toEqual(['What is x?']);
        expect(doc.tokenCount).toBe(42);
        expect(doc.processingState).toBe('done');
        expect(doc.model).toBe('gemini-2.5-flash');
        expect(doc.answerScope).toBe('document');
        expect(doc.monkeyMode).toBe(true);
        expect(doc.documentContent).toBe('Full extracted text');
        expect(doc.folderId).toBe('folder-1');
        expect(doc.currentPage).toBe(1);
    });

    it('uses the fallback welcome for legacy rows with empty chat history', () => {
        expect(mapDocumentRow(row({ chat_history: [] }), fallbackWelcome).chatHistory).toEqual([fallbackWelcome]);
        expect(mapDocumentRow(row({ chat_history: null }), fallbackWelcome).chatHistory).toEqual([fallbackWelcome]);
    });

    it('keeps legacy processing fallback behavior', () => {
        expect(mapDocumentRow(row({ processing_state: null, summary: 'Has summary' }), fallbackWelcome).processingState).toBe('done');
        expect(mapDocumentRow(row({ processing_state: null, summary: null }), fallbackWelcome).processingState).toBe('error');
    });

    it('normalizes nullable optional columns to undefined/default values', () => {
        const doc = mapDocumentRow(row({
            folder_id: null,
            file_mime: null,
            storage_path: null,
            summary: null,
            preset_questions: null,
            token_count: null,
            error_message: null,
            model: null,
            answer_scope: null,
            monkey_mode: null,
            document_content: null,
        }), fallbackWelcome);

        expect(doc.fileMime).toBeUndefined();
        expect(doc.storagePath).toBeUndefined();
        expect(doc.uploadState).toBeUndefined();
        expect(doc.summary).toBe('');
        expect(doc.presetQuestions).toBeUndefined();
        expect(doc.tokenCount).toBeUndefined();
        expect(doc.errorMessage).toBeUndefined();
        expect(doc.model).toBe('gemini-2.5-flash');
        expect(doc.answerScope).toBe('document');
        expect(doc.monkeyMode).toBe(false);
        expect(doc.documentContent).toBeUndefined();
        expect(doc.folderId).toBeNull();
    });

    it('normalizes malformed persisted preset question payloads', () => {
        const doc = mapDocumentRow(row({
            preset_questions: [
                { emoji: '❓', question: ' What changed in the update? ' },
                null,
                { text: 'Summarize the risk' },
                42,
                { label: '' },
            ],
        }), fallbackWelcome);

        expect(doc.presetQuestions).toEqual([
            '❓ What changed in the update?',
            'Summarize the risk',
        ]);
    });

    it('parses stringified legacy preset question arrays', () => {
        const doc = mapDocumentRow(row({
            preset_questions: '[{"question":"Explain the main idea"},{"text":"List the examples"}]',
        }), fallbackWelcome);

        expect(doc.presetQuestions).toEqual([
            'Explain the main idea',
            'List the examples',
        ]);
    });
});
