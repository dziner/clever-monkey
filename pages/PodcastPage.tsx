import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { generatePodcastScript } from '../services/geminiService';
import { MenuIcon, HeadphonesIcon, PlayArrowIcon, PauseIcon, StopIcon, AutoAwesomeIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';

interface Props { onMenuClick: () => void; }

export const PodcastPage: React.FC<Props> = ({ onMenuClick }) => {
  const { state } = useDocuments();
  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);

  const [script, setScript] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [playing, setPlaying] = React.useState(false);
  const [utteranceIndex, setUtteranceIndex] = React.useState(-1);
  const sentencesRef = React.useRef<string[]>([]);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const handleGenerate = React.useCallback(async () => {
    if (!activeDoc?.documentContent) return;
    stop();
    setLoading(true);
    setError(null);
    try {
      const result = await generatePodcastScript(activeDoc.documentContent, activeDoc.model);
      setScript(result);
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate podcast script.');
    } finally {
      setLoading(false);
    }
  }, [activeDoc]);

  // Split script into sentences for highlighting
  React.useEffect(() => {
    if (!script) return;
    sentencesRef.current = script.match(/[^.!?]+[.!?]+/g) ?? [script];
  }, [script]);

  function stop() {
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setUtteranceIndex(-1);
  }

  function play() {
    if (!script) return;
    const sentences = sentencesRef.current;
    if (!sentences.length) return;

    window.speechSynthesis.cancel();
    setPlaying(true);

    let idx = utteranceIndex < 0 ? 0 : utteranceIndex;

    const speakFrom = (i: number) => {
      if (i >= sentences.length) { stop(); return; }
      setUtteranceIndex(i);
      const u = new SpeechSynthesisUtterance(sentences[i]);
      u.rate = 0.95;
      u.pitch = 1;
      u.onend = () => speakFrom(i + 1);
      u.onerror = () => stop();
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    };

    speakFrom(idx);
  }

  function pause() {
    window.speechSynthesis.pause();
    setPlaying(false);
  }

  function resume() {
    window.speechSynthesis.resume();
    setPlaying(true);
  }

  // Cleanup on unmount
  React.useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const sentences = sentencesRef.current;
  const progress = sentences.length > 0 && utteranceIndex >= 0
    ? Math.round((utteranceIndex / sentences.length) * 100)
    : 0;

  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <button type="button" onClick={onMenuClick} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          <MenuIcon className="text-xl" />
        </button>
        <HeadphonesIcon className="text-2xl text-emerald-500" />
        <div>
          <h1 className="font-bold text-slate-800 text-base leading-tight">Podcast</h1>
          {activeDoc && <p className="text-xs text-slate-400 truncate max-w-xs">{activeDoc.fileName}</p>}
        </div>
        <div className="ml-auto">
          {activeDoc?.documentContent && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <AutoAwesomeIcon className="text-base" />
              {loading ? 'Generating…' : script ? 'Regenerate' : 'Generate Script'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-6">
        {!activeDoc ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
            <HeadphonesIcon className="text-5xl mb-3 opacity-30" />
            <p className="text-sm font-medium">Upload a document to generate a podcast script</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
            <Spinner />
            <span className="text-sm">Writing your podcast script…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm mt-8">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !script ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400 max-w-xs">
            <HeadphonesIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Listen to your document</p>
            <p className="text-sm">Generate a podcast-style audio script and play it back with text-to-speech.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col gap-5">
            {/* Player card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <HeadphonesIcon className="text-2xl text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{activeDoc.fileName}</p>
                  <p className="text-xs text-slate-400">Podcast Episode</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">
                    {utteranceIndex >= 0 ? `Sentence ${utteranceIndex + 1} / ${sentences.length}` : 'Not started'}
                  </span>
                  <span className="text-[10px] text-slate-400">{progress}%</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={stop}
                  disabled={!playing && utteranceIndex < 0}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                  title="Stop"
                >
                  <StopIcon className="text-xl text-slate-600" />
                </button>
                {!hasTTS ? (
                  <p className="text-sm text-slate-400">TTS not supported in this browser</p>
                ) : playing ? (
                  <button
                    type="button"
                    onClick={pause}
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-colors"
                    title="Pause"
                  >
                    <PauseIcon className="text-3xl text-white" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={utteranceIndex >= 0 ? resume : play}
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-colors"
                    title="Play"
                  >
                    <PlayArrowIcon className="text-3xl text-white" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { stop(); setUtteranceIndex(0); }}
                  disabled={utteranceIndex === 0}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center transition-colors text-xs font-bold text-slate-600"
                  title="Restart"
                >
                  ↺
                </button>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Transcript</p>
              <div className="text-sm text-slate-700 leading-relaxed space-y-0.5">
                {sentences.length > 0
                  ? sentences.map((s, i) => (
                    <span
                      key={i}
                      className={`transition-colors ${i === utteranceIndex ? 'bg-emerald-100 text-emerald-900 rounded px-0.5' : ''}`}
                    >
                      {s}{' '}
                    </span>
                  ))
                  : <p>{script}</p>
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
