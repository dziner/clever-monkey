// Isolated mp3 encoder so lamejs (≈170 kB) ships in its own chunk and
// loads only when the user actually synthesizes podcast audio, instead
// of being pulled into the main bundle by every page. Imported via
// dynamic import() from services/geminiService.ts at synthesis time.

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Encode a raw PCM buffer (16-bit mono, default 24 kHz) as MP3. At the
 * default 48 kbps the output is ~8× smaller than the equivalent WAV
 * (~360 KB/min vs ~2.88 MB/min) with no audible quality loss for
 * narrated speech. 48 kbps is the sweet spot for speech mono — 64 is
 * overkill, 32 starts to thin out vowels. The 1152-sample block size
 * is the standard MP3 granule, which lamejs is optimized around.
 */
export function pcmToMp3Blob(pcm: Uint8Array, sampleRate = 24000, kbps = 48): Blob {
    // The PCM bytes are little-endian int16 — alias as Int16Array so the
    // encoder reads sample values directly without a copy. Browsers we
    // target are little-endian, matching Gemini's PCM byte order.
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 1);
    const encoder = new Mp3Encoder(1, sampleRate, kbps);
    const BLOCK = 1152;
    const mp3Chunks: Uint8Array[] = [];
    for (let i = 0; i < samples.length; i += BLOCK) {
        const slice = samples.subarray(i, i + BLOCK);
        const out = encoder.encodeBuffer(slice);
        if (out.length > 0) mp3Chunks.push(out);
    }
    const tail = encoder.flush();
    if (tail.length > 0) mp3Chunks.push(tail);
    return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mpeg' });
}
