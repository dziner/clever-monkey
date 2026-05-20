import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { generateMindMap, MindMapData } from '../services/geminiService';
import { MenuIcon, AccountTreeIcon, AutoAwesomeIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';

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

interface Props { onMenuClick: () => void; }

export const MindMapPage: React.FC<Props> = ({ onMenuClick }) => {
  const { state } = useDocuments();
  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);

  const [data, setData] = React.useState<MindMapData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Body
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = React.useState(1);

  React.useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width - 32; // account for p-4
        setCanvasScale(w < CANVAS_W ? w / CANVAS_W : 1);
      }
    });
    if (bodyRef.current) obs.observe(bodyRef.current);
    return () => obs.disconnect();
  }, []);

  const handleGenerate = React.useCallback(async () => {
    if (!activeDoc?.documentContent) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await generateMindMap(activeDoc.documentContent, activeDoc.model, abortRef.current.signal);
      setData(result);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message ?? 'Failed to generate mind map.');
    } finally {
      setLoading(false);
    }
  }, [activeDoc]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <button type="button" onClick={onMenuClick} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          <MenuIcon className="text-xl" />
        </button>
        <AccountTreeIcon className="text-2xl text-violet-500" />
        <div>
          <h1 className="font-bold text-slate-800 text-base leading-tight">Mind Map</h1>
          {activeDoc && <p className="text-xs text-slate-400 truncate max-w-xs">{activeDoc.fileName}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <>
              <button type="button" onClick={() => abortRef.current?.abort()} className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button type="button" disabled className="flex items-center gap-2 px-4 py-2 bg-violet-600 opacity-50 text-white rounded-xl text-sm font-semibold cursor-not-allowed">
                <AutoAwesomeIcon className="text-base" />
                Generating…
              </button>
            </>
          ) : activeDoc?.documentContent ? (
            <button type="button" onClick={handleGenerate} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <AutoAwesomeIcon className="text-base" />
              {data ? 'Regenerate' : 'Generate'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex-1 overflow-auto p-4 flex items-center justify-center">
        {!activeDoc ? (
          <div className="text-center text-slate-400">
            <AccountTreeIcon className="text-5xl mb-3 opacity-30" />
            <p className="text-sm font-medium">Upload a document to generate a mind map</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Spinner />
            <span className="text-sm">Building mind map…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="text-center text-slate-400 max-w-xs">
            <AccountTreeIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Visualize your document</p>
            <p className="text-sm">Click Generate to build an interactive mind map of key concepts.</p>
          </div>
        ) : (
          <div style={{ transform: `scale(${canvasScale})`, transformOrigin: 'top center', width: CANVAS_W, height: CANVAS_H * canvasScale }}>
            <MindMapCanvas data={data} />
          </div>
        )}
      </div>
    </div>
  );
};

const MindMapCanvas: React.FC<{ data: MindMapData }> = ({ data }) => {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleBranch = (i: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const total = data.branches.length;

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W, minHeight: CANVAS_H }}
    >
      {/* SVG lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={CANVAS_W}
        height={CANVAS_H}
      >
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
