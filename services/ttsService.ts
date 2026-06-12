// Pure audio-format utilities for the TTS pipeline. Keeps the WAV
// muxing, sentence chunking, and PCM concatenation out of the main
// Gemini service file so each surface stays focused. The synthesize
// step itself stays in geminiService because it has to call the
// authenticated Gemini proxy — only the parts that don't need network
// access live here.

/**
 * Wrap a raw PCM buffer (16-bit mono, default 24 kHz) in a WAV
 * container. The output is a Blob playable by the browser <audio>
 * element directly. Matches the format Gemini's TTS preview model
 * returns inside its audio inlineData.
 */
export function pcmToWavBlob(pcm: Uint8Array, sampleRate = 24000): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    const s = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); s(8, 'WAVE');
    s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true);
    v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true);
    v.setUint16(34, bitsPerSample, true);
    s(36, 'data'); v.setUint32(40, pcm.length, true);
    const wav = new Uint8Array(44 + pcm.length);
    wav.set(new Uint8Array(header)); wav.set(pcm, 44);
    return new Blob([wav], { type: 'audio/wav' });
}

// (Text chunking for podcast TTS lives in utils/podcastAudio.ts — the
// splitter there preserves speaker-marker boundaries and stays under the
// per-request char cap; this file only owns the audio-format primitives.)

/**
 * Concatenate per-chunk PCM buffers into one continuous PCM stream,
 * with a short silence inserted between consecutive chunks so the
 * boundaries don't click. SILENCE_SAMPLES is 20 ms at 24 kHz, 16-bit.
 */
export function concatPcmBuffers(pcmBuffers: Uint8Array[]): Uint8Array {
    const SILENCE_SAMPLES = 480 * 2;
    const silence = new Uint8Array(SILENCE_SAMPLES);
    const parts: Uint8Array[] = [];
    pcmBuffers.forEach((buf, i) => {
        parts.push(buf);
        if (i < pcmBuffers.length - 1) parts.push(silence);
    });
    const total = parts.reduce((n, p) => n + p.length, 0);
    const combined = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { combined.set(p, off); off += p.length; }
    return combined;
}

/** base64 audio bytes from the Gemini TTS reply → raw PCM Uint8Array. */
export function decodeAudioData(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
