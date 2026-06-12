import * as React from 'react';
import type { DocumentData, Folder } from '../types';

// Pure data derivations for the sidebar file list. Extracted from
// FileListPanel because the memos here are independent of presentation —
// they're testable, and pulling them out makes the panel render code
// less crowded.

export interface FileListBuckets {
    /** Documents grouped by folder id (only includes existing folders). */
    docsByFolder: Map<string, DocumentData[]>;
    /** Documents that have no folder (folderId null or unknown). */
    unfiledDocs: DocumentData[];
    /**
     * Flat list of documents matching `searchQuery` across all folders,
     * or `null` when the query is empty — signaling "render the folder
     * tree as usual" rather than "show empty results".
     */
    filteredDocs: DocumentData[] | null;
}

/**
 * Bucket documents into folder groups + unfiled + search hits in one
 * pass per dependency change. The hook returns plain references so the
 * caller can use the same memoized identity for downstream lists.
 */
export function useFileListFiltering(
    documents: DocumentData[],
    folders: Folder[],
    searchQuery: string,
): FileListBuckets {
    const docsByFolder = React.useMemo(() => {
        const map = new Map<string, DocumentData[]>();
        folders.forEach(f => map.set(f.id, []));
        documents.forEach(doc => {
            if (doc.folderId && map.has(doc.folderId)) map.get(doc.folderId)!.push(doc);
        });
        return map;
    }, [documents, folders]);

    const unfiledDocs = React.useMemo(
        () => documents.filter(doc => !doc.folderId),
        [documents],
    );

    const filteredDocs = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return null;
        return documents.filter(doc => doc.fileName.toLowerCase().includes(q));
    }, [documents, searchQuery]);

    return { docsByFolder, unfiledDocs, filteredDocs };
}
