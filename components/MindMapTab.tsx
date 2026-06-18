import * as React from 'react';
import type { DocumentData, MindMapData, MindMapNode } from '../types';
import { generateMindMap } from '../services/geminiService';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { aiJobBusyMessage, useAiJobGate } from '../contexts/AiJobContext';
import { AccountTreeIcon, AutoAwesomeIcon, ZoomInIcon, ZoomOutIcon, FitScreenIcon } from './icons';
import { Spinner } from './Spinner';
import { t } from '../services/uiStrings';
import { getPinchTransform, getZoomAtPointTransform, type PinchStart, type Point } from '../utils/panZoom';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.2;

type InteractionMode = 'idle' | 'pan' | 'pinch';

// Depth-based color ramp (root uses dark slate, deeper levels cycle).
const COLORS = [
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', accent: '#3b82f6' },
  { bg: '#f0fdf4', border: '#86efac', text: '#166534', accent: '#22c55e' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8', accent: '#a855f7' },
  { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', accent: '#f59e0b' },
  { bg: '#fff1f2', border: '#fda4af', text: '#9f1239', accent: '#f43f5e' },
  { bg: '#ecfeff', border: '#67e8f9', text: '#155e75', accent: '#06b6d4' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', accent: '#f97316' },
];

// ── Normalize legacy / loose data into a strict MindMapNode tree ──────────────
// Old shape: branches: [{ label, children: string[] }]  → children become leaf nodes.
function normalizeNode(raw: unknown): MindMapNode {
  if (typeof raw === 'string') return { label: raw };
  if (raw && typeof raw === 'object') {
    const r = raw as { label?: unknown; children?: unknown };
    const label = typeof r.label === 'string' ? r.label : '';
    const children = Array.isArray(r.children) ? r.children.map(normalizeNode) : undefined;
    return children && children.length > 0 ? { label, children } : { label };
  }
  return { label: String(raw ?? '') };
}

function normalizeData(data: MindMapData): { center: string; branches: MindMapNode[] } {
  return {
    center: data.center || 'Mind Map',
    branches: Array.isArray(data.branches) ? data.branches.map(normalizeNode) : [],
  };
}

// ── Connector column: the rail + horizontal stub linking a parent to a child ──
const ConnectorColumn: React.FC<{
  isFirst: boolean;
  isLast: boolean;
  single: boolean;
  accent: string;
}> = ({ isFirst, isLast, single, accent }) => (
  <div className="relative w-6 flex-shrink-0 self-stretch">
    {/* Vertical rail spanning siblings (hidden for a lone child) */}
    {!single && (
      <div
        className="absolute left-0 w-[2px]"
        style={{
          background: '#cbd5e1',
          top: isFirst ? '50%' : 0,
          bottom: isLast ? '50%' : 0,
        }}
      />
    )}
    {/* Horizontal stub into the child, in the child's accent color */}
    <div
      className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
      style={{ background: accent, opacity: 0.6 }}
    />
  </div>
);

// ── Recursive tree node ───────────────────────────────────────────────────────
const TreeNode: React.FC<{ node: MindMapNode; depth: number }> = ({ node, depth }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const color = COLORS[depth % COLORS.length];
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isRoot = depth === 0;

  return (
    <div className="flex items-center">
      {/* Node card */}
      <button
        type="button"
        onClick={() => hasChildren && setCollapsed(c => !c)}
        className={[
          'flex-shrink-0 text-left transition-shadow',
          hasChildren ? 'cursor-pointer' : 'cursor-default',
          isRoot
            ? 'rounded-2xl px-5 py-3 shadow-md max-w-[220px] bg-ink-900 text-white'
            : 'rounded-xl px-3.5 py-2 shadow-sm border-2 max-w-[260px]',
        ].join(' ')}
        style={
          isRoot
            ? undefined
            : { background: color.bg, borderColor: color.border }
        }
      >
        <div className="flex items-center gap-1.5">
          {isRoot && <AccountTreeIcon className="text-base text-brand-300 flex-shrink-0" />}
          <span
            className={isRoot ? 'text-sm font-bold leading-snug' : 'text-[13px] font-semibold leading-snug'}
            style={isRoot ? undefined : { color: color.text }}
          >
            {node.label}
          </span>
        </div>
        {/* Collapsed-children indicator */}
        {hasChildren && collapsed && (
          <span
            className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold"
            style={{ color: isRoot ? '#cbd5e1' : color.accent }}
          >
            +{children.length}
          </span>
        )}
      </button>

      {/* Children */}
      {hasChildren && !collapsed && (
        <>
          {/* Trunk from this node into the child rail */}
          <div className="w-5 h-[2px] flex-shrink-0 rounded-full" style={{ background: color.accent, opacity: 0.6 }} />
          <div className="flex flex-col">
            {children.map((child, i) => {
              const childColor = COLORS[(depth + 1) % COLORS.length];
              return (
                <div key={i} className="flex items-stretch">
                  <ConnectorColumn
                    isFirst={i === 0}
                    isLast={i === children.length - 1}
                    single={children.length === 1}
                    accent={childColor.accent}
                  />
                  <div className="py-1.5">
                    <TreeNode node={child} depth={depth + 1} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const MindMapTree: React.FC<{ data: MindMapData }> = ({ data }) => {
  const normalized = React.useMemo(() => normalizeData(data), [data]);
  const rootNode: MindMapNode = { label: normalized.center, children: normalized.branches };
  return (
    <div className="inline-flex p-10 select-none">
      <TreeNode node={rootNode} depth={0} />
    </div>
  );
};

// ── Pan/zoom canvas — standard mind-map controls ──────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface CanvasHandle {
  zoomBy: (factor: number) => void;
  fit: () => void;
  getZoom: () => number;
}

const PanZoomCanvas = React.forwardRef<CanvasHandle, {
  children: React.ReactNode;
  onZoomChange?: (z: number) => void;
  onTouchGestureSupportChange?: (supported: boolean) => void;
}>(
  ({ children, onZoomChange, onTouchGestureSupportChange }, ref) => {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = React.useState(false);
    const [supportsTouchGestures, setSupportsTouchGestures] = React.useState(false);

    // Pan gesture bookkeeping
    const panStart = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const movedRef = React.useRef(false);
    const activePointersRef = React.useRef(new Map<number, Point>());
    const interactionModeRef = React.useRef<InteractionMode>('idle');
    const zoomRef = React.useRef(zoom);
    const panRef = React.useRef(pan);
    const pinchStartRef = React.useRef<PinchStart | null>(null);

    React.useEffect(() => { onZoomChange?.(zoom); }, [zoom, onZoomChange]);

    React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
    React.useEffect(() => { panRef.current = pan; }, [pan]);

    React.useEffect(() => {
      const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)');
      const update = () => {
        const supported = Boolean(
          navigator.maxTouchPoints > 0 ||
          coarsePointerQuery?.matches,
        );
        setSupportsTouchGestures(supported);
        onTouchGestureSupportChange?.(supported);
      };

      update();
      if (coarsePointerQuery?.addEventListener) {
        coarsePointerQuery.addEventListener('change', update);
        return () => coarsePointerQuery.removeEventListener('change', update);
      }
      coarsePointerQuery?.addListener?.(update);
      return () => coarsePointerQuery?.removeListener?.(update);
    }, [onTouchGestureSupportChange]);

    const updateZoom = React.useCallback((nextZoom: number) => {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    }, []);

    const updatePan = React.useCallback((nextPan: Point) => {
      panRef.current = nextPan;
      setPan(nextPan);
    }, []);

    const viewportPointFromEvent = React.useCallback((e: React.PointerEvent): Point => {
      const vp = viewportRef.current;
      if (!vp) return { x: e.clientX, y: e.clientY };
      const rect = vp.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const zoomAtPoint = React.useCallback((point: Point, nextZoomRaw: number) => {
      const next = getZoomAtPointTransform(
        { zoom: zoomRef.current, pan: panRef.current },
        point,
        nextZoomRaw,
        ZOOM_MIN,
        ZOOM_MAX,
      );
      updateZoom(next.zoom);
      updatePan(next.pan);
    }, [updatePan, updateZoom]);

    const beginPinch = React.useCallback(() => {
      const points = Array.from(activePointersRef.current.values());
      if (points.length < 2) return;
      const [a, b] = points;
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      pinchStartRef.current = {
        startDistance: distance,
        startZoom: currentZoom,
        contentPoint: {
          x: (center.x - currentPan.x) / currentZoom,
          y: (center.y - currentPan.y) / currentZoom,
        },
      };
      interactionModeRef.current = 'pinch';
      movedRef.current = true;
      setIsPanning(true);
    }, []);

    // Fit the content into the viewport (centered).
    const fit = React.useCallback(() => {
      const vp = viewportRef.current;
      const content = contentRef.current;
      if (!vp || !content) return;
      const cw = content.scrollWidth;
      const ch = content.scrollHeight;
      if (cw === 0 || ch === 0) return;
      const pad = 48;
      const scale = clamp(
        Math.min((vp.clientWidth - pad) / cw, (vp.clientHeight - pad) / ch),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      const z = Math.min(scale, 1); // never upscale on fit
      updateZoom(z);
      updatePan({
        x: (vp.clientWidth - cw * z) / 2,
        y: (vp.clientHeight - ch * z) / 2,
      });
    }, [updatePan, updateZoom]);

    // Zoom around the viewport center by a multiplicative factor (for buttons).
    const zoomBy = React.useCallback((factor: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      zoomAtPoint(
        { x: vp.clientWidth / 2, y: vp.clientHeight / 2 },
        zoomRef.current * factor,
      );
    }, [zoomAtPoint]);

    React.useImperativeHandle(ref, () => ({ zoomBy, fit, getZoom: () => zoom }), [zoomBy, fit, zoom]);

    // Fit once content is first measured.
    const didInitialFit = React.useRef(false);
    React.useEffect(() => {
      if (didInitialFit.current) return;
      const content = contentRef.current;
      if (!content) return;
      // Wait a frame so layout settles before measuring.
      const id = requestAnimationFrame(() => {
        if (content.scrollWidth > 0) {
          fit();
          didInitialFit.current = true;
        }
      });
      return () => cancelAnimationFrame(id);
    });

    // Wheel zoom centered on the pointer (preventDefault needs a non-passive listener).
    React.useEffect(() => {
      const vp = viewportRef.current;
      if (!vp) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0015); // smooth, trackpad-friendly
        zoomAtPoint({ x: mx, y: my }, zoomRef.current * factor);
      };
      vp.addEventListener('wheel', onWheel, { passive: false });
      return () => vp.removeEventListener('wheel', onWheel);
    }, [zoomAtPoint]);

    // Pointer drag to pan; two active touch pointers pinch-zoom around their midpoint.
    const onPointerDown = (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointer may already be captured */ }
      setIsPanning(true);
      movedRef.current = false;

      if (e.pointerType === 'touch') {
        activePointersRef.current.set(e.pointerId, viewportPointFromEvent(e));
        if (activePointersRef.current.size >= 2) {
          beginPinch();
          return;
        }
      }

      interactionModeRef.current = 'pan';
      panStart.current = {
        ...viewportPointFromEvent(e),
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    };
    const onPointerMove = (e: React.PointerEvent) => {
      if (e.pointerType === 'touch' && activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, viewportPointFromEvent(e));
      }

      if (interactionModeRef.current === 'pinch') {
        const points = Array.from(activePointersRef.current.values());
        const pinchStart = pinchStartRef.current;
        if (points.length < 2 || !pinchStart) return;
        const [a, b] = points;
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const next = getPinchTransform(pinchStart, center, distance, ZOOM_MIN, ZOOM_MAX);
        updateZoom(next.zoom);
        updatePan(next.pan);
        return;
      }

      if (interactionModeRef.current !== 'pan') return;
      const point = viewportPointFromEvent(e);
      const dx = point.x - panStart.current.x;
      const dy = point.y - panStart.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
      updatePan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    };
    const endPan = (e: React.PointerEvent) => {
      try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* pointer may already be released */ }

      if (e.pointerType === 'touch') {
        activePointersRef.current.delete(e.pointerId);
        if (activePointersRef.current.size >= 2) {
          beginPinch();
          return;
        }
        if (activePointersRef.current.size === 1) {
          const remaining = Array.from(activePointersRef.current.values())[0];
          interactionModeRef.current = 'pan';
          pinchStartRef.current = null;
          panStart.current = {
            x: remaining.x,
            y: remaining.y,
            panX: panRef.current.x,
            panY: panRef.current.y,
          };
          setIsPanning(true);
          return;
        }
      }

      interactionModeRef.current = 'idle';
      pinchStartRef.current = null;
      setIsPanning(false);
    };

    // Suppress node clicks that were actually the end of a pan drag.
    const onClickCapture = (e: React.MouseEvent) => {
      if (movedRef.current) {
        e.stopPropagation();
        e.preventDefault();
        movedRef.current = false;
      }
    };

    return (
      <div
        ref={viewportRef}
        className={`relative w-full h-full overflow-hidden bg-ink-50 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        data-touch-gestures={supportsTouchGestures ? 'true' : 'false'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClickCapture={onClickCapture}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: 'fit-content',
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);
PanZoomCanvas.displayName = 'PanZoomCanvas';

interface MindMapTabProps {
  document: DocumentData;
}

export const MindMapTab: React.FC<MindMapTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();
  const { userProfile } = useUser();
  const aiJobGate = useAiJobGate();
  const language = userProfile?.language ?? null;
  const canvasRef = React.useRef<CanvasHandle>(null);
  const [zoomPct, setZoomPct] = React.useState(100);
  const [touchGestureHint, setTouchGestureHint] = React.useState(false);
  const [gateError, setGateError] = React.useState<string | null>(null);

  const { data, loading, error, generate, cancel } = useAIGeneration<MindMapData>(
    React.useCallback(
      (signal) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        return generateMindMap(document.documentContent, document.model, signal, language);
      },
      [document.documentContent, document.model, language]
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

  const displayData = data ?? document.mindMapData ?? null;
  const activeAiJob = aiJobGate.activeJob;
  const isBlockedByAiJob = Boolean(activeAiJob);
  const activeAiJobMessage = activeAiJob ? aiJobBusyMessage(activeAiJob) : null;

  const handleGenerate = React.useCallback(() => {
    const aiJobLease = aiJobGate.tryStartJob({
      kind: 'mindmap',
      documentId: document.id,
      label: '마인드맵 생성',
    });
    if (aiJobLease.ok === false) {
      setGateError(aiJobBusyMessage(aiJobLease.activeJob));
      return;
    }
    setGateError(null);
    void generate().finally(aiJobLease.finish);
  }, [aiJobGate, document.id, generate]);

  // Re-fit the canvas whenever the tree content changes (e.g. Regenerate).
  React.useEffect(() => {
    if (!displayData) return;
    const id = requestAnimationFrame(() => canvasRef.current?.fit());
    return () => cancelAnimationFrame(id);
  }, [displayData]);

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-ink-400 p-6">
        <AccountTreeIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">{t('podcast.documentMissing', language)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-white">
        <div className="flex items-center gap-2">
          <AccountTreeIcon className="text-xl text-brand-500" />
          <span className="font-semibold text-ink-700 text-sm">Mind Map</span>
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
              onClick={handleGenerate}
              disabled={isBlockedByAiJob}
              title={activeAiJobMessage ?? undefined}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AutoAwesomeIcon className="text-sm" />
              {displayData ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>
      </div>
      {gateError && displayData && !loading && !error && (
        <div className="flex-shrink-0 border-b border-ink-100 bg-ink-50 px-4 py-2 text-center text-xs font-medium text-ink-500">
          {gateError}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 relative min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-500">
            <Spinner />
            <span className="text-sm">Building mind map…</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-danger-500 text-sm max-w-sm mx-auto px-6">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : gateError && !displayData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-ink-500 text-sm max-w-sm mx-auto px-6">
            <p>{gateError}</p>
          </div>
        ) : !displayData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-ink-400 max-w-xs mx-auto p-4">
            <AccountTreeIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-ink-700 mb-1">Visualize your document</p>
            <p className="text-sm">Click Generate to build an interactive mind map of key concepts.</p>
          </div>
        ) : (
          <PanZoomCanvas
            ref={canvasRef}
            onZoomChange={(z) => setZoomPct(Math.round(z * 100))}
            onTouchGestureSupportChange={setTouchGestureHint}
          >
            <MindMapTree data={displayData} />
          </PanZoomCanvas>
        )}
      </div>

      {/* Hint + zoom controls */}
      {displayData && !loading && !error && (
        <>
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <span className="text-[11px] text-ink-400 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-ink-200">
              {touchGestureHint ? '한 손가락으로 이동 · 두 손가락으로 확대/축소' : '드래그로 이동 · 스크롤로 확대/축소'}
            </span>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center bg-white/95 backdrop-blur-sm border border-ink-200 rounded-xl shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomBy(1 / (1 + ZOOM_STEP))}
              title="Zoom out"
              className="p-2 text-ink-700 hover:bg-ink-100 transition-colors"
            >
              <ZoomOutIcon className="text-lg" />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.fit()}
              title="Fit to window"
              className="px-2 py-2 text-xs font-mono font-semibold text-ink-700 hover:bg-ink-100 transition-colors min-w-[46px] text-center border-x border-ink-200"
            >
              {zoomPct}%
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomBy(1 + ZOOM_STEP)}
              title="Zoom in"
              className="p-2 text-ink-700 hover:bg-ink-100 transition-colors"
            >
              <ZoomInIcon className="text-lg" />
            </button>
            <div className="w-px h-5 bg-ink-200 mx-0.5" />
            <button
              type="button"
              onClick={() => canvasRef.current?.fit()}
              title="Fit to window"
              className="p-2 text-ink-500 hover:bg-ink-100 transition-colors"
            >
              <FitScreenIcon className="text-lg" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
