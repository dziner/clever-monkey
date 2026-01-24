// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { Spinner } from './Spinner';
import { ZoomInIcon, ZoomOutIcon, FitScreenIcon } from './icons';

interface PdfViewerProps {
    file: File;
    imageUrl?: string;
    docId: string;
}

// A memoized component to render a single page of a PDF.
const PdfPage: React.FC<{
    pdfDoc: any;
    pageNum: number;
    baseViewport: any;
    renderScale: number;
}> = React.memo(({ pdfDoc, pageNum, baseViewport, renderScale }) => {
    const pdfCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);

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

    return (
        <div className="relative w-full h-full shadow-lg">
            <canvas ref={pdfCanvasRef} className="w-full h-full" />
        </div>
    );
});


const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4.0;

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, imageUrl }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = React.useState<any>(null);
    const [numPages, setNumPages] = React.useState(0);
    const [pageViewports, setPageViewports] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const [textContent, setTextContent] = React.useState<string | null>(null);

    const [scale, setScale] = React.useState(1.0);
    const [renderScale, setRenderScale] = React.useState(1.0);
    const [fitToPageScale, setFitToPageScale] = React.useState(1.0);
    const debounceTimerRef = React.useRef<number>();
    
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
            
            setFitToPageScale(calculatedScale);
            setScale(calculatedScale);
            setRenderScale(calculatedScale);
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
            setRenderScale(scale);
        }, 300);
        return () => clearTimeout(debounceTimerRef.current);
    }, [scale]);

    const zoomIn = React.useCallback(() => setScale(s => Math.min(MAX_ZOOM, s + ZOOM_STEP)), []);
    const zoomOut = React.useCallback(() => setScale(s => Math.max(MIN_ZOOM, s - ZOOM_STEP)), []);
    const fitToPage = React.useCallback(() => setScale(fitToPageScale), [fitToPageScale]);

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
        setCurrentPage(closestPage + 1);
    }, [numPages]);

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
                x: (container.scrollLeft + viewportOrigin.x) / scale,
                y: (container.scrollTop + viewportOrigin.y) / scale,
            };
    
            const oldScale = scale;
            const newScale = oldScale - e.deltaY * 0.005;
            const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
            
            setScale(clampedScale);
    
            const newScrollLeft = contentOrigin.x * clampedScale - viewportOrigin.x;
            const newScrollTop = contentOrigin.y * clampedScale - viewportOrigin.y;
    
            requestAnimationFrame(() => {
                container.scrollLeft = newScrollLeft;
                container.scrollTop = newScrollTop;
            });
        }
    }, [scale]);

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
                x: (container.scrollLeft + viewportOrigin.x) / scale,
                y: (container.scrollTop + viewportOrigin.y) / scale,
            };
    
            pinchStateRef.current = {
                startScale: scale,
                startDist: dist,
                contentOrigin,
                viewportOrigin,
            };
        }
    }, [scale, activePointers]);

    const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch' || activePointers.size !== 2 || !pinchStateRef.current) return;
        
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // Fix: Explicitly type 'pointers' to resolve type inference issue with Map iterator.
        const pointers: { x: number; y: number }[] = Array.from(activePointers.values());
        const newDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        
        const { startScale, startDist, contentOrigin, viewportOrigin } = pinchStateRef.current;
    
        const newScale = startScale * (newDist / startDist);
        const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
        
        setScale(clampedScale);
        
        const container = containerRef.current;
        if (container) {
            const newScrollLeft = contentOrigin.x * clampedScale - viewportOrigin.x;
            const newScrollTop = contentOrigin.y * clampedScale - viewportOrigin.y;
            
            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;
        }
    }, [activePointers]);
    
    const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'touch') return;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) {
            pinchStateRef.current = null;
        }
    }, [activePointers]);
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full p-4 text-red-600 bg-red-50">{error}</div>;
    }

    return (
        <div className="w-full h-full flex flex-col bg-slate-100">
            <div className="flex-shrink-0 flex items-center justify-between p-1.5 bg-slate-100 border-b border-slate-200">
                <div className="w-28 text-center">
                    <span className="text-sm font-semibold text-slate-600">Page {currentPage} of {numPages || 1}</span>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={zoomOut} className="p-2 rounded-lg text-slate-600 hover:bg-slate-200"><ZoomOutIcon className="text-xl"/></button>
                        <span className="w-16 text-center text-sm font-mono text-slate-700">{(scale * 100).toFixed(0)}%</span>
                        <button onClick={zoomIn} className="p-2 rounded-lg text-slate-600 hover:bg-slate-200"><ZoomInIcon className="text-xl"/></button>
                    </div>
                </div>
                <div className="w-28 flex justify-end">
                    <button onClick={fitToPage} className="p-2 rounded-lg text-slate-600 hover:bg-slate-200" title="Fit to width"><FitScreenIcon className="text-xl"/></button>
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
            >
                {pdfDoc && numPages > 0 ? (
                    // Add an extra wrapper div to ensure the scroll container's child
                    // can expand beyond the viewport width, enabling horizontal scrolling.
                    <div>
                        <div className="p-3 space-y-3 flex flex-col items-center">
                            {Array.from({ length: numPages }, (_, i) => {
                                const pageNum = i + 1;
                                const viewport = pageViewports[i];
                                const scaledWidth = viewport.width * scale;
                                const scaledHeight = viewport.height * scale;
                                
                                return (
                                    <div
                                        key={`page-${pageNum}`}
                                        // Fix: Changed ref callback to a block body to ensure it returns void, resolving a TypeScript error.
                                        ref={el => { pageRefs.current[i] = el; }}
                                        className="mx-auto"
                                        style={{ width: scaledWidth, height: scaledHeight }}
                                    >
                                        <PdfPage
                                            pdfDoc={pdfDoc}
                                            pageNum={pageNum}
                                            baseViewport={viewport}
                                            renderScale={renderScale * window.devicePixelRatio}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : imageUrl ? (
                    <div className="p-6 flex justify-center">
                        <img src={imageUrl} alt="document content" className="max-w-full h-auto shadow-lg" style={{ width: `${scale * 100}%` }} />
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