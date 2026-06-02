import * as React from 'react';
import { Spinner } from './Spinner';
import { ZoomInIcon, ZoomOutIcon, FitScreenIcon } from './icons';
import type { PDFDocumentProxy, PDFPageViewport } from '../types';

interface PdfViewerProps {
    file: File;
    imageUrl?: string;
    docId: string;
    currentPage?: number;
    onPageChange?: (page: number) => void;
}

interface RenderTask {
    promise?: Promise<void>;
    cancel(): void;
}

const PdfPage: React.FC<{
    pdfDoc: PDFDocumentProxy | null;
    pageNum: number;
    renderScale: number;
    viewScale: number;
}> = React.memo(({ pdfDoc, pageNum, renderScale, viewScale }) => {
    const pdfCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<RenderTask | null>(null);
    const textLayerRef = React.useRef<HTMLDivElement>(null);
    const textRenderTaskRef = React.useRef<RenderTask | null>(null);

    React.useEffect(() => {
        let isCancelled = false;
        const renderPage = async () => {
            const canvas = pdfCanvasRef.current;
            if (!pdfDoc || !canvas || renderScale <= 0) return;

            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch (_) {}
                renderTaskRef.current = null;
            }

            try {
                const page = await pdfDoc.getPage(pageNum);
                if (isCancelled) return;

                const renderViewport = page.getViewport({ scale: renderScale });
                const tempCanvas = document.createElement('canvas');
                const tempContext = tempCanvas.getContext('2d');
                if (!tempContext) return;

                tempCanvas.height = renderViewport.height;
                tempCanvas.width = renderViewport.width;

                const task = page.render({ canvasContext: tempContext, viewport: renderViewport, background: 'white' });
                renderTaskRef.current = task;
                await task.promise;
                if (isCancelled) return;

                const context = canvas.getContext('2d');
                if (!context) return;
                canvas.height = renderViewport.height;
                canvas.width = renderViewport.width;
                context.drawImage(tempCanvas, 0, 0);
            } catch (err: unknown) {
                const e = err as { name?: string };
                if (e.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNum}:`, err);
                }
            } finally {
                renderTaskRef.current = null;
            }
        };

        renderPage();
        return () => {
            isCancelled = true;
            try { renderTaskRef.current?.cancel(); } catch (_) {}
        };
    }, [pdfDoc, pageNum, renderScale]);

    React.useEffect(() => {
        let isCancelled = false;
        const renderTextLayer = async () => {
            const layer = textLayerRef.current;
            if (!pdfDoc || !layer || viewScale <= 0) return;

            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib?.renderTextLayer) return;

            layer.innerHTML = '';

            try {
                const page = await pdfDoc.getPage(pageNum);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale: viewScale });
                const textContentSource = await page.getTextContent();
                if (isCancelled) return;

                const task = pdfjsLib.renderTextLayer({ textContentSource, container: layer, viewport });
                textRenderTaskRef.current = task;
                if (task?.promise) await task.promise;
            } catch (err: unknown) {
                const e = err as { name?: string };
                if (e?.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering text layer ${pageNum}:`, err);
                }
            }
        };

        renderTextLayer();
        return () => {
            isCancelled = true;
            try { textRenderTaskRef.current?.cancel?.(); } catch (_) {}
        };
    }, [pdfDoc, pageNum, viewScale]);

    const textLayerStyle: React.CSSProperties & { ['--scale-factor']?: string } = {
        ['--scale-factor']: String(viewScale),
    };

    return (
        <div className="relative w-full h-full shadow-lg bg-white select-none">
            <canvas ref={pdfCanvasRef} className="w-full h-full block" />
            <div
                ref={textLayerRef}
                className="absolute inset-0 text-transparent z-20 select-text"
                style={textLayerStyle}
            />
        </div>
    );
});


const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4.0;

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, imageUrl, currentPage: externalCurrentPage, onPageChange }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = React.useState(0);
    const [pageViewports, setPageViewports] = React.useState<PDFPageViewport[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [internalCurrentPage, setInternalCurrentPage] = React.useState(1);
    const currentPage = externalCurrentPage ?? internalCurrentPage;

    const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const [textContent, setTextContent] = React.useState<string | null>(null);

    const [fitScale, setFitScale] = React.useState(1.0);
    const [zoomFactor, setZoomFactor] = React.useState(1.0);
    const [renderScale, setRenderScale] = React.useState(1.0);
    const debounceTimerRef = React.useRef<number>();
    const [visiblePages, setVisiblePages] = React.useState<number[]>([]);
    const effectiveScale = fitScale * zoomFactor;

    // Tracks the last page reached by user scrolling so the scrollIntoView effect
    // doesn't fire back in response to onPageChange updates we just triggered.
    const lastUserScrollPageRef = React.useRef(1);
    const activePointers = React.useRef(new Map<number, { x: number; y: number }>()).current;
    const pinchStateRef = React.useRef<{
        startScale: number;
        startDist: number;
        contentOrigin: { x: number; y: number };
        viewportOrigin: { x: number; y: number };
    } | null>(null);

    // Only scroll to a page when externalCurrentPage changes due to external navigation,
    // not when we ourselves reported the position via onPageChange. Compare against
    // lastUserScrollPageRef to tell them apart.
    React.useEffect(() => {
        if (!externalCurrentPage || externalCurrentPage === lastUserScrollPageRef.current) return;
        const pageEl = pageRefs.current[externalCurrentPage - 1];
        if (pageEl && containerRef.current) {
            const rect = pageEl.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
            if (!isVisible) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            lastUserScrollPageRef.current = externalCurrentPage;
            setInternalCurrentPage(externalCurrentPage);
        }
    }, [externalCurrentPage]);

    React.useEffect(() => {
        setIsLoading(true);
        setPdfDoc(null);
        setNumPages(0);
        setInternalCurrentPage(1);

        if (file.type.startsWith('image/')) {
            setIsLoading(false);
            return;
        }

        if (file.type.startsWith('text/')) {
            const reader = new FileReader();
            reader.onload = (e) => { setTextContent(e.target?.result as string); setIsLoading(false); };
            reader.onerror = () => { setError('Failed to read the text file.'); setIsLoading(false); };
            reader.readAsText(file);
            return;
        }

        const loadPdf = async () => {
            try {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) throw new Error('PDF.js library is not loaded.');

                const arrayBuffer = await file.arrayBuffer();
                const doc = await pdfjsLib.getDocument(arrayBuffer).promise;
                setPdfDoc(doc);
                setNumPages(doc.numPages);

                const viewports = await Promise.all(
                    Array.from({ length: doc.numPages }, async (_, i) => {
                        const page = await doc.getPage(i + 1);
                        return page.getViewport({ scale: 1.0 });
                    })
                );
                setPageViewports(viewports);
                pageRefs.current = Array(doc.numPages).fill(null);
            } catch (err: unknown) {
                console.error('Error loading PDF:', err);
                setError((err as { message?: string }).message || 'Failed to load PDF.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPdf();
    }, [file]);

    React.useEffect(() => {
        const calculateFitScale = () => {
            const container = containerRef.current;
            if (!container || pageViewports.length === 0 || container.clientWidth <= 0) return;
            const calculatedScale = (container.clientWidth - 24) / pageViewports[0].width;
            if (Number.isFinite(calculatedScale) && calculatedScale > 0) setFitScale(calculatedScale);
        };

        calculateFitScale();
        const observer = new ResizeObserver(calculateFitScale);
        const el = containerRef.current;
        if (el) observer.observe(el);
        return () => { if (el) observer.unobserve(el); observer.disconnect(); };
    }, [pageViewports]);

    React.useEffect(() => {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => setRenderScale(effectiveScale), 100);
        return () => clearTimeout(debounceTimerRef.current);
    }, [effectiveScale]);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container || numPages === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                setVisiblePages(prev => {
                    const next = new Set(prev);
                    entries.forEach(entry => {
                        const pageNum = Number((entry.target as HTMLElement).dataset.page);
                        if (!pageNum) return;
                        entry.isIntersecting ? next.add(pageNum) : next.delete(pageNum);
                    });
                    return Array.from(next).sort((a, b) => a - b);
                });
            },
            { root: container, rootMargin: '400px 0px', threshold: 0.1 }
        );

        pageRefs.current.forEach((el, i) => {
            if (!el) return;
            el.dataset.page = String(i + 1);
            observer.observe(el);
        });

        return () => observer.disconnect();
    }, [numPages]);

    const pagesToRender = React.useMemo(() => {
        const set = new Set<number>();
        if (numPages === 0) return set;
        const base = visiblePages.length > 0 ? visiblePages : [1];
        base.forEach(p => {
            for (let i = p - 2; i <= p + 2; i++) {
                if (i >= 1 && i <= numPages) set.add(i);
            }
        });
        return set;
    }, [visiblePages, numPages]);

    const clampScale = React.useCallback((v: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v)), []);

    const zoomIn = React.useCallback(() => {
        setZoomFactor(cur => fitScale > 0 ? clampScale(fitScale * cur + ZOOM_STEP) / fitScale : cur);
    }, [fitScale, clampScale]);

    const zoomOut = React.useCallback(() => {
        setZoomFactor(cur => fitScale > 0 ? clampScale(fitScale * cur - ZOOM_STEP) / fitScale : cur);
    }, [fitScale, clampScale]);

    const fitToPage = React.useCallback(() => setZoomFactor(1), []);

    const handleScroll = React.useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const mid = container.scrollTop + container.clientHeight / 2;
        let closest = 0;
        let minDist = Infinity;
        pageRefs.current.forEach((el, i) => {
            if (!el) return;
            const dist = Math.abs(mid - (el.offsetTop + el.offsetHeight / 2));
            if (dist < minDist) { minDist = dist; closest = i; }
        });
        const page = closest + 1;
        lastUserScrollPageRef.current = page;
        setInternalCurrentPage(page);
        onPageChange?.(page);
    }, [onPageChange]);

    const handleWheel = React.useCallback((e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const vpOrigin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const contentOrigin = {
            x: (container.scrollLeft + vpOrigin.x) / effectiveScale,
            y: (container.scrollTop + vpOrigin.y) / effectiveScale,
        };
        const newScale = clampScale(effectiveScale - e.deltaY * 0.005);
        if (fitScale > 0) setZoomFactor(newScale / fitScale);

        requestAnimationFrame(() => {
            container.scrollLeft = contentOrigin.x * newScale - vpOrigin.x;
            container.scrollTop = contentOrigin.y * newScale - vpOrigin.y;
        });
    }, [effectiveScale, fitScale, clampScale]);

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch') return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 2) {
            const container = containerRef.current;
            if (!container) return;
            const pts = Array.from(activePointers.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            const rect = container.getBoundingClientRect();
            const vpOrigin = { x: mid.x - rect.left, y: mid.y - rect.top };
            pinchStateRef.current = {
                startScale: effectiveScale,
                startDist: dist,
                contentOrigin: {
                    x: (container.scrollLeft + vpOrigin.x) / effectiveScale,
                    y: (container.scrollTop + vpOrigin.y) / effectiveScale,
                },
                viewportOrigin: vpOrigin,
            };
        }
    }, [effectiveScale, activePointers]);

    const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch' || activePointers.size !== 2 || !pinchStateRef.current) return;

        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = Array.from(activePointers.values());
        const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const { startScale, startDist, contentOrigin, viewportOrigin } = pinchStateRef.current;
        const clamped = clampScale(startScale * (newDist / startDist));
        if (fitScale > 0) setZoomFactor(clamped / fitScale);

        const container = containerRef.current;
        if (container) {
            container.scrollLeft = contentOrigin.x * clamped - viewportOrigin.x;
            container.scrollTop = contentOrigin.y * clamped - viewportOrigin.y;
        }
    }, [activePointers, clampScale, fitScale]);

    const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch') return;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) pinchStateRef.current = null;
    }, [activePointers]);

    if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    if (error) return <div className="flex items-center justify-center h-full p-4 text-red-600 bg-red-50">{error}</div>;

    return (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-ink-100 relative">
            {/* Toolbar */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-ink-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] z-20 relative">
                <div className="flex items-center">
                    <div className="flex items-center bg-ink-100 rounded-lg p-0.5 border border-ink-200">
                        <button type="button" onClick={zoomOut} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-ink-500 hover:text-ink-700 transition-all active:scale-95" title="Zoom Out">
                            <ZoomOutIcon className="text-lg" />
                        </button>
                        <span className="w-12 text-center text-xs font-mono font-bold text-ink-700 select-none">
                            {(effectiveScale * 100).toFixed(0)}%
                        </span>
                        <button type="button" onClick={zoomIn} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-ink-500 hover:text-ink-700 transition-all active:scale-95" title="Zoom In">
                            <ZoomInIcon className="text-lg" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 bg-ink-50 px-2.5 sm:px-3 py-1.5 rounded-full border border-ink-200 shadow-sm flex-shrink-0">
                    <span className="hidden sm:inline text-[10px] font-bold text-ink-400 uppercase tracking-wider">Page</span>
                    <span className="text-xs sm:text-sm font-bold text-ink-700 font-mono">{currentPage}</span>
                    <span className="text-xs text-ink-300">/</span>
                    <span className="text-xs sm:text-sm font-medium text-ink-500 font-mono">{numPages || '--'}</span>
                </div>

                <button type="button" onClick={fitToPage} className="p-2 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600 transition-colors active:scale-95" title="Fit to width">
                    <FitScreenIcon className="text-xl" />
                </button>
            </div>

            {/* Scroll area */}
            <section
                ref={containerRef}
                className="flex-1 min-h-0 w-full overflow-auto bg-ink-200 relative"
                style={{ touchAction: 'pan-x pan-y' }}
                aria-label="PDF viewer"
                onScroll={handleScroll}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {pdfDoc && numPages > 0 && pageViewports.length === numPages ? (
                    <div className="p-3 space-y-3 flex flex-col items-center">
                        {Array.from({ length: numPages }, (_, i) => {
                            const pageNum = i + 1;
                            const viewport = pageViewports[i];
                            const scaledWidth = viewport.width * effectiveScale;
                            const scaledHeight = viewport.height * effectiveScale;

                            return (
                                <div
                                    key={`page-${pageNum}`}
                                    ref={el => { pageRefs.current[i] = el; }}
                                    className="mx-auto"
                                    style={{ width: scaledWidth, height: scaledHeight }}
                                    data-page={pageNum}
                                >
                                    {pagesToRender.has(pageNum) ? (
                                        <PdfPage
                                            pdfDoc={pdfDoc}
                                            pageNum={pageNum}
                                            renderScale={renderScale * window.devicePixelRatio}
                                            viewScale={effectiveScale}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-white shadow-lg" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : imageUrl ? (
                    <div className="p-6 flex justify-center">
                        <img src={imageUrl} alt="document content" className="max-w-full h-auto shadow-lg" style={{ width: `${effectiveScale * 100}%` }} />
                    </div>
                ) : textContent !== null ? (
                    <div className="p-6 bg-white max-w-4xl mx-auto my-4 rounded-lg shadow-lg">
                        <pre className="whitespace-pre-wrap text-sm text-ink-800 font-sans">{textContent}</pre>
                    </div>
                ) : null}
            </section>
        </div>
    );
};
