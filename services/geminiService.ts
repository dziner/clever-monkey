import type { Part } from '@google/genai';
import { getSystemInstruction, buildInitialBotMessage } from '../constants';
import type { Model, ProcessingModel, DocumentProcessingState, QuizData, FRQData, UserAnswer, FRUserAnswer, ChatMessage, MindMapData, SlideData } from '../types';
import { languageDirective, allCorrectMessage } from './languageService';
import { extractPdfTextDetailsLocally, extractPdfTextLocally } from '../utils/pdfText';
import { isPasswordProtectedPdfError, PasswordProtectedPdfError } from '../utils/pdfPassword';
import { estimateTokens, sampleEvenly, CONTENT_BUDGET } from '../utils/promptBudget';
import { createDiagnosticErrorInfo } from '../utils/diagnostics';
import { logDiagnosticEvent } from './diagnostics';
import { normalizePodcastScriptForSingleNarrator, splitTextForTts } from '../utils/podcastAudio';
import { buildQuizAvoidanceBlock } from '../utils/quizMemory';

const GEMINI_PROXY_ENDPOINT = '/api/gemini';
const GEMINI_STREAM_ENDPOINT = '/api/gemini-stream';

// Mirrors STREAM_ERROR_SENTINEL in netlify/functions/lib/shared.ts (kept
// byte-identical) — a mid-stream failure can't change the HTTP status
// anymore, so the server appends this marker followed by the error message.
const STREAM_ERROR_SENTINEL = '\n[[__GEMINI_STREAM_ERROR__]]\n';

import { cleanAndParseJSON } from '../utils/jsonRepair';

// `task` (when set) routes the call through the multi-provider router
// server-side (Gemini → Groq → Cerebras fallback per task type).
type GeminiPayload =
  | { action: 'countTokens'; model: string; text: string }
  | { action: 'generateContent'; model: string; contents: unknown; config?: unknown; task?: string }
  | { action: 'chat'; model: string; systemInstruction: string; history: unknown; message: string }
  | { action: 'extractText'; model: string; inlineData: unknown }
  | { action: 'extractTextFromStorage'; model: string; storagePath: string; mimeType: string; fileName: string }
  | { action: 'tts'; text: string; voice: string };

import { supabase } from './supabaseClient';

function summarizeGeminiPayload(payload: GeminiPayload): Record<string, unknown> {
  switch (payload.action) {
    case 'countTokens':
      return { action: payload.action, model: payload.model, textLength: payload.text.length };
    case 'generateContent':
      return {
        action: payload.action,
        model: payload.model,
        task: payload.task,
        contentsKind: typeof payload.contents,
        contentsLength: typeof payload.contents === 'string' ? payload.contents.length : undefined,
        responseMimeType: (payload.config as { responseMimeType?: string } | undefined)?.responseMimeType,
      };
    case 'chat':
      return {
        action: payload.action,
        model: payload.model,
        historyLength: Array.isArray(payload.history) ? payload.history.length : undefined,
        messageLength: payload.message.length,
        hasSystemInstruction: Boolean(payload.systemInstruction),
      };
    case 'extractText':
      {
        const inlineData = payload.inlineData as { data?: unknown; mimeType?: unknown };
        return {
          action: payload.action,
          model: payload.model,
          mimeType: typeof inlineData.mimeType === 'string' ? inlineData.mimeType : undefined,
          inlineDataLength: typeof inlineData.data === 'string' ? inlineData.data.length : undefined,
        };
      }
    case 'extractTextFromStorage':
      return {
        action: payload.action,
        model: payload.model,
        storagePath: payload.storagePath,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
      };
    case 'tts':
      return { action: payload.action, textLength: payload.text.length, voice: payload.voice };
  }
}

function modelForPayload(payload: GeminiPayload): string | undefined {
  return payload.action === 'tts' ? undefined : payload.model;
}

function storagePathForPayload(payload: GeminiPayload): string | undefined {
  return payload.action === 'extractTextFromStorage' ? payload.storagePath : undefined;
}

async function getAuthHeader(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

async function callGemini<T>(payload: GeminiPayload, signal?: AbortSignal): Promise<T> {
  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;

  let res: Response;
  try {
    res = await fetch(GEMINI_PROXY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    void logDiagnosticEvent({
      severity: 'error',
      stage: `api.gemini.${payload.action}.network_failed`,
      message: 'Gemini proxy network request failed',
      model: modelForPayload(payload),
      storagePath: storagePathForPayload(payload),
      error: createDiagnosticErrorInfo(error),
      context: summarizeGeminiPayload(payload),
    });
    throw error;
  }

  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    const rawMsg = data?.error || `Gemini request failed (${res.status})`;
    void logDiagnosticEvent({
      severity: 'error',
      stage: `api.gemini.${payload.action}.failed`,
      message: 'Gemini proxy request failed',
      model: modelForPayload(payload),
      storagePath: storagePathForPayload(payload),
      error: { message: rawMsg, status: res.status },
      context: summarizeGeminiPayload(payload),
    });
    // 413 / "Request too large" / "Prompt too large" all mean the body
    // hit our function cap. PDFs route around it via the storage path,
    // but a single big raw image (HEIC photo, screenshot) can still
    // land here. Surface a sentinel so the upload hooks can swap in a
    // localized 'compress to under 5 MB' message rather than leaking
    // the raw HTTP code.
    if (res.status === 413 || /too large/i.test(rawMsg)) {
      throw new Error('FILE_TOO_LARGE');
    }
    throw new Error(rawMsg);
  }
  return data as T;
}

async function generateContent(model: string, contents: unknown, config?: { temperature?: number; responseMimeType?: string }, signal?: AbortSignal, task?: string): Promise<string> {
  const data = await callGemini<{ text: string }>({
    action: 'generateContent',
    model,
    contents,
    config,
    task,
  }, signal);
  return data.text;
}

/**
 * Streamed generateContent. Long generations (the document summary above
 * all) used to buffer server-side until the serverless gateway timed out
 * (504); streaming starts the response with the first token. `onChunk`
 * receives the accumulated text so far, throttled by network framing.
 * Resolves with the complete text.
 */
async function generateContentStreaming(
  model: string,
  contents: unknown,
  onChunk?: (textSoFar: string) => void,
  config?: { temperature?: number },
  signal?: AbortSignal,
  task?: string,
): Promise<string> {
  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;

  let res: Response;
  try {
    res = await fetch(GEMINI_STREAM_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, contents, config, task }),
      signal,
    });
  } catch (error) {
    void logDiagnosticEvent({
      severity: 'error',
      stage: 'api.gemini_stream.network_failed',
      message: 'Gemini stream network request failed',
      model,
      error: createDiagnosticErrorInfo(error),
      context: {
        task,
        contentsKind: typeof contents,
        contentsLength: typeof contents === 'string' ? contents.length : undefined,
      },
    });
    throw error;
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    const error = new Error(data?.error || `Gemini request failed (${res.status})`);
    void logDiagnosticEvent({
      severity: 'error',
      stage: 'api.gemini_stream.failed',
      message: 'Gemini stream request failed before body',
      model,
      error: { ...createDiagnosticErrorInfo(error), status: res.status },
      context: {
        task,
        contentsKind: typeof contents,
        contentsLength: typeof contents === 'string' ? contents.length : undefined,
      },
    });
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    // Hold back the tail in case the sentinel arrives split across chunks
    const errAt = full.indexOf(STREAM_ERROR_SENTINEL);
    if (errAt >= 0) {
      const error = new Error(full.slice(errAt + STREAM_ERROR_SENTINEL.length).trim() || 'Stream failed');
      void logDiagnosticEvent({
        severity: 'error',
        stage: 'api.gemini_stream.midstream_failed',
        message: 'Gemini stream returned an error sentinel',
        model,
        error: createDiagnosticErrorInfo(error),
        context: { task, textReceivedLength: errAt },
      });
      throw error;
    }
    onChunk?.(full);
  }
  full += decoder.decode();
  const errAt = full.indexOf(STREAM_ERROR_SENTINEL);
  if (errAt >= 0) {
    const error = new Error(full.slice(errAt + STREAM_ERROR_SENTINEL.length).trim() || 'Stream failed');
    void logDiagnosticEvent({
      severity: 'error',
      stage: 'api.gemini_stream.completed_with_error',
      message: 'Gemini stream completed with an error sentinel',
      model,
      error: createDiagnosticErrorInfo(error),
      context: { task, textReceivedLength: errAt },
    });
    throw error;
  }
  return full;
}

/**
 * Thrown by extractTextFromDocument when a file is too large to OCR
 * inside a synchronous function and must be handed to the background
 * OCR function instead. Callers catch this and fire triggerBackgroundOcr.
 */
export class BackgroundOcrRequired extends Error {
  constructor() {
    super('BACKGROUND_OCR_REQUIRED');
    this.name = 'BackgroundOcrRequired';
  }
}

// Background functions are invoked at their own function URL. Netlify
// accepts the request and returns 202 immediately, then runs the handler
// for up to 15 minutes.
const BACKGROUND_OCR_ENDPOINT = '/.netlify/functions/extract-ocr-background';

/**
 * Kick off server-side background OCR for a large scanned document and
 * return as soon as Netlify accepts the job (202). The extracted text is
 * NOT returned here — it lands on the documents row later
 * (processing_state -> 'ocr_ready'), which the client picks up via
 * useBackgroundProcessing and then finalizes with summary + questions.
 */
export async function triggerBackgroundOcr(params: {
  documentId: string;
  storagePath: string;
  model: ProcessingModel;
  mimeType: string;
  fileName: string;
  pageCount?: number;
  preflight?: Record<string, unknown>;
}): Promise<void> {
  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;

  let res: Response;
  try {
    res = await fetch(BACKGROUND_OCR_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documentId: params.documentId,
        storagePath: params.storagePath,
        model: params.model,
        mimeType: params.mimeType,
        fileName: params.fileName,
        pageCount: params.pageCount,
        preflight: params.preflight,
      }),
    });
  } catch (error) {
    void logDiagnosticEvent({
      severity: 'error',
      stage: 'api.background_ocr.trigger_failed',
      message: 'Background OCR trigger network request failed',
      model: params.model,
      storagePath: params.storagePath,
      error: createDiagnosticErrorInfo(error),
    });
    throw error;
  }

  // Netlify returns 202 Accepted for background functions; treat any 2xx
  // as accepted. Anything else means the job never started.
  if (res.status < 200 || res.status >= 300) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    const error = new Error(data?.error || `Background OCR could not start (${res.status})`);
    void logDiagnosticEvent({
      severity: 'error',
      stage: 'api.background_ocr.trigger_rejected',
      message: 'Background OCR trigger returned non-2xx',
      model: params.model,
      storagePath: params.storagePath,
      error: { ...createDiagnosticErrorInfo(error), status: res.status },
    });
    throw error;
  }
}

async function sendChatMessage(params: {
  model: Model;
  systemInstruction: string;
  documentContent: string;
  chatHistory: ChatMessage[];
  message: string;
  language?: string | null;
}): Promise<string> {
  // Every chat request re-sends the conversation, so an unbounded history
  // makes each message progressively more expensive. The last 20 turns are
  // plenty of conversational context — the document itself (sent below) is
  // what grounds the answers.
  const MAX_HISTORY_MESSAGES = 20;
  const historyForModel = params.chatHistory
    .slice(1)
    .filter((msg) => !msg.type)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({
      role: msg.sender === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.text }],
    }));
  const documentContentForChat = sampleEvenly(params.documentContent, CONTENT_BUDGET.documentContent);

  const history = [
    {
      role: 'user' as const,
      parts: [
        {
          text: `Here is the document I've uploaded. All of your answers must be based on this content. DOCUMENT CONTENT:\n"""${documentContentForChat}"""`,
        },
      ],
    },
    // Seed the model history with the same localized welcome line the
    // user saw — keeps the model in-language from the very first turn.
    { role: 'model' as const, parts: [{ text: buildInitialBotMessage(params.language).text }] },
    ...historyForModel,
  ];

  const systemInstruction = `${params.systemInstruction}\n\n${languageDirective(params.language)}`;

  const data = await callGemini<{ text: string }>({
    action: 'chat',
    model: params.model,
    systemInstruction,
    history,
    message: params.message,
  });

  return data.text;
}

interface InlineDataPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

const INLINE_TEXT_EXTRACTION_LIMIT_BYTES = 2.5 * 1024 * 1024;
const GEMINI_PDF_OCR_LIMIT_BYTES = 50 * 1024 * 1024;
const GEMINI_PDF_OCR_PAGE_LIMIT = 1000;
const PDF_TEXT_PROBE_PAGES = 8;
const MIN_LOCAL_PDF_TEXT_CHARS = 100;

async function fileToGenerativePart(file: File): Promise<InlineDataPart> {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode file as base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message ?? 'unknown'}`));
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}

async function extractTextFromDocument(file: File, model: ProcessingModel, storagePath?: string): Promise<string> {
  if (file.type === 'text/plain' || file.type === 'text/markdown') {
    return await file.text();
  }

  // For PDFs, extract the text layer locally with pdf.js first. Text-based
  // PDFs (the common case) need no server round-trip at all, which avoids
  // the serverless function timeout (504) on large files. Only fall back
  // to Gemini OCR when the PDF has no usable text layer (scanned / image).
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const shouldProbeBeforeOcr = Boolean(storagePath && file.size > INLINE_TEXT_EXTRACTION_LIMIT_BYTES);
    try {
      if (shouldProbeBeforeOcr) {
        const probe = await extractPdfTextDetailsLocally(file, {
          maxPages: PDF_TEXT_PROBE_PAGES,
          stopAfterChars: MIN_LOCAL_PDF_TEXT_CHARS,
        });
        if (probe.text.trim().length >= MIN_LOCAL_PDF_TEXT_CHARS) {
          return await extractPdfTextLocally(file);
        }
        if (probe.numPages > GEMINI_PDF_OCR_PAGE_LIMIT) {
          throw new Error('Image-based PDFs over 1,000 pages are not supported. Use a text-based PDF or split the file.');
        }
        if (file.size > GEMINI_PDF_OCR_LIMIT_BYTES) {
          throw new Error('Image-based PDFs over 50MB are not supported by OCR processing. Use a text-based PDF, split the file, or compress it below 50MB.');
        }
      } else {
        const localText = await extractPdfTextLocally(file);
        if (localText.trim().length >= MIN_LOCAL_PDF_TEXT_CHARS) return localText;
      }
    } catch (err) {
      if (isPasswordProtectedPdfError(err)) throw new PasswordProtectedPdfError();
      if (err instanceof Error && /image-based PDFs over/i.test(err.message)) throw err;
      console.warn('Local PDF text extraction failed; falling back to Gemini OCR', err);
    }
  }

  if (storagePath && file.size > INLINE_TEXT_EXTRACTION_LIMIT_BYTES) {
    // Large scanned file: OCR can take 30-120s (download + Files API
    // upload + processing + multimodal OCR), which no synchronous /
    // streaming Netlify function can survive (~26s hard kill). Hand it
    // to the background OCR function (15-min limit) instead of trying to
    // stream it. The caller catches this and fires the background job;
    // the result arrives later via DB poll (useBackgroundProcessing).
    throw new BackgroundOcrRequired();
  }

  if (file.size > INLINE_TEXT_EXTRACTION_LIMIT_BYTES) {
    throw new Error('페이지 내용이 이미지로 구성된 큰 PDF 파일과 큰 이미지 파일은 안전하게 처리하려면 로그인이 필요해요. 로그인 후 다시 업로드해 주세요.');
  }

  const documentPart = await fileToGenerativePart(file);
  const data = await callGemini<{ text: string }>({
    action: 'extractText',
    model,
    inlineData: documentPart.inlineData,
  });

  return data.text;
}

export async function processDocument(
  file: File,
  model: ProcessingModel,
  onProgress: (state: DocumentProcessingState) => void,
  language?: string | null,
  onSummaryChunk?: (partialSummary: string) => void,
  storagePath?: string,
): Promise<{ summary: string; presetQuestions: string[]; chat: null; documentContent: string; tokenCount: number }> {
  onProgress('reading');
  const extractedContent = await extractTextFromDocument(file, model, storagePath);

  if (!extractedContent.trim()) {
    throw new Error('Could not extract any text from the document. It might be empty, contain only images, or be unreadable.');
  }

  // Token count is a display-only number — estimate it locally instead of
  // spending an API round-trip on it.
  const tokenCount = estimateTokens(extractedContent);
  const documentContent = sampleEvenly(extractedContent, CONTENT_BUDGET.documentContent);

  onProgress('summarizing');
  const { summary, presetQuestions } = await summarizeExtractedText(documentContent, model, language, onSummaryChunk);

  return { summary, presetQuestions, chat: null, documentContent, tokenCount };
}

const FALLBACK_PRESET_QUESTIONS = [
  '❓ What is the main takeaway from this document?',
  '📄 Can you summarize the key points?',
  '🔑 What are the key terms mentioned?',
];

/**
 * Summary + preset questions from already-extracted document text. Split
 * out of processDocument so the background-OCR finalize step
 * (useBackgroundProcessing) runs the exact same fast generation over text
 * the background function already OCR'd — no need to re-implement these
 * prompts server-side. `documentContent` is expected to already be
 * sampled to CONTENT_BUDGET.documentContent.
 */
export async function summarizeExtractedText(
  documentContent: string,
  model: ProcessingModel,
  language?: string | null,
  onSummaryChunk?: (partialSummary: string) => void,
): Promise<{ summary: string; presetQuestions: string[] }> {
  const langDir = languageDirective(language);

  const summaryPrompt = `Based on the following document, provide a comprehensive, well-structured summary. Use Markdown for formatting (headings, lists, bold text) to make it clear and easy to read.\n\n${langDir}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.summary)}\n"""`;
  const questionsPrompt = `Based on the following document, generate 3-4 insightful and distinct preset questions a user might ask to better understand the content. Prefix each question with a relevant emoji. Format the response as a JSON array of strings.\n\n${langDir}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.presetQuestions)}\n"""\n\nExample output (translate to the target language): ["❓ What is the main topic?", "📄 Can you summarize section 2?", "🔑 What are the key terms?"]`;

  // Summary streams (long output; live display, no gateway timeout) while
  // the preset questions run concurrently. Questions are a small task:
  // an evenly-sampled excerpt and the cheap flash model are plenty.
  const [summary, questionsText] = await Promise.all([
    generateContentStreaming(model, summaryPrompt, onSummaryChunk, undefined, undefined, 'summary'),
    generateContent('gemini-2.5-flash', questionsPrompt, undefined, undefined, 'presetQuestions'),
  ]);

  let presetQuestions: string[];
  try {
    const parsedQuestions = cleanAndParseJSON(questionsText);
    presetQuestions = Array.isArray(parsedQuestions) && parsedQuestions.length > 0
      ? parsedQuestions
      : FALLBACK_PRESET_QUESTIONS;
  } catch (e) {
    console.error('Failed to parse preset questions:', e, questionsText);
    presetQuestions = FALLBACK_PRESET_QUESTIONS;
  }

  return { summary, presetQuestions };
}

export async function generateQuiz(
  documentContent: string,
  model: Model,
  quizType: 'mcq' | 'frq',
  questionCount: number,
  signal?: AbortSignal,
  language?: string | null,
  /** Stems of recently-seen questions for the same (user, doc, type)
   *  so the prompt can steer the model away from repeats. Pass [] when
   *  the user has no history (first quiz, or guest). */
  recentQuestions: string[] = [],
): Promise<QuizData | FRQData> {
  const diversityRules = `
CRITICAL RULES — READ BEFORE GENERATING:
- Each question MUST test a completely different concept, fact, or section of the document. No two questions may share the same main topic.
- Spread questions evenly across the ENTIRE document — cover the beginning, middle, and end, not just the most prominent parts.
- Vary difficulty: mix easy recall, moderate comprehension, and at least one higher-order analysis question.
- Before finalizing your output, verify that every question tests something unique. If any two questions overlap in topic, replace one with a question from an untested section.`;

  let prompt: string;

  if (quizType === 'mcq') {
    prompt = `Based on the DOCUMENT CONTENT provided, generate a ${questionCount}-question multiple-choice quiz. Return ONLY valid JSON with keys: title (string), questions (array). Each question must contain: questionText (string), options (array of exactly 4 strings), correctAnswerIndex (number 0-3), explanation (string). The quiz title must be engaging and MUST include a relevant emoji.

${diversityRules}`;
  } else {
    prompt = `Based on the DOCUMENT CONTENT provided, generate a ${questionCount}-question free-response quiz. Return ONLY valid JSON with keys: title (string), questions (array). Each question must contain: questionText (string), explanation (string — the ideal reference answer used for grading). The quiz title must be engaging and MUST include a relevant emoji.

${diversityRules}`;
  }

  // Cross-attempt repetition is the user-quoted "critical motivation
  // killer" — diversityRules above only prevents dupes WITHIN this
  // one quiz, not across attempts. The avoidance block tells the
  // model which stems the user has already seen for this doc + type.
  const avoidanceBlock = buildQuizAvoidanceBlock(recentQuestions);

  const fullPrompt = `${prompt}\n\n${languageDirective(language)}${avoidanceBlock}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.quiz)}\n"""`;
  const text = await generateContent(model, fullPrompt, { temperature: 1.0, responseMimeType: 'application/json' }, signal, 'quiz');
  return cleanAndParseJSON(text) as QuizData | FRQData;
}

export async function generateFlashcards(
  documentContent: string,
  model: Model,
  count: number,
  signal?: AbortSignal,
  language?: string | null
): Promise<Array<{ front: string; back: string }>> {
  const prompt = `Based on the DOCUMENT CONTENT provided, generate ${count} flashcards for active recall study.
Return ONLY valid JSON: an array of objects, each with "front" (a question, term, or cloze) and "back" (a short answer).

ATOMIC SHORT-ANSWER STYLE (most important — follow strictly):
- Each card tests ONE atomic fact. If a concept needs explanation, split it into multiple cards.
- "front" is a focused prompt: a key term, a "what/which/how many/define" question, or a cloze ("___ is the process of ..."). Never a yes/no question. Never multi-part.
- "back" is a SHORT answer: a word, number, name, date, or short phrase. Aim for 1–8 words; hard limit ~15 words. Never a paragraph, never multiple sentences if avoidable.
- Prefer term → definition, question → short answer, or cloze deletions over essay-style prompts.

GENERAL RULES:
- Each card covers a different concept; no duplicates.
- Spread cards across the ENTIRE document.

${languageDirective(language)}

DOCUMENT CONTENT:
"""
${sampleEvenly(documentContent, CONTENT_BUDGET.flashcards)}
"""`;

  const text = await generateContent(model, prompt, { temperature: 1.0, responseMimeType: 'application/json' }, signal, 'flashcards');
  const parsed = cleanAndParseJSON(text);
  if (!Array.isArray(parsed)) throw new Error('Unexpected flashcard response format');
  return parsed as Array<{ front: string; back: string }>;
}

export async function evaluateFRQAnswer(
  question: string,
  referenceAnswer: string,
  userAnswer: string,
  model: Model,
  language?: string | null
): Promise<{ score: number; feedback: string }> {
  const prompt = `A user was asked a question based on a document. Please evaluate their answer.\n\nQuestion: "${question}"\nIdeal Answer (for reference): "${referenceAnswer}"\nUser's Answer: "${userAnswer}"\n\nProvide a score from 0 to 100 and brief, constructive feedback. Respond ONLY with valid JSON: {"score": number, "feedback": string}.\n\n${languageDirective(language)}`;

  const text = await generateContent(model, prompt, { responseMimeType: 'application/json' }, undefined, 'evaluate');
  return cleanAndParseJSON(text) as { score: number; feedback: string };
}

export async function generateStudyTips(
  documentContent: string,
  quizContent: QuizData | FRQData,
  userAnswers: (UserAnswer | FRUserAnswer)[],
  model: Model,
  language?: string | null
): Promise<string> {
  const isMCQ = 'options' in quizContent.questions[0];

  let incorrectResultsSummary = '';
  if (isMCQ) {
    const mcqAnswers = userAnswers as UserAnswer[];
    incorrectResultsSummary = (quizContent as QuizData).questions
      .map((q, i) => {
        const answer = mcqAnswers.find((a) => a.questionIndex === i);
        if (!answer || answer.isCorrect) return null;
        return `- Question: "${q.questionText}"\n  - Your Incorrect Answer: "${q.options[answer.selectedOptionIndex]}"\n  - Correct Answer: "${q.options[q.correctAnswerIndex]}"\n  - Explanation for Correct Answer: ${q.explanation}`;
      })
      .filter(Boolean)
      .join('\n');
  } else {
    const frqAnswers = userAnswers as FRUserAnswer[];
    incorrectResultsSummary = (quizContent as FRQData).questions
      .map((q, i) => {
        const answer = frqAnswers.find((a) => a.questionIndex === i);
        const LOW_SCORE_THRESHOLD = 70;
        if (!answer || (answer.score !== undefined && answer.score >= LOW_SCORE_THRESHOLD)) return null;
        return `- Question: "${q.questionText}"\n  - Your Answer: "${answer.userAnswerText}"\n  - Score: ${answer.score}/100\n  - AI Feedback: ${answer.feedback}\n  - Ideal Answer for Reference: ${q.explanation}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  const allCorrect = userAnswers.every((a) => (a as UserAnswer).isCorrect === true || ((a as FRUserAnswer).score !== undefined && (a as FRUserAnswer).score! >= 70));
  if (allCorrect) {
    return allCorrectMessage(language);
  }

  const prompt = `You are a precise AI Tutor. Analyze the user's quiz results and provide a concise "Key Concepts for Review" list based ONLY on incorrect/low-scoring answers.\n\n### DOCUMENT CONTENT\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.studyTips)}\n"""\n\n### QUIZ RESULTS (Incorrect/Low-Scoring Only)\n"""\n${incorrectResultsSummary}\n"""\n\nRules:\n- Output MUST start with a heading line equivalent to "### 🎯 Key Concepts for Review" — keep the leading "###" and 🎯 emoji, but translate the heading text.\n- Use Markdown bullet points.\n- Be concise; no motivational phrases; focus only on content corrections.\n\n${languageDirective(language)}\n`;

  return await generateContent(model, prompt, undefined, undefined, 'studyTips');
}

export type { MindMapData, SlideData };

export async function generateMindMap(
  documentContent: string,
  model: Model,
  signal?: AbortSignal,
  language?: string | null
): Promise<MindMapData> {
  const prompt = `Based on the DOCUMENT CONTENT, create a hierarchical mind map as a nested tree.

Return ONLY valid JSON in this exact recursive shape:
{
  "center": "Main Topic",
  "branches": [
    {
      "label": "Major concept",
      "children": [
        { "label": "Sub-concept", "children": [ { "label": "Specific detail" } ] },
        { "label": "Another sub-concept" }
      ]
    }
  ]
}

Rules:
- "center": the core topic of the document (3-6 words).
- 3-6 top-level branches, each a distinct major theme.
- Build REAL depth: most branches should have children, and those
  children should themselves have 1-3 children where the material
  supports it. Aim for 3-4 levels deep overall (not a flat list).
- A node is a leaf when it has no "children" key (omit it, don't use []).
- Every "label" is concise: a short phrase, ideally under 8 words.
- Group related ideas under a shared parent so the hierarchy reads
  like an outline of the document, not a flat bullet list.
- Cover the entire document breadth, not just the beginning.

${languageDirective(language)}

DOCUMENT CONTENT:
"""
${sampleEvenly(documentContent, CONTENT_BUDGET.mindmap)}
"""`;
  const text = await generateContent(model, prompt, { temperature: 0.7, responseMimeType: 'application/json' }, signal, 'mindmap');
  return cleanAndParseJSON(text) as MindMapData;
}

export async function generateSlides(
  documentContent: string,
  model: Model,
  slideCount: number,
  signal?: AbortSignal,
  language?: string | null
): Promise<SlideData> {
  const prompt = `Based on the DOCUMENT CONTENT, create a ${slideCount}-slide presentation.
Return ONLY valid JSON: {"title": "🎯 Presentation Title", "slides": [{"heading": "Slide Title", "emoji": "📌", "bullets": ["point 1", "point 2", "point 3"]}]}

Rules:
- Presentation title must include a relevant emoji
- Each slide: one heading, one emoji, 3-5 bullet points (max 15 words each)
- Spread evenly across the full document — beginning, middle, end
- No two slides should cover the same topic
- Last slide must be a concise summary/takeaways slide

${languageDirective(language)}

DOCUMENT CONTENT:
"""
${sampleEvenly(documentContent, CONTENT_BUDGET.slides)}
"""`;
  const text = await generateContent(model, prompt, { temperature: 0.8, responseMimeType: 'application/json' }, signal, 'slides');
  return cleanAndParseJSON(text) as SlideData;
}

// ── TTS ──────────────────────────────────────────────────────────────────────
// Audio-format primitives live in services/ttsService — this function
// owns only the network step (authenticated call to /api/gemini for
// each chunk) and orchestrates concurrent synthesis with progress.

import { concatPcmBuffers, decodeAudioData, pcmToWavBlob } from './ttsService';

export async function synthesizeSpeech(
  text: string,
  voice: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const chunks = splitTextForTts(normalizePodcastScriptForSingleNarrator(text));
  if (chunks.length === 0) {
    throw new Error('No text available for speech synthesis.');
  }

  // Prefer one TTS request whenever the script fits the limit. Independent
  // chunk requests can make the same selected voice sound inconsistent across
  // segment boundaries, which feels like multiple speakers.
  let completed = 0;
  // Sequential (not concurrent) on purpose: parallel chunk requests can
  // make the same selected voice sound inconsistent across segment
  // boundaries, which the user perceives as multiple speakers.
  const pcmBuffers: Uint8Array[] = [];

  // TTS preview model is unstable, and the server-side retry budget has
  // to live inside a ~26 s function timeout — so the client owns the
  // longer-horizon retries where it has no such limit:
  //
  //   1. Same-chunk retry: try the exact text once more after a short
  //      backoff. Most transient failures (INTERNAL/UNAVAILABLE/504/timeout)
  //      clear on the second attempt because they're upstream throttling,
  //      not anything wrong with the input.
  //   2. Split-half fallback: when the same chunk fails twice in a row,
  //      split it on a sentence boundary and try each half once.
  //      Smaller inputs are markedly more likely to succeed because the
  //      model is rate-limited per second of audio output.
  const requestChunk = async (text: string): Promise<Uint8Array> => {
    const data = await callGemini<{ audioData: string; mimeType: string }>({
      action: 'tts', text, voice,
    }, signal);
    return decodeAudioData(data.audioData);
  };
  const splitHalfOnSentence = (text: string): [string, string] | null => {
    const trimmed = text.trim();
    if (trimmed.length < 80) return null; // too small to bother splitting
    const sentences = trimmed.match(/[^.!?]+[.!?]+\s*/g) ?? [trimmed];
    if (sentences.length < 2) {
      // Fall back to mid-character split if there are no sentence ends.
      const mid = Math.floor(trimmed.length / 2);
      return [trimmed.slice(0, mid), trimmed.slice(mid)];
    }
    const mid = Math.floor(sentences.length / 2);
    return [sentences.slice(0, mid).join('').trim(), sentences.slice(mid).join('').trim()];
  };
  const isTransientTtsError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : '';
    return /INTERNAL|UNAVAILABLE|5\d\d|internal error|overload|temporar|timeout|timed out|fetch failed|network/i.test(msg);
  };

  for (const chunk of chunks) {
    let pcm: Uint8Array | null = null;
    let lastErr: unknown;
    // Two same-chunk attempts before falling back to split-half. The
    // 1.5 s pause lets upstream throttling clear without dragging the
    // user-perceived wait too long (sequential across all chunks).
    for (let attempt = 0; attempt < 2 && pcm === null; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        pcm = await requestChunk(chunk);
      } catch (err) {
        lastErr = err;
        // Abort/non-transient: bail immediately, don't waste a retry
        // on something that won't recover (e.g. 400 invalid input).
        if (err instanceof Error && err.name === 'AbortError') throw err;
        if (!isTransientTtsError(err)) throw err;
      }
    }
    if (pcm === null) {
      // Same chunk failed twice — split and try each half once.
      const halves = splitHalfOnSentence(chunk);
      if (!halves) throw lastErr ?? new Error('TTS failed');
      const [a, b] = halves;
      const [pa, pb] = await Promise.all([requestChunk(a), requestChunk(b)]);
      pcm = concatPcmBuffers([pa, pb]);
    }
    pcmBuffers.push(pcm);
    onProgress(++completed, chunks.length);
  }

  // MP3 (48 kbps mono) instead of WAV: ≈8× smaller for the same audible
  // quality on narration, so a 3-minute podcast goes from ~9 MB to ~1 MB
  // in storage. Dynamic import keeps the ~170 kB lamejs codec out of the
  // main bundle — it only loads when the user actually presses "Generate
  // Audio".
  //
  // Defensive: if the codec fails to load or encode for any reason, fall
  // back to raw WAV rather than throwing away audio the user already
  // waited through every chunk to synthesize. Bigger file, but it plays.
  const pcm = concatPcmBuffers(pcmBuffers);
  try {
    const { pcmToMp3Blob } = await import('./mp3Encoder');
    return pcmToMp3Blob(pcm, 24000);
  } catch (err) {
    console.error('[tts] MP3 encode failed, falling back to WAV:', err);
    return pcmToWavBlob(pcm, 24000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export type PodcastScriptLength = 'standard' | 'long';

export const PODCAST_SCRIPT_LENGTH_GUIDE: Record<PodcastScriptLength, { prompt: string }> = {
  standard: {
    prompt: 'about 750 words by default, roughly 4-5 minutes of spoken narration',
  },
  long: {
    prompt: 'about 1,200 words by default, roughly 7-8 minutes of spoken narration',
  },
};

export async function generatePodcastScript(
  documentContent: string,
  model: Model,
  signal?: AbortSignal,
  instructions?: string,
  language?: string | null,
  onChunk?: (textSoFar: string) => void,
  length: PodcastScriptLength = 'standard',
): Promise<string> {
  const lengthGuide = PODCAST_SCRIPT_LENGTH_GUIDE[length] ?? PODCAST_SCRIPT_LENGTH_GUIDE.standard;
  const trimmedInstructions = instructions?.trim();
  const instructionBlock = trimmedInstructions
    ? `\nUSER DIRECTION (follow scope, tone, emphasis, and length requests; it must NOT override the one-narrator format):
"""
${trimmedInstructions}
"""\n`
    : '';

  // Length rule: the original ~300 words felt too short in real use. The
  // default is now roughly 2-3x longer while still short enough for the
  // existing sequential TTS chunking path. If the user direction specifies a
  // duration or word count, follow that instead — otherwise a "30-second"
  // request conflicts with a hard default word rule and the model burns
  // time trying to reconcile both, which is what caused the 504s.
  const prompt = `Write an engaging podcast-style audio script based on the DOCUMENT CONTENT.
A single narrator presents the material in a conversational, educational style.

Rules:
- Open with a friendly welcome line equivalent to: "Welcome to today's study session. Today we're exploring..." (translated naturally into the target language).
- Use natural transitions equivalent to: "Moving on to...", "Here's something interesting...", "Let's now look at..." (translated naturally).
- Explain concepts clearly — assume the listener hasn't read the document.
- Close with a 2-sentence recap and sign-off.
- Length preset: ${lengthGuide.prompt}. If the USER DIRECTION specifies a duration (e.g. "30 seconds") or word count, follow that instead — use ~100 words per 30 seconds of audio as a guide.
- One narrator only. Do not write host/guest dialogue, panel discussions, interviews, speaker labels, role names, stage directions, or back-and-forth turns.
- If the USER DIRECTION asks for multiple speakers or a dialogue format, convert that request into a single-narrator explanation while preserving the requested topic, tone, and length.
- Plain prose only — absolutely no markdown, no headers, no bullet points, no speaker labels.
- ALWAYS finish the closing sentence with proper punctuation; never end mid-sentence.

${languageDirective(language)}
${instructionBlock}
DOCUMENT CONTENT:
"""
${sampleEvenly(documentContent, CONTENT_BUDGET.podcast)}
"""`;
  // Stream so the gateway never times out before first byte AND so the UI
  // can render the transcript as it's written. The router falls back
  // Gemini Flash-Lite → Flash → Groq if the upstream stalls before
  // emitting a token.
  return await generateContentStreaming(model, prompt, onChunk, { temperature: 1.0 }, signal, 'podcast');
}

export const geminiProxy = {
  sendChatMessage,
};
