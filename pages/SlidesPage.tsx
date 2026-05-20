import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { generateSlides, SlideData } from '../services/geminiService';
import { MenuIcon, SlideshowIcon, ChevronLeftIcon, ChevronRightIcon, AutoAwesomeIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';


const SLIDE_COUNT_OPTIONS = [5, 8, 10, 12] as const;

const SLIDE_THEMES = [
  { bg: 'from-slate-900 to-slate-800', text: 'text-white', bullet: 'bg-indigo-400', accent: 'text-indigo-300' },
  { bg: 'from-indigo-900 to-indigo-800', text: 'text-white', bullet: 'bg-cyan-400', accent: 'text-cyan-300' },
  { bg: 'from-emerald-900 to-emerald-800', text: 'text-white', bullet: 'bg-emerald-300', accent: 'text-emerald-200' },
  { bg: 'from-violet-900 to-violet-800', text: 'text-white', bullet: 'bg-pink-400', accent: 'text-pink-300' },
];

interface Props { onMenuClick: () => void; }

export const SlidesPage: React.FC<Props> = ({ onMenuClick }) => {
  const { state } = useDocuments();
  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);

  const [data, setData] = React.useState<SlideData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slideCount, setSlideCount] = React.useState<number>(8);
  const [current, setCurrent] = React.useState(0);
  const [presenting, setPresenting] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const dataRef = React.useRef(data);
  React.useEffect(() => { dataRef.current = data; }, [data]);

  const handleGenerate = React.useCallback(async () => {
    if (!activeDoc?.documentContent) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await generateSlides(activeDoc.documentContent, activeDoc.model, slideCount, abortRef.current.signal);
      setData(result);
      setCurrent(0);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message ?? 'Failed to generate slides.');
    } finally {
      setLoading(false);
    }
  }, [activeDoc, slideCount]);

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => data && setCurrent(c => Math.min(data.slides.length - 1, c + 1));

  React.useEffect(() => {
    if (!presenting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrent(c => dataRef.current ? Math.min(dataRef.current.slides.length - 1, c + 1) : c);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrent(c => Math.max(0, c - 1));
      if (e.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presenting]);

  const theme = SLIDE_THEMES[(current) % SLIDE_THEMES.length];
  const slide = data?.slides[current];

  if (presenting && data && slide) {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br ${theme.bg} p-8`}
        onClick={next}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPresenting(false); }}
          className="absolute top-4 right-4 text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
        >
          ESC / Exit
        </button>
        <div className="max-w-3xl w-full text-center">
          <div className="text-8xl mb-6">{slide.emoji}</div>
          <h2 className={`text-4xl font-bold mb-8 ${theme.text}`}>{slide.heading}</h2>
          <ul className="space-y-4 text-left max-w-2xl mx-auto">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-2 w-2 h-2 rounded-full flex-shrink-0 ${theme.bullet}`} />
                <span className={`text-xl leading-snug ${theme.text} opacity-90`}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute bottom-6 flex items-center gap-4">
          {data.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/30'}`}
            />
          ))}
        </div>
        <p className="absolute bottom-4 right-4 text-white/30 text-xs">Click anywhere to advance</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <button type="button" onClick={onMenuClick} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          <MenuIcon className="text-xl" />
        </button>
        <SlideshowIcon className="text-2xl text-indigo-500" />
        <div>
          <h1 className="font-bold text-slate-800 text-base leading-tight">Slides</h1>
          {activeDoc && <p className="text-xs text-slate-400 truncate max-w-xs">{activeDoc.fileName}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {activeDoc?.documentContent && (
            <>
              {!loading && (
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                  {SLIDE_COUNT_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSlideCount(n)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${slideCount === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {loading ? (
                <>
                  <button type="button" onClick={() => abortRef.current?.abort()} className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button type="button" disabled className="flex items-center gap-2 px-4 py-2 bg-indigo-600 opacity-50 text-white rounded-xl text-sm font-semibold cursor-not-allowed">
                    <AutoAwesomeIcon className="text-base" />
                    Generating…
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  <AutoAwesomeIcon className="text-base" />
                  {data ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-6">
        {!activeDoc ? (
          <div className="text-center text-slate-400">
            <SlideshowIcon className="text-5xl mb-3 opacity-30" />
            <p className="text-sm font-medium">Upload a document to generate slides</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Spinner />
            <span className="text-sm">Generating {slideCount} slides…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="text-center text-slate-400 max-w-xs">
            <SlideshowIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Turn your document into slides</p>
            <p className="text-sm">Choose slide count and click Generate to create a presentation.</p>
          </div>
        ) : (
          <>
            {/* Slide preview */}
            <div className="w-full max-w-2xl">
              <p className="text-center text-xs text-slate-400 mb-2 font-medium">{data.title}</p>
              <div className={`rounded-2xl bg-gradient-to-br ${theme.bg} p-8 shadow-2xl aspect-video flex flex-col justify-center`}>
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-5xl">{slide?.emoji}</span>
                  <h2 className="text-2xl font-bold text-white leading-tight">{slide?.heading}</h2>
                </div>
                <ul className="space-y-3">
                  {slide?.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.bullet}`} />
                      <span className="text-sm text-white/90 leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-4">
                <button type="button" onClick={prev} disabled={current === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors">
                  <ChevronLeftIcon className="text-lg" /> Prev
                </button>
                <div className="flex items-center gap-1.5">
                  {data.slides.map((_, i) => (
                    <button key={i} type="button" onClick={() => setCurrent(i)}
                      className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'}`} />
                  ))}
                </div>
                <button type="button" onClick={next} disabled={current === data.slides.length - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors">
                  Next <ChevronRightIcon className="text-lg" />
                </button>
              </div>

              <div className="flex justify-center mt-3">
                <button type="button" onClick={() => setPresenting(true)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                  Present Fullscreen
                </button>
              </div>
            </div>

            {/* Slide list */}
            <div className="w-full max-w-2xl mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.slides.map((s, i) => {
                const t = SLIDE_THEMES[i % SLIDE_THEMES.length];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`rounded-xl p-3 text-left bg-gradient-to-br ${t.bg} transition-all hover:scale-105 ${i === current ? 'ring-2 ring-indigo-400' : ''}`}
                  >
                    <div className="text-2xl mb-1">{s.emoji}</div>
                    <p className="text-xs font-bold text-white leading-tight truncate">{s.heading}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{i + 1} / {data.slides.length}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
