// Per-request char cap for TTS — deliberately SMALL.
//
// gemini-2.5-flash-preview-tts generation time scales with output audio
// length, and the whole call has to finish inside Netlify's ~26 s
// function wall-clock (empirically confirmed when large-PDF OCR timed
// out at ~26 s). Podcast scripts now default to roughly 750 words, so
// keeping this cap small is even more important: a long script must become
// many short TTS calls rather than one giant request that hits the
// function wall-clock.
//
// The original working version (2026-05) split by paragraph into 4–6
// small chunks ("1/6 … 6/6"), each finishing in a few seconds. Restore
// that: 500 chars keeps every chunk's TTS call fast and well within the
// function limit, a typical script becomes 2–4 sequential chunks, and
// the per-chunk progress bar comes back. Smaller also means a transient
// failure only costs one short retry, not a 26 s timeout.
export const TTS_SAFE_CHUNK_CHARS = 500;

const SPEAKER_LABEL_PATTERN =
  /^\s*(?:(?:host|guest|co-?host|narrator|speaker\s*\d+|panelist|expert|student|teacher|professor|interviewer|interviewee)|(?:진행자|사회자|게스트|패널|패널리스트|내레이터|나레이터|화자\s*\d+|전문가|학생|선생님|교수|인터뷰어|인터뷰이)|[A-Z])\s*[:：\-]\s*/i;

const DIRECTION_ONLY_PATTERN =
  /^\s*(?:\[[^\]]{1,80}\]|\([^)]{1,80}\)|（[^）]{1,80}）)\s*$/;
const LEADING_DIRECTION_PATTERN =
  /^\s*(?:\[[^\]]{1,80}\]|\([^)]{1,80}\)|（[^）]{1,80}）)\s*/;
const SENTENCE_PATTERN = /[^.!?。！？\n]+[.!?。！？]+(?:["'”’）)]*)?|[^.!?。！？\n]+$/g;

function splitIntoSentences(text: string): string[] {
  return (text.match(SENTENCE_PATTERN) ?? [text])
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

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

  const sentences = splitIntoSentences(paragraph);
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

/**
 * Build the Supabase Storage key for a synthesized podcast WAV. Pure (no
 * network) so it lives here; the upload/download live in
 * services/podcastStorage.ts. Kept under `{userId}/podcasts/` so the
 * docs-bucket RLS — which keys on the FIRST path segment — treats it as
 * the user's own object. A timestamp + random suffix makes every render a
 * distinct object, so a fresh upload never collides (the bucket grants no
 * UPDATE policy); regeneration uploads fresh and removes the old file.
 */
export function buildPodcastAudioPath(userId: string, docId: string, voice: string): string {
  const safeDoc = docId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const safeVoice = voice.replace(/[^a-zA-Z0-9]/g, '') || 'voice';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // .mp3 because synthesizeSpeech now produces lamejs-encoded MP3
  // (≈8× smaller than the WAV we used to store). Old podcasts saved as
  // .wav still play back fine — the stored audioPath drives extension,
  // not this builder.
  return `${userId}/podcasts/${safeDoc}-${safeVoice}-${unique}.mp3`;
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

export function splitTtsChunkForRetry(text: string): [string, string] | null {
  const trimmed = text.trim();
  if (trimmed.length < 80) return null;

  const sentences = splitIntoSentences(trimmed);
  if (sentences.length >= 2) {
    const mid = Math.floor(sentences.length / 2);
    const left = sentences.slice(0, mid).join(' ').trim();
    const right = sentences.slice(mid).join(' ').trim();
    return left && right ? [left, right] : null;
  }

  const mid = Math.floor(trimmed.length / 2);
  const left = trimmed.slice(0, mid).trim();
  const right = trimmed.slice(mid).trim();
  return left && right ? [left, right] : null;
}
