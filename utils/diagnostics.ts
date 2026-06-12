export type DiagnosticSeverity = 'info' | 'warn' | 'error';

export interface DiagnosticFileInfo {
    name: string;
    sizeBytes: number;
    mimeType: string;
    extension: string;
    fileType?: 'pdf' | 'image' | 'text';
}

export interface DiagnosticErrorInfo {
    name?: string;
    message: string;
    stack?: string;
    status?: number;
    code?: string | number;
}

export interface DiagnosticEvent {
    severity: DiagnosticSeverity;
    stage: string;
    message: string;
    documentId?: string;
    file?: DiagnosticFileInfo;
    storagePath?: string;
    model?: string;
    processingState?: string;
    isGuest?: boolean;
    error?: DiagnosticErrorInfo;
    context?: Record<string, unknown>;
}

const MAX_NAME_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 3000;

function trimText(value: string | undefined, maxLength: number): string | undefined {
    if (!value) return value;
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function createFileDiagnosticInfo(
    file: File,
    fileType?: DiagnosticFileInfo['fileType'],
): DiagnosticFileInfo {
    const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    return {
        name: trimText(file.name, MAX_NAME_LENGTH) ?? 'unknown',
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        extension: extensionMatch?.[1]?.toLowerCase() ?? '',
        fileType,
    };
}

export function createDiagnosticErrorInfo(error: unknown): DiagnosticErrorInfo {
    if (error instanceof Error) {
        const extra = error as Error & { status?: number; statusCode?: number; code?: string | number };
        return {
            name: error.name,
            message: trimText(error.message, MAX_MESSAGE_LENGTH) || 'Unknown error',
            stack: trimText(error.stack, MAX_STACK_LENGTH),
            status: extra.status ?? extra.statusCode,
            code: extra.code,
        };
    }
    if (typeof error === 'string') {
        return { message: trimText(error, MAX_MESSAGE_LENGTH) || 'Unknown error' };
    }
    if (error && typeof error === 'object') {
        const candidate = error as { name?: unknown; message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown };
        return {
            name: typeof candidate.name === 'string' ? candidate.name : undefined,
            message: typeof candidate.message === 'string'
                ? trimText(candidate.message, MAX_MESSAGE_LENGTH) || 'Unknown error'
                : 'Unknown object error',
            status: typeof candidate.status === 'number'
                ? candidate.status
                : typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
            code: typeof candidate.code === 'string' || typeof candidate.code === 'number' ? candidate.code : undefined,
        };
    }
    return { message: 'Unknown error' };
}
