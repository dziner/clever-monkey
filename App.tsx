import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from './contexts/DocumentContext';
import { IdleStateView } from './components/IdleStateView';
import { FileListPanel } from './components/FileListPanel';
import { Spinner } from './components/Spinner';
import { useFileHandler } from './hooks/useFileHandler';
import { MenuIcon, HomeIcon, ErrorOutlineIcon, StyleIcon, AccountTreeIcon, SlideshowIcon, HeadphonesIcon } from './components/icons';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, supabase } from './services/supabaseClient';
import { StudyPage } from './pages/StudyPage';
import { WrongAnswersPage } from './pages/WrongAnswersPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { MindMapPage } from './pages/MindMapPage';
import { SlidesPage } from './pages/SlidesPage';
import { PodcastPage } from './pages/PodcastPage';
import { CleverMonkeyIcon } from './components/icons';

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

const NAV_ITEMS = [
    { path: '/', label: 'Study', icon: HomeIcon },
    { path: '/wrong-answers', label: '오답노트', icon: ErrorOutlineIcon },
    { path: '/flashcards', label: 'Flashcards', icon: StyleIcon },
    { path: '/mindmap', label: 'Mind Map', icon: AccountTreeIcon },
    { path: '/slides', label: 'Slides', icon: SlideshowIcon },
    { path: '/podcast', label: 'Podcast', icon: HeadphonesIcon },
] as const;

const App: React.FC = () => {
    const { state, isLoading: isDocumentsLoading } = useDocuments();
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
    const handleFileSelected = useFileHandler(() => setIsAuthModalOpen(true));
    const navigate = useNavigate();
    const location = useLocation();

    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);

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
        <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onGoogleSignIn={handleSignIn}
            onEmailSignIn={handleEmailSignIn}
            onEmailSignUp={handleEmailSignUp}
        />
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

    // Show loading screen while auth + documents are initializing
    if (isAuthLoading || isDocumentsLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 gap-4">
                <CleverMonkeyIcon className="w-20 h-20 text-blue-600 animate-pulse" />
                <p className="text-slate-400 text-sm font-medium">Loading…</p>
            </div>
        );
    }

    // No documents — idle/landing state, full screen
    if (state.documents.length === 0) {
        return (
            <React.Fragment>
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    onGoogleSignIn={handleSignIn}
                    onEmailSignIn={handleEmailSignIn}
                    onEmailSignUp={handleEmailSignUp}
                />
                <IdleStateView
                    onFileSelected={handleFileSelected}
                    userEmail={userEmail}
                    onSignInClick={() => setIsAuthModalOpen(true)}
                />
            </React.Fragment>
        );
    }

    // Main layout with sidebar + routed content
    return (
        <div className="flex h-full bg-slate-50 font-sans antialiased overflow-hidden">
            {authUI}

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
                    <div className="flex flex-col items-center py-4 gap-1 h-full">
                        <button
                            type="button"
                            onClick={() => setIsPanelCollapsed(false)}
                            className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors mb-1"
                            title="Expand sidebar"
                            aria-label="Expand sidebar"
                        >
                            <MenuIcon className="text-2xl" />
                        </button>
                        <div className="w-8 h-px bg-slate-100 mb-1" />
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.path}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className={`p-3 rounded-xl transition-colors ${
                                    location.pathname === item.path
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                                title={item.label}
                                aria-label={item.label}
                            >
                                <item.icon className="text-2xl" />
                            </button>
                        ))}
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
            <main className="flex-1 flex min-w-0 relative pb-16 md:pb-0">
                <Routes>
                    <Route path="/" element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/wrong-answers" element={<WrongAnswersPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/flashcards" element={<FlashcardsPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/mindmap" element={<MindMapPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/slides" element={<SlidesPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="/podcast" element={<PodcastPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="*" element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                </Routes>
            </main>

            {/* Mobile bottom navigation bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 flex">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                            location.pathname === item.path
                                ? 'text-blue-700'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                        aria-label={item.label}
                    >
                        <item.icon className="text-xl" />
                        <span className="text-[9px] font-semibold leading-none truncate max-w-[52px] text-center">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default App;
