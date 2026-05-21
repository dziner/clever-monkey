import * as React from 'react';
import type { DocumentData, SlideData } from '../types';
import { generateSlides } from '../services/geminiService';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { SlideshowIcon, ChevronLeftIcon, ChevronRightIcon, AutoAwesomeIcon } from './icons';
import { Spinner } from './Spinner';

const SLIDE_COUNT_OPTIONS = [5, 8, 10, 12] as const;

const SLIDE_THEMES = [
  { bg: 'from-slate-900 to-slate-800', text: 'text-white', bullet: 'bg-indigo-400', accent: 'text-indigo-300' },
  { bg: 'from-indigo-900 to-indigo-800', text: 'text-white', bullet: 'bg-cyan-400', accent: 'text-cyan-300' },
  { bg: 'from-emerald-900 to-emerald-800', text: 'text-white', bullet: 'bg-emerald-300', accent: 'text-emerald-200' },
  { bg: 'from-violet-900 to-violet-800', text: 'text-white', bullet: 'bg-pink-400', accent: 'text-pink-300' },
];

interface SlidesTabProps {
  document: DocumentData;
}

export const SlidesTab: React.FC<SlidesTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();
  const [slideCount, setSlideCount] = React.useState<number>(8);
  const [current, setCurrent] = React.useState(0);

  const { data, loading, error, generate, cancel } = useAIGeneration<SlideData>(
    React.useCallback(
      (signal) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        return generateSlides(document.documentContent, document.model, slideCount, signal);
      },
      [document.documentContent, document.model, slideCount]
    )
  );

  // Persist generated data
  React.useEffect(() => {
    if (data) {
      dispatch({
        type: 'UPDATE_DOCUMENT',
        payload: { docId: document.id, updates: { slidesData: data } },
      });
    }
  }, [data, document.id, dispatch]);

  // Reset to first slide when new presentation is generated
  React.useEffect(() => { if (data) setCurrent(0); }, [data]);

  const displayData = data ?? document.slidesData ?? null;
  const theme = SLIDE_THEMES[current % SLIDE_THEMES.length];
  const slide = displayData?.slides[current];

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => displayData && setCurrent(c => Math.min(displayData.slides.length - 1, c + 1));

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
        <SlideshowIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">Document content not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white gap-2">
        <div className="flex items-center gap-2">
          <SlideshowIcon className="text-xl text-indigo-500" />
          <span className="font-semibold text-slate-700 text-sm">Slides</span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {SLIDE_COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSlideCount(n)}
                  className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors ${slideCount === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <>
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 opacity-50 text-white rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <AutoAwesomeIcon className="text-sm" />
                Generating…
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <AutoAwesomeIcon className="text-sm" />
              {displayData ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500 mt-8">
            <Spinner />
            <span className="text-sm">Generating {slideCount} slides…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm mt-8">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !displayData ? (
          <div className="text-center text-slate-400 max-w-xs mt-8">
            <SlideshowIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Turn your document into slides</p>
            <p className="text-sm">Choose slide count and click Generate to create a presentation.</p>
          </div>
        ) : (
          <>
            <div className="w-full max-w-lg">
              <p className="text-center text-xs text-slate-400 mb-2 font-medium">{displayData.title}</p>
              <div className={`rounded-2xl bg-gradient-to-br ${theme.bg} p-6 shadow-xl aspect-video flex flex-col justify-center`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-4xl">{slide?.emoji}</span>
                  <h2 className="text-xl font-bold text-white leading-tight">{slide?.heading}</h2>
                </div>
                <ul className="space-y-2">
                  {slide?.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.bullet}`} />
                      <span className="text-sm text-white/90 leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={prev}
                  disabled={current === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeftIcon className="text-base" /> Prev
                </button>
                <div className="flex items-center gap-1">
                  {displayData.slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`rounded-full transition-all ${i === current ? 'w-4 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={next}
                  disabled={current === displayData.slides.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  Next <ChevronRightIcon className="text-base" />
                </button>
              </div>
            </div>

            {/* Slide list */}
            <div className="w-full max-w-lg mt-4 grid grid-cols-3 gap-2">
              {displayData.slides.map((s, i) => {
                const t = SLIDE_THEMES[i % SLIDE_THEMES.length];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`rounded-xl p-2 text-left bg-gradient-to-br ${t.bg} transition-all hover:scale-105 ${i === current ? 'ring-2 ring-indigo-400' : ''}`}
                  >
                    <div className="text-xl mb-0.5">{s.emoji}</div>
                    <p className="text-xs font-bold text-white leading-tight truncate">{s.heading}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{i + 1} / {displayData.slides.length}</p>
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
