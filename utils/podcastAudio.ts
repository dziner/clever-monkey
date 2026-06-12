export const TTS_SAFE_CHUNK_CHARS = 4400;

const SPEAKER_LABEL_PATTERN =
  /^\s*(?:(?:host|guest|co-?host|narrator|speaker\s*\d+|panelist|expert|student|teacher|professor|interviewer|interviewee)|(?:진행자|사회자|게스트|패널|패널리스트|내레이터|나레이터|화자\s*\d+|전문가|학생|선생님|교수|인터뷰어|인터뷰이)|[A-Z])\s*[:：\-]\s*/i;

const DIRECTION_ONLY_PATTERN =
  /^\s*(?:\[[^\]]{1,80}\]|\([^)]{1,80}\)|（[^）]{1,80}）)\s*$/;
const LEADING_DIRECTION_PATTERN =
  /^\s*(?:\[[^\]]{1,80}\]|\([^)]{1,80}\)|（[^）]{1,80}）)\s*/;

function splitOversizedText(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    const part = text.slice(i, i + maxChars).trim();
    if (part) parts.push(part);
  }
  return parts;
}

function splitParagraphIntoUnits(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];

  const sentences = paragraph.match(/[^.!?。！？\n]+[.!?。！？]+(?:["'”’）)]*)?|[^.!?。！？\n]+$/g) ?? [paragraph];
  return sentences.flatMap(sentence => {
    const trimmed = sentence.trim();
    return trimmed.length > maxChars ? splitOversizedText(trimmed, maxChars) : [trimmed];
  }).filter(Boolean);
}

export function normalizePodcastScriptForSingleNarrator(script: string): string {
  return script
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !DIRECTION_ONLY_PATTERN.test(line))
    .map(line => line.replace(LEADING_DIRECTION_PATTERN, '').replace(SPEAKER_LABEL_PATTERN, '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function splitTextForTts(text: string, maxChars = TTS_SAFE_CHUNK_CHARS): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const units = paragraphs.flatMap(paragraph => splitParagraphIntoUnits(paragraph, maxChars));

  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    const separator = current ? '\n\n' : '';
    if (current && current.length + separator.length + unit.length > maxChars) {
      chunks.push(current);
      current = unit;
    } else {
      current += `${separator}${unit}`;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
