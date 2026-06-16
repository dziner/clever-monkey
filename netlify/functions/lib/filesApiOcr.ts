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

// Hard wall-clock budget for the whole OCR call. Netlify's synchronous
// (and streaming) functions are killed at ~26s — streaming heartbeats
// keep the gateway from idle-cutting EARLIER, but they do NOT extend the
// execution limit. If we let the function run to the kill, the client
// only ever received heartbeats and reported the opaque "OCR returned no
// text". Instead, give up a few seconds early and throw a clear, honest,
// actionable message that propagates to the user as a real error.
const OCR_DEADLINE_MS = 23_000;

class OcrTimeoutError extends Error {
    constructor() {
        super('OCR가 제한 시간 내에 완료되지 않았습니다 — 파일이 너무 크거나 페이지가 많습니다. PDF를 더 작게 나눠서(예: 20~30페이지씩) 다시 시도해 주세요.');
        this.name = 'OcrTimeoutError';
    }
}

/** Reject after `ms`, so a slow Files API upload / OCR call can't run
 *  the function into Netlify's hard kill (which surfaces as a silent
 *  heartbeat-only stream). */
function rejectAfter(ms: number): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new OcrTimeoutError()), Math.max(0, ms)));
}

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
    const startedAt = Date.now();
    const msLeft = () => OCR_DEADLINE_MS - (Date.now() - startedAt);
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
        // Race the upload against the deadline — uploading a 50MB scan can
        // itself eat most of the budget.
        const uploadedFile = await Promise.race([
            ai.files.upload({ file: storedFile.blob, config: { mimeType, displayName: params.fileName } }),
            rejectAfter(msLeft()),
        ]);
        tick();
        const uploadedFileName = uploadedFile.name;
        if (!uploadedFileName) {
            throw new Error('Gemini did not return an uploaded file name.');
        }

        try {
            let currentFile = uploadedFile;
            for (let i = 0; currentFile.state === 'PROCESSING' && i < FILE_PROCESSING_MAX_POLLS; i += 1) {
                // Stop polling if the next poll cycle wouldn't leave enough
                // budget to also run OCR — fail with a clear message rather
                // than polling straight into Netlify's hard kill.
                if (msLeft() < FILE_PROCESSING_POLL_MS + 4000) throw new OcrTimeoutError();
                await new Promise(resolve => setTimeout(resolve, FILE_PROCESSING_POLL_MS));
                tick();
                currentFile = await ai.files.get({ name: uploadedFileName });
                tick();
            }

            if (currentFile.state === 'PROCESSING') {
                throw new OcrTimeoutError();
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
            // Race OCR against whatever budget is left. withRetry stays for
            // transient 5xx, but the outer race guarantees we surface a
            // clear timeout instead of being silently killed mid-call.
            const runOcr = (model: string) => Promise.race([
                withRetry(() => ai.models.generateContent({
                    model,
                    contents: [filePart, { text: prompt }],
                })),
                rejectAfter(msLeft()),
            ]);
            tick();
            let res: { text?: string };
            try {
                res = await runOcr(params.model);
            } catch (err) {
                if (err instanceof OcrTimeoutError) throw err;
                const fallback = OVERLOAD_FALLBACK_MODEL[params.model];
                // Only attempt the fallback model if there's still budget.
                if (fallback && isOverloaded(err) && msLeft() > 6000) {
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
