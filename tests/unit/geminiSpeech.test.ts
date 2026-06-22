import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}));

vi.mock('../../services/diagnostics', () => ({
  logDiagnosticEvent: vi.fn(async () => undefined),
}));

import { synthesizeSpeech } from '../../services/geminiService';
import { logDiagnosticEvent } from '../../services/diagnostics';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('synthesizeSpeech', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recovers a transient no-audio TTS failure by retrying and splitting the chunk', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'TTS returned no audio data' }, 502))
      .mockResolvedValueOnce(jsonResponse({ error: 'TTS returned no audio data' }, 502))
      .mockResolvedValueOnce(jsonResponse({ audioData: 'AQI=', mimeType: 'audio/pcm;rate=24000' }))
      .mockResolvedValueOnce(jsonResponse({ audioData: 'AwQ=', mimeType: 'audio/pcm;rate=24000' }));
    vi.stubGlobal('fetch', fetchMock);

    const script = [
      '첫 번째 개념은 세포가 에너지를 저장하는 방식입니다.',
      '두 번째 개념은 ATP가 필요한 순간에 다시 분해된다는 점입니다.',
      '마지막으로 이 흐름을 호흡 과정 전체와 연결해 볼 수 있습니다.',
      '복습할 때는 입력과 출력의 관계를 떠올리면 좋습니다.',
    ].join(' ');
    const progress = vi.fn();

    const blob = await synthesizeSpeech(script, 'Puck', progress);

    expect(blob.type).toBe('audio/mpeg');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(progress).toHaveBeenCalledWith(1, 1);
    expect(logDiagnosticEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'api.gemini.tts.failed',
      context: expect.objectContaining({
        attempt: 1,
        chunkIndex: 1,
        splitDepth: 0,
      }),
    }));
    expect(logDiagnosticEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'api.gemini.tts.failed',
      context: expect.objectContaining({
        attempt: 2,
        chunkIndex: 1,
        splitDepth: 0,
      }),
    }));
  });
});
