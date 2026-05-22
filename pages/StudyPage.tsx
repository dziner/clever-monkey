import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { PdfViewer } from '../components/PdfViewer';
import { InteractionPanel } from '../components/InteractionPanel';
import type { ActiveTab } from '../components/InteractionPanel';
import { Spinner } from '../components/Spinner';
import { DocumentIcon, XIcon, CopyIcon, ChatIcon, AssignmentIcon, AccountTreeIcon, SlideshowIcon, HeadphonesIcon, PanelRightCloseIcon } from '../components/icons';
import { useResizablePanel } from '../hooks/useResizablePanel';
import type { DocumentProcessingState } from '../types';

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

interface PdfContentPanelProps {
    file: File | null | undefined;
    imageUrl?: string;
    docId: string;
    currentPage: number;
    onPageChange: (page: number) => void;
    isProcessing: boolean;
    processingState: DocumentProcessingState;
    errorMessage?: string | null;
    onDeleteDocument: () => void;
}

const PdfContentPanel: React.FC<PdfContentPanelProps> = React.memo(({
    file, imageUrl, docId, currentPage, onPageChange,
    isProcessing, processingState, errorMessage, onDeleteDocument,
}) => (
    <React.Fragment>
        {isProcessing && (
            <div className="absolute inset-0 bg-slate-100/80 flex flex-col items-center justify-center z-10">
                <Spinner />
                <p className="mt-4 text-slate-700 font-semibold">{getProcessingMessage(processingState)}</p>
            </div>
        )}
        {processingState === 'error' && (
            <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center z-10 p-4">
                <h3 className="text-lg font-bold text-red-700">Processing Failed</h3>
                <p className="text-red-600 mt-2 text-center">{errorMessage}</p>
                <button
                    type="button"
                    onClick={onDeleteDocument}
                    className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                >
                    <XIcon className="text-base mr-2" /> Close
                </button>
            </div>
        )}
        {file ? (
            <PdfViewer
                file={file}
                imageUrl={imageUrl}
                docId={docId}
                currentPage={currentPage}
                onPageChange={onPageChange}
            />
        ) : (
            !isProcessing && <ViewerPlaceholder />
        )}
    </React.Fragment>
));

interface StudyPageProps {
    onMenuClick: () => void;
}

export const StudyPage: React.FC<StudyPageProps> = ({ onMenuClick }) => {
    const { state, dispatch } = useDocuments();
    const [isPdfVisible, setIsPdfVisible] = React.useState(false);
    const [isPdfViewerCollapsed, setIsPdfViewerCollapsed] = React.useState(false);
    const { width: interactionPanelWidth, handleMouseDown: handleResize } = useResizablePanel(400, 280, 700, 'right');
    const [activeTab, setActiveTab] = React.useState<ActiveTab>('summary');
    const [isRightPanelCollapsed, setIsRightPanelCollapsed] = React.useState(
        typeof window !== 'undefined' && window.innerWidth < 1024
    );

    const [sheetTranslateY, setSheetTranslateY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartY = React.useRef(0);

    const activeDocument = state.documents.find(d => d.id === state.activeDocumentId);
    const isProcessing = activeDocument?.processingState !== 'done' && activeDocument?.processingState !== 'error';

    const handlePageChange = React.useCallback((page: number) => {
        if (!activeDocument) return;
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: activeDocument.id, updates: { currentPage: page } } });
    }, [activeDocument?.id, dispatch]);

    const handleDeleteDocument = React.useCallback(() => {
        if (!activeDocument) return;
        dispatch({ type: 'DELETE_DOCUMENT', payload: { docId: activeDocument.id } });
    }, [activeDocument?.id, dispatch]);

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

    return (
        <div className="flex-1 flex min-w-0">
            {/* PDF Viewer — Desktop */}
            <section className={`relative hidden md:flex flex-col flex-1 min-w-0 min-h-0 bg-slate-100 transition-all duration-300 ease-in-out ${isPdfViewerCollapsed ? 'flex-basis-0 w-0 p-0' : ''}`}>
                <div className={`flex-1 relative min-h-0 w-full flex flex-col ${isPdfViewerCollapsed ? 'overflow-hidden' : ''}`}>
                    <PdfContentPanel
                        file={activeDocument.file}
                        imageUrl={activeDocument.imageUrl}
                        docId={activeDocument.id}
                        currentPage={activeDocument.currentPage ?? 1}
                        onPageChange={handlePageChange}
                        isProcessing={isProcessing}
                        processingState={activeDocument.processingState}
                        errorMessage={activeDocument.errorMessage}
                        onDeleteDocument={handleDeleteDocument}
                    />
                </div>
            </section>

            {/* Resizer — Desktop (hidden when right panel is collapsed) */}
            {!isRightPanelCollapsed && (
                <button
                    type="button"
                    onMouseDown={handleResize}
                    className={`hidden md:flex items-center justify-center w-3 h-full bg-slate-50 border-l border-slate-200 hover:bg-blue-50 cursor-col-resize flex-shrink-0 transition-colors group z-20 ${isPdfViewerCollapsed ? 'hidden' : ''}`}
                    aria-label="Resize panel"
                >
                    <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
                </button>
            )}

            {/* Right Panel — collapsed icon strip or full InteractionPanel */}
            <aside
                className={`hidden md:flex flex-col flex-shrink-0 h-full bg-white border-l border-slate-200 transition-all duration-300 ${isRightPanelCollapsed ? 'w-14' : ''}`}
                style={isRightPanelCollapsed ? {} : (isPdfViewerCollapsed ? { width: '100%' } : { width: interactionPanelWidth })}
            >
                {isRightPanelCollapsed ? (
                    <div className="flex flex-col items-center py-4 gap-1 h-full">
                        <button
                            type="button"
                            onClick={() => setIsRightPanelCollapsed(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Expand tools panel"
                        >
                            <PanelRightCloseIcon />
                        </button>
                        <div className="w-8 h-px bg-slate-200 mb-1" />
                        {([
                            { id: 'summary', icon: CopyIcon, label: 'Summary' },
                            { id: 'chat', icon: ChatIcon, label: 'Chat' },
                            { id: 'quiz', icon: AssignmentIcon, label: 'Quiz' },
                            { id: 'mindmap', icon: AccountTreeIcon, label: 'Mind Map' },
                            { id: 'slides', icon: SlideshowIcon, label: 'Slides' },
                            { id: 'podcast', icon: HeadphonesIcon, label: 'Podcast' },
                        ] as { id: ActiveTab; icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>; label: string }[]).map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => { setIsRightPanelCollapsed(false); setActiveTab(tab.id); }}
                                className={`p-2 rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                title={tab.label}
                            >
                                <tab.icon className="text-xl" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <InteractionPanel
                        key={activeDocument.id}
                        document={activeDocument}
                        onMenuClick={onMenuClick}
                        onPreviewClick={() => setIsPdfVisible(v => !v)}
                        isPdfVisible={isPdfVisible}
                        isPdfViewerCollapsed={isPdfViewerCollapsed}
                        onTogglePdfViewer={() => setIsPdfViewerCollapsed(v => !v)}
                        onToggleRightPanel={() => setIsRightPanelCollapsed(true)}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                )}
            </aside>

            {/* Interaction Panel — Mobile (full width) */}
            <section className="min-h-0 h-full w-full md:hidden bg-white border-l border-slate-200 shadow-xl z-10">
                <InteractionPanel
                    key={`mobile-${activeDocument.id}`}
                    document={activeDocument}
                    onMenuClick={onMenuClick}
                    onPreviewClick={() => setIsPdfVisible(v => !v)}
                    isPdfVisible={isPdfVisible}
                    isPdfViewerCollapsed={isPdfViewerCollapsed}
                    onTogglePdfViewer={() => setIsPdfViewerCollapsed(v => !v)}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
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
                <div className="relative h-full w-full pt-8 flex flex-col">
                    <PdfContentPanel
                        file={activeDocument.file}
                        imageUrl={activeDocument.imageUrl}
                        docId={activeDocument.id}
                        currentPage={activeDocument.currentPage ?? 1}
                        onPageChange={handlePageChange}
                        isProcessing={isProcessing}
                        processingState={activeDocument.processingState}
                        errorMessage={activeDocument.errorMessage}
                        onDeleteDocument={handleDeleteDocument}
                    />
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
