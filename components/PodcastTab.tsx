import * as React from 'react';
import type { DocumentData } from '../types';
import { generatePodcastScript, synthesizeSpeech } from '../services/geminiService';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { HeadphonesIcon, AutoAwesomeIcon } from './icons';
import { Spinner } from './Spinner';

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

const DIRECTION_PLACEHOLDER = '예: 챕터 5~7의 범위만을 대상으로, 진행자와 패널의 대화 같은 형식으로 생성해 주세요.';

export const PodcastTab: React.FC<PodcastTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();

  const [instructions, setInstructions] = React.useState('');

  const { data, loading, error, generate, cancel } = useAIGeneration<string>(
    React.useCallback(
      (signal) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        return generatePodcastScript(document.documentContent, document.model, signal, instructions);
      },
      [document.documentContent, document.model, instructions]
    )
  );

  React.useEffect(() => {
    if (data) {
      dispatch({
        type: 'UPDATE_DOCUMENT',
        payload: { docId: document.id, updates: { podcastData: { script: data } } },
      });
    }
  }, [data, document.id, dispatch]);

  const displayScript = data ?? document.podcastData?.script ?? null;

  const [voice, setVoice] = React.useState<string>('Puck');
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioLoading, setAudioLoading] = React.useState(false);
  const [audioProgress, setAudioProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const audioAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  const handleGenerateAudio = React.useCallback(async () => {
    if (!displayScript) return;
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    audioAbortRef.current?.abort();
    audioAbortRef.current = new AbortController();
    setAudioLoading(true);
    setAudioError(null);
    setAudioProgress(null);
    try {
      const blob = await synthesizeSpeech(displayScript, voice, (done, total) => {
        setAudioProgress({ done, total });
      }, audioAbortRef.current.signal);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setAudioError(e instanceof Error ? e.message : 'Audio generation failed.');
    } finally {
      setAudioLoading(false);
      setAudioProgress(null);
    }
  }, [displayScript, voice, audioUrl]);

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-ink-400 p-6">
        <HeadphonesIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">Document content not available</p>
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
                Cancel
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 opacity-50 text-white rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <AutoAwesomeIcon className="text-sm" />
                Generating…
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
              {displayScript ? 'New Script' : 'Generate Script'}
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
              className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              범위·형식·말투 등 원하는 방향을 적어주세요. 비워두면 기본 형식으로 생성됩니다.
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
            <p className="text-sm">Generate a script, pick a voice, then synthesize real AI audio.</p>
          </div>
        ) : (
          <>
            {/* Audio card */}
            <div className="bg-ink-50 rounded-xl border border-ink-200 p-4">
              <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Voice</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoice(v.id)}
                    disabled={audioLoading}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                      voice === v.id
                        ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                        : 'bg-white border-ink-200 text-ink-700 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {v.label} <span className="font-normal opacity-70">{v.desc}</span>
                  </button>
                ))}
              </div>

              {audioLoading ? (
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
                        Cancel
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
                    download="podcast.wav"
                    className="text-center text-xs text-brand-600 hover:text-brand-700 font-medium py-0.5"
                  >
                    ↓ Download WAV
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
