import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from './contexts/DocumentContext';
import { IdleStateView } from './components/IdleStateView';
import { FileListPanel } from './components/FileListPanel';
import { useFileHandler } from './hooks/useFileHandler';
import { PanelLeftCloseIcon, CleverMonkeyIcon, AdminPanelIcon } from './components/icons';
import { UpgradeModal, useUpgradeModal } from './components/UpgradeModal';
import { AuthModal } from './components/AuthModal';
import { NamePromptModal } from './components/NamePromptModal';
import { ProfilePage } from './components/ProfilePage';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } from './services/supabaseClient';
import { useUser } from './contexts/UserContext';
import { ROUTES } from './routes';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const StudyPage = React.lazy(() => import('./pages/StudyPage').then(m => ({ default: m.StudyPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center bg-slate-50">
    <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
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


const App: React.FC = () => {
    const { state, isLoading: isDocumentsLoading } = useDocuments();
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
    const handleFileSelected = useFileHandler(() => setIsAuthModalOpen(true));
    const navigate = useNavigate();
    const location = useLocation();

    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
    const { userEmail, userProfile, isAuthLoading, refreshProfile } = useUser();
    const { isOpen: isUpgradeOpen, reason: upgradeReason, openUpgrade, closeUpgrade } = useUpgradeModal();

    useKeyboardShortcuts([
        { key: 'Escape', handler: () => setIsPanelCollapsed(true) },
        { key: 'b', handler: () => setIsPanelCollapsed(prev => !prev) },
    ]);

    const handleSignIn = React.useCallback(async () => {
        const { error } = await signInWithGoogle();
        if (error) console.error('Google sign-in failed', error);
    }, []);

    const handleEmailSignIn = React.useCallback(async (email: string, password: string) => {
        const { error } = await signInWithEmail(email, password);
        return error?.message ?? null;
    }, []);

    const handleEmailSignUp = React.useCallback(async (email: string, password: string, displayName: string) => {
        const { error } = await signUpWithEmail(email, password, displayName);
        return error?.message ?? null;
    }, []);

    const handleSignOut = React.useCallback(async () => {
        const { error } = await signOut();
        if (error) console.error('Sign out failed', error);
    }, []);

    React.useEffect(() => {
        if (window.innerWidth < 1024) setIsPanelCollapsed(true);
        else setIsPanelCollapsed(false);
    }, []);

    React.useEffect(() => {
        if (state.documents.length === 0) document.body.style.overflow = 'auto';
        else document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'hidden'; };
    }, [state.documents.length]);

    const fileCount = state.documents.length;
    const totalFileSize = state.documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
    const storageUsage = formatBytes(totalFileSize);
    const planName = userProfile?.tier === 'pro' ? 'Pro' : 'Free';

    const needsName = !!userProfile && !userProfile.displayName;

    const authUI = (
        <>
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onGoogleSignIn={handleSignIn}
                onEmailSignIn={handleEmailSignIn}
                onEmailSignUp={handleEmailSignUp}
            />
            <NamePromptModal isOpen={needsName} onSaved={refreshProfile} />
        </>
    );

    // Admin page — full screen, no sidebar
    if (location.pathname === ROUTES.ADMIN) {
        return (
            <React.Fragment>
                {authUI}
                <UpgradeModal isOpen={isUpgradeOpen} reason={upgradeReason} onClose={closeUpgrade} />
                <React.Suspense fallback={<PageLoader />}>
                    <AdminPage onMenuClick={() => {}} />
                </React.Suspense>
            </React.Fragment>
        );
    }

    // Profile page — full screen, no sidebar
    if (location.pathname === ROUTES.PROFILE) {
        return (
            <React.Fragment>
                {authUI}
                <ProfilePage
                    userEmail={userEmail}
                    displayName={userProfile?.displayName ?? null}
                    fileCount={fileCount}
                    storageUsage={storageUsage}
                    planName={planName}
                    onBack={() => navigate(ROUTES.STUDY)}
                    onUpgrade={() => setIsAuthModalOpen(true)}
                    onNameSaved={refreshProfile}
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
                {authUI}
                <IdleStateView
                    onFileSelected={handleFileSelected}
                    userEmail={userEmail}
                    onSignInClick={() => setIsAuthModalOpen(true)}
                />
            </React.Fragment>
        );
    }

    const isAdmin = userProfile?.role === 'admin';

    // Main layout with sidebar + routed content
    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden">
            {authUI}
            <UpgradeModal isOpen={isUpgradeOpen} reason={upgradeReason} onClose={closeUpgrade} />

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
                        onProfileClick={() => navigate(ROUTES.PROFILE)}
                        onSignOut={handleSignOut}
                        onUpgradeClick={openUpgrade}
                        onAdminClick={isAdmin ? () => navigate(ROUTES.ADMIN) : undefined}
                    />
                </aside>
            </div>

            {/* Sidebar — Desktop collapsible */}
            <aside className={`hidden md:flex flex-shrink-0 h-full flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-14' : 'md:w-60 lg:w-72'} shadow-[1px_0_20px_0_rgba(0,0,0,0.02)] z-10`}>
                {isPanelCollapsed ? (
                    <div className="flex flex-col items-center py-4 gap-1 h-full">
                        <button
                            type="button"
                            onClick={() => setIsPanelCollapsed(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Expand sources panel"
                            aria-label="Expand sources panel"
                        >
                            <PanelLeftCloseIcon />
                        </button>
                    </div>
                ) : (
                    <FileListPanel
                        isDesktop={true}
                        onFileSelected={handleFileSelected}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                        onProfileClick={() => navigate(ROUTES.PROFILE)}
                        onSignOut={handleSignOut}
                        onUpgradeClick={openUpgrade}
                        onAdminClick={isAdmin ? () => navigate(ROUTES.ADMIN) : undefined}
                    />
                )}
            </aside>

            {/* Main content area — routed */}
            <main className="flex-1 flex min-w-0 relative">
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path={ROUTES.STUDY} element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                    <Route path="*" element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} />} />
                </Routes>
              </React.Suspense>
            </main>
        </div>
    );
};

export default App;
