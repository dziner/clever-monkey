import type { Handler } from '@netlify/functions';
import {
  getUserIdFromToken,
  patchDocument,
  logServerDiagnostic,
  MAX_TEXT_CHARS,
  extractMessage,
} from './lib/shared';
import { extractTextViaFilesApi } from './lib/filesApiOcr';
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

  const { documentId, storagePath, model, mimeType, fileName, prompt } = body;
  if (!documentId || !storagePath || !model || !fileName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

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
      });
      return { statusCode: 200, body: 'empty' };
    }

    // Mirror the synchronous pipeline: token count from the full text,
    // then store an evenly-sampled excerpt bounded for downstream prompts.
    const tokenCount = estimateTokens(text);
    const documentContent = sampleEvenly(text, CONTENT_BUDGET.documentContent).slice(0, MAX_TEXT_CHARS);

    await patchDocument(documentId, userId, {
      document_content: documentContent,
      token_count: tokenCount,
      processing_state: 'ocr_ready',
      error_message: null,
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
      context: { raw },
    });
    return { statusCode: 200, body: 'error' };
  }
};
