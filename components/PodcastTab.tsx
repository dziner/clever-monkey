import * as React from 'react';
import type { DocumentData } from '../types';
import { generatePodcastScript, synthesizeSpeech } from '../services/geminiService';
import {
  buildPodcastAudioPath,
  uploadPodcastAudio,
  downloadPodcastAudio,
  removePodcastAudio,
} from '../services/podcastStorage';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { HeadphonesIcon, AutoAwesomeIcon } from './icons';
import { Spinner } from './Spinner';
import { t } from '../services/uiStrings';

const VOICES = [
  { id: 'Puck',   label: 'Puck',   desc: 'Enthusiastic' },
  { id: 'Aoede',  label: 'Aoede',  desc: 'Warm' },
  { id: 'Kore',   label: 'Kore',   desc: 'Professional' },
  { id: 'Charon', label: 'Charon', desc: 'Authoritative' },
  { id: 'Zephyr', label: 'Zephyr', desc: 'Casual' },
] as const;

interface PodcastTabProps {
  document: DocumentData;
}

const DIRECTION_PLACEHOLDER = '예: 챕터 5~7만 대상으로, 시험 전 복습용 2분 내레이션으로 차분하게 설명해 주세요.';

export const PodcastTab: React.FC<PodcastTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();
  const { userProfile, userId } = useUser();
  const language = userProfile?.language ?? null;

  const [instructions, setInstructions] = React.useState('');

  const { data, loading, error, generate, cancel } = useAIGeneration<string>(
    React.useCallback(
      (signal, onProgress) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        // Forward streaming chunks so the transcript renders live — gives
        // the user visible progress and confirms the function is alive
        // long before the full script finishes.
        return generatePodcastScript(
          document.documentContent, document.model, signal, instructions, language, onProgress,
        );
      },
      [document.documentContent, document.model, instructions, language]
    )
  );

  const [voice, setVoice] = React.useState<string>('Puck');
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioLoading, setAudioLoading] = React.useState(false);
  const [audioRestoring, setAudioRestoring] = React.useState(false);
  const [audioProgress, setAudioProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const audioAbortRef = React.useRef<AbortController | null>(null);
  // The storage path currently represented by `audioUrl`, so the restore
  // effect doesn't re-download audio we already have in memory.
  const loadedAudioPathRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    // A freshly generated script makes any previously synthesized audio
    // stale — drop the saved pointer, clear the player, and clean up the
    // now-orphaned file so storage doesn't accumulate dead audio.
    const stalePath = document.podcastData?.audioPath ?? null;
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: { docId: document.id, updates: { podcastData: { script: data } } },
    });
    setAudioUrl(null);
    setAudioError(null);
    loadedAudioPathRef.current = null;
    if (stalePath) void removePodcastAudio(stalePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, document.id, dispatch]);

  const displayScript = data ?? document.podcastData?.script ?? null;

  React.useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  // Restore saved audio on mount (or when a different saved file appears),
  // so a refresh brings the podcast back instead of losing it.
  const savedAudioPath = document.podcastData?.audioPath;
  const savedVoice = document.podcastData?.voice;
  React.useEffect(() => {
    if (!savedAudioPath || loadedAudioPathRef.current === savedAudioPath) return;
    let cancelled = false;
    setAudioRestoring(true);
    (async () => {
      const blob = await downloadPodcastAudio(savedAudioPath);
      if (cancelled) return;
      if (blob) {
        loadedAudioPathRef.current = savedAudioPath;
        setAudioUrl(URL.createObjectURL(blob));
        if (savedVoice) setVoice(savedVoice);
      }
      setAudioRestoring(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAudioPath]);

  const handleGenerateAudio = React.useCallback(async () => {
    if (!displayScript) return;
    audioAbortRef.current?.abort();
    audioAbortRef.current = new AbortController();
    setAudioLoading(true);
    setAudioError(null);
    setAudioProgress(null);
    try {
      const blob = await synthesizeSpeech(displayScript, voice, (done, total) => {
        setAudioProgress({ done, total });
      }, audioAbortRef.current.signal);
      // Play immediately from memory; the previous object URL is revoked by
      // the cleanup effect when this replaces it.
      setAudioUrl(URL.createObjectURL(blob));

      // Persist so it survives a refresh. Guests have no per-user storage
      // prefix, so they keep only the in-memory copy for this session.
      if (userId) {
        const prevPath = document.podcastData?.audioPath ?? null;
        try {
          const path = buildPodcastAudioPath(userId, document.id, voice);
          await uploadPodcastAudio(path, blob);
          loadedAudioPathRef.current = path;
          dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { docId: document.id, updates: { podcastData: { script: displayScript, audioPath: path, voice } } },
          });
          if (prevPath && prevPath !== path) void removePodcastAudio(prevPath);
        } catch (saveErr) {
          // Non-fatal: audio still plays this session, just not persisted.
          console.error('[podcast] failed to save audio:', saveErr);
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const raw = e instanceof Error ? e.message : '';
      // Friendlier copy for the upstream Gemini TTS transient errors we retry on.
      const friendly =
        /INTERNAL|UNAVAILABLE|5\d\d|internal error/i.test(raw)
          ? '음성 합성 서버가 잠시 응답하지 않고 있어요. 잠깐 후 다시 시도해 주세요.'
          : raw || '음성 합성에 실패했습니다.';
      setAudioError(friendly);
    } finally {
      setAudioLoading(false);
      setAudioProgress(null);
    }
  }, [displayScript, voice, userId, document.id, document.podcastData?.audioPath, dispatch]);

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-ink-400 p-6">
        <HeadphonesIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">{t('podcast.documentMissing', language)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-white">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="text-xl text-brand-500" />
          <span className="font-semibold text-ink-700 text-sm">Podcast</span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-ink-200 hover:bg-ink-300 text-ink-700 rounded-lg text-xs font-semibold transition-colors"
              >
                {t('podcast.cancel', language)}
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 opacity-50 text-white rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <AutoAwesomeIcon className="text-sm" />
                {t('podcast.generating', language)}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={audioLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <AutoAwesomeIcon className="text-sm" />
              {t(displayScript ? 'podcast.newScript' : 'podcast.generateScript', language)}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {!loading && (
          <div className="bg-white rounded-xl border border-ink-200 p-4">
            <label htmlFor="podcast-direction" className="block text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">
              생성 방향 <span className="font-normal lowercase tracking-normal text-ink-400">(선택)</span>
            </label>
            <textarea
              id="podcast-direction"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={DIRECTION_PLACEHOLDER}
              rows={3}
              // Direction snippets are inserted verbatim into the LLM
              // prompt; cap so a paste of a whole document doesn't blow
              // the prompt budget or surprise-charge tokens.
              maxLength={1000}
              className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              범위·길이·말투 등 원하는 방향을 적어주세요. 오디오는 선택한 하나의 보이스로 낭독됩니다.
            </p>
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-ink-500 mt-8">
            <Spinner />
            <span className="text-sm">Writing podcast script…</span>
          </div>
        ) : error ? (
          <div className="text-center text-danger-500 text-sm max-w-sm mt-8">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !displayScript ? (
          <div className="text-center text-ink-400 max-w-xs mx-auto mt-8">
            <HeadphonesIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-ink-700 mb-1">Generate a podcast</p>
            <p className="text-sm">Generate a single-narrator script, pick a voice, then synthesize real AI audio.</p>
          </div>
        ) : (
          <>
            {/* Audio card */}
            <div className="bg-ink-50 rounded-xl border border-ink-200 p-4">
              <label htmlFor="podcast-voice" className="block text-[11px] font-bold text-ink-500 uppercase tracking-[0.14em] mb-2">
                Voice
              </label>
              <select
                id="podcast-voice"
                value={voice}
                onChange={e => setVoice(e.target.value)}
                disabled={audioLoading}
                className="w-full h-10 text-sm border border-ink-200 rounded-lg px-3 bg-white text-ink-800 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 mb-3"
              >
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.desc}
                  </option>
                ))}
              </select>

              {audioRestoring ? (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-500">
                  <Spinner />
                  <span>저장된 음성을 불러오는 중…</span>
                </div>
              ) : audioLoading ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>Synthesizing…</span>
                    <div className="flex items-center gap-2">
                      {audioProgress && (
                        <span className="font-semibold text-brand-600">
                          {audioProgress.done}/{audioProgress.total} segments
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => audioAbortRef.current?.abort()}
                        className="px-2 py-0.5 bg-ink-200 hover:bg-ink-300 text-ink-700 rounded text-xs font-semibold"
                      >
                        {t('podcast.cancel', language)}
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-ink-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{
                        width: audioProgress
                          ? `${(audioProgress.done / audioProgress.total) * 100}%`
                          : '10%',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <HeadphonesIcon className="text-sm" />
                  {audioUrl ? 'Regenerate Audio' : 'Generate Audio'} · {voice}
                </button>
              )}

              {audioError && (
                <p className="mt-2 text-xs text-danger-500 text-center">{audioError}</p>
              )}

              {audioUrl && !audioLoading && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <audio
                    key={audioUrl}
                    src={audioUrl}
                    controls
                    className="w-full rounded-lg"
                    style={{ accentColor: '#7c3aed' }}
                  />
                  <a
                    href={audioUrl}
                    download="podcast.mp3"
                    className="text-center text-xs text-brand-600 hover:text-brand-700 font-medium py-0.5"
                  >
                    ↓ Download MP3
                  </a>
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-xl border border-ink-200 p-4">
              <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Transcript</p>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{displayScript}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
