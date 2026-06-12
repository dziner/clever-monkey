import type { DocumentData } from '../types';

// Build the placeholder DocumentData we insert when the upload pipeline
// rejects a file (guest cap, oversized for guest, unsupported MIME,
// password-protected PDF, …). The four sites that used to inline this
// were drifting independently — if we forget a field on one, the doc
// gets silently malformed and breaks the sidebar render that reads it.
// One builder keeps the shape pinned.

export interface BuildErrorDocOptions {
    id: string;
    fileName: string;
    fileSize: number;
    /** 'pdf' is a reasonable fallback when the type can't be determined. */
    fileType?: DocumentData['fileType'];
    folderId: string | null;
    errorMessage: string;
}

export function buildErrorDoc(opts: BuildErrorDocOptions): DocumentData {
    return {
        id: opts.id,
        file: null,
        fileName: opts.fileName,
        fileSize: opts.fileSize,
        fileType: opts.fileType ?? 'pdf',
        summary: '',
        chat: null,
        chatHistory: [],
        processingState: 'error',
        errorMessage: opts.errorMessage,
        model: 'gemini-2.5-flash',
        answerScope: 'document',
        monkeyMode: false,
        folderId: opts.folderId,
        currentPage: 1,
    };
}
