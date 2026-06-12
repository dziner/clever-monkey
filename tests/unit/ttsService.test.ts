import { describe, it, expect } from 'vitest';
import { pcmToWavBlob, concatPcmBuffers, decodeAudioData } from '../../services/ttsService';

// Text chunking now lives in utils/podcastAudio (tested in
// tests/unit/podcastAudio.test.ts) — ttsService owns only the
// audio-format primitives, so the suite here covers those alone.

describe('concatPcmBuffers', () => {
    it('joins buffers with a 960-byte silence (20ms @ 24kHz, 16-bit) between each', () => {
        const a = new Uint8Array([1, 2, 3]);
        const b = new Uint8Array([4, 5, 6]);
        const out = concatPcmBuffers([a, b]);
        // 3 + 960 silence + 3 = 966
        expect(out.length).toBe(3 + 960 + 3);
        // First three are the input bytes
        expect(out[0]).toBe(1);
        expect(out[2]).toBe(3);
        // Silence region is zero
        expect(out[100]).toBe(0);
        // Tail picks up the second buffer
        expect(out[out.length - 1]).toBe(6);
    });

    it('omits the silence between for a single buffer', () => {
        const a = new Uint8Array([7, 8, 9]);
        expect(concatPcmBuffers([a])).toEqual(a);
    });

    it('handles an empty input as an empty output', () => {
        expect(concatPcmBuffers([])).toEqual(new Uint8Array(0));
    });
});

describe('pcmToWavBlob', () => {
    it('produces a WAV-typed Blob with a 44-byte header + the PCM body', async () => {
        const pcm = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const blob = pcmToWavBlob(pcm);
        expect(blob.type).toBe('audio/wav');
        expect(blob.size).toBe(44 + pcm.length);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        // RIFF / WAVE magic
        expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('RIFF');
        expect(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])).toBe('WAVE');
    });
});

describe('decodeAudioData', () => {
    it('decodes base64 into a Uint8Array byte-for-byte', () => {
        // btoa('hi') === 'aGk='
        expect(Array.from(decodeAudioData('aGk='))).toEqual([0x68, 0x69]);
    });
});
