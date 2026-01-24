
import React from 'react';
import { useDocuments } from './contexts/DocumentContext';
import { IdleStateView } from './components/IdleStateView';
import { FileListPanel } from './components/FileListPanel';
import { PdfViewer } from './components/PdfViewer';
import { InteractionPanel } from './components/InteractionPanel';
import { Spinner } from './components/Spinner';
import { useResizablePanel } from './hooks/useResizablePanel';
import { useFileHandler } from './hooks/useFileHandler';
import { DocumentIcon, MenuIcon, XIcon } from './components/icons';
import { FileUploader } from './components/FileUploader';
import { signInWithGoogle, signOut, supabase } from './services/supabaseClient';
import type { DocumentData, DocumentProcessingState } from './types';

const getProcessingMessage = (state: DocumentProcessingState): string => {
    switch (state) {
        case 'reading':
            return 'Extracting text with AI...';
        case 'summarizing':
            return 'Summarizing document...';
        case 'generating_questions':
            return 'Getting things ready...';
        default:
            return `${state.charAt(0).toUpperCase() + state.slice(1)} document...`;
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

const PdfContent: React.FC<{ document: DocumentData | undefined, isProcessing: boolean }> = ({ document, isProcessing }) => {
    if (!document) return null;

    return (
        <React.Fragment>
            {isProcessing && (
                <div className="absolute inset-0 bg-slate-100/80 flex flex-col items-center justify-center z-10">
                    <Spinner />
                    <p className="mt-4 text-slate-700 font-semibold">{getProcessingMessage(document.processingState)}</p>
                </div>
            )}
            {document.processingState === 'error' && (
                <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center z-10 p-4">
                    <h3 className="text-lg font-bold text-red-700">Processing Failed</h3>
                    <p className="text-red-600 mt-2 text-center">{document.errorMessage}</p>
                    <button
                        onClick={() => useDocuments().dispatch({ type: 'DELETE_DOCUMENT', payload: { docId: document.id } })}
                        className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                    >
                        <XIcon className="text-base mr-2" /> Close
                    </button>
                </div>
            )}
            {document.file ? (
                <PdfViewer
                  file={document.file}
                  imageUrl={document.imageUrl}
                  docId={document.id}
                />
            ) : (
                !isProcessing && <ViewerPlaceholder />
            )}
        </React.Fragment>
    );
};


const App: React.FC = () => {
    const { state, dispatch } = useDocuments();
    const handleFileSelected = useFileHandler();
    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
    const [isPdfVisible, setIsPdfVisible] = React.useState(false);
    const [isPdfViewerCollapsed, setIsPdfViewerCollapsed] = React.useState(false);
    const { width: interactionPanelWidth, handleMouseDown: handleResize } = useResizablePanel(450, 350, 800, 'right');
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);

    const activeDocument = state.documents.find(d => d.id === state.activeDocumentId);
    const isProcessing = activeDocument?.processingState !== 'done' && activeDocument?.processingState !== 'error';

    const handleSignIn = React.useCallback(async () => {
        const { error } = await signInWithGoogle();
        if (error) {
            console.error('Google sign-in failed', error);
        }
    }, []);

    const handleSignOut = React.useCallback(async () => {
        const { error } = await signOut();
        if (error) {
            console.error('Sign out failed', error);
        }
    }, []);

    React.useEffect(() => {
        if (window.innerWidth < 768) {
            setIsPanelCollapsed(true);
        } else {
            setIsPanelCollapsed(false);
        }
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        supabase.auth.getSession().then(({ data, error }) => {
            if (!isMounted) return;
            if (error) {
                console.error('Failed to load session', error);
            }
            setUserEmail(data.session?.user?.email ?? null);
            setIsAuthLoading(false);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserEmail(session?.user?.email ?? null);
            setIsAuthLoading(false);
        });

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
        };
    }, []);
    
    React.useEffect(() => {
        if (state.documents.length === 0) {
            document.body.style.overflow = 'auto';
        } else {
            document.body.style.overflow = 'hidden';
        }
        // When the component unmounts, restore default
        return () => {
            document.body.style.overflow = 'hidden';
        };
    }, [state.documents.length]);

    const authUI = (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 pointer-events-auto">
            {isAuthLoading ? (
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-full shadow-sm">
                    <span className="text-sm text-slate-400 font-medium animate-pulse">Loading...</span>
                </div>
            ) : userEmail ? (
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 p-1 pl-4 rounded-full shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium text-slate-600 max-w-[120px] sm:max-w-[200px] truncate" title={userEmail}>
                        {userEmail}
                    </span>
                    <button
                        onClick={handleSignOut}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-bold rounded-full transition-colors"
                    >
                        로그아웃
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleSignIn}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-300"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.115-1.315.32-1.92V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    구글 로그인
                </button>
            )}
        </div>
    );

    if (state.documents.length === 0) {
        return (
            <React.Fragment>
                {authUI}
                <FileUploader />
                <IdleStateView onFileSelected={handleFileSelected} />
            </React.Fragment>
        );
    }

    return (
        <div className="flex h-full bg-white font-sans antialiased overflow-hidden">
            {authUI}
            <FileUploader />
            {/* --- FILE LIST PANEL (Mobile Overlay) --- */}
            <div className="md:hidden">
                {!isPanelCollapsed && (
                    <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setIsPanelCollapsed(true)} aria-hidden="true" />
                )}
                <aside className={`fixed top-0 left-0 h-full w-72 bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-in-out z-40 ${isPanelCollapsed ? '-translate-x-full' : 'translate-x-0'}`}>
                    <FileListPanel onFileSelected={handleFileSelected} setIsPanelCollapsed={setIsPanelCollapsed} />
                </aside>
            </div>
            
            {/* --- FILE LIST PANEL (Desktop Static Collapsible) --- */}
            <aside className={`hidden md:flex flex-shrink-0 h-full flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-14' : 'w-72'}`}>
                {isPanelCollapsed ? (
                    <div className="flex flex-col items-center pt-4">
                        <button onClick={() => setIsPanelCollapsed(false)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg" title="Expand file list" aria-label="Expand file list">
                            <MenuIcon className="text-2xl" />
                        </button>
                    </div>
                ) : (
                    <FileListPanel isDesktop={true} onFileSelected={handleFileSelected} setIsPanelCollapsed={setIsPanelCollapsed} />
                )}
            </aside>
            
            <main className="flex-1 flex min-w-0 relative">
                {activeDocument ? (
                    <div className="flex-1 flex min-w-0">
                        {/* --- PDF Viewer (Desktop Only) --- */}
                        <section className={`relative hidden md:flex flex-col flex-1 min-w-0 min-h-0 bg-slate-100 transition-all duration-300 ease-in-out ${isPdfViewerCollapsed ? 'flex-basis-0 w-0 p-0' : ''}`}>
                           <div className={`flex-1 relative min-h-0 w-full h-full ${isPdfViewerCollapsed ? 'overflow-hidden' : ''}`}>
                                <PdfContent document={activeDocument} isProcessing={isProcessing} />
                            </div>
                        </section>
                        
                        {/* --- Resizer (Desktop Only) --- */}
                        <div onMouseDown={handleResize} className={`hidden md:block w-1.5 h-full bg-slate-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors ${isPdfViewerCollapsed ? 'hidden' : ''}`} />
                        
                        {/* --- Interaction Panel --- */}
                        <section className="min-h-0 w-full md:w-auto md:flex-shrink-0" style={!isPdfViewerCollapsed ? { width: interactionPanelWidth } : { width: '100%' }}>
                            <InteractionPanel
                                key={activeDocument.id}
                                document={activeDocument}
                                onMenuClick={() => setIsPanelCollapsed(false)}
                                onPreviewClick={() => setIsPdfVisible(v => !v)}
                                isPdfVisible={isPdfVisible}
                                isPdfViewerCollapsed={isPdfViewerCollapsed}
                                onTogglePdfViewer={() => setIsPdfViewerCollapsed(v => !v)}
                            />
                        </section>

                        {/* --- PDF Viewer (Mobile Overlay) --- */}
                        <div className={`md:hidden fixed inset-0 z-20 bg-slate-100 transform transition-transform duration-500 ease-in-out ${isPdfVisible ? 'translate-y-0' : 'translate-y-full'} overflow-hidden`}>
                            <div className="relative h-full w-full">
                                <PdfContent document={activeDocument} isProcessing={isProcessing} />
                                <button
                                    onClick={() => setIsPdfVisible(false)}
                                    className="absolute top-4 right-4 z-30 w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/70 flex items-center justify-center"
                                    aria-label="Close document preview"
                                >
                                    <XIcon className="text-2xl" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-500">
                        <p>Select a document to get started.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
