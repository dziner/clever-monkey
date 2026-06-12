import type { Part } from '@google/genai';
import { getSystemInstruction, buildInitialBotMessage } from '../constants';
import type { Model, ProcessingModel, DocumentProcessingState, QuizData, FRQData, UserAnswer, FRUserAnswer, ChatMessage, MindMapData, SlideData } from '../types';
import { languageDirective, allCorrectMessage } from './languageService';
import { extractPdfTextLocally } from '../utils/pdfText';
import { estimateTokens, sampleEvenly, CONTENT_BUDGET } from '../utils/promptBudget';

const GEMINI_PROXY_ENDPOINT = '/api/gemini';
const GEMINI_STREAM_ENDPOINT = '/api/gemini-stream';

// Mirrors STREAM_ERROR_SENTINEL in netlify/functions/lib/shared.ts (kept
// byte-identical) — a mid-stream failure can't change the HTTP status
// anymore, so the server appends this marker followed by the error message.
const STREAM_ERROR_SENTINEL = '\n[[__GEMINI_STREAM_ERROR__]]\n';

const repairJSON = (text: string): string =>
  text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');

// Utility to safely parse JSON from LLM output which might contain Markdown code blocks or extra text
const cleanAndParseJSON = (text: string) => {
  const firstOpenBrace = text.indexOf('{');
  const firstOpenBracket = text.indexOf('[');
  let startIndex = -1;

  if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
    startIndex = Math.min(firstOpenBrace, firstOpenBracket);
  } else if (firstOpenBrace !== -1) {
    startIndex = firstOpenBrace;
  } else if (firstOpenBracket !== -1) {
    startIndex = firstOpenBracket;
  }

  if (startIndex !== -1) {
    const lastCloseBrace = text.lastIndexOf('}');
    const lastCloseBracket = text.lastIndexOf(']');
    let endIndex = -1;

    if (lastCloseBrace !== -1 && lastCloseBracket !== -1) {
      endIndex = Math.max(lastCloseBrace, lastCloseBracket);
    } else if (lastCloseBrace !== -1) {
      endIndex = lastCloseBrace;
    } else if (lastCloseBracket !== -1) {
      endIndex = lastCloseBracket;
    }

    if (endIndex !== -1 && endIndex >= startIndex) {
      const candidate = text.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        try {
          return JSON.parse(repairJSON(candidate));
        } catch {
          // fall through
        }
      }
    }
  }

  const stripped = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return JSON.parse(repairJSON(stripped));
  }
};

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

async function getAuthHeader(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

async function callGemini<T>(payload: GeminiPayload, signal?: AbortSignal): Promise<T> {
  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;

  const res = await fetch(GEMINI_PROXY_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    const msg = data?.error || `Gemini request failed (${res.status})`;
    throw new Error(msg);
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

  const res = await fetch(GEMINI_STREAM_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, contents, config, task }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data?.error || `Gemini request failed (${res.status})`);
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
      throw new Error(full.slice(errAt + STREAM_ERROR_SENTINEL.length).trim() || 'Stream failed');
    }
    onChunk?.(full);
  }
  full += decoder.decode();
  const errAt = full.indexOf(STREAM_ERROR_SENTINEL);
  if (errAt >= 0) {
    throw new Error(full.slice(errAt + STREAM_ERROR_SENTINEL.length).trim() || 'Stream failed');
  }
  return full;
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
    try {
      const localText = await extractPdfTextLocally(file);
      if (localText.trim().length >= 100) return localText;
    } catch (err) {
      console.warn('Local PDF text extraction failed; falling back to Gemini OCR', err);
    }
  }

  if (storagePath && file.size > INLINE_TEXT_EXTRACTION_LIMIT_BYTES) {
    const data = await callGemini<{ text: string }>({
      action: 'extractTextFromStorage',
      model,
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
    });
    return data.text;
  }

  if (file.size > INLINE_TEXT_EXTRACTION_LIMIT_BYTES) {
    throw new Error('Large scanned PDFs and images require sign-in so the file can be processed securely after upload.');
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
  const langDir = languageDirective(language);

  const summaryPrompt = `Based on the following document, provide a comprehensive, well-structured summary. Use Markdown for formatting (headings, lists, bold text) to make it clear and easy to read.\n\n${langDir}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.summary)}\n"""`;
  const questionsPrompt = `Based on the following document, generate 3-4 insightful and distinct preset questions a user might ask to better understand the content. Prefix each question with a relevant emoji. Format the response as a JSON array of strings.\n\n${langDir}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.presetQuestions)}\n"""\n\nExample output (translate to the target language): ["❓ What is the main topic?", "📄 Can you summarize section 2?", "🔑 What are the key terms?"]`;

  // Summary streams (long output; live display, no gateway timeout) while
  // the preset questions run concurrently. Questions are a small task:
  // an evenly-sampled excerpt and the cheap flash model are plenty.
  onProgress('summarizing');
  const [summary, questionsText] = await Promise.all([
    generateContentStreaming(model, summaryPrompt, onSummaryChunk, undefined, undefined, 'summary'),
    generateContent('gemini-2.5-flash', questionsPrompt, undefined, undefined, 'presetQuestions'),
  ]);

  let presetQuestions: string[];
  try {
    const parsedQuestions = cleanAndParseJSON(questionsText);
    presetQuestions = Array.isArray(parsedQuestions) && parsedQuestions.length > 0
      ? parsedQuestions
      : [
          '❓ What is the main takeaway from this document?',
          '📄 Can you summarize the key points?',
          '🔑 What are the key terms mentioned?',
        ];
  } catch (e) {
    console.error('Failed to parse preset questions:', e, questionsText);
    presetQuestions = [
      '❓ What is the main takeaway from this document?',
      '📄 Can you summarize the key points?',
      '🔑 What are the key terms mentioned?',
    ];
  }

  return { summary, presetQuestions, chat: null, documentContent, tokenCount };
}

export async function generateQuiz(
  documentContent: string,
  model: Model,
  quizType: 'mcq' | 'frq',
  questionCount: number,
  signal?: AbortSignal,
  language?: string | null
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

  const fullPrompt = `${prompt}\n\n${languageDirective(language)}\n\nDOCUMENT CONTENT:\n"""\n${sampleEvenly(documentContent, CONTENT_BUDGET.quiz)}\n"""`;
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
  return cleanAndParseJSON(text);
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

// ── TTS helpers ───────────────────────────────────────────────────────────────

function pcmToWavBlob(pcm: Uint8Array, sampleRate = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const s = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); s(8, 'WAVE');
  s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  s(36, 'data'); v.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header)); wav.set(pcm, 44);
  return new Blob([wav], { type: 'audio/wav' });
}

function splitIntoChunks(text: string): string[] {
  // Split on blank lines first; fall back to sentence grouping
  const byPara = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (byPara.length >= 2) return byPara;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const size = Math.ceil(sentences.length / 4);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += size) {
    chunks.push(sentences.slice(i, i + size).join(' ').trim());
  }
  return chunks.filter(Boolean);
}

export async function synthesizeSpeech(
  text: string,
  voice: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const chunks = splitIntoChunks(text);

  // Chunks are independent, so synthesize them concurrently — with the
  // server-side key pool they fan out across API keys, cutting podcast
  // audio generation from sum-of-chunks to roughly the slowest chunk.
  // Order is preserved by index; progress counts completions.
  let completed = 0;
  const pcmBuffers = await Promise.all(
    chunks.map(async (chunk) => {
      const data = await callGemini<{ audioData: string; mimeType: string }>({
        action: 'tts',
        text: chunk,
        voice,
      }, signal);
      onProgress(++completed, chunks.length);
      return Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
    }),
  );

  // Concatenate PCM buffers, add 480-sample silence between chunks
  const silence = new Uint8Array(480 * 2); // 20ms @ 24kHz, 16-bit
  const parts: Uint8Array[] = [];
  pcmBuffers.forEach((buf, i) => { parts.push(buf); if (i < pcmBuffers.length - 1) parts.push(silence); });
  const total = parts.reduce((n, p) => n + p.length, 0);
  const combined = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { combined.set(p, off); off += p.length; }

  // Extract sample rate from mimeType (e.g. "audio/pcm;rate=24000")
  const sampleRate = 24000;
  return pcmToWavBlob(combined, sampleRate);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function generatePodcastScript(
  documentContent: string,
  model: Model,
  signal?: AbortSignal,
  instructions?: string,
  language?: string | null,
  onChunk?: (textSoFar: string) => void
): Promise<string> {
  const trimmedInstructions = instructions?.trim();
  const instructionBlock = trimmedInstructions
    ? `\nUSER DIRECTION (follow this exactly — it OVERRIDES the default length):
"""
${trimmedInstructions}
"""\n`
    : '';

  // Length rule: a default ~300 words keeps generation comfortably under
  // Netlify's function timeout. If the user direction specifies a
  // duration or word count, follow that instead — otherwise a "30-second"
  // request conflicts with a hard 400-500-word rule and the model burns
  // time trying to reconcile both, which is what caused the 504s.
  const prompt = `Write an engaging podcast-style audio script based on the DOCUMENT CONTENT.
A single narrator presents the material in a conversational, educational style.

Rules:
- Open with a friendly welcome line equivalent to: "Welcome to today's study session. Today we're exploring..." (translated naturally into the target language).
- Use natural transitions equivalent to: "Moving on to...", "Here's something interesting...", "Let's now look at..." (translated naturally).
- Explain concepts clearly — assume the listener hasn't read the document.
- Close with a 2-sentence recap and sign-off.
- Length: about 300 words by default. If the USER DIRECTION specifies a duration (e.g. "30 seconds") or word count, follow that instead — use ~100 words per 30 seconds of audio as a guide.
- Plain prose only — absolutely no markdown, no headers, no bullet points.
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
