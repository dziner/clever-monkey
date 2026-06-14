import { describe, expect, it } from 'vitest';
import { pcmToWavBlob } from '../../services/ttsService';
import { pcmToMp3Blob } from '../../services/mp3Encoder';

// One second of 24 kHz mono 16-bit PCM as a deterministic 200 Hz sine
// wave — long enough that lamejs produces a real (non-trivial) bitstream
// and short enough to encode instantly in tests.
function oneSecondSinePcm(): Uint8Array {
  const sampleRate = 24000;
  const freq = 200;
  const pcm = new Uint8Array(sampleRate * 2);
  for (let i = 0; i < sampleRate; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0x4fff);
    pcm[i * 2]     = v & 0xff;
    pcm[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return pcm;
}

describe('pcmToMp3Blob', () => {
  it('produces a non-empty audio/mpeg blob', () => {
    const blob = pcmToMp3Blob(oneSecondSinePcm(), 24000);
    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('is substantially smaller than the equivalent WAV', () => {
    // The whole point of switching codecs: storage savings. WAV @ 24 kHz
    // mono is ~48 KB/s; MP3 @ 48 kbps is ~6 KB/s. A loose 4× floor lets
    // the test absorb codec frame overhead on very short clips while
    // still catching a regression that accidentally re-stores WAV.
    const pcm = oneSecondSinePcm();
    const wav = pcmToWavBlob(pcm, 24000);
    const mp3 = pcmToMp3Blob(pcm, 24000);
    expect(mp3.size * 4).toBeLessThan(wav.size);
  });
});
