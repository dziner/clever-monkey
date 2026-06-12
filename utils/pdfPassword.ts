interface PdfPasswordProbeDoc {
    destroy?: () => void | Promise<void>;
}

interface PdfPasswordProbeTask {
    promise: Promise<PdfPasswordProbeDoc>;
    destroy?: () => void | Promise<void>;
}

interface PdfPasswordProbeGlobal {
    getDocument?: (source: { data: ArrayBuffer; password: string }) => PdfPasswordProbeTask;
}

export class PasswordProtectedPdfError extends Error {
    constructor() {
        super('Password-protected PDFs are not supported.');
        this.name = 'PasswordProtectedPdfError';
    }
}

const passwordErrorCodes = new Set<unknown>([
    1,
    2,
    '1',
    '2',
    'NEED_PASSWORD',
    'INCORRECT_PASSWORD',
]);

export function isPasswordProtectedPdfError(error: unknown): boolean {
    if (error instanceof PasswordProtectedPdfError) return true;
    if (!error || typeof error !== 'object') return false;

    const candidate = error as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        reason?: unknown;
    };

    if (candidate.name === 'PasswordException') return true;
    if (passwordErrorCodes.has(candidate.code) || passwordErrorCodes.has(candidate.reason)) return true;

    const text = [
        candidate.name,
        candidate.message,
        candidate.code,
        candidate.reason,
    ]
        .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
        .join(' ')
        .toLowerCase();

    return /password|encrypted|암호|비밀번호/.test(text);
}

function getPdfJsLib(): PdfPasswordProbeGlobal | undefined {
    return (window as Window & { pdfjsLib?: PdfPasswordProbeGlobal }).pdfjsLib;
}

export async function assertPdfCanOpenWithoutPassword(file: File): Promise<void> {
    const pdfjsLib = getPdfJsLib();
    if (!pdfjsLib?.getDocument) return;

    const arrayBuffer = await file.arrayBuffer();
    let doc: PdfPasswordProbeDoc | null = null;
    let task: PdfPasswordProbeTask | null = null;

    try {
        task = pdfjsLib.getDocument({ data: arrayBuffer, password: '' });
        doc = await task.promise;
    } catch (error) {
        if (isPasswordProtectedPdfError(error)) throw new PasswordProtectedPdfError();
    } finally {
        try {
            if (doc) await doc.destroy?.();
            else await task?.destroy?.();
        } catch {
            // Cleanup failure should not block an otherwise valid upload.
        }
    }
}
