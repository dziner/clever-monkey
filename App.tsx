import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from './contexts/DocumentContext';
import { IdleStateView } from './components/IdleStateView';
import { FileListPanel } from './components/FileListPanel';
import { useFileHandler } from './hooks/useFileHandler';
import { useBackgroundProcessing } from './hooks/useBackgroundProcessing';
import { PanelLeftCloseIcon, CleverMonkeyIcon, AdminPanelIcon } from './components/icons';
import { UpgradeModal, useUpgradeModal } from './components/UpgradeModal';
import { AuthModal } from './components/AuthModal';
import { NamePromptModal } from './components/NamePromptModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InactiveAccountScreen } from './components/InactiveAccountScreen';
import { OnboardingTour, tourCompleted, markTourCompleted } from './components/OnboardingTour';
import { t } from './services/uiStrings';
import { ProfilePage } from './components/ProfilePage';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } from './services/supabaseClient';
import { useUser } from './contexts/UserContext';
import { isAdminUser } from './services/adminConfig';
import { ROUTES } from './routes';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const StudyPage = React.lazy(() => import('./pages/StudyPage').then(m => ({ default: m.StudyPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const LegalPage = React.lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center bg-ink-50">
    <div className="w-7 h-7 border-2 border-ink-200 border-t-brand-600 rounded-full animate-spin" />
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
    // Drives background OCR for large scanned PDFs (poll 'queued' →
    // finalize 'ocr_ready'). Mounted here so it survives navigation
    // between routes and tab switches.
    useBackgroundProcessing();
    const navigate = useNavigate();
    const location = useLocation();
    const isLegalRoute = location.pathname === ROUTES.PRIVACY || location.pathname === ROUTES.TERMS;
    const isKnownRoute = Object.values(ROUTES).includes(location.pathname as (typeof ROUTES)[keyof typeof ROUTES]);

    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
    const { userEmail, userProfile, isAuthLoading, refreshProfile } = useUser();
    const { isOpen: isUpgradeOpen, reason: upgradeReason, openUpgrade, closeUpgrade } = useUpgradeModal();
    const isInactiveAccount = userProfile?.accountStatus === 'inactive';

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

    const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = React.useState(false);
    const handleSignOut = React.useCallback(() => {
        // Opens the confirmation; actual sign-out runs from the dialog.
        // Prevents accidental sidebar misclicks from ending a session.
        setIsSignOutConfirmOpen(true);
    }, []);
    const confirmSignOut = React.useCallback(async () => {
        const { error } = await signOut();
        if (error) console.error('Sign out failed', error);
        setIsSignOutConfirmOpen(false);
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

    // First-run onboarding tour: fire the first time a signed-in user has
    // at least one finished document. We watch processingState rather
    // than length, so a fresh upload that's still processing doesn't
    // pop the tour over a half-rendered Overview tab.
    const [isTourOpen, setIsTourOpen] = React.useState(false);
    const hasFinishedDoc = React.useMemo(
        () => state.documents.some(d => d.processingState === 'done'),
        [state.documents],
    );
    React.useEffect(() => {
        if (!userEmail || isInactiveAccount || !hasFinishedDoc || tourCompleted()) return;
        // Give the layout a beat to settle so anchor measurements land
        // on the rendered tab buttons, not the pre-mount placeholder.
        const id = window.setTimeout(() => setIsTourOpen(true), 600);
        return () => window.clearTimeout(id);
    }, [userEmail, isInactiveAccount, hasFinishedDoc]);

    const fileCount = state.documents.length;
    const totalFileSize = state.documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
    const storageUsage = formatBytes(totalFileSize);
    const planName = userProfile?.tier === 'pro' ? 'Pro' : 'Free';

    const needsName = !!userProfile && !userProfile.displayName && !isInactiveAccount;

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
            <ConfirmDialog
                isOpen={isSignOutConfirmOpen}
                onClose={() => setIsSignOutConfirmOpen(false)}
                onConfirm={confirmSignOut}
                title={t('signout.title', userProfile?.language)}
                body={t('signout.body', userProfile?.language)}
                confirmKey="signout.confirm"
            />
            <OnboardingTour
                isOpen={isTourOpen && !isInactiveAccount}
                onClose={() => { markTourCompleted(); setIsTourOpen(false); }}
            />
        </>
    );

    if (isInactiveAccount) {
        return (
            <React.Fragment>
                {authUI}
                <InactiveAccountScreen
                    email={userEmail}
                    restoreUntil={userProfile.restoreUntil}
                    onSignOut={async () => {
                        const { error } = await signOut();
                        if (error) console.error('Sign out failed', error);
                        navigate(ROUTES.STUDY);
                    }}
                />
            </React.Fragment>
        );
    }

    // Legal and 404 pages are public, full-screen routes. Keep them above
    // the "empty guest workspace" branch so /privacy, /terms, and typoed
    // URLs do not silently render the landing/upload screen.
    if (isLegalRoute) {
        return (
            <React.Fragment>
                {authUI}
                <React.Suspense fallback={<PageLoader />}>
                    <LegalPage mode={location.pathname === ROUTES.PRIVACY ? 'privacy' : 'terms'} />
                </React.Suspense>
            </React.Fragment>
        );
    }

    if (!isKnownRoute) {
        return (
            <React.Fragment>
                {authUI}
                <React.Suspense fallback={<PageLoader />}>
                    <NotFoundPage />
                </React.Suspense>
            </React.Fragment>
        );
    }

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
                    language={userProfile?.language ?? null}
                    fileCount={fileCount}
                    storageUsage={storageUsage}
                    planName={planName}
                    onBack={() => navigate(ROUTES.STUDY)}
                    onUpgrade={() => setIsAuthModalOpen(true)}
                    onNameSaved={refreshProfile}
                    onLanguageSaved={refreshProfile}
                />
            </React.Fragment>
        );
    }

    // Show loading screen while auth + documents are initializing
    if (isAuthLoading || isDocumentsLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh bg-ink-50 gap-4">
                <div className="w-24 h-24 animate-pulse">
                    <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                </div>
                <p className="text-ink-400 text-sm font-medium">Loading…</p>
            </div>
        );
    }

    // No documents — guest only. Signed-in users go straight to the
    // workspace so they can upload from there (the side panel + empty
    // state both surface upload entry points).
    if (state.documents.length === 0 && !userEmail) {
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

    const isAdmin = isAdminUser(userProfile?.role, userEmail, userProfile?.accountStatus);

    // Main layout with sidebar + routed content
    return (
        <div className="flex h-dvh bg-ink-50 font-sans antialiased overflow-hidden">
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
                <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-ink-200 transform transition-transform duration-300 ease-in-out z-40 ${isPanelCollapsed ? '-translate-x-full' : 'translate-x-0'} shadow-sheet`}>
                    <FileListPanel
                        onFileSelected={handleFileSelected}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                        onProfileClick={() => navigate(ROUTES.PROFILE)}
                        onSignOut={handleSignOut}
                        onUpgradeClick={openUpgrade}
                        onAdminClick={isAdmin ? () => navigate(ROUTES.ADMIN) : undefined}
                        onSignInClick={() => setIsAuthModalOpen(true)}
                    />
                </aside>
            </div>

            {/* Sidebar — Desktop collapsible */}
            <aside className={`hidden md:flex flex-shrink-0 h-full flex-col bg-white border-r border-ink-200 transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-14' : 'md:w-60 lg:w-72'} shadow-card z-10`}>
                {isPanelCollapsed ? (
                    <div className="flex flex-col items-center py-4 gap-1 h-full">
                        <button
                            type="button"
                            onClick={() => setIsPanelCollapsed(false)}
                            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors"
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
                        onSignInClick={() => setIsAuthModalOpen(true)}
                    />
                )}
            </aside>

            {/* Main content area — routed */}
            <main className="flex-1 flex min-w-0 relative">
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path={ROUTES.STUDY} element={<StudyPage onMenuClick={() => setIsPanelCollapsed(false)} isGuest={!userEmail} onSignInClick={() => setIsAuthModalOpen(true)} onFileSelected={handleFileSelected} />} />
                    <Route path={ROUTES.PRIVACY} element={<LegalPage mode="privacy" />} />
                    <Route path={ROUTES.TERMS} element={<LegalPage mode="terms" />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </React.Suspense>
            </main>
        </div>
    );
};

export default App;
