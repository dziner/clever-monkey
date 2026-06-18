const QUESTION_TEXT_FIELDS = ['question', 'text', 'prompt', 'title', 'content', 'label'] as const;
const QUESTION_LIST_FIELDS = ['questions', 'presetQuestions', 'preset_questions'] as const;
const MAX_PRESET_QUESTION_LENGTH = 500;

function cleanQuestionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PRESET_QUESTION_LENGTH).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseQuestionContainer(value: unknown): unknown {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    const cleaned = cleanQuestionText(value);
    if (!cleaned) return undefined;

    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
      try {
        return parseQuestionContainer(JSON.parse(cleaned));
      } catch {
        return [cleaned];
      }
    }

    return [cleaned];
  }

  const record = asRecord(value);
  if (!record) return undefined;

  for (const field of QUESTION_LIST_FIELDS) {
    if (field in record) return parseQuestionContainer(record[field]);
  }

  return [record];
}

function extractQuestionText(value: unknown): string | null {
  if (typeof value === 'string') {
    const cleaned = cleanQuestionText(value);
    return cleaned || null;
  }

  const record = asRecord(value);
  if (!record) return null;

  for (const field of QUESTION_TEXT_FIELDS) {
    const raw = record[field];
    if (typeof raw !== 'string') continue;

    const question = cleanQuestionText(raw);
    if (!question) continue;

    const emoji = typeof record.emoji === 'string' ? cleanQuestionText(record.emoji) : '';
    return emoji && !question.startsWith(emoji) ? `${emoji} ${question}` : question;
  }

  return null;
}

export function normalizePresetQuestions(value: unknown): string[] | undefined {
  const container = parseQuestionContainer(value);
  if (!Array.isArray(container)) return undefined;

  const seen = new Set<string>();
  const questions: string[] = [];

  for (const item of container) {
    const question = extractQuestionText(item);
    if (!question || seen.has(question)) continue;
    seen.add(question);
    questions.push(question);
  }

  return questions.length > 0 ? questions : undefined;
}

function isLikelyLeadingIcon(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;

  return (
    (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
    (codePoint >= 0x2600 && codePoint <= 0x27bf)
  );
}

export function stripLeadingPresetQuestionIcon(question: string): string {
  const trimmed = question.trim();
  const chars = Array.from(trimmed);
  if (chars.length === 0 || !isLikelyLeadingIcon(chars[0])) return trimmed;

  return chars.slice(1).join('').replace(/^\uFE0F?\s*/, '').trim();
}
