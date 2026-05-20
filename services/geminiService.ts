import type { Part } from '@google/genai';
import { getSystemInstruction, initialBotMessage } from '../constants';
import type { Model, ProcessingModel, DocumentProcessingState, QuizData, FRQData, UserAnswer, FRUserAnswer, ChatMessage } from '../types';

const GEMINI_PROXY_ENDPOINT = '/api/gemini';

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
      } catch (e) {
        // fall through
      }
    }
  }

  const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
};

async function callGemini<T>(payload: any): Promise<T> {
  const res = await fetch(GEMINI_PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error || `Gemini request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

async function countTokens(model: string, text: string): Promise<number> {
  const data = await callGemini<{ totalTokens: number }>({
    action: 'countTokens',
    model,
    text,
  });
  return data.totalTokens ?? 0;
}

async function generateContent(model: string, contents: any, config?: any): Promise<string> {
  const data = await callGemini<{ text: string }>({
    action: 'generateContent',
    model,
    contents,
    config,
  });
  return data.text;
}

async function sendChatMessage(params: {
  model: Model;
  systemInstruction: string;
  documentContent: string;
  chatHistory: ChatMessage[];
  message: string;
}): Promise<string> {
  const historyForModel = params.chatHistory
    .slice(1)
    .filter((msg) => !msg.type)
    .map((msg) => ({
      role: msg.sender === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.text }],
    }));

  const history = [
    {
      role: 'user' as const,
      parts: [
        {
          text: `Here is the document I've uploaded. All of your answers must be based on this content. DOCUMENT CONTENT:\n"""${params.documentContent}"""`,
        },
      ],
    },
    { role: 'model' as const, parts: [{ text: initialBotMessage.text }] },
    ...historyForModel,
  ];

  const data = await callGemini<{ text: string }>({
    action: 'chat',
    model: params.model,
    systemInstruction: params.systemInstruction,
    history,
    message: params.message,
  });

  return data.text;
}

async function fileToGenerativePart(file: File): Promise<Part> {
  const base64EncodedData = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}

async function extractTextFromDocument(file: File, model: ProcessingModel): Promise<string> {
  if (file.type === 'text/plain' || file.type === 'text/markdown') {
    return await file.text();
  }

  const documentPart = await fileToGenerativePart(file);

  const data = await callGemini<{ text: string }>({
    action: 'extractText',
    model,
    inlineData: (documentPart as any).inlineData,
  });

  return data.text;
}

export async function processDocument(
  file: File,
  model: ProcessingModel,
  onProgress: (state: DocumentProcessingState) => void
): Promise<{ summary: string; presetQuestions: string[]; chat: null; documentContent: string; tokenCount: number }> {
  onProgress('reading');
  const documentContent = await extractTextFromDocument(file, model);

  if (!documentContent.trim()) {
    throw new Error('Could not extract any text from the document. It might be empty, contain only images, or be unreadable.');
  }

  const tokenCount = await countTokens(model, documentContent);

  onProgress('summarizing');
  const summaryPrompt = `Based on the following document, provide a comprehensive, well-structured summary. Use Markdown for formatting (headings, lists, bold text) to make it clear and easy to read.\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""`;
  const summary = await generateContent(model, summaryPrompt);

  onProgress('generating_questions');
  const questionsPrompt = `Based on the following document, generate 3-4 insightful and distinct preset questions a user might ask to better understand the content. Prefix each question with a relevant emoji. Format the response as a JSON array of strings.\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""\n\nExample output: ["❓ What is the main topic?", "📄 Can you summarize section 2?", "🔑 What are the key terms?"]`;
  const questionsText = await generateContent(model, questionsPrompt);

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
  questionCount: number
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

  const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""`;
  const text = await generateContent(model, fullPrompt, { temperature: 1.0 });
  return cleanAndParseJSON(text) as QuizData | FRQData;
}

export async function evaluateFRQAnswer(
  question: string,
  referenceAnswer: string,
  userAnswer: string,
  model: Model
): Promise<{ score: number; feedback: string }> {
  const prompt = `A user was asked a question based on a document. Please evaluate their answer.\n\nQuestion: "${question}"\nIdeal Answer (for reference): "${referenceAnswer}"\nUser's Answer: "${userAnswer}"\n\nProvide a score from 0 to 100 and brief, constructive feedback. Respond ONLY with valid JSON: {"score": number, "feedback": string}.`;

  const text = await generateContent(model, prompt);
  return cleanAndParseJSON(text);
}

export async function generateStudyTips(
  documentContent: string,
  quizContent: QuizData | FRQData,
  userAnswers: (UserAnswer | FRUserAnswer)[],
  model: Model
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

  const allCorrect = userAnswers.every((a) => (a as UserAnswer).isCorrect === true || (a as FRUserAnswer).score! >= 70);
  if (allCorrect) {
    return '### 🎯 All Correct!\n\nExcellent work! You\'ve demonstrated a strong understanding of the material. No review needed for this quiz.';
  }

  const prompt = `You are a precise AI Tutor. Analyze the user's quiz results and provide a concise "Key Concepts for Review" list based ONLY on incorrect/low-scoring answers.\n\n### DOCUMENT CONTENT\n"""\n${documentContent}\n"""\n\n### QUIZ RESULTS (Incorrect/Low-Scoring Only)\n"""\n${incorrectResultsSummary}\n"""\n\nRules:\n- Output MUST start with: ### 🎯 Key Concepts for Review\n- Use Markdown bullet points.\n- Be concise; no motivational phrases; focus only on content corrections.\n`;

  return await generateContent(model, prompt);
}

export const geminiProxy = {
  sendChatMessage,
  countTokens,
};
