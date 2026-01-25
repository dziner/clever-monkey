import * as React from 'react';
import { Spinner } from './Spinner';
import { ZoomInIcon, ZoomOutIcon, FitScreenIcon, HighlightIcon } from './icons';
import type { AnnotationAnchor, Annotation, Point } from '../types';
import { AnnotationPopover } from './AnnotationPopover';
import { PenToolbar } from './PenToolbar';

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
    onHighlightCreate?: (anchor: AnnotationAnchor, note?: string, color?: string, paths?: Point[][], penWidth?: number) => void;
}

// A memoized component to render a single page of a PDF.
const PdfPage: React.FC<{
    pdfDoc: any;
    pageNum: number;
    renderScale: number;
    viewScale: number;
    penMode?: boolean;
    pageAnnotations?: Annotation[];
    currentStroke?: Point[];
    strokeColor?: string;
    strokeWidth?: number;
}> = React.memo(({ pdfDoc, pageNum, renderScale, viewScale, penMode, pageAnnotations, currentStroke, strokeColor, strokeWidth }) => {
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

            if (renderTaskRef.current) {
                try {
                    (renderTaskRef.current as any).cancel();
                } catch (e) { }
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
                } catch (e) { }
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
                } catch (e) { }
            }
        };
    }, [pdfDoc, pageNum, viewScale]);

    const renderPath = (pts: Point[], color: string, width: number) => {
        if (pts.length === 0) return '';
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ');
        return (
            <path
                d={d}
                stroke={color}
                strokeWidth={width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        );
    };

    return (
        <div className="relative w-full h-full shadow-lg bg-white select-none">
            <canvas ref={pdfCanvasRef} className="w-full h-full block" />

            {/* Annotation Layers */}
            <div className="absolute inset-0 pointer-events-none z-10 w-full h-full">
                {/* Highlights */}
                {pageAnnotations?.map((annotation) => {
                    if (annotation.kind === 'highlight') {
                        return annotation.anchor.rects.map((rect, rectIndex) => (
                            <div
                                key={`hl-${annotation.id}-${rectIndex}`}
                                className="absolute mix-blend-multiply transition-opacity duration-200"
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
                        ));
                    }
                    return null;
                })}

                {/* Pen Drawings */}
                <svg
                    className="absolute inset-0 w-full h-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                    {pageAnnotations?.map((annotation) => {
                        if (annotation.kind === 'pen' && annotation.content?.paths) {
                            return annotation.content.paths.map((path, i) => (
                                <React.Fragment key={`pen-${annotation.id}-${i}`}>
                                    {renderPath(path, annotation.content?.color || 'black', annotation.content?.penWidth || 2)}
                                </React.Fragment>
                            ));
                        }
                        return null;
                    })}
                    {/* Current Draft Stroke */}
                    {currentStroke && currentStroke.length > 0 && (
                        renderPath(currentStroke, strokeColor || 'red', strokeWidth || 2)
                    )}
                </svg>
            </div>

            <div
                ref={textLayerRef}
                className={`absolute inset-0 text-transparent z-20 ${penMode ? 'select-none' : 'select-text'}`}
                style={{ pointerEvents: penMode ? 'none' : 'auto' }}
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

    // Annotation & Pen State
    const [activeSelection, setActiveSelection] = React.useState<{ anchor: AnnotationAnchor, position: { x: number, y: number } } | null>(null);
    const [penColor, setPenColor] = React.useState('#000000');
    const [penWidth, setPenWidth] = React.useState(2);
    // stroke accumulates points {x,y} relative to a specific page
    const [currentStroke, setCurrentStroke] = React.useState<{ page: number, points: Point[] } | null>(null);
    const [isPenToolbarCollapsed, setIsPenToolbarCollapsed] = React.useState(false);

    React.useEffect(() => {
        if (penMode) {
            setIsPenToolbarCollapsed(false);
        }
    }, [penMode]);

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

                // Keep scale 1.0 for viewports to get base dimensions
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
            // More sensitive pinch to zoom on wheel
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

    // --- Pointer Handling (Zoom, Pan, Draw) ---

    // Constants for drawing
    const DRAW_THRESHOLD = 2; // px movement before counting as draw (to avoid dots on click)

    const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Drawing Logic
        if (penMode) {
            // Only draw with primary pointer (mouse left click, or first touch)
            if (!e.isPrimary && e.pointerType !== 'mouse') return;
            // Check which page we are over
            const target = e.target as HTMLElement;
            const pageEl = target.closest('[data-page]') as HTMLElement;
            if (!pageEl) return;

            const pageNum = Number(pageEl.dataset.page);
            if (!pageNum) return;

            const pageRect = pageEl.getBoundingClientRect();
            const x = (e.clientX - pageRect.left) / pageRect.width;
            const y = (e.clientY - pageRect.top) / pageRect.height;

            // Capture pointer to container to track it even if it leaves the page? 
            // Or keep it simple. Capturing on pageEl might be better but pageEl is inside scroll.
            // Let's rely on global move for now or set capture on container.
            containerRef.current?.setPointerCapture(e.pointerId);

            setCurrentStroke({
                page: pageNum,
                points: [{ x, y }]
            });
            return;
        }

        // Panning/Zooming Logic
        if (e.pointerType !== 'touch') return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 2) {
            const container = containerRef.current;
            if (!container) return;

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
    }, [effectiveScale, activePointers, penMode]);

    const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Drawing
        if (penMode && currentStroke) {
            e.preventDefault(); // prevent scroll

            // We need to map current pointer to the SAME page coordinates
            // Even if we drag outside, we project to that page's space (clamping if needed, or allowing out of bounds)
            const pageEl = pageRefs.current[currentStroke.page - 1];
            if (!pageEl) return;

            const pageRect = pageEl.getBoundingClientRect();
            const x = (e.clientX - pageRect.left) / pageRect.width;
            const y = (e.clientY - pageRect.top) / pageRect.height;

            setCurrentStroke(prev => prev ? {
                ...prev,
                points: [...prev.points, { x, y }]
            } : null);
            return;
        }

        // Zooming/Panning
        if (e.pointerType !== 'touch' || activePointers.size !== 2 || !pinchStateRef.current) return;

        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    }, [activePointers, clampScale, fitScale, penMode, currentStroke]);

    const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (penMode && currentStroke) {
            containerRef.current?.releasePointerCapture(e.pointerId);
            // Finalize stroke
            if (currentStroke.points.length > 2) { // Minimal length check
                // Pass new annotation to parent
                const anchor: AnnotationAnchor = {
                    page: currentStroke.page,
                    rects: [], // Pen drawings don't have text rects
                    // We could calculate a bounding box here if we wanted
                };

                // We're just passing the paths as 'content'
                onHighlightCreate?.(anchor, undefined, penColor, [currentStroke.points], penWidth);
            }
            setCurrentStroke(null);
            return;
        }

        if (e.pointerType !== 'touch') return;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) {
            pinchStateRef.current = null;
        }
    }, [activePointers, penMode, currentStroke, onHighlightCreate, penColor, penWidth]);

    const handleMouseUp = React.useCallback((e: React.MouseEvent) => {
        // If drawing, ignore
        if (penMode) return;

        // Selection logic
        // Slight delay to let selection finalize in some browsers? usually immediate.
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            // Also close popover if clicking elsewhere
            // But check if we clicked INSIDE the popover? 
            // The popover is rendered outside this container usually or on top. 
            // If click bubble up to here, and it wasn't on selection, clear selection.
            // But we need to check if target was the popover...
            // For now, if no selection text, clear active selection
            if (!e.defaultPrevented) { // if button clicked, it prevents default
                setActiveSelection(null);
            }
            return;
        }

        const text = selection.toString().trim();
        if (!text) {
            setActiveSelection(null);
            return;
        }

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

        // Instead of calling onSelection immediately, show popover
        // Calculate popover position. e.clientY/X is mouse position.
        // Or better, top of the selection?
        // e.clientX/Y is easier and puts it near cursor.
        setActiveSelection({
            anchor,
            position: { x: e.clientX, y: e.clientY }
        });

    }, [penMode]);

    // Save handler for Popover
    const handleAnnotationSave = (note: string, color: string) => {
        if (!activeSelection) return;
        onHighlightCreate?.(activeSelection.anchor, note, color);
        setActiveSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full p-4 text-red-600 bg-red-50">{error}</div>;
    }

    return (
        <div className="w-full h-full flex flex-col bg-slate-100 relative">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] z-20 relative">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button onClick={zoomOut} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-700 transition-all active:scale-95" title="Zoom Out">
                            <ZoomOutIcon className="text-lg" />
                        </button>
                        <span className="w-12 text-center text-xs font-mono font-bold text-slate-600 select-none">
                            {(effectiveScale * 100).toFixed(0)}%
                        </span>
                        <button onClick={zoomIn} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-700 transition-all active:scale-95" title="Zoom In">
                            <ZoomInIcon className="text-lg" />
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
                            className={`p-2 rounded-lg transition-colors active:scale-95 ${penMode
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
                        <FitScreenIcon className="text-xl" />
                    </button>
                </div>
            </div>

            {/* Pen Toolbar Overlay */}
            {penMode && onTogglePenMode && (
                isPenToolbarCollapsed ? (
                    <div className="absolute top-20 right-6 z-50">
                        <button
                            type="button"
                            onClick={() => setIsPenToolbarCollapsed(false)}
                            className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                            title="Expand Pen Tools"
                            aria-label="Expand pen tools"
                        >
                            <div
                                className="rounded-full transition-all duration-200"
                                style={{
                                    backgroundColor: penColor,
                                    width: Math.max(6, Math.min(24, penWidth * 2.5)),
                                    height: Math.max(6, Math.min(24, penWidth * 2.5)),
                                    boxShadow: penColor === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none'
                                }}
                            />
                        </button>
                    </div>
                ) : (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
                        <PenToolbar
                            color={penColor} setColor={setPenColor}
                            width={penWidth} setWidth={setPenWidth}
                            onCollapse={() => setIsPenToolbarCollapsed(true)}
                            onAfterSelect={() => setIsPenToolbarCollapsed(true)}
                        />
                    </div>
                )
            )}

            {/* Annotation Popover Overlay */}
            {activeSelection && (
                <AnnotationPopover
                    x={activeSelection.position.x}
                    y={activeSelection.position.y}
                    onSave={handleAnnotationSave}
                    onCancel={() => {
                        setActiveSelection(null);
                        window.getSelection()?.removeAllRanges();
                    }}
                />
            )}

            <div
                ref={containerRef}
                className={`flex-1 w-full h-full overflow-auto bg-slate-200 touch-panning relative ${penMode ? 'cursor-crosshair' : ''}`}
                style={penMode ? { touchAction: 'none' } : undefined}
                onScroll={handleScroll}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onMouseUp={handleMouseUp}
            >
                {pdfDoc && numPages > 0 ? (
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
                                                penMode={penMode}
                                                pageAnnotations={annotations.filter(a => a.pageNumber === pageNum)}
                                                currentStroke={currentStroke?.page === pageNum ? currentStroke.points : undefined}
                                                strokeColor={penColor}
                                                strokeWidth={penWidth}
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
