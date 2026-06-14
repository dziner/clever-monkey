import { describe, expect, it } from 'vitest';
// Imported from utils/ (pure) rather than services/podcastStorage to avoid
// pulling in supabaseClient, which throws without env vars under test.
import { buildPodcastAudioPath } from '../../utils/podcastAudio';

describe('buildPodcastAudioPath', () => {
  it('puts the userId as the first path segment so docs-bucket RLS applies', () => {
    const path = buildPodcastAudioPath('user-123', 'lecture.pdf', 'Puck');
    // RLS keys on (storage.foldername(name))[1] — the first segment must be
    // the owner's id, otherwise the upload is rejected.
    expect(path.split('/')[0]).toBe('user-123');
    expect(path.split('/')[1]).toBe('podcasts');
    expect(path.endsWith('.mp3')).toBe(true);
  });

  it('sanitizes unsafe characters in the document id', () => {
    const path = buildPodcastAudioPath('u1', 'my file/../weird*name.pdf', 'Aoede');
    const objectKey = path.split('/').slice(2).join('/'); // after `u1/podcasts/`
    // No path traversal or slashes leak into the object key segment.
    expect(objectKey).not.toContain('/');
    expect(objectKey).not.toContain('*');
    expect(objectKey).toContain('Aoede');
  });

  it('produces a distinct key per call so regeneration never collides', () => {
    const a = buildPodcastAudioPath('u1', 'doc.pdf', 'Kore');
    const b = buildPodcastAudioPath('u1', 'doc.pdf', 'Kore');
    expect(a).not.toBe(b);
  });
});
