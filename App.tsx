
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
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, supabase } from './services/supabaseClient';
import type { DocumentData, DocumentProcessingState, AnnotationAnchor } from './types';

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

const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unitIndex]}`;
};

const PdfContent: React.FC<{ document: DocumentData | undefined; isProcessing: boolean; onSelection?: (anchor: AnnotationAnchor) => void; onPageChange?: (page: number) => void }> = ({ document, isProcessing, onSelection, onPageChange }) => {
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
                  annotations={document.annotations}
                  currentPage={document.currentPage}
                  onSelection={onSelection}
                  onPageChange={onPageChange}
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
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
    const [pendingAnnotation, setPendingAnnotation] = React.useState<AnnotationAnchor | null>(null);
    const [route, setRoute] = React.useState(window.location.pathname);

    const activeDocument = state.documents.find(d => d.id === state.activeDocumentId);
    const isProcessing = activeDocument?.processingState !== 'done' && activeDocument?.processingState !== 'error';

    const handlePageChange = React.useCallback((page: number) => {
        if (!activeDocument) return;
        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { docId: activeDocument.id, updates: { currentPage: page } },
        });
    }, [activeDocument, dispatch]);

    const handleSignIn = React.useCallback(async () => {
        const { error } = await signInWithGoogle();
        if (error) {
            console.error('Google sign-in failed', error);
        }
    }, []);

    const handleEmailSignIn = React.useCallback(async (email: string, password: string) => {
        const { error } = await signInWithEmail(email, password);
        return error?.message ?? null;
    }, []);

    const handleEmailSignUp = React.useCallback(async (email: string, password: string) => {
        const { error } = await signUpWithEmail(email, password);
        return error?.message ?? null;
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
        const handlePopState = () => setRoute(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
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
        <React.Fragment>
            <div className="fixed top-4 right-4 z-50 flex items-center gap-3 pointer-events-auto">
                {isAuthLoading ? (
                    <div className="bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-full shadow-sm">
                        <span className="text-sm text-slate-400 font-medium animate-pulse">Loading...</span>
                    </div>
                ) : !userEmail && state.documents.length === 0 && (
                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white border border-transparent px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105 transition-all duration-300"
                    >
                        Sign In / Sign Up
                    </button>
                )}
            </div>
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
                onGoogleSignIn={handleSignIn}
                onEmailSignIn={handleEmailSignIn}
                onEmailSignUp={handleEmailSignUp}
            />
        </React.Fragment>
    );

    const isProfileView = route === '/profile';
    const fileCount = state.documents.length;
    const totalFileSize = state.documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
    const storageUsage = formatBytes(totalFileSize);
    const planName = 'Free';

    if (isProfileView) {
        return (
            <React.Fragment>
                {authUI}
                <ProfilePage
                    userEmail={userEmail}
                    fileCount={fileCount}
                    storageUsage={storageUsage}
                    planName={planName}
                    onBack={() => {
                        window.history.pushState({}, '', '/');
                        setRoute('/');
                    }}
                    onUpgrade={() => setIsAuthModalOpen(true)}
                />
            </React.Fragment>
        );
    }

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
        <div className="flex h-full bg-slate-50 font-sans antialiased overflow-hidden">
            {authUI}
            <FileUploader />
            {/* --- FILE LIST PANEL (Mobile Overlay) --- */}
            <div className="md:hidden">
                {!isPanelCollapsed && (
                    <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setIsPanelCollapsed(true)} aria-hidden="true" />
                )}
                <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out z-40 ${isPanelCollapsed ? '-translate-x-full' : 'translate-x-0'} shadow-2xl`}>
                    <FileListPanel
                        onFileSelected={handleFileSelected}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                        userEmail={userEmail}
                        planName={planName}
                        fileCount={fileCount}
                        storageUsage={storageUsage}
                        onProfileClick={() => {
                            window.history.pushState({}, '', '/profile');
                            setRoute('/profile');
                        }}
                        onSignOut={handleSignOut}
                    />
                </aside>
            </div>
            
            {/* --- FILE LIST PANEL (Desktop Static Collapsible) --- */}
            <aside className={`hidden md:flex flex-shrink-0 h-full flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-16' : 'w-72'} shadow-[1px_0_20px_0_rgba(0,0,0,0.02)] z-10`}>
                {isPanelCollapsed ? (
                    <div className="flex flex-col items-center pt-4">
                        <button onClick={() => setIsPanelCollapsed(false)} className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" title="Expand file list" aria-label="Expand file list">
                            <MenuIcon className="text-2xl" />
                        </button>
                    </div>
                ) : (
                    <FileListPanel
                        isDesktop={true}
                        onFileSelected={handleFileSelected}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                        userEmail={userEmail}
                        planName={planName}
                        fileCount={fileCount}
                        storageUsage={storageUsage}
                        onProfileClick={() => {
                            window.history.pushState({}, '', '/profile');
                            setRoute('/profile');
                        }}
                        onSignOut={handleSignOut}
                    />
                )}
            </aside>
            
            <main className="flex-1 flex min-w-0 relative">
                {activeDocument ? (
                    <div className="flex-1 flex min-w-0">
                        {/* --- PDF Viewer (Desktop Only) --- */}
                        <section className={`relative hidden md:flex flex-col flex-1 min-w-0 min-h-0 bg-slate-100 transition-all duration-300 ease-in-out ${isPdfViewerCollapsed ? 'flex-basis-0 w-0 p-0' : ''}`}>
                           <div className={`flex-1 relative min-h-0 w-full h-full ${isPdfViewerCollapsed ? 'overflow-hidden' : ''}`}>
                                <PdfContent document={activeDocument} isProcessing={isProcessing} onSelection={setPendingAnnotation} onPageChange={handlePageChange} />
                            </div>
                        </section>
                        
                        {/* --- Resizer (Desktop Only) --- */}
                        <div 
                            onMouseDown={handleResize} 
                            className={`hidden md:flex items-center justify-center w-3 h-full bg-slate-50 border-l border-slate-200 hover:bg-blue-50 cursor-col-resize flex-shrink-0 transition-colors group z-20 ${isPdfViewerCollapsed ? 'hidden' : ''}`}
                        >
                            <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
                        </div>
                        
                        {/* --- Interaction Panel --- */}
                        <section className="min-h-0 w-full md:w-auto md:flex-shrink-0 bg-white border-l border-slate-200 shadow-xl z-10" style={!isPdfViewerCollapsed ? { width: interactionPanelWidth } : { width: '100%' }}>
                            <InteractionPanel
                                key={activeDocument.id}
                                document={activeDocument}
                                onMenuClick={() => setIsPanelCollapsed(false)}
                                onPreviewClick={() => setIsPdfVisible(v => !v)}
                                isPdfVisible={isPdfVisible}
                                isPdfViewerCollapsed={isPdfViewerCollapsed}
                                onTogglePdfViewer={() => setIsPdfViewerCollapsed(v => !v)}
                                pendingAnnotation={pendingAnnotation}
                                onClearPendingAnnotation={() => setPendingAnnotation(null)}
                            />
                        </section>

                        {/* --- PDF Viewer (Mobile Overlay) --- */}
                        <div className={`md:hidden fixed inset-0 z-20 bg-slate-100 transform transition-transform duration-500 ease-in-out ${isPdfVisible ? 'translate-y-0' : 'translate-y-full'} overflow-hidden`}>
                            <div className="relative h-full w-full">
                                <PdfContent document={activeDocument} isProcessing={isProcessing} onSelection={setPendingAnnotation} onPageChange={handlePageChange} />
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
