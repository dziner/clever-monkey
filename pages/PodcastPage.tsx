import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { generatePodcastScript, synthesizeSpeech } from '../services/geminiService';
import { MenuIcon, HeadphonesIcon, AutoAwesomeIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';

const VOICES = [
  { id: 'Puck',   label: 'Puck',   desc: 'Enthusiastic' },
  { id: 'Aoede',  label: 'Aoede',  desc: 'Warm' },
  { id: 'Kore',   label: 'Kore',   desc: 'Professional' },
  { id: 'Charon', label: 'Charon', desc: 'Authoritative' },
  { id: 'Zephyr', label: 'Zephyr', desc: 'Casual' },
] as const;

interface Props { onMenuClick: () => void; }

export const PodcastPage: React.FC<Props> = ({ onMenuClick }) => {
  const { state } = useDocuments();
  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);

  const [script, setScript] = React.useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = React.useState(false);
  const [scriptError, setScriptError] = React.useState<string | null>(null);

  const [voice, setVoice] = React.useState<string>('Puck');
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioLoading, setAudioLoading] = React.useState(false);
  const [audioProgress, setAudioProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [audioError, setAudioError] = React.useState<string | null>(null);

  const scriptAbortRef = React.useRef<AbortController | null>(null);
  const audioAbortRef = React.useRef<AbortController | null>(null);

  // Revoke previous blob URL on change/unmount
  React.useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  const handleGenerateScript = React.useCallback(async () => {
    if (!activeDoc?.documentContent) return;
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    scriptAbortRef.current?.abort();
    scriptAbortRef.current = new AbortController();
    setScriptLoading(true);
    setScriptError(null);
    setAudioError(null);
    try {
      const result = await generatePodcastScript(activeDoc.documentContent, activeDoc.model, scriptAbortRef.current.signal);
      setScript(result);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setScriptError(e.message ?? 'Failed to generate script.');
    } finally {
      setScriptLoading(false);
    }
  }, [activeDoc, audioUrl]);

  const handleGenerateAudio = React.useCallback(async () => {
    if (!script) return;
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    audioAbortRef.current?.abort();
    audioAbortRef.current = new AbortController();
    setAudioLoading(true);
    setAudioError(null);
    setAudioProgress(null);
    try {
      const blob = await synthesizeSpeech(script, voice, (done, total) => {
        setAudioProgress({ done, total });
      }, audioAbortRef.current.signal);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setAudioError(e.message ?? 'Audio generation failed.');
    } finally {
      setAudioLoading(false);
      setAudioProgress(null);
    }
  }, [script, voice, audioUrl]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 shadow-sm">
        <button type="button" onClick={onMenuClick} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          <MenuIcon className="text-xl" />
        </button>
        <HeadphonesIcon className="text-2xl text-emerald-500" />
        <div>
          <h1 className="font-bold text-slate-800 text-lg leading-tight">Podcast</h1>
          <p className="text-xs text-slate-400 truncate max-w-xs">{activeDoc ? activeDoc.fileName : 'No document selected'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeDoc?.documentContent && (
            scriptLoading ? (
              <>
                <button type="button" onClick={() => scriptAbortRef.current?.abort()} className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="button" disabled className="flex items-center gap-2 px-4 py-2 bg-emerald-600 opacity-50 text-white rounded-xl text-sm font-semibold cursor-not-allowed">
                  <AutoAwesomeIcon className="text-base" />
                  Writing…
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={audioLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <AutoAwesomeIcon className="text-base" />
                {script ? 'New Script' : 'Generate Script'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-6 gap-5">
        {!activeDoc ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
            <HeadphonesIcon className="text-5xl mb-3 opacity-30" />
            <p className="text-sm font-medium">Upload a document to generate a podcast</p>
          </div>
        ) : scriptLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
            <Spinner />
            <span className="text-sm">Writing podcast script…</span>
          </div>
        ) : scriptError ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-red-500 text-sm max-w-sm">
            <p className="font-semibold mb-1">Script generation failed</p>
            <p>{scriptError}</p>
          </div>
        ) : !script ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400 max-w-xs">
            <HeadphonesIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Listen to your document</p>
            <p className="text-sm">Generate a podcast script, pick a voice, then synthesize real AI audio — no more robotic text-to-speech.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col gap-5">

            {/* ── Audio generation card ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Voice</p>

              {/* Voice selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoice(v.id)}
                    disabled={audioLoading}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
                      voice === v.id
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    {v.label}
                    <span className={`ml-1.5 font-normal opacity-70`}>{v.desc}</span>
                  </button>
                ))}
              </div>

              {/* Generate audio button / progress */}
              {audioLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Synthesizing audio…</span>
                    <div className="flex items-center gap-2">
                      {audioProgress && (
                        <span className="font-semibold text-emerald-600">
                          {audioProgress.done} / {audioProgress.total} segments
                        </span>
                      )}
                      <button type="button" onClick={() => audioAbortRef.current?.abort()} className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: audioProgress
                          ? `${(audioProgress.done / audioProgress.total) * 100}%`
                          : '10%',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mt-1">
                    This takes 10–30 seconds. Neural voices are generating in real-time.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  <HeadphonesIcon className="text-base" />
                  {audioUrl ? 'Regenerate Audio' : 'Generate Audio'} · {voice}
                </button>
              )}

              {audioError && (
                <p className="mt-2 text-xs text-red-500 text-center">{audioError}</p>
              )}

              {/* Audio player */}
              {audioUrl && !audioLoading && (
                <div className="mt-4 flex flex-col gap-2">
                  <audio
                    key={audioUrl}
                    src={audioUrl}
                    controls
                    className="w-full rounded-xl"
                    style={{ accentColor: '#059669' }}
                  />
                  <a
                    href={audioUrl}
                    download="podcast.wav"
                    className="text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1"
                  >
                    ↓ Download WAV
                  </a>
                </div>
              )}
            </div>

            {/* ── Transcript ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Transcript</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{script}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
