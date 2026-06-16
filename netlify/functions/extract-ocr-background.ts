import type { Handler } from '@netlify/functions';
import {
  getUserIdFromToken,
  patchDocument,
  logServerDiagnostic,
  MAX_TEXT_CHARS,
  extractMessage,
} from './lib/shared';
import { extractTextViaFilesApi, type FilesApiOcrProgressEvent } from './lib/filesApiOcr';
import { estimateTokens, sampleEvenly, CONTENT_BUDGET } from '../../utils/promptBudget';

// Background OCR for large scanned PDFs.
//
// The `-background` filename suffix tells Netlify to run this
// asynchronously: the caller gets a 202 immediately and the function
// keeps running for up to 15 minutes — far beyond the ~26s synchronous
// limit that made big scans fail with "OCR returned no text". The
// function OCRs the file via the Files API, writes the extracted text +
// token count back onto the documents row, and flips processing_state to
// 'ocr_ready'. The client (useBackgroundProcessing) polls for that, then
// runs the fast summary/preset step itself. On failure it writes
// 'error' + a message so the client surfaces Retry.

const BACKGROUND_OCR_DEADLINE_MS = 13 * 60 * 1000; // stay under Netlify's 15-min ceiling

interface BackgroundOcrRequest {
  documentId: string;
  storagePath: string;
  model: string;
  mimeType: string;
  fileName: string;
  prompt?: string;
  pageCount?: number;
  preflight?: Record<string, unknown>;
}

function compactProgressTrail(events: FilesApiOcrProgressEvent[]): Array<Record<string, unknown>> {
  return events.slice(-40).map(event => {
    const compact: Record<string, unknown> = {
      stage: event.stage,
      elapsedMs: event.elapsedMs,
      msLeft: event.msLeft,
    };
    if (event.fileSizeBytes !== undefined) compact.fileSizeBytes = event.fileSizeBytes;
    if (event.mimeType) compact.mimeType = event.mimeType;
    if (event.pollCount !== undefined) compact.pollCount = event.pollCount;
    if (event.fileState) compact.fileState = event.fileState;
    if (event.model) compact.model = event.model;
    if (event.fallbackModel) compact.fallbackModel = event.fallbackModel;
    if (event.textLength !== undefined) compact.textLength = event.textLength;
    return compact;
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const userId = await getUserIdFromToken(event.headers['authorization']);
  if (!userId) {
    return { statusCode: 401, body: 'Authentication required' };
  }

  let body: BackgroundOcrRequest;
  try {
    body = JSON.parse(event.body || '{}') as BackgroundOcrRequest;
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { documentId, storagePath, model, mimeType, fileName, prompt, pageCount, preflight } = body;
  if (!documentId || !storagePath || !model || !fileName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const startedAt = Date.now();
  const progressEvents: FilesApiOcrProgressEvent[] = [];
  const captureProgress = (progress: FilesApiOcrProgressEvent) => {
    progressEvents.push(progress);
    if (progressEvents.length > 60) progressEvents.shift();
  };
  const diagnosticContext = (extra: Record<string, unknown> = {}) => ({
    pageCount,
    preflight,
    durationMs: Date.now() - startedAt,
    progressTrail: compactProgressTrail(progressEvents),
    ...extra,
  });

  void logServerDiagnostic({
    severity: 'info',
    stage: 'background_ocr.started',
    message: 'Background OCR started',
    userId,
    documentId,
    fileName,
    fileMime: mimeType,
    storagePath,
    model,
    processingState: 'queued',
    context: diagnosticContext({ deadlineMs: BACKGROUND_OCR_DEADLINE_MS }),
  });

  // The actual work. Netlify forces the response to 202 for background
  // functions, so the return value below is irrelevant to the client —
  // results are delivered by patching the documents row.
  try {
    const text = await extractTextViaFilesApi({
      userId,
      storagePath,
      model,
      mimeType,
      fileName,
      prompt,
      deadlineMs: BACKGROUND_OCR_DEADLINE_MS,
      onProgress: captureProgress,
    });

    if (!text.trim()) {
      const emptyMessage = '문서에서 텍스트를 추출하지 못했어요. 빈 문서이거나 읽을 수 없는 형식일 수 있어요.';
      await patchDocument(documentId, userId, {
        processing_state: 'error',
        error_message: emptyMessage,
      });
      void logServerDiagnostic({
        severity: 'error',
        stage: 'background_ocr.empty_result',
        message: 'Background OCR returned empty text',
        userId,
        documentId,
        fileName,
        fileMime: mimeType,
        storagePath,
        model,
        processingState: 'error',
        errorMessage: emptyMessage,
        context: diagnosticContext({ extractedTextLength: text.length }),
      });
      return { statusCode: 200, body: 'empty' };
    }

    // Mirror the synchronous pipeline: token count from the full text,
    // then store an evenly-sampled excerpt bounded for downstream prompts.
    const tokenCount = estimateTokens(text);
    const documentContent = sampleEvenly(text, CONTENT_BUDGET.documentContent).slice(0, MAX_TEXT_CHARS);

    const patchSucceeded = await patchDocument(documentId, userId, {
      document_content: documentContent,
      token_count: tokenCount,
      processing_state: 'ocr_ready',
      error_message: null,
    });
    void logServerDiagnostic({
      severity: patchSucceeded ? 'info' : 'error',
      stage: patchSucceeded ? 'background_ocr.completed' : 'background_ocr.patch_failed',
      message: patchSucceeded
        ? 'Background OCR completed'
        : 'Background OCR completed but documents row patch failed',
      userId,
      documentId,
      fileName,
      fileMime: mimeType,
      storagePath,
      model,
      processingState: patchSucceeded ? 'ocr_ready' : 'error',
      context: diagnosticContext({
        extractedTextLength: text.length,
        storedContentLength: documentContent.length,
        tokenCount,
        patchSucceeded,
      }),
    });
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('extract-ocr-background error', err);
    const raw = extractMessage(err);
    // Network-layer failures (undici "fetch failed sending request",
    // connection resets) are retried internally now; if one still
    // escapes, show actionable copy rather than a raw TypeError.
    const friendly = /fetch failed|sending request|ECONNRESET|ETIMEDOUT|socket hang up|terminated|network/i.test(raw)
      ? '문서 처리 중 네트워크 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.'
      : raw;
    await patchDocument(documentId, userId, {
      processing_state: 'error',
      error_message: friendly,
    });
    // Surface the failure in diagnostic_events so the admin "최근 에러
    // 로그" feed catches it — without this, background OCR failures were
    // invisible to the admin dashboard because the function fails outside
    // any client request.
    void logServerDiagnostic({
      severity: 'error',
      stage: 'background_ocr.failed',
      message: 'Background OCR failed',
      userId,
      documentId,
      fileName,
      fileMime: mimeType,
      storagePath,
      model,
      processingState: 'error',
      errorName: err instanceof Error ? err.name : null,
      errorMessage: friendly,
      context: diagnosticContext({ raw }),
    });
    return { statusCode: 200, body: 'error' };
  }
};
