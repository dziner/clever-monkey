import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { PdfViewer } from '../components/PdfViewer';
import { InteractionPanel } from '../components/InteractionPanel';
import { Spinner } from '../components/Spinner';
import { DocumentIcon, XIcon } from '../components/icons';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { fetchAnnotationsForDocument, createAnnotation } from '../services/annotationService';
import type { DocumentProcessingState, Annotation, AnnotationAnchor, Point } from '../types';

const getProcessingMessage = (state: DocumentProcessingState): string => {
    switch (state) {
        case 'reading': return 'Extracting text with AI...';
        case 'summarizing': return 'Summarizing document...';
        case 'generating_questions': return 'Getting things ready...';
        default: return `${state.charAt(0).toUpperCase() + state.slice(1)} document...`;
    }
};

const ViewerPlaceholder = () => (
    <div className="flex flex-col items-center justify-center h-full bg-slate-100 p-8 text-center">
        <DocumentIcon className="text-5xl text-slate-400" />
        <h3 className="text-lg font-bold text-slate-700 mt-4">File content not available</h3>
        <p className="text-slate-500 mt-2 max-w-sm">
            To view the document, please upload the file again. Your summary and chat history have been saved.
        </p>
    </div>
);

interface StudyPageProps {
    onMenuClick: () => void;
}

export const StudyPage: React.FC<StudyPageProps> = ({ onMenuClick }) => {
    const { state, dispatch } = useDocuments();
    const [isPdfVisible, setIsPdfVisible] = React.useState(false);
    const [isPdfViewerCollapsed, setIsPdfViewerCollapsed] = React.useState(false);
    const { width: interactionPanelWidth, handleMouseDown: handleResize } = useResizablePanel(450, 350, 800, 'right');
    const [penMode, setPenMode] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'summary' | 'chat' | 'quiz' | 'annotations'>('summary');
    const [editingAnnotationId, setEditingAnnotationId] = React.useState<string | null>(null);

    const [sheetTranslateY, setSheetTranslateY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartY = React.useRef(0);

    const activeDocument = state.documents.find(d => d.id === state.activeDocumentId);
    const isProcessing = activeDocument?.processingState !== 'done' && activeDocument?.processingState !== 'error';

    React.useEffect(() => {
        const fetchAnnotations = async () => {
            if (activeDocument && !activeDocument.annotations) {
                const annotations = await fetchAnnotationsForDocument(activeDocument.id);
                if (annotations) {
                    dispatch({
                        type: 'UPDATE_DOCUMENT',
                        payload: { docId: activeDocument.id, updates: { annotations } },
                    });
                }
            }
        };
        fetchAnnotations();
    }, [activeDocument?.id, dispatch]);

    const handlePageChange = React.useCallback((page: number) => {
        if (!activeDocument) return;
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: activeDocument.id, updates: { currentPage: page } } });
    }, [activeDocument?.id, dispatch]);

    const handleAnnotationCreate = React.useCallback(async (
        anchor: AnnotationAnchor,
        note?: string,
        color?: string,
        paths?: Point[][],
        penWidth?: number
    ) => {
        if (!activeDocument) return;

        const getCurrentAnnotations = () => {
            const currentDoc = state.documents.find(doc => doc.id === activeDocument.id);
            return currentDoc?.annotations ?? [];
        };

        const kind = paths && paths.length > 0 ? 'pen' : 'highlight';
        const content: { color?: string; note?: string; paths?: Point[][]; penWidth?: number } = {};
        const trimmedNote = note?.trim();

        if (kind === 'highlight') {
            content.color = color || '#FDE68A';
            if (trimmedNote) content.note = trimmedNote;
        } else {
            content.paths = paths;
            content.penWidth = penWidth;
            content.color = color || '#000000';
            if (trimmedNote) content.note = trimmedNote;
        }

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: Annotation = {
            id: tempId,
            documentId: activeDocument.id,
            pageNumber: anchor.page,
            kind,
            anchor,
            content,
        };
        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { docId: activeDocument.id, updates: { annotations: [...getCurrentAnnotations(), optimistic] } },
        });

        const created = await createAnnotation({
            documentId: activeDocument.id,
            pageNumber: anchor.page,
            kind,
            anchor,
            content,
        });

        if (created) {
            const nextAnnotations = getCurrentAnnotations().map(a => a.id === tempId ? created : a);
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId: activeDocument.id, updates: { annotations: nextAnnotations } },
            });
            if (trimmedNote) {
                setActiveTab('annotations');
                setEditingAnnotationId(created.id);
            }
        } else {
            const nextAnnotations = getCurrentAnnotations().filter(a => a.id !== tempId);
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId: activeDocument.id, updates: { annotations: nextAnnotations } },
            });
        }
    }, [activeDocument?.id, state.documents, dispatch]);

    const handleTogglePenMode = React.useCallback(() => setPenMode(c => !c), []);

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const deltaY = e.touches[0].clientY - dragStartY.current;
        if (deltaY > 0) setSheetTranslateY(deltaY);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (sheetTranslateY > 150) setIsPdfVisible(false);
        setSheetTranslateY(0);
    };

    if (!activeDocument) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-500">
                <p>Select a document to get started.</p>
            </div>
        );
    }

    const PdfContent = () => (
        <React.Fragment>
            {isProcessing && (
                <div className="absolute inset-0 bg-slate-100/80 flex flex-col items-center justify-center z-10">
                    <Spinner />
                    <p className="mt-4 text-slate-700 font-semibold">{getProcessingMessage(activeDocument.processingState)}</p>
                </div>
            )}
            {activeDocument.processingState === 'error' && (
                <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center z-10 p-4">
                    <h3 className="text-lg font-bold text-red-700">Processing Failed</h3>
                    <p className="text-red-600 mt-2 text-center">{activeDocument.errorMessage}</p>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'DELETE_DOCUMENT', payload: { docId: activeDocument.id } })}
                        className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                    >
                        <XIcon className="text-base mr-2" /> Close
                    </button>
                </div>
            )}
            {activeDocument.file ? (
                <PdfViewer
                    file={activeDocument.file}
                    imageUrl={activeDocument.imageUrl}
                    docId={activeDocument.id}
                    annotations={activeDocument.annotations}
                    currentPage={activeDocument.currentPage}
                    onPageChange={handlePageChange}
                    penMode={penMode}
                    onTogglePenMode={handleTogglePenMode}
                    onHighlightCreate={handleAnnotationCreate}
                />
            ) : (
                !isProcessing && <ViewerPlaceholder />
            )}
        </React.Fragment>
    );

    return (
        <div className="flex-1 flex min-w-0">
            {/* PDF Viewer — Desktop */}
            <section className={`relative hidden md:flex flex-col flex-1 min-w-0 min-h-0 bg-slate-100 transition-all duration-300 ease-in-out ${isPdfViewerCollapsed ? 'flex-basis-0 w-0 p-0' : ''}`}>
                <div className={`flex-1 relative min-h-0 w-full h-full ${isPdfViewerCollapsed ? 'overflow-hidden' : ''}`}>
                    <PdfContent />
                </div>
            </section>

            {/* Resizer — Desktop */}
            <button
                type="button"
                onMouseDown={handleResize}
                className={`hidden md:flex items-center justify-center w-3 h-full bg-slate-50 border-l border-slate-200 hover:bg-blue-50 cursor-col-resize flex-shrink-0 transition-colors group z-20 ${isPdfViewerCollapsed ? 'hidden' : ''}`}
                aria-label="Resize panel"
            >
                <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
            </button>

            {/* Interaction Panel */}
            <section
                className="min-h-0 w-full md:w-auto md:flex-shrink-0 bg-white border-l border-slate-200 shadow-xl z-10"
                style={!isPdfViewerCollapsed ? { width: interactionPanelWidth } : { width: '100%' }}
            >
                <InteractionPanel
                    key={activeDocument.id}
                    document={activeDocument}
                    onMenuClick={onMenuClick}
                    onPreviewClick={() => setIsPdfVisible(v => !v)}
                    isPdfVisible={isPdfVisible}
                    isPdfViewerCollapsed={isPdfViewerCollapsed}
                    onTogglePdfViewer={() => setIsPdfViewerCollapsed(v => !v)}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    editingAnnotationId={editingAnnotationId}
                    onEditingAnnotationChange={setEditingAnnotationId}
                />
            </section>

            {/* PDF Viewer — Mobile overlay backdrop */}
            {isPdfVisible && (
                <button
                    type="button"
                    className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
                    onClick={() => setIsPdfVisible(false)}
                    aria-label="Close PDF preview"
                />
            )}

            {/* PDF Viewer — Mobile bottom sheet */}
            <div
                className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-slate-100 rounded-t-2xl shadow-2xl transform overflow-hidden h-[92vh]"
                style={{
                    transform: isPdfVisible
                        ? `translateY(${isDragging ? sheetTranslateY : 0}px)`
                        : 'translateY(100%)',
                    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                <div
                    className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center z-30 bg-white border-b border-slate-100 rounded-t-2xl touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
                </div>
                <div className="relative h-full w-full pt-8">
                    <PdfContent />
                    <button
                        type="button"
                        onClick={() => setIsPdfVisible(false)}
                        className="absolute top-2 right-2 z-30 p-2 text-slate-400 hover:text-slate-600"
                        aria-label="Close document preview"
                    >
                        <XIcon className="text-xl" />
                    </button>
                </div>
            </div>
        </div>
    );
};
