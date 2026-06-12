// Pure file-upload helpers. Lives outside the useFileHandler hook so
// the validation / classification / filename sanitization can be tested
// without spinning up the React reducer, and reused if the upload entry
// point ever moves (drop zones, file pickers, paste handlers).

export const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'text/plain',
    'text/markdown',
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export function isSupportedMimeType(type: string): type is SupportedMimeType {
    return (SUPPORTED_MIME_TYPES as readonly string[]).includes(type);
}

/**
 * Normalize a filename to ASCII so it round-trips through Supabase
 * Storage path encoding without surprises. We keep the extension
 * lowercase (matching how MIME inference looks at it), strip non-ASCII
 * from the base, collapse other punctuation to underscores, and trim
 * leading/trailing underscores so `한글.pdf` doesn't become `_.pdf`.
 */
export function sanitizeFileName(name: string): string {
    const extensionMatch = name.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
    const baseName = extensionMatch ? name.slice(0, -extension.length) : name;
    // eslint-disable-next-line no-control-regex
    const asciiOnly = baseName.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
    const cleaned = asciiOnly.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    const finalBase = cleaned || 'file';
    return `${finalBase}${extension}`;
}

/**
 * Map a Supabase Storage upload error to a human-friendly Korean
 * message. status===0 means a network failure (fetch threw); the rest
 * map common HTTP responses to actionable next steps.
 */
export function getUploadErrorMessage(error: { status?: number; message?: string }): string {
    const status = error.status ?? 0;
    if (status === 413) return '파일이 너무 큽니다. 업로드 용량 제한을 확인해주세요.';
    if (status === 401 || status === 403) return '업로드 권한이 없습니다. 로그인 상태와 권한을 확인해주세요.';
    if (status === 409) return '같은 이름의 파일이 이미 있습니다. 이름을 변경하거나 잠시 후 다시 시도해주세요.';
    if (status === 0) return '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
    return error.message || '업로드에 실패했습니다.';
}

/** Bucket a File into one of the three categories the app processes. */
export function getFileType(file: File): 'pdf' | 'image' | 'text' {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return 'text';
}
