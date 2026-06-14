// Persistence for synthesized podcast audio. The WAV blob is stored in
// the same `docs` bucket as document files, under the user's own prefix
// (`{userId}/podcasts/…`) so the existing owner-based RLS — which keys on
// the FIRST path segment — applies unchanged. Each synthesis writes a new
// timestamped object and deletes the previous one, so we never depend on
// an UPDATE storage policy (the bucket only grants SELECT/INSERT/DELETE).

import { supabase } from './supabaseClient';

// Pure path builder lives in utils/ (no network) and is re-exported here so
// callers have a single import site for podcast-audio storage concerns.
export { buildPodcastAudioPath } from '../utils/podcastAudio';

const BUCKET = 'docs';

/** Upload a synthesized WAV. Throws on failure so the caller can fall back
 *  to the in-memory copy for this session. */
export async function uploadPodcastAudio(path: string, blob: Blob): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'audio/wav', upsert: false });
    if (error) throw error;
}

/** Download saved podcast audio as a Blob, or null if it's gone / denied. */
export async function downloadPodcastAudio(path: string): Promise<Blob | null> {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) {
        if (error) console.error('[podcast] audio download failed:', error);
        return null;
    }
    return data;
}

/** Best-effort delete of a superseded audio file. Never throws. */
export async function removePodcastAudio(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.warn('[podcast] failed to remove old audio:', error);
}
