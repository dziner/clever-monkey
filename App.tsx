import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from './contexts/DocumentContext';
import { IdleStateView } from './components/IdleStateView';
import { FileListPanel } from './components/FileListPanel';
import { Spinner } from './components/Spinner';
import { useFileHandler } from './hooks/useFileHandler';
import { MenuIcon } from './components/icons';
import { FileUploader } from './components/FileUploader';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, supabase } from './services/supabaseClient';
import { StudyPage } from './pages/StudyPage';
import { WrongAnswersPage } from './pages/WrongAnswersPage';
import { FlashcardsPage } from './pages/FlashcardsPage';

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

const App: React.FC = () => {
    const { state } = useDocuments();
    const handleFileSelected = useFileHandler();
    const navigate = useNavigate();
    const location = useLocation();

    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

    const handleSignIn = React.useCallback(async () => {
        const { error } = await signInWithGoogle();
        if (error) console.error('Google sign-in failed', error);
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
        if (error) console.error('Sign out failed', error);
    }, []);

    React.useEffect(() => {
        if (window.innerWidth < 768) setIsPanelCollapsed(true);
        else setIsPanelCollapsed(false);
    }, []);

    React.useEffect(() => {
        let isMounted = true;
        supabase.auth.getSession().then(({ data, error }) => {
            if (!isMounted) return;
            if (error) console.error('Failed to load session', error);
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
        if (state.documents.length === 0) document.body.style.overflow = 'auto';
        else document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'hidden'; };
    }, [state.documents.length]);

    const fileCount = state.documents.length;
    const totalFileSize = state.documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
    const storageUsage = formatBytes(totalFileSize);
    const planName = 'Free';

    const authUI = (
        <React.Fragment>
            <div className="fixed top-4 right-4 z-50 flex items-center gap-3 pointer-events-auto">
                {isAuthLoading ? (
                    <div className="bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-full shadow-sm">
                        <span className="text-sm text-slate-400 font-medium animate-pulse">Loading...</span>
                    </div>
                ) : !userEmail && state.documents.length === 0 && (
                    <button
                        type="button"
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

    // Profile page — full screen, no sidebar
    if (location.pathname === '/profile') {
        return (
            <React.Fragment>
                {authUI}
                <ProfilePage
                    userEmail={userEmail}
                    fileCount={fileCount}
                    storageUsage={storageUsage}
                    planName={planName}
                    onBack={() => navigate('/')}
                    onUpgrade={() => setIsAuthModalOpen(true)}
                />
            </React.Fragment>
        );
    }

    // No documents — idle state, full screen
    if (state.documents.length === 0) {
        return (
            <React.Fragment>
                {authUI}
                <FileUploader />
                <IdleStateView onFileSelected={handleFileSelected} />
            </React.Fragment>
        );
    }

    // Main layout with sidebar + routed content
    return (
        <div className="flex h-full bg-slate-50 font-sans antialiased overflow-hidden">
            {authUI}
            <FileUploader />

            {/* Sidebar — Mobile overlay */}
            <div className="md:hidden">
                {!isPanelCollapsed && (
                    <button
                        type="button"
                        className="fixed inset-0 bg-black/60 z-30"
                        onClick={() => setIsPanelCollapsed(true)}
                        aria-label="Close file list"
                    />
                )}
                <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out z-40 ${isPanelCollapsed ? '-translate-x-full' : 'translate-x-0'} shadow-2xl`}>
                    <FileListPanel
                        onFileSelected={handleFileSelected}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                        userEmail={userEmail}
                        planName={planName}
                        onProfileClick={() => navigate('/profile')}
                        onSignOut={handleSignOut}
                    />
                </aside>
            </div>

            {/* Sidebar — Desktop collapsible */}
            <aside className={`hidden md:flex flex-shrink-0 h-full flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-16' : 'w-72'} shadow-[1px_0_20px_0_rgba(0,0,0,0.02)] z-10`}>
                {isPanelCollapsed ? (
                    <div className="flex flex-col items-center pt-4">
                        <button
                            type="button"
                            onClick={() => setIsPanelCollapsed(false)}
                            className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Expand file list"
                            aria-label="Expand file list"
                        >
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
                        onProfileClick={() => navigate('/profile')}
                        onSignOut={handleSignOut}
                    />
                )}
            </aside>

            {/* Main content area — routed */}
            <main className="flex-1 flex min-w-0 relative">
                <Routes>
                    <Route path="/" element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/wrong-answers" element={<WrongAnswersPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/flashcards" element={<FlashcardsPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="*" element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                </Routes>
            </main>
        </div>
    );
};

export default App;
