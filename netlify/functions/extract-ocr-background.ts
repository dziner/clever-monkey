import type { Handler } from '@netlify/functions';
import {
  getUserIdFromToken,
  patchDocument,
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
      await patchDocument(documentId, userId, {
        processing_state: 'error',
        error_message: '문서에서 텍스트를 추출하지 못했어요. 빈 문서이거나 읽을 수 없는 형식일 수 있어요.',
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
    await patchDocument(documentId, userId, {
      processing_state: 'error',
      error_message: extractMessage(err),
    });
    return { statusCode: 200, body: 'error' };
  }
};
