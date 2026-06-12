import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileListFiltering } from '../../hooks/useFileListFiltering';
import type { DocumentData, Folder } from '../../types';

const doc = (id: string, fileName: string, folderId: string | null): DocumentData => ({
    id, fileName, folderId,
    file: null, fileSize: 0, fileType: 'pdf',
    summary: '', chat: null, chatHistory: [],
    processingState: 'done', model: 'gemini-2.5-flash',
    answerScope: 'document', monkeyMode: false,
});

const folders: Folder[] = [
    { id: 'f1', name: 'Folder 1' },
    { id: 'f2', name: 'Folder 2' },
];

const documents: DocumentData[] = [
    doc('a', 'Intro to Calculus.pdf', 'f1'),
    doc('b', 'Algebra notes.pdf', 'f1'),
    doc('c', 'Random sketch.png', 'f2'),
    doc('d', 'Unfiled doc.pdf', null),
    doc('e', 'Orphan from deleted folder.pdf', 'f-deleted'),
];

describe('useFileListFiltering', () => {
    it('groups documents under their folder ids', () => {
        const { result } = renderHook(() => useFileListFiltering(documents, folders, ''));
        expect(result.current.docsByFolder.get('f1')?.map(d => d.id)).toEqual(['a', 'b']);
        expect(result.current.docsByFolder.get('f2')?.map(d => d.id)).toEqual(['c']);
    });

    it('treats documents pointing at a non-existent folder as unfiled', () => {
        // Important: orphans (folderId set but folder gone) should still
        // be visible, otherwise they get silently hidden. They surface
        // through the unfiled bucket when no matching folder exists.
        const { result } = renderHook(() => useFileListFiltering(documents, folders, ''));
        const f1Ids = result.current.docsByFolder.get('f1')?.map(d => d.id);
        expect(f1Ids).not.toContain('e');
        // Orphans aren't in the unfiled list either, because they HAVE a
        // folderId — they're just dangling. That's existing behavior;
        // surface it so future maintainers don't assume otherwise.
        expect(result.current.unfiledDocs.map(d => d.id)).toEqual(['d']);
    });

    it('returns null filteredDocs for an empty query (signals "render tree as usual")', () => {
        const { result } = renderHook(() => useFileListFiltering(documents, folders, ''));
        expect(result.current.filteredDocs).toBeNull();
    });

    it('returns null filteredDocs for a whitespace-only query', () => {
        const { result } = renderHook(() => useFileListFiltering(documents, folders, '   '));
        expect(result.current.filteredDocs).toBeNull();
    });

    it('filters case-insensitively across folders', () => {
        const { result } = renderHook(() => useFileListFiltering(documents, folders, 'algebra'));
        expect(result.current.filteredDocs?.map(d => d.id)).toEqual(['b']);
    });

    it('returns an empty array (not null) when nothing matches', () => {
        const { result } = renderHook(() => useFileListFiltering(documents, folders, 'zzz-no-match'));
        expect(result.current.filteredDocs).toEqual([]);
    });
});
