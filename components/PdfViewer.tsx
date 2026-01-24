// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { Spinner } from './Spinner';
import { ZoomInIcon, ZoomOutIcon, FitScreenIcon, HighlightIcon } from './icons';
import type { AnnotationAnchor, Annotation } from '../types';

interface PdfViewerProps {
    file: File;
    imageUrl?: string;
    docId: string;
    annotations?: Annotation[];
    currentPage?: number;
    onSelection?: (anchor: AnnotationAnchor) => void;
    onPageChange?: (page: number) => void;
    penMode?: boolean;
    onTogglePenMode?: () => void;
    onHighlightCreate?: (anchor: AnnotationAnchor) => void;
}

// A memoized component to render a single page of a PDF.
const PdfPage: React.FC<{
    pdfDoc: any;
    pageNum: number;
    renderScale: number;
    viewScale: number;
    pageAnnotations?: Annotation[];
}> = React.memo(({ pdfDoc, pageNum, renderScale, viewScale, pageAnnotations }) => {
    const pdfCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const textLayerRef = React.useRef<HTMLDivElement>(null);
    const textRenderTaskRef = React.useRef<any>(null);

    // Effect to render the PDF content to the main canvas
    React.useEffect(() => {
        let isCancelled = false;
        const renderPage = async () => {
            const canvas = pdfCanvasRef.current;
            if (!pdfDoc || !canvas || renderScale <= 0) return;

            // Clean up previous render task if exists
            if (renderTaskRef.current) {
                try {
                    // Ensure we don't await cancel if it's synchronous or already done
                    // In pdf.js v3+, cancel() is synchronous but returns void/undefined.
                    (renderTaskRef.current as any).cancel();
                } catch (e) {
                    // Ignore cancellation errors
                }
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

                const renderContext = {
                    canvasContext: tempContext,
                    viewport: renderViewport,
                    background: 'white',
                };
                
                const task = page.render(renderContext);
                renderTaskRef.current = task;
                await task.promise;
                if (isCancelled) return;

                const context = canvas.getContext('2d');
                if (!context) return;
                
                canvas.height = renderViewport.height;
                canvas.width = renderViewport.width;
                context.drawImage(tempCanvas, 0, 0);

            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNum}:`, err);
                }
            } finally {
                // Clear reference to completed task
                if (renderTaskRef.current?.promise?.state === 'resolved' || renderTaskRef.current?.promise?.state === 'rejected') {
                    renderTaskRef.current = null;
                }
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                try {
                    (renderTaskRef.current as any).cancel();
                } catch (e) {
                    // Ignore cancellation errors during unmount
                }
            }
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
                const textContent = await page.getTextContent();
                if (isCancelled) return;

                const task = pdfjsLib.renderTextLayer({
                    textContent,
                    container: layer,
                    viewport,
                });
                textRenderTaskRef.current = task;

                if (task?.promise) {
                    await task.promise;
                }
            } catch (err: any) {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering text layer ${pageNum}:`, err);
                }
            }
        };

        renderTextLayer();

        return () => {
            isCancelled = true;
            if (textRenderTaskRef.current?.cancel) {
                try {
                    textRenderTaskRef.current.cancel();
                } catch (e) {
                    // Ignore cancellation errors
                }
            }
        };
    }, [pdfDoc, pageNum, viewScale]);

    return (
        <div className="relative w-full h-full shadow-lg bg-white">
            <canvas ref={pdfCanvasRef} className="w-full h-full block" />
            
            {/* Annotation Highlights Layer */}
            {pageAnnotations && pageAnnotations.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-10">
                    {pageAnnotations.map((annotation) => 
                        annotation.anchor.rects.map((rect, rectIndex) => (
                            <div
                                key={`${annotation.id}-${rectIndex}`}
                                className="absolute bg-yellow-300 mix-blend-multiply transition-opacity duration-200"
                                style={{
                                    left: `${rect.x * 100}%`,
                                    top: `${rect.y * 100}%`,
                                    width: `${rect.width * 100}%`,
                                    height: `${rect.height * 100}%`,
                                    backgroundColor: annotation.content?.color || '#FDE68A',
                                    opacity: 0.4,
                                    borderRadius: '2px',
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            <div
                ref={textLayerRef}
                className="absolute inset-0 text-transparent select-text z-20"
                style={{ pointerEvents: 'auto' }}
            />
        </div>
    );
});


const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4.0;

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, imageUrl, annotations = [], currentPage: externalCurrentPage, onSelection, onPageChange, penMode, onTogglePenMode, onHighlightCreate }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = React.useState<any>(null);
    const [numPages, setNumPages] = React.useState(0);
    const [pageViewports, setPageViewports] = React.useState<any[]>([]);
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

    const setCurrentPage = setInternalCurrentPage;
    
    React.useEffect(() => {
        if (externalCurrentPage && externalCurrentPage !== internalCurrentPage) {
            const pageEl = pageRefs.current[externalCurrentPage - 1];
            if (pageEl && containerRef.current) {
                const rect = pageEl.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                const isVisible = (
                    rect.top >= containerRect.top &&
                    rect.bottom <= containerRect.bottom
                );
                
                if (!isVisible) {
                    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setInternalCurrentPage(externalCurrentPage);
            }
        }
    }, [externalCurrentPage, numPages]);
    
    // Refs for gesture-based zooming
    const activePointers = React.useRef(new Map<number, { x: number; y: number }>()).current;
    const pinchStateRef = React.useRef<{
        startScale: number;
        startDist: number;
        contentOrigin: { x: number; y: number };
        viewportOrigin: { x: number; y: number };
    } | null>(null);
    
    // Load PDF, text, or image file
    React.useEffect(() => {
        setIsLoading(true);
        setPdfDoc(null);
        setNumPages(0);
        setCurrentPage(1);

        if (file.type.startsWith('image/')) {
            setIsLoading(false);
            return;
        }

        if (file.type.startsWith('text/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setTextContent(e.target?.result as string);
                setIsLoading(false);
            };
            reader.onerror = () => {
                setError('Failed to read the text file.');
                setIsLoading(false);
            }
            reader.readAsText(file);
            return;
        }
        
        const loadPdf = async () => {
            try {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) {
                    throw new Error('PDF.js library is not loaded.');
                }
                
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument(arrayBuffer);
                const doc = await loadingTask.promise;
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
                
            } catch (err: any) {
                console.error("Error loading PDF:", err);
                setError(err.message || 'Failed to load PDF.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPdf();

    }, [file]);

    React.useEffect(() => {
        const calculateFitScale = () => {
            const container = containerRef.current;
            // Fix: Add guard against container width being 0 during layout shifts to prevent a blank render.
            if (!container || pageViewports.length === 0 || container.clientWidth <= 0) {
                return;
            }

            const containerWidth = container.clientWidth - 24;
            const firstPageViewport = pageViewports[0];
            const calculatedScale = containerWidth / firstPageViewport.width;
            if (!Number.isFinite(calculatedScale) || calculatedScale <= 0) {
                return;
            }

            setFitScale(calculatedScale);
        };
        
        calculateFitScale();

        const resizeObserver = new ResizeObserver(() => calculateFitScale());
        const containerEl = containerRef.current;
        if (containerEl) {
            resizeObserver.observe(containerEl);
        }

        return () => {
            if (containerEl) {
                resizeObserver.unobserve(containerEl);
                resizeObserver.disconnect();
            }
        };
    }, [pageViewports]);
    
    React.useEffect(() => {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
            setRenderScale(effectiveScale);
        }, 300);
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
                        const target = entry.target as HTMLElement;
                        const pageNum = Number(target.dataset.page);
                        if (!pageNum) return;
                        if (entry.isIntersecting) {
                            next.add(pageNum);
                        } else {
                            next.delete(pageNum);
                        }
                    });
                    return Array.from(next).sort((a, b) => a - b);
                });
            },
            { root: container, rootMargin: '400px 0px', threshold: 0.1 }
        );

        pageRefs.current.forEach((el, index) => {
            if (!el) return;
            el.dataset.page = String(index + 1);
            observer.observe(el);
        });

        return () => observer.disconnect();
    }, [numPages, pageViewports, effectiveScale]);

    const pagesToRender = React.useMemo(() => {
        const set = new Set<number>();
        if (numPages === 0) return set;
        if (visiblePages.length === 0) {
            for (let i = 1; i <= Math.min(3, numPages); i += 1) {
                set.add(i);
            }
            return set;
        }

        visiblePages.forEach(pageNum => {
            for (let i = pageNum - 2; i <= pageNum + 2; i += 1) {
                if (i >= 1 && i <= numPages) {
                    set.add(i);
                }
            }
        });
        return set;
    }, [visiblePages, numPages]);

    const clampScale = React.useCallback((value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)), []);

    const zoomIn = React.useCallback(() => {
        setZoomFactor(current => {
            const next = clampScale(fitScale * current + ZOOM_STEP);
            return fitScale > 0 ? next / fitScale : current;
        });
    }, [fitScale, clampScale]);

    const zoomOut = React.useCallback(() => {
        setZoomFactor(current => {
            const next = clampScale(fitScale * current - ZOOM_STEP);
            return fitScale > 0 ? next / fitScale : current;
        });
    }, [fitScale, clampScale]);

    const fitToPage = React.useCallback(() => setZoomFactor(1), []);

    const handleScroll = React.useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const scrollMidpoint = container.scrollTop + container.clientHeight / 2;
        let closestPage = 0;
        let minDistance = Infinity;

        for (let i = 0; i < numPages; i++) {
            const pageEl = pageRefs.current[i];
            if (pageEl) {
                const pageMidpoint = pageEl.offsetTop + pageEl.offsetHeight / 2;
                const distance = Math.abs(scrollMidpoint - pageMidpoint);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPage = i;
                }
            }
        }
        const pageNumber = closestPage + 1;
        setCurrentPage(pageNumber);
        onPageChange?.(pageNumber);
    }, [numPages, onPageChange]);

    const handleWheel = React.useCallback((e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
    
            const rect = container.getBoundingClientRect();
            const viewportOrigin = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            const contentOrigin = {
                x: (container.scrollLeft + viewportOrigin.x) / effectiveScale,
                y: (container.scrollTop + viewportOrigin.y) / effectiveScale,
            };

            const oldScale = effectiveScale;
            const newScale = clampScale(oldScale - e.deltaY * 0.005);

            if (fitScale > 0) {
                setZoomFactor(newScale / fitScale);
            }

            const newScrollLeft = contentOrigin.x * newScale - viewportOrigin.x;
            const newScrollTop = contentOrigin.y * newScale - viewportOrigin.y;
    
            requestAnimationFrame(() => {
                container.scrollLeft = newScrollLeft;
                container.scrollTop = newScrollTop;
            });
        }
    }, [effectiveScale, fitScale, clampScale]);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch') return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
        if (activePointers.size === 2) {
            const container = containerRef.current;
            if (!container) return;
    
            // Fix: Explicitly type 'pointers' to resolve type inference issue with Map iterator.
            const pointers: { x: number; y: number }[] = Array.from(activePointers.values());
            const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
            
            const viewportMidpoint = {
                x: (pointers[0].x + pointers[1].x) / 2,
                y: (pointers[0].y + pointers[1].y) / 2
            };
    
            const rect = container.getBoundingClientRect();
            const viewportOrigin = {
                x: viewportMidpoint.x - rect.left,
                y: viewportMidpoint.y - rect.top,
            };

            const contentOrigin = {
                x: (container.scrollLeft + viewportOrigin.x) / effectiveScale,
                y: (container.scrollTop + viewportOrigin.y) / effectiveScale,
            };

            pinchStateRef.current = {
                startScale: effectiveScale,
                startDist: dist,
                contentOrigin,
                viewportOrigin,
            };
        }
    }, [effectiveScale, activePointers]);

    const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch' || activePointers.size !== 2 || !pinchStateRef.current) return;
        
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // Fix: Explicitly type 'pointers' to resolve type inference issue with Map iterator.
        const pointers: { x: number; y: number }[] = Array.from(activePointers.values());
        const newDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        
        const { startScale, startDist, contentOrigin, viewportOrigin } = pinchStateRef.current;
    
        const newScale = startScale * (newDist / startDist);
        const clampedScale = clampScale(newScale);

        if (fitScale > 0) {
            setZoomFactor(clampedScale / fitScale);
        }
        
        const container = containerRef.current;
        if (container) {
            const newScrollLeft = contentOrigin.x * clampedScale - viewportOrigin.x;
            const newScrollTop = contentOrigin.y * clampedScale - viewportOrigin.y;
            
            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;
        }
    }, [activePointers, clampScale, fitScale]);
    
    const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch') return;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) {
            pinchStateRef.current = null;
        }
    }, [activePointers]);

    const handleMouseUp = React.useCallback(() => {
        if (!onSelection && !onHighlightCreate) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (!text) return;

        const anchorNode = selection.anchorNode as HTMLElement | null;
        const pageElement = anchorNode?.parentElement?.closest('[data-page]') as HTMLElement | null;
        if (!pageElement) return;

        const pageNumber = Number(pageElement.dataset.page);
        if (!pageNumber) return;

        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects())
            .filter(rect => rect.width > 0 && rect.height > 0)
            .map(rect => {
                const pageRect = pageElement.getBoundingClientRect();
                return {
                    x: (rect.left - pageRect.left) / pageRect.width,
                    y: (rect.top - pageRect.top) / pageRect.height,
                    width: rect.width / pageRect.width,
                    height: rect.height / pageRect.height,
                };
            });

        if (rects.length === 0) return;

        const anchor: AnnotationAnchor = {
            page: pageNumber,
            rects,
            textQuote: text,
        };

        if (penMode && onHighlightCreate) {
            onHighlightCreate(anchor);
            selection.removeAllRanges();
            return;
        }

        onSelection?.(anchor);
    }, [onSelection, onHighlightCreate, penMode]);
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full p-4 text-red-600 bg-red-50">{error}</div>;
    }

    return (
        <div className="w-full h-full flex flex-col bg-slate-100">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] z-20 relative">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button onClick={zoomOut} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-700 transition-all active:scale-95" title="Zoom Out">
                            <ZoomOutIcon className="text-lg"/>
                        </button>
                        <span className="w-12 text-center text-xs font-mono font-bold text-slate-600 select-none">
                            {(effectiveScale * 100).toFixed(0)}%
                        </span>
                        <button onClick={zoomIn} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-700 transition-all active:scale-95" title="Zoom In">
                            <ZoomInIcon className="text-lg"/>
                        </button>
                    </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Page</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">{currentPage}</span>
                    <span className="text-xs text-slate-300">/</span>
                    <span className="text-sm font-medium text-slate-500 font-mono">{numPages || '--'}</span>
                </div>

                <div className="flex justify-end gap-2">
                    {onTogglePenMode && (
                        <button
                            onClick={onTogglePenMode}
                            className={`p-2 rounded-lg transition-colors active:scale-95 ${
                                penMode
                                    ? 'bg-blue-100 text-blue-600 shadow-inner ring-1 ring-blue-200'
                                    : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                            title={penMode ? "Exit Pen Mode" : "Enter Pen Mode"}
                            aria-pressed={penMode}
                        >
                            <HighlightIcon className="text-xl" />
                        </button>
                    )}
                    <button onClick={fitToPage} className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95" title="Fit to width">
                        <FitScreenIcon className="text-xl"/>
                    </button>
                </div>
            </div>
            <div
                ref={containerRef}
                className="flex-1 w-full h-full overflow-auto bg-slate-200 touch-panning relative"
                onScroll={handleScroll}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onMouseUp={handleMouseUp}
            >
                {pdfDoc && numPages > 0 ? (
                    // Add an extra wrapper div to ensure the scroll container's child
                    // can expand beyond the viewport width, enabling horizontal scrolling.
                    <div>
                        <div className="p-3 space-y-3 flex flex-col items-center">
                            {Array.from({ length: numPages }, (_, i) => {
                                const pageNum = i + 1;
                                const viewport = pageViewports[i];
                                const scaledWidth = viewport.width * effectiveScale;
                                const scaledHeight = viewport.height * effectiveScale;
                                
                                return (
                                    <div
                                        key={`page-${pageNum}`}
                                        // Fix: Changed ref callback to a block body to ensure it returns void, resolving a TypeScript error.
                                        ref={el => { pageRefs.current[i] = el; }}
                                        className="mx-auto"
                                        style={{ width: scaledWidth, height: scaledHeight }}
                                    >
                                        {pagesToRender.has(pageNum) ? (
                                        <PdfPage
                                            pdfDoc={pdfDoc}
                                            pageNum={pageNum}
                                            renderScale={renderScale * window.devicePixelRatio}
                                            viewScale={effectiveScale}
                                            pageAnnotations={annotations.filter(a => a.pageNumber === pageNum)}
                                        />
                                        ) : (
                                            <div className="w-full h-full bg-white shadow-lg" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : imageUrl ? (
                    <div className="p-6 flex justify-center">
                        <img src={imageUrl} alt="document content" className="max-w-full h-auto shadow-lg" style={{ width: `${effectiveScale * 100}%` }} />
                    </div>
                ) : textContent !== null ? (
                    <div className="p-6 bg-white max-w-4xl mx-auto my-4 rounded-lg shadow-lg">
                        <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">{textContent}</pre>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
