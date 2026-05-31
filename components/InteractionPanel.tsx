import * as React from 'react';
import type { DocumentData, ChatMessage, QuizData, FRQData, MCQQuizState, FRQQuizState, QuizTabState } from '../types';
import { ChatIcon, MenuIcon, PreviewIcon, AssignmentIcon, XIcon, AccountTreeIcon, HeadphonesIcon, PanelRightCloseIcon, DocumentIcon, SearchIcon, ErrorOutlineIcon, StyleIcon, SpaceDashboardIcon, TrashIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, BrainIcon, CleverMonkeyIcon } from './icons';
import { OverviewTab } from './OverviewTab';
import { MindMapTab } from './MindMapTab';
import { FlashcardsTab } from './FlashcardsTab';
import { PodcastTab } from './PodcastTab';
import { fetchWrongAnswers, markReviewed, deleteWrongAnswer } from '../services/wrongAnswersService';
import type { WrongAnswerRecord } from '../services/wrongAnswersService';
import { supabase } from '../services/supabaseClient';
import { ChatBubble } from './ChatBubble';
import { PresetQuestions } from './PresetQuestions';
import { Quiz } from './Quiz';
import { useDocuments } from '../contexts/DocumentContext';
import { Spinner } from './Spinner';
import { useChat } from '../hooks/useChat';
import { ChatInput } from './ChatInput';
import { QuizGenerator } from './QuizGenerator';
import { FRQuiz } from './FRQuiz';
import { generateQuiz } from '../services/geminiService';
import { saveQuizSession } from '../services/wrongAnswersService';
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
}

// ─── Wrong Answers Panel (document-scoped, used inside Quiz tab) ──
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const WrongAnswerCard: React.FC<{
    item: WrongAnswerRecord;
    onMarkReviewed: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ item, onMarkReviewed, onDelete }) => {
    const [expanded, setExpanded] = React.useState(false);
    const isReviewed = !!item.reviewedAt;
    return (
        <div className={`rounded-xl border transition-all duration-200 ${isReviewed ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 bg-white shadow-sm'}`}>
            <button type="button" className="w-full text-left p-3 flex items-start gap-3" onClick={() => setExpanded(e => !e)}>
                <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${item.quizType === 'mcq' ? 'bg-info-50 text-info-600' : 'bg-success-50 text-success-600'}`}>
                    {item.quizType === 'mcq' ? <AssignmentIcon className="text-sm" /> : <BrainIcon className="text-sm" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isReviewed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.questionText}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                        {item.quizType === 'frq' && item.score !== undefined && (
                            <span className={`text-xs font-semibold ${item.score < 40 ? 'text-red-500' : 'text-orange-500'}`}>{item.score}점</span>
                        )}
                        {isReviewed && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">복습완료</span>}
                    </div>
                </div>
                <div className="flex-shrink-0 text-slate-300">
                    {expanded ? <ChevronUpIcon className="text-lg" /> : <ChevronDownIcon className="text-lg" />}
                </div>
            </button>
            {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
                    {item.quizType === 'mcq' && item.options && (
                        <div className="space-y-1">
                            {item.options.map((opt, i) => {
                                const isCorrect = i === item.correctAnswerIndex;
                                const isUser = i === item.userAnswerIndex;
                                let cls = 'text-slate-500 bg-slate-50';
                                if (isCorrect) cls = 'text-green-700 bg-green-50 border border-green-200 font-semibold';
                                else if (isUser) cls = 'text-red-700 bg-red-50 border border-red-200 line-through';
                                return (
                                    <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${cls}`}>
                                        <span className="font-bold mr-1.5">{String.fromCharCode(65 + i)}.</span>{opt}
                                        {isCorrect && <span className="ml-1.5 text-green-600">✓ 정답</span>}
                                        {isUser && !isCorrect && <span className="ml-1.5 text-red-500">✗ 내 답</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {item.quizType === 'frq' && item.userAnswerText && (
                        <div className="text-xs p-2.5 bg-red-50 border border-red-100 rounded-lg">
                            <span className="font-semibold text-red-700 block mb-0.5">내 답</span>
                            <span className="text-slate-700">{item.userAnswerText}</span>
                        </div>
                    )}
                    <div className="text-xs p-2.5 bg-brand-50 border border-brand-100 rounded-lg">
                        <span className="font-semibold text-brand-700 block mb-0.5">{item.quizType === 'frq' ? '모범 답안' : '해설'}</span>
                        <span className="text-slate-700 leading-relaxed">{item.explanation}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                        {!isReviewed && (
                            <button type="button" onClick={() => onMarkReviewed(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg">
                                <CheckIcon className="text-xs" /> 복습완료
                            </button>
                        )}
                        <button type="button" onClick={() => onDelete(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg">
                            <TrashIcon className="text-xs" /> 삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const WrongAnswersPanel: React.FC<{
    items: WrongAnswerRecord[];
    isLoading: boolean;
    isLoggedIn: boolean;
    onMarkReviewed: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ items, isLoading, isLoggedIn, onMarkReviewed, onDelete }) => {
    const pendingCount = items.filter(i => !i.reviewedAt).length;

    if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    if (!isLoggedIn) return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <ErrorOutlineIcon className="text-3xl text-slate-300" />
            <p className="font-semibold text-slate-600">로그인이 필요합니다</p>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto">
            {items.length > 0 && (
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">{items.length}</span>
                    <span className="text-xs text-slate-500">전체</span>
                    <span className="w-px h-4 bg-slate-200" />
                    <span className="text-sm font-bold text-rose-600">{pendingCount}</span>
                    <span className="text-xs text-slate-500">복습 필요</span>
                </div>
            )}
            <div className="p-3 space-y-2">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
                            <ErrorOutlineIcon className="text-3xl text-rose-300" />
                        </div>
                        <div>
                            <p className="font-handwritten font-bold text-2xl text-ink-700 -rotate-1 inline-block">오답 0개</p>
                            <p className="text-sm text-ink-400 mt-2">너무 잘하잖아 🐒 일단 퀴즈부터 좀 풀어봐.</p>
                        </div>
                    </div>
                ) : (
                    items.map(item => (
                        <WrongAnswerCard key={item.id} item={item} onMarkReviewed={onMarkReviewed} onDelete={onDelete} />
                    ))
                )}
            </div>
        </div>
    );
};

// ─── Processing chatter — rotating playful messages while AI works ──────

const PROCESSING_LINES = [
    { head: '원숭이가 페이지 넘기는 중…',  sub: '바나나도 좀 먹고.' },
    { head: '어 이거 좀 어렵네',            sub: '잠깐 생각 좀 해볼게.' },
    { head: '거의 다 됐어',                 sub: '근데 너 진짜 이거 다 읽을 거야?' },
    { head: '머리에서 김 나는 중',          sub: '요약, 퀴즈, 카드 — 한 번에 만드는 중.' },
    { head: '필기 정리해놨음',              sub: '곧 보여줄게.' },
];

const ProcessingChatter: React.FC = () => {
    const [i, setI] = React.useState(0);
    React.useEffect(() => {
        const t = setInterval(() => setI(n => (n + 1) % PROCESSING_LINES.length), 2800);
        return () => clearInterval(t);
    }, []);
    const line = PROCESSING_LINES[i];
    return (
        <>
            <h3 className="font-handwritten font-bold text-3xl text-ink-900 -rotate-1 inline-block animate-fade-in" key={`h-${i}`}>
                {line.head}
            </h3>
            <p className="text-body text-ink-500 mt-2 max-w-xs animate-fade-in" key={`s-${i}`}>
                {line.sub}
            </p>
        </>
    );
};

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
}) => {
    const { dispatch } = useDocuments();
    // activeTab is controlled by prop from StudyPage

    // Wrong answers sub-view within Quiz tab
    type QuizView = 'quiz' | 'wrong_answers';
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
            setQuizError("Document content is not available to generate a quiz.");
            return;
        }
        setIsGeneratingQuiz(true);
        setQuizError(null);
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: document.id, updates: { quizTabData: null } } });

        try {
            const data = await generateQuiz(document.documentContent, document.model, type, count);
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



    const MonkeyModeToggle = () => (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-600" title="Toggle mischievous monkey mode">
            <span className="font-medium">🍌 Monkey</span>
            <button
                type="button"
                role="switch"
                aria-label="Toggle monkey mode"
                onClick={() => handleMonkeyModeChange(!document.monkeyMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${document.monkeyMode ? 'bg-yellow-500' : 'bg-slate-400'}`}
                aria-checked={document.monkeyMode}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${document.monkeyMode ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );

    const AnswerScopeToggle = () => (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-600" title={document.answerScope === 'document' ? 'Answers are strictly from the document' : 'Answers can include general knowledge'}>
            <span className="font-medium">📚 From Document Only</span>
            <button
                type="button"
                role="switch"
                aria-label="Toggle answer scope"
                onClick={() => handleScopeChange(document.answerScope === 'document' ? 'general' : 'document')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${document.answerScope === 'document' ? 'bg-brand-600' : 'bg-ink-400'}`}
                aria-checked={document.answerScope === 'document'}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${document.answerScope === 'document' ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );

    const studyTabs = [
        { id: 'overview', icon: SpaceDashboardIcon, label: 'Overview' },
        { id: 'chat', icon: ChatIcon, label: 'Chat' },
        { id: 'quiz', icon: AssignmentIcon, label: 'Quiz' },
    ] as const;

    const createTabs = [
        { id: 'mindmap', icon: AccountTreeIcon, label: 'Mind Map' },
        { id: 'flashcards', icon: StyleIcon, label: 'Flashcards' },
        { id: 'podcast', icon: HeadphonesIcon, label: 'Podcast' },
    ] as const;

    const TabsComponent = () => (
        <div className="flex bg-white w-full border-b border-ink-100">
            {studyTabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    onClick={() => onTabChange(tab.id as ActiveTab)}
                    className={[
                        'relative flex-1 flex items-center justify-center py-3 transition-colors',
                        activeTab === tab.id ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700',
                    ].join(' ')}
                >
                    <tab.icon className="text-[18px]" />
                    {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-brand-600" />
                    )}
                </button>
            ))}
            <div className="w-px bg-ink-200 flex-shrink-0 my-2.5" />
            {createTabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    onClick={() => onTabChange(tab.id as ActiveTab)}
                    className={[
                        'relative flex-1 flex items-center justify-center py-3 transition-colors',
                        activeTab === tab.id ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700',
                    ].join(' ')}
                >
                    <tab.icon className="text-[18px]" />
                    {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-brand-600" />
                    )}
                </button>
            ))}
        </div>
    );

    const MainContent = () => {
        return (
            <React.Fragment>
                <div className="hidden md:flex flex-shrink-0">
                    {TabsComponent()}
                </div>

                <div className={`flex-1 flex-col min-h-0 ${activeTab === 'overview' ? 'flex' : 'hidden'}`}>
                    <OverviewTab document={document} onSelectTab={onTabChange} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <div className="flex items-center gap-2">
                            <ChatIcon className="text-xl text-brand-500" />
                            <span className="font-semibold text-ink-700 text-sm">Chat</span>
                            {chatSearch && (
                                <span className="text-xs text-ink-400">
                                    {document.chatHistory.filter(m => m.text.toLowerCase().includes(chatSearch.toLowerCase())).length} matches
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={toggleChatSearch}
                            className={`p-1.5 rounded-lg transition-colors ${isChatSearchOpen ? 'bg-brand-50 text-brand-600' : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'}`}
                            title="Search chat history"
                            aria-label="Search chat"
                        >
                            <SearchIcon className="text-base" />
                        </button>
                    </div>
                    {isChatSearchOpen && (
                        <div className="flex-shrink-0 px-4 py-2 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                <input
                                    ref={chatSearchRef}
                                    type="text"
                                    value={chatSearch}
                                    onChange={e => setChatSearch(e.target.value)}
                                    placeholder="Search messages…"
                                    className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                                />
                                {chatSearch && (
                                    <button type="button" onClick={() => setChatSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <XIcon className="text-sm" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
                        {document.chatHistory.filter(msg => !chatSearch || msg.text.toLowerCase().includes(chatSearch.toLowerCase())).map((msg, index) => {
                            if (msg.type === 'quiz_suggestion') {
                                const suggestionText = msg.text || "Let's make a quiz! Click the button below to go to the quiz generator.";
                                return (
                                    <div key={`chat-item-${document.id}-${index}`} className="chat-message-item">
                                        <ChatBubble message={{ ...msg, text: suggestionText }} />
                                        <div className="flex justify-start pl-14 -mt-3 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => onTabChange('quiz')}
                                                className="flex items-center gap-2 bg-white text-brand-800 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors shadow-card border border-brand-200"
                                            >
                                                <AssignmentIcon className="text-xl" />
                                                <span>Create a Quiz</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            const prevUserMsg = msg.isError
                                ? document.chatHistory.slice(0, index).findLast(m => m.sender === 'user')
                                : null;
                            return (
                                <div key={`chat-item-${document.id}-${index}`} className="chat-message-item">
                                    {msg.type === 'quiz' && msg.quizData && msg.quizState ? (
                                        <div className="message-bubble-wrapper flex items-start gap-2 w-full justify-start mb-4">
                                            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                                                <AssignmentIcon className="w-8 h-8 text-brand-600" />
                                            </div>
                                            <div className="bg-brand-50 border border-brand-200 rounded-2xl rounded-bl-sm shadow-card p-2 sm:p-4 max-w-xl w-full">
                                                <Quiz
                                                    key={`quiz-${document.id}-${index}`}
                                                    data={msg.quizData}
                                                    onCreateAnotherQuiz={handleCreateAnotherQuizInChat}
                                                    quizState={msg.quizState}
                                                    onStateChange={(newState) => handleQuizStateChangeInChat(index, newState)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <ChatBubble
                                            message={msg}
                                            onRetry={prevUserMsg ? () => handleSendMessage(prevUserMsg.text) : undefined}
                                        />
                                    )}
                                </div>
                            );
                        })}
                        {isBotTyping && (
                            <div className="chat-message-item">
                                <ChatBubble message={{ sender: 'bot', text: '...', wasMonkeyMode: document.monkeyMode }} />
                            </div>
                        )}
                        {isPreparingSuggestions && (
                            <div className="chat-message-item">
                                <ChatBubble message={{ sender: 'bot', text: '...', wasMonkeyMode: document.monkeyMode }} />
                            </div>
                        )}
                        {document.presetQuestions && canShowPresetQuestions && (
                            <PresetQuestions
                                isOpen={isPresetQuestionsOpen}
                                setIsOpen={setIsPresetQuestionsOpen}
                                questions={document.presetQuestions}
                                onQuestionClick={(q) => {
                                    handleSendMessage(q);
                                    setIsPresetQuestionsOpen(false);
                                }}
                            />
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200">
                        <div className="max-w-3xl mx-auto">
                            <div className="mb-2 flex flex-row flex-wrap justify-end items-center gap-x-4 gap-y-2">
                                <MonkeyModeToggle />
                                <AnswerScopeToggle />
                            </div>
                            <ChatInput
                                isBotTyping={isBotTyping}
                                onSendMessage={(message) => {
                                    handleSendMessage(message);
                                    setIsPresetQuestionsOpen(false);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'mindmap' ? 'flex' : 'hidden'}`}>
                    <MindMapTab document={document} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'flashcards' ? 'flex' : 'hidden'}`}>
                    <FlashcardsTab document={document} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'podcast' ? 'flex' : 'hidden'}`}>
                    <PodcastTab document={document} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'quiz' ? 'flex' : 'hidden'}`}>
                    {/* Sub-tab strip: Quiz | 오답노트 */}
                    <div className="flex-shrink-0 border-b border-slate-100 bg-white">
                        <div className="flex">
                            <button
                                type="button"
                                onClick={() => setQuizView('quiz')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${quizView === 'quiz' ? 'text-brand-600 border-brand-600' : 'text-ink-400 border-transparent hover:text-ink-700'}`}
                            >
                                <AssignmentIcon className="text-base" /> 퀴즈
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuizView('wrong_answers')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${quizView === 'wrong_answers' ? 'text-rose-600 border-rose-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                <ErrorOutlineIcon className="text-base" /> 오답노트
                            </button>
                        </div>
                    </div>

                    {/* Quiz view */}
                    {quizView === 'quiz' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            {isGeneratingQuiz && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <Spinner />
                                    <p className="mt-4 font-semibold text-slate-700">Generating your quiz... 🧠</p>
                                </div>
                            )}
                            {!isGeneratingQuiz && quizError && (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-red-50 rounded-lg">
                                    <p className="font-bold text-red-700">Quiz Generation Failed</p>
                                    <p className="text-red-600 mt-2 text-sm">{quizError}</p>
                                    <button onClick={handleStartNewQuizInTab} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Try Again</button>
                                </div>
                            )}
                            {!isGeneratingQuiz && !quizTabData && !quizError && (
                                <QuizGenerator onGenerate={handleGenerateQuiz} />
                            )}
                            {!isGeneratingQuiz && quizTabData && (
                                <div className="max-w-xl w-full mx-auto">
                                    {quizTabData.quizState.type === 'mcq' ? (
                                        <Quiz
                                            data={quizTabData.quizContent as QuizData}
                                            onCreateAnotherQuiz={handleStartNewQuizInTab}
                                            quizState={quizTabData.quizState}
                                            onStateChange={handleQuizTabStateChange}
                                            documentContent={document.documentContent}
                                            onRestartWithNewData={handleRestartQuizWithNewData}
                                            studyTips={quizTabData.studyTips}
                                            onStudyTipsGenerated={handleStudyTipsGenerated}
                                        />
                                    ) : (
                                        <FRQuiz
                                            data={quizTabData.quizContent as FRQData}
                                            model={document.model}
                                            onCreateAnotherQuiz={handleStartNewQuizInTab}
                                            quizState={quizTabData.quizState}
                                            onStateChange={handleQuizTabStateChange}
                                            documentContent={document.documentContent}
                                            onRestartWithNewData={handleRestartQuizWithNewData}
                                            studyTips={quizTabData.studyTips}
                                            onStudyTipsGenerated={handleStudyTipsGenerated}
                                        />
                                    )}
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-400 mb-2">복습하기</p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setQuizView('wrong_answers')}
                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                                            >
                                                <ErrorOutlineIcon className="text-lg" /> 오답노트 보기
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onTabChange('flashcards')}
                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
                                            >
                                                <StyleIcon className="text-lg" /> 플래시카드
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Wrong answers view */}
                    {quizView === 'wrong_answers' && (
                        <WrongAnswersPanel
                            items={wrongAnswers}
                            isLoading={isLoadingWA}
                            isLoggedIn={isLoggedInWA}
                            onMarkReviewed={handleMarkReviewed}
                            onDelete={handleDeleteWA}
                        />
                    )}
                </div>

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
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center justify-between gap-2">
                    {/* Left side: Menu for mobile, PDF toggle for desktop */}
                    <button type="button" onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open file menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <button
                        onClick={onTogglePdfViewer}
                        className="hidden md:inline-flex p-2 text-slate-400 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                        title={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                    >
                        <DocumentIcon className="text-xl" />
                    </button>

                    {/* Center: Active tab name (desktop) / File name (mobile) */}
                    <div className="flex-1 min-w-0 text-center">
                        <p className="font-semibold text-slate-700 truncate px-2 hidden md:block">
                            {activeTabLabel[activeTab]}
                        </p>
                        <p className="font-semibold text-slate-700 truncate px-2 md:hidden" title={document.fileName}>
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
                            className="hidden md:inline-flex p-2 text-slate-400 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                        {TabsComponent()}
                    </div>
                )}
            </div>

            {isProcessing ? (
                <div className="flex flex-col items-center justify-center flex-1 bg-white p-8 text-center">
                    <div className="w-24 h-24 mb-4 animate-pulse">
                        <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                    </div>
                    <ProcessingChatter />
                    <div className="mt-5"><Spinner size="md" /></div>
                </div>
            ) : (
                MainContent()
            )}
        </div>
    );
};
