// `task` (when set) routes the call through the multi-provider router
// server-side (Gemini -> Groq -> Cerebras fallback per task type).
export type GeminiPayload =
  | { action: 'countTokens'; model: string; text: string }
  | { action: 'generateContent'; model: string; contents: unknown; config?: unknown; task?: string }
  | { action: 'chat'; model: string; systemInstruction: string; history: unknown; message: string }
  | { action: 'extractText'; model: string; inlineData: unknown }
  | { action: 'extractTextFromStorage'; model: string; storagePath: string; mimeType: string; fileName: string }
  | { action: 'tts'; text: string; voice: string };

export function summarizeGeminiPayload(payload: GeminiPayload): Record<string, unknown> {
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

export function modelForPayload(payload: GeminiPayload): string | undefined {
  return payload.action === 'tts' ? undefined : payload.model;
}

export function storagePathForPayload(payload: GeminiPayload): string | undefined {
  return payload.action === 'extractTextFromStorage' ? payload.storagePath : undefined;
}
