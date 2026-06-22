import { describe, expect, it } from 'vitest';
import {
  normalizePodcastScriptForSingleNarrator,
  splitTextForTts,
  splitTtsChunkForRetry,
  TTS_SAFE_CHUNK_CHARS,
} from '../../utils/podcastAudio';

describe('normalizePodcastScriptForSingleNarrator', () => {
  it('removes speaker labels and standalone stage directions', () => {
    const script = [
      '진행자: 오늘은 세포 호흡을 살펴봅니다.',
      '[밝은 음악]',
      '[패널] ATP는 에너지 전달에 중요합니다.',
      'Guest: The key idea is energy conversion.',
      'A: 마지막으로 핵심을 정리해 볼게요.',
    ].join('\n');

    const normalized = normalizePodcastScriptForSingleNarrator(script);

    expect(normalized).toContain('오늘은 세포 호흡을 살펴봅니다.');
    expect(normalized).toContain('ATP는 에너지 전달에 중요합니다.');
    expect(normalized).toContain('The key idea is energy conversion.');
    expect(normalized).toContain('마지막으로 핵심을 정리해 볼게요.');
    expect(normalized).not.toContain('진행자:');
    expect(normalized).not.toContain('Guest:');
    expect(normalized).not.toContain('[밝은 음악]');
  });
});

describe('splitTextForTts', () => {
  it('keeps a normal multi-paragraph podcast script in one segment', () => {
    const text = [
      'Welcome to today\'s study session.',
      'Here is the first concept explained in a steady narrator voice.',
      'Let\'s close with a short recap.',
    ].join('\n\n');

    expect(splitTextForTts(text)).toEqual([text]);
  });

  it('splits oversized scripts without exceeding the safe TTS chunk size', () => {
    const text = Array.from({ length: 8 }, (_, i) => `Paragraph ${i}. ${'x'.repeat(900)}`).join('\n\n');
    const chunks = splitTextForTts(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= TTS_SAFE_CHUNK_CHARS)).toBe(true);
    expect(chunks.join('\n\n')).toContain('Paragraph 0.');
    expect(chunks.join('\n\n')).toContain('Paragraph 7.');
  });
});

describe('splitTtsChunkForRetry', () => {
  it('splits a failed Korean TTS chunk on sentence boundaries', () => {
    const text = [
      '첫 번째 개념은 세포가 에너지를 저장하는 방식입니다.',
      '두 번째 개념은 ATP가 필요한 순간에 다시 분해된다는 점입니다.',
      '마지막으로 이 흐름을 호흡 과정 전체와 연결해 볼 수 있습니다.',
      '복습할 때는 입력과 출력의 관계를 떠올리면 좋습니다.',
    ].join(' ');

    const split = splitTtsChunkForRetry(text);

    expect(split).not.toBeNull();
    expect(split?.[0]).toContain('첫 번째 개념');
    expect(split?.[0]).toContain('두 번째 개념');
    expect(split?.[1]).toContain('마지막으로');
    expect(split?.[1]).toContain('복습할 때');
  });

  it('falls back to a character split when sentence boundaries are absent', () => {
    const text = 'x'.repeat(120);
    const split = splitTtsChunkForRetry(text);

    expect(split).not.toBeNull();
    expect(split?.[0].length).toBeGreaterThan(0);
    expect(split?.[1].length).toBeGreaterThan(0);
    expect(`${split?.[0]}${split?.[1]}`).toHaveLength(120);
  });

  it('does not split tiny chunks', () => {
    expect(splitTtsChunkForRetry('짧은 문장입니다.')).toBeNull();
  });
});
