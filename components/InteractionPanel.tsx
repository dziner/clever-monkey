import * as React from 'react';
import type { DocumentData, ChatMessage, QuizData, FRQData, MCQQuizState, FRQQuizState, QuizTabState } from '../types';
import { MenuIcon, PreviewIcon, PanelRightCloseIcon, DocumentIcon, CleverMonkeyIcon } from './icons';
import { OverviewTab } from './OverviewTab';
import { MindMapTab } from './MindMapTab';
import { FlashcardsTab } from './FlashcardsTab';
import { PodcastTab } from './PodcastTab';
import { LoginRequired } from './LoginRequired';
import { fetchWrongAnswers, markReviewed, deleteWrongAnswer } from '../services/wrongAnswersService';
import type { WrongAnswerRecord } from '../services/wrongAnswersService';
import { supabase } from '../services/supabaseClient';
import { Quiz } from './Quiz';
import { InteractionTabs } from './InteractionTabs';
import { ChatTabPanel } from './ChatTabPanel';
import { QuizTabPanel, type QuizView } from './QuizTabPanel';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { Spinner } from './Spinner';
import { useChat } from '../hooks/useChat';
import { t } from '../services/uiStrings';
import { generateQuiz } from '../services/geminiService';
import { saveQuizSession } from '../services/wrongAnswersService';
import { fetchRecentQuestions, recordSeenQuestions } from '../services/quizMemoryService';
import { getErrorMessage } from '../utils/errors';

export type ActiveTab = 'overview' | 'chat' | 'quiz' | 'mindmap' | 'flashcards' | 'podcast';

interface InteractionPanelProps {
    document: DocumentData;
    onMenuClick: () => void;
    onPreviewClick: () => void;
    isPdfVisible: boolean;
    isPdfViewerCollapsed: boolean;
    onTogglePdfViewer: () => void;
    onToggleRightPanel?: () => void;

    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;

    /**
     * Guest mode locks Quiz/Mind Map/Flashcards/Podcast. When true the
     * corresponding tabs render a <LoginRequired/> gate instead of their
     * normal content, and their tab buttons show a small lock indicator.
     */
    isGuest?: boolean;
    onSignInClick?: () => void;
}

// ─────────────────────────────────────────────────────────────

export const InteractionPanel: React.FC<InteractionPanelProps> = ({
    document,
    onMenuClick,
    onPreviewClick,
    isPdfVisible,
    isPdfViewerCollapsed,
    onTogglePdfViewer,
    onToggleRightPanel,
    activeTab,
    onTabChange,
    isGuest = false,
    onSignInClick,
}) => {
    const { dispatch } = useDocuments();
    const { userProfile, userId } = useUser();
    const language = userProfile?.language ?? null;
    // activeTab is controlled by prop from StudyPage

    // Wrong answers sub-view within Quiz tab (QuizView type defined in
    // ./QuizTabPanel — re-exported so this stays one source of truth).
    const [quizView, setQuizView] = React.useState<QuizView>('quiz');
    const [wrongAnswers, setWrongAnswers] = React.useState<WrongAnswerRecord[]>([]);
    const [isLoadingWA, setIsLoadingWA] = React.useState(false);
    const [isLoggedInWA, setIsLoggedInWA] = React.useState(false);
    const waLoadedRef = React.useRef(false);

    const [isPresetQuestionsOpen, setIsPresetQuestionsOpen] = React.useState(false);
    const [chatSearch, setChatSearch] = React.useState('');
    const [isChatSearchOpen, setIsChatSearchOpen] = React.useState(false);
    const chatSearchRef = React.useRef<HTMLInputElement>(null);

    // State for quiz generation status in the quiz tab
    const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
    const [quizError, setQuizError] = React.useState<string | null>(null);

    // New state for the initial conversational flow
    const [isPreparingSuggestions, setIsPreparingSuggestions] = React.useState(false);
    const [canShowPresetQuestions, setCanShowPresetQuestions] = React.useState(document.chatHistory.length > 1);

    const chatContainerRef = React.useRef<HTMLDivElement>(null);

    const onChatHistoryChange = (chatHistory: ChatMessage[]) => {
        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { docId: document.id, updates: { chatHistory } }
        });
    };

    const {
        isBotTyping,
        handleSendMessage,
        handleScopeChange,
        handleMonkeyModeChange,
    } = useChat(document, onChatHistoryChange);

    React.useEffect(() => {
        setQuizError(null);
        setChatSearch('');
        setIsChatSearchOpen(false);
        setQuizView('quiz');
        waLoadedRef.current = false;
        setWrongAnswers([]);
    }, [document.id]);

    const loadWrongAnswers = React.useCallback(async () => {
        if (waLoadedRef.current) return;
        waLoadedRef.current = true;
        setIsLoadingWA(true);
        const { data } = await supabase.auth.getUser();
        if (!data.user) { setIsLoggedInWA(false); setIsLoadingWA(false); return; }
        setIsLoggedInWA(true);
        const all = await fetchWrongAnswers();
        setWrongAnswers(all.filter(w => w.documentId === document.id));
        setIsLoadingWA(false);
    }, [document.id]);

    React.useEffect(() => {
        if (quizView === 'wrong_answers') loadWrongAnswers();
    }, [quizView, loadWrongAnswers]);

    const handleMarkReviewed = async (id: string) => {
        const ok = await markReviewed(id);
        if (ok) setWrongAnswers(prev => prev.map(w => w.id === id ? { ...w, reviewedAt: new Date().toISOString() } : w));
    };

    const handleDeleteWA = async (id: string) => {
        const ok = await deleteWrongAnswer(id);
        if (ok) setWrongAnswers(prev => prev.filter(w => w.id !== id));
    };

    React.useEffect(() => {
        if (isChatSearchOpen) chatSearchRef.current?.focus();
    }, [isChatSearchOpen]);

    const toggleChatSearch = React.useCallback(() => {
        setIsChatSearchOpen(v => {
            if (v) setChatSearch('');
            return !v;
        });
    }, []);

    // Effect to manage the initial chat sequence and preset questions visibility
    React.useEffect(() => {
        // This sequence runs only on the first view of the chat for a new document.
        if (document.chatHistory.length === 1) {
            setIsPreparingSuggestions(true);
            const timer = setTimeout(() => {
                setIsPreparingSuggestions(false);
                setCanShowPresetQuestions(true);
            }, 2500); // Wait for 2.5 seconds to simulate "thinking"

            return () => clearTimeout(timer);
        }
    }, [document.id]);

    // Effect to control the accordion state of the preset questions
    React.useEffect(() => {
        // If it's the first chat and questions are now ready to be shown, open the accordion.
        if (document.chatHistory.length === 1 && canShowPresetQuestions) {
            setIsPresetQuestionsOpen(true);
        } else {
            // Otherwise (e.g., after sending a message), default to closed.
            setIsPresetQuestionsOpen(false);
        }
    }, [document.chatHistory.length, canShowPresetQuestions]);

    const handleCreateAnotherQuizInChat = () => {
        handleSendMessage("Create another quiz for me based on the document.");
    };

    const handleQuizStateChangeInChat = (messageIndex: number, newState: MCQQuizState) => {
        const newChatHistory = document.chatHistory.map((msg, idx) => {
            if (idx === messageIndex && msg.type === 'quiz') {
                return { ...msg, quizState: newState };
            }
            return msg;
        });
        onChatHistoryChange(newChatHistory);
    };

    const prevChatHistoryLength = React.useRef(document.chatHistory.length);
    const scrollSnapshot = React.useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

    React.useLayoutEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        // Priority 1: A new message has been added. Always scroll to the bottom.
        if (document.chatHistory.length > prevChatHistoryLength.current) {
            container.scrollTop = container.scrollHeight;
        }
        // Priority 2: Not a new message, but some other layout change (like toggling questions).
        // Restore scroll position to keep the viewport stable.
        else if (scrollSnapshot.current) {
            const scrollOffset = container.scrollHeight - scrollSnapshot.current.scrollHeight;
            container.scrollTop = scrollSnapshot.current.scrollTop + scrollOffset;
        }

        // After every layout effect, update the refs for the *next* render cycle.
        prevChatHistoryLength.current = document.chatHistory.length;
        scrollSnapshot.current = {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
        };

        // This effect should run whenever the content that affects scroll might change.
        // The chat history length covers new messages, and the preset questions toggle.
    }, [document.chatHistory.length, isPresetQuestionsOpen, activeTab, canShowPresetQuestions]);


    const handleGenerateQuiz = async (type: 'mcq' | 'frq', count: number) => {
        if (!document.documentContent) {
            setQuizError(t('quiz.docMissing', language));
            return;
        }
        setIsGeneratingQuiz(true);
        setQuizError(null);
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: document.id, updates: { quizTabData: null } } });

        try {
            // Pull the user's recent stems for this (doc, type) before
            // generating so we can tell the model what to AVOID. Fetch
            // failures are silently treated as "no history" — repeating
            // a question is annoying, but blocking generation outright
            // because the history fetch flaked is worse.
            const recentQuestions = await fetchRecentQuestions(userId, document.id, type);
            const data = await generateQuiz(
                document.documentContent, document.model, type, count, undefined, language, recentQuestions,
            );
            const initialQuizState: QuizTabState = type === 'mcq'
                ? { type: 'mcq', userAnswers: [], isFinished: false, currentQuestionIndex: 0 }
                : { type: 'frq', userAnswers: [], currentQuestionIndex: 0, isFinished: false, isGrading: false };

            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: {
                        quizTabData: {
                            quizContent: data,
                            quizState: initialQuizState,
                        }
                    }
                }
            });

            // Record what we just generated so the NEXT attempt avoids
            // these stems. Fire-and-forget: persist errors are logged
            // but never block the user from taking the quiz they can
            // already see on screen.
            void recordSeenQuestions(
                userId, document.id, type,
                data.questions.map(q => q.questionText),
            );
        } catch (error) {
            console.error("Failed to generate quiz:", error);
            setQuizError(getErrorMessage(error));
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleStartNewQuizInTab = () => {
        setQuizError(null);
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: document.id, updates: { quizTabData: null } } });
    };

    const handleStudyTipsGenerated = (tips: string) => {
        if (document.quizTabData) {
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: { quizTabData: { ...document.quizTabData, studyTips: tips } }
                }
            });
        }
    };

    const handleQuizTabStateChange = (newState: QuizTabState) => {
        if (document.quizTabData) {
            const prevState = document.quizTabData.quizState;
            const restarting = prevState.isFinished && !newState.isFinished;
            const updatedQuizTabData = {
                ...document.quizTabData,
                quizState: newState,
                // When a finished quiz is restarted, clear the previous study tips.
                ...(restarting ? { studyTips: undefined } : {}),
            };

            // Save wrong answers on quiz completion (fire-and-forget)
            const justFinishedMCQ = newState.type === 'mcq' && !prevState.isFinished && newState.isFinished;
            const justFinishedFRQ = newState.type === 'frq' &&
                newState.isFinished && !(newState as FRQQuizState).isGrading &&
                !!(prevState as FRQQuizState).isGrading;

            if (justFinishedMCQ || justFinishedFRQ) {
                saveQuizSession(
                    document.id,
                    document.fileName,
                    document.quizTabData.quizContent,
                    newState
                ).catch(err => console.error('Failed to save quiz session:', err));
            }

            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: { quizTabData: updatedQuizTabData }
                }
            });
        }
    };

    const handleRestartQuizWithNewData = (newQuizData: QuizData | FRQData) => {
        if (!document.quizTabData) return;

        const newQuizType = 'options' in newQuizData.questions[0] ? 'mcq' : 'frq';

        const initialQuizState: QuizTabState = newQuizType === 'mcq'
            ? { type: 'mcq', userAnswers: [], isFinished: false, currentQuestionIndex: 0 }
            : { type: 'frq', userAnswers: [], currentQuestionIndex: 0, isFinished: false, isGrading: false };

        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: {
                docId: document.id,
                updates: {
                    quizTabData: {
                        quizContent: newQuizData,
                        quizState: initialQuizState,
                    }
                }
            }
        });
    };

    const isProcessing = document.processingState !== 'done' && document.processingState !== 'error';
    const quizTabData = document.quizTabData;



    const tabBar = (
        <InteractionTabs activeTab={activeTab} isGuest={isGuest} onTabChange={onTabChange} />
    );

    const MainContent = () => {
        return (
            <React.Fragment>
                <div className="hidden md:flex flex-shrink-0">
                    {tabBar}
                </div>

                <div className={`flex-1 flex-col min-h-0 ${activeTab === 'overview' ? 'flex' : 'hidden'}`}>
                    <OverviewTab document={document} onSelectTab={onTabChange} />
                </div>

                <ChatTabPanel
                    document={document}
                    active={activeTab === 'chat'}
                    chatSearch={chatSearch}
                    setChatSearch={setChatSearch}
                    isChatSearchOpen={isChatSearchOpen}
                    toggleChatSearch={toggleChatSearch}
                    chatSearchRef={chatSearchRef}
                    chatContainerRef={chatContainerRef}
                    isBotTyping={isBotTyping}
                    isPreparingSuggestions={isPreparingSuggestions}
                    onSendMessage={handleSendMessage}
                    onCreateAnotherQuiz={handleCreateAnotherQuizInChat}
                    onQuizStateChange={handleQuizStateChangeInChat}
                    onTabChange={onTabChange}
                    canShowPresetQuestions={canShowPresetQuestions}
                    isPresetQuestionsOpen={isPresetQuestionsOpen}
                    setIsPresetQuestionsOpen={setIsPresetQuestionsOpen}
                    onMonkeyModeChange={handleMonkeyModeChange}
                    onScopeChange={handleScopeChange}
                />

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'mindmap' ? 'flex' : 'hidden'}`}>
                    {isGuest
                        ? <LoginRequired feature="마인드맵" onSignInClick={onSignInClick} />
                        : <MindMapTab document={document} />}
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'flashcards' ? 'flex' : 'hidden'}`}>
                    {isGuest
                        ? <LoginRequired feature="플래시카드" onSignInClick={onSignInClick} />
                        : <FlashcardsTab document={document} />}
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'podcast' ? 'flex' : 'hidden'}`}>
                    {isGuest
                        ? <LoginRequired feature="팟캐스트" onSignInClick={onSignInClick} />
                        : <PodcastTab document={document} />}
                </div>

                <QuizTabPanel
                    document={document}
                    active={activeTab === 'quiz'}
                    isGuest={isGuest}
                    onSignInClick={onSignInClick}
                    quizView={quizView}
                    setQuizView={setQuizView}
                    isGeneratingQuiz={isGeneratingQuiz}
                    quizError={quizError}
                    quizTabData={quizTabData}
                    onGenerate={handleGenerateQuiz}
                    onStartNewQuiz={handleStartNewQuizInTab}
                    onQuizTabStateChange={handleQuizTabStateChange}
                    onRestartWithNewData={handleRestartQuizWithNewData}
                    onStudyTipsGenerated={handleStudyTipsGenerated}
                    wrongAnswers={wrongAnswers}
                    isLoadingWA={isLoadingWA}
                    isLoggedInWA={isLoggedInWA}
                    onMarkReviewed={handleMarkReviewed}
                    onDeleteWA={handleDeleteWA}
                    onTabChange={onTabChange}
                />

            </React.Fragment>
        )
    }

    const activeTabLabel: Record<ActiveTab, string> = {
        overview: 'Overview',
        chat: 'Chat',
        quiz: 'Quiz',
        mindmap: 'Mind Map',
        flashcards: 'Flashcards',
        podcast: 'Podcast',
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header for both Mobile and Desktop */}
            <div className="flex-shrink-0 border-b border-ink-200 bg-white">
                <div className="p-3 h-14 flex items-center justify-between gap-2">
                    {/* Left side: Menu for mobile, PDF toggle for desktop */}
                    <button type="button" onClick={onMenuClick} className="p-2 text-ink-700 rounded-lg hover:bg-ink-100 md:hidden" aria-label="Open file menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <button
                        onClick={onTogglePdfViewer}
                        className="hidden md:inline-flex p-2 text-ink-400 rounded-lg hover:text-ink-700 hover:bg-ink-100 transition-colors"
                        aria-label={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                        title={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                    >
                        <DocumentIcon className="text-xl" />
                    </button>

                    {/* Center: Active tab name (desktop) / File name (mobile) */}
                    <div className="flex-1 min-w-0 text-center">
                        <p className="font-semibold text-ink-700 truncate px-2 hidden md:block">
                            {activeTabLabel[activeTab]}
                        </p>
                        <p className="font-semibold text-ink-700 truncate px-2 md:hidden" title={document.fileName}>
                            {document.fileName}
                        </p>
                    </div>

                    {/* Right side: Preview for mobile */}
                    <button
                        type="button"
                        onClick={onPreviewClick}
                        className={`p-2 rounded-lg hover:bg-ink-100 md:hidden ${isPdfVisible ? 'bg-brand-100 text-brand-700' : 'text-ink-600'}`}
                        aria-label={isPdfVisible ? 'Hide document preview' : 'Show document preview'}
                    >
                        <PreviewIcon className="text-2xl" />
                    </button>
                    {/* Collapse right panel button — desktop only */}
                    {onToggleRightPanel ? (
                        <button
                            onClick={onToggleRightPanel}
                            className="hidden md:inline-flex p-2 text-ink-400 rounded-lg hover:text-ink-700 hover:bg-ink-100 transition-colors"
                            aria-label="Collapse tools panel"
                            title="Collapse tools panel"
                        >
                            <PanelRightCloseIcon />
                        </button>
                    ) : (
                        <div className="hidden md:inline-flex w-10 h-10"></div>
                    )}
                </div>
                {!isProcessing && (
                    <div className="md:hidden">
                        {tabBar}
                    </div>
                )}
            </div>

            {isProcessing ? (
                <div className="flex flex-col items-center justify-center flex-1 bg-white p-8 text-center">
                    <div className="w-20 h-20 mb-4 animate-pulse">
                        <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                    </div>
                    <h3 className="text-h2">학습 준비 중…</h3>
                    <p className="text-body text-ink-500 mt-1.5 max-w-xs">문서를 분석해 요약을 만들고, 질문에 답할 준비를 하고 있어요.</p>
                    <div className="mt-5"><Spinner size="md" /></div>
                </div>
            ) : (
                MainContent()
            )}
        </div>
    );
};
