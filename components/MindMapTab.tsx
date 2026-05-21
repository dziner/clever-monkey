import * as React from 'react';
import type { DocumentData, MindMapData } from '../types';
import { generateMindMap } from '../services/geminiService';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { AccountTreeIcon, AutoAwesomeIcon, ZoomInIcon, ZoomOutIcon, FitScreenIcon } from './icons';
import { Spinner } from './Spinner';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3.0;

const COLORS = [
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', accent: '#3b82f6' },
  { bg: '#f0fdf4', border: '#86efac', text: '#166534', accent: '#22c55e' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8', accent: '#a855f7' },
  { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', accent: '#f59e0b' },
  { bg: '#fff1f2', border: '#fda4af', text: '#9f1239', accent: '#f43f5e' },
  { bg: '#ecfeff', border: '#67e8f9', text: '#155e75', accent: '#06b6d4' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', accent: '#f97316' },
];

const CANVAS_W = 860;
const CANVAS_H = 580;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;
const RADIUS = 210;

function getBranchPos(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

const MindMapCanvas: React.FC<{ data: MindMapData }> = ({ data }) => {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const toggleBranch = (i: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const total = data.branches.length;

  return (
    <div
      className="relative select-none"
      style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W, minHeight: CANVAS_H }}
    >
      <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H}>
        {data.branches.map((_, i) => {
          const { x, y } = getBranchPos(i, total);
          const color = COLORS[i % COLORS.length];
          return (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={x} y2={y}
              stroke={color.accent}
              strokeWidth={2}
              strokeOpacity={0.5}
              strokeDasharray="4 3"
            />
          );
        })}
      </svg>

      {/* Center node */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: CX, top: CY, transform: 'translate(-50%, -50%)', zIndex: 10 }}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl px-5 py-3 text-center shadow-xl max-w-[140px]">
          <AccountTreeIcon className="text-2xl text-violet-400 mb-1" />
          <p className="text-sm font-bold leading-tight">{data.center}</p>
        </div>
      </div>

      {/* Branch nodes */}
      {data.branches.map((branch, i) => {
        const { x, y } = getBranchPos(i, total);
        const color = COLORS[i % COLORS.length];
        const isOpen = expanded.has(i);

        return (
          <div
            key={i}
            className="absolute"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: 20 }}
          >
            <button
              type="button"
              onClick={() => toggleBranch(i)}
              className="rounded-xl border-2 shadow-md transition-all hover:shadow-lg active:scale-95 max-w-[160px] w-[160px] text-left"
              style={{ background: color.bg, borderColor: color.border }}
            >
              <div className="px-3 py-2">
                <p className="text-xs font-bold leading-snug" style={{ color: color.text }}>
                  {branch.label}
                </p>
                {isOpen && (
                  <ul className="mt-1.5 space-y-0.5">
                    {branch.children.map((child, ci) => (
                      <li key={ci} className="flex items-start gap-1 text-xs text-slate-600">
                        <span className="mt-0.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: color.accent }} />
                        <span className="leading-tight">{child}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] mt-1 opacity-50" style={{ color: color.text }}>
                  {isOpen ? 'tap to collapse' : `${branch.children.length} concepts — tap`}
                </p>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface MindMapTabProps {
  document: DocumentData;
}

export const MindMapTab: React.FC<MindMapTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = React.useState(1);
  const [userZoom, setUserZoom] = React.useState(1);

  const { data, loading, error, generate, cancel } = useAIGeneration<MindMapData>(
    React.useCallback(
      (signal) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        return generateMindMap(document.documentContent, document.model, signal);
      },
      [document.documentContent, document.model]
    )
  );

  // Persist generated data
  React.useEffect(() => {
    if (data) {
      dispatch({
        type: 'UPDATE_DOCUMENT',
        payload: { docId: document.id, updates: { mindMapData: data } },
      });
    }
  }, [data, document.id, dispatch]);

  React.useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width - 32;
        setCanvasScale(w < CANVAS_W ? w / CANVAS_W : 1);
      }
    });
    if (bodyRef.current) obs.observe(bodyRef.current);
    return () => obs.disconnect();
  }, []);

  const displayData = data ?? document.mindMapData ?? null;
  const effectiveScale = canvasScale * userZoom;

  const zoomIn  = () => setUserZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))));
  const zoomOut = () => setUserZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))));
  const zoomFit = () => setUserZoom(1);

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
        <AccountTreeIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">Document content not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <AccountTreeIcon className="text-xl text-violet-500" />
          <span className="font-semibold text-slate-700 text-sm">Mind Map</span>
        </div>
        <div className="flex items-center gap-2">
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
                className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 opacity-50 text-white rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <AutoAwesomeIcon className="text-sm" />
                Generating…
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <AutoAwesomeIcon className="text-sm" />
              {displayData ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex-1 overflow-auto relative">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500 mt-8">
            <Spinner />
            <span className="text-sm">Building mind map…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm mt-8 mx-auto">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !displayData ? (
          <div className="text-center text-slate-400 max-w-xs mt-8 mx-auto p-4">
            <AccountTreeIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Visualize your document</p>
            <p className="text-sm">Click Generate to build an interactive mind map of key concepts.</p>
          </div>
        ) : (
          <>
            {/* Scroll area sized to match visual canvas */}
            <div
              className="flex items-start justify-center p-4"
              style={{ minWidth: 'fit-content' }}
            >
              <div
                style={{
                  width: CANVAS_W * effectiveScale,
                  height: CANVAS_H * effectiveScale,
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: CANVAS_W,
                    height: CANVAS_H,
                    transform: `scale(${effectiveScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                  }}
                >
                  <MindMapCanvas data={displayData} />
                </div>
              </div>
            </div>

            {/* Zoom controls — floating bottom-right */}
            <div className="absolute bottom-4 right-4 z-30 flex items-center bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={zoomOut}
                disabled={userZoom <= ZOOM_MIN}
                title="Zoom out"
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomOutIcon className="text-lg" />
              </button>
              <button
                type="button"
                onClick={zoomFit}
                title="Fit to window"
                className="px-2 py-2 text-xs font-mono font-semibold text-slate-600 hover:bg-slate-100 transition-colors min-w-[46px] text-center border-x border-slate-200"
              >
                {Math.round(effectiveScale * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={userZoom >= ZOOM_MAX}
                title="Zoom in"
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomInIcon className="text-lg" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={zoomFit}
                title="Reset zoom"
                className="p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <FitScreenIcon className="text-lg" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
