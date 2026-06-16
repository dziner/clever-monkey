import { createPartFromUri } from '@google/genai';
import {
    callWithKeyRotation,
    withRetry,
    isOverloaded,
    OVERLOAD_FALLBACK_MODEL,
    downloadStorageObjectForUser,
    OCR_PROMPT,
    describeEmptyGeneration,
} from './shared';

// Server-side OCR via Gemini Files API. Pulled out of the classic
// gemini.ts handler so the streaming endpoint can call the same code
// path with a heartbeat callback — large scanned PDFs need ~30-60s
// of Files API processing time, far beyond the 26s wall-clock limit
// of the classic (buffered) function, so the only way to keep the
// gateway connection alive that long is for the streaming endpoint
// to emit periodic bytes during the polling loop.

const GEMINI_PDF_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const FILE_PROCESSING_POLL_MS = 5000;
const FILE_PROCESSING_MAX_POLLS = 24;

export interface FilesApiOcrParams {
    userId: string;
    storagePath: string;
    model: string;
    mimeType: string;
    fileName: string;
    prompt?: string;
    /**
     * Called at every meaningful step (storage download, upload to
     * Files API, each poll iteration, OCR start, OCR fallback). The
     * streaming endpoint wires this to flush a one-byte heartbeat into
     * the open HTTP response so the gateway keeps the connection alive
     * past 10/26s. No-op when called from the buffered classic handler.
     */
    onTick?: () => void;
}

export async function extractTextViaFilesApi(params: FilesApiOcrParams): Promise<string> {
    const tick = params.onTick ?? (() => undefined);
    tick();
    const storedFile = await downloadStorageObjectForUser(params.userId, params.storagePath);
    tick();
    const mimeType = params.mimeType && params.mimeType !== 'application/octet-stream'
        ? params.mimeType
        : storedFile.contentType || 'application/octet-stream';
    const isPdf = mimeType === 'application/pdf' || params.fileName.toLowerCase().endsWith('.pdf');

    if (isPdf && storedFile.size > GEMINI_PDF_FILE_LIMIT_BYTES) {
        throw Object.assign(
            new Error('Gemini can process scanned/image PDFs up to 50MB. For larger PDFs, use a text-based PDF or split the file.'),
            { status: 413 },
        );
    }

    const prompt = params.prompt || OCR_PROMPT;

    return callWithKeyRotation(async ai => {
        tick();
        const uploadedFile = await ai.files.upload({
            file: storedFile.blob,
            config: { mimeType, displayName: params.fileName },
        });
        tick();
        const uploadedFileName = uploadedFile.name;
        if (!uploadedFileName) {
            throw new Error('Gemini did not return an uploaded file name.');
        }

        try {
            let currentFile = uploadedFile;
            for (let i = 0; currentFile.state === 'PROCESSING' && i < FILE_PROCESSING_MAX_POLLS; i += 1) {
                await new Promise(resolve => setTimeout(resolve, FILE_PROCESSING_POLL_MS));
                tick();
                currentFile = await ai.files.get({ name: uploadedFileName });
                tick();
            }

            if (currentFile.state === 'PROCESSING') {
                throw new Error('File processing is taking too long. Please try again shortly.');
            }
            if (currentFile.state === 'FAILED') {
                throw new Error('Gemini failed to process this file.');
            }
            if (!currentFile.uri) {
                throw new Error('Gemini did not return a processed file URI.');
            }

            const filePart = createPartFromUri(currentFile.uri, currentFile.mimeType || mimeType);
            // OCR of a large scanned PDF is a heavy multimodal request and
            // the single most common failure here is the upstream model
            // returning 503 "high demand". Mirror generateContentResilient:
            // retry on a higher-availability model when the primary is
            // overloaded. The uploaded file is tied to the project, so the
            // same filePart works across models without re-uploading.
            const runOcr = (model: string) => withRetry(() => ai.models.generateContent({
                model,
                contents: [filePart, { text: prompt }],
            }));
            tick();
            let res: { text?: string };
            try {
                res = await runOcr(params.model);
            } catch (err) {
                const fallback = OVERLOAD_FALLBACK_MODEL[params.model];
                if (fallback && isOverloaded(err)) {
                    console.warn(`[gemini] OCR ${params.model} overloaded — retrying on ${fallback}`);
                    tick();
                    res = await runOcr(fallback);
                } else {
                    throw err;
                }
            }

            const text = res.text ?? '';
            if (!text.trim()) {
                // Same pattern as the inline OCR + TTS paths: when the
                // model returns an empty payload, surface the actual
                // reason (safety block / finishReason) instead of an
                // opaque "no text" that's invisible in logs.
                throw new Error(describeEmptyGeneration(res));
            }
            return text;
        } finally {
            await ai.files.delete({ name: uploadedFileName }).catch(() => undefined);
        }
    }, { category: 'extract_storage', model: params.model });
}
