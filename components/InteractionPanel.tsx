// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import type { DocumentData, ChatMessage, QuizData, FRQData, MCQQuizState, FRQQuizState, QuizTabState } from '../types';
import { ChatIcon, CopyIcon, DownloadIcon, MenuIcon, PreviewIcon, AssignmentIcon, XIcon, AccountTreeIcon, SlideshowIcon, HeadphonesIcon, PanelRightCloseIcon, DocumentIcon } from './icons';
import { MindMapTab } from './MindMapTab';
import { SlidesTab } from './SlidesTab';
import { PodcastTab } from './PodcastTab';
import { MarkdownRenderer } from './MarkdownRenderer';
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

// Assuming jspdf and html2canvas are loaded from CDN
declare const jspdf: any;

export type ActiveTab = 'summary' | 'chat' | 'quiz' | 'mindmap' | 'slides' | 'podcast';

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

    const [showCopyToast, setShowCopyToast] = React.useState(false);
    const [isPresetQuestionsOpen, setIsPresetQuestionsOpen] = React.useState(false);

    // State for quiz generation status in the quiz tab
    const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
    const [quizError, setQuizError] = React.useState<string | null>(null);

    // New state for the initial conversational flow
    const [isPreparingSuggestions, setIsPreparingSuggestions] = React.useState(false);
    const [canShowPresetQuestions, setCanShowPresetQuestions] = React.useState(document.chatHistory.length > 1);

    const summaryRef = React.useRef<HTMLDivElement>(null);
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
    }, [document.id]);

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


    const handleCopyToClipboard = () => {
        if (summaryRef.current) {
            navigator.clipboard.writeText(summaryRef.current.innerText)
                .then(() => {
                    setShowCopyToast(true);
                    setTimeout(() => setShowCopyToast(false), 2000);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        }
    };

    const handleDownloadPdf = () => {
        if (summaryRef.current && typeof jspdf !== 'undefined') {
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4'
            });
            const content = summaryRef.current;
            const docName = document.fileName.replace(/\.[^/.]+$/, "");

            pdf.html(content, {
                callback: function (doc: any) {
                    doc.save(`${docName}-summary.pdf`);
                },
                margin: [40, 40, 40, 40],
                autoPaging: 'text',
                width: 515,
            });
        }
    };

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

    const handleQuizTabStateChange = (newState: QuizTabState) => {
        if (document.quizTabData) {
            const prevState = document.quizTabData.quizState;
            const updatedQuizTabData = {
                ...document.quizTabData,
                quizState: newState,
            };

            // When a finished quiz is restarted, clear the previous study tips.
            if (prevState.isFinished && !newState.isFinished) {
                delete updatedQuizTabData.studyTips;
            }

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
                onClick={() => handleMonkeyModeChange(!document.monkeyMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${document.monkeyMode ? 'bg-yellow-500' : 'bg-slate-400'}`}
                aria-pressed={document.monkeyMode}
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
                onClick={() => handleScopeChange(document.answerScope === 'document' ? 'general' : 'document')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${document.answerScope === 'document' ? 'bg-blue-600' : 'bg-slate-400'}`}
                aria-pressed={document.answerScope === 'document'}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${document.answerScope === 'document' ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );

    const studyTabs = [
        { id: 'summary', icon: CopyIcon, label: 'Summary' },
        { id: 'chat', icon: ChatIcon, label: 'Chat' },
        { id: 'quiz', icon: AssignmentIcon, label: 'Quiz' },
    ] as const;

    const createTabs = [
        { id: 'mindmap', icon: AccountTreeIcon, label: 'Mind Map' },
        { id: 'slides', icon: SlideshowIcon, label: 'Slides' },
        { id: 'podcast', icon: HeadphonesIcon, label: 'Podcast' },
    ] as const;

    const TabsComponent = () => (
        <div className="flex bg-white w-full">
            {studyTabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    onClick={() => onTabChange(tab.id as ActiveTab)}
                    className={`flex-1 flex items-center justify-center py-3 border-b-2 transition-colors ${
                        activeTab === tab.id
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-400 hover:text-slate-600 border-slate-200'
                    }`}
                >
                    <tab.icon className="text-[18px]" />
                </button>
            ))}
            <div className="w-px bg-slate-200 flex-shrink-0 my-2" />
            {createTabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    onClick={() => onTabChange(tab.id as ActiveTab)}
                    className={`flex-1 flex items-center justify-center py-3 border-b-2 transition-colors ${
                        activeTab === tab.id
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-400 hover:text-slate-600 border-slate-200'
                    }`}
                >
                    <tab.icon className="text-[18px]" />
                </button>
            ))}
        </div>
    );

    const MainContent = () => {
        return (
            <React.Fragment>
                <div className="hidden md:flex flex-shrink-0">
                    <TabsComponent />
                </div>

                <div className={`flex-1 flex-col overflow-y-auto ${activeTab === 'summary' ? 'flex' : 'hidden'}`}>
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <div className="flex items-center gap-2">
                            <CopyIcon className="text-xl text-blue-500" />
                            <span className="font-semibold text-slate-700 text-sm">Summary</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={handleCopyToClipboard} className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors">
                                <CopyIcon className="text-sm" /> Copy
                            </button>
                            <button onClick={handleDownloadPdf} className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors">
                                <DownloadIcon className="text-sm" /> PDF
                            </button>
                        </div>
                    </div>
                    <div ref={summaryRef} className="p-6 bg-white text-slate-800">
                        <MarkdownRenderer content={document.summary} />
                    </div>
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
                    <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-slate-100 bg-white">
                        <div className="flex items-center gap-2">
                            <ChatIcon className="text-xl text-blue-500" />
                            <span className="font-semibold text-slate-700 text-sm">Chat</span>
                        </div>
                    </div>
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
                        {document.chatHistory.map((msg, index) => {
                            if (msg.type === 'quiz_suggestion') {
                                const suggestionText = msg.text || "Let's make a quiz! Click the button below to go to the quiz generator.";
                                return (
                                    <div key={`chat-item-${document.id}-${index}`} className="chat-message-item">
                                        <ChatBubble message={{ ...msg, text: suggestionText }} />
                                        <div className="flex justify-start pl-14 -mt-3 mb-4">
                                            <button
                                                onClick={() => onTabChange('quiz')}
                                                className="flex items-center gap-2 bg-white text-blue-800 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors shadow-md border border-blue-200"
                                            >
                                                <AssignmentIcon className="text-xl" />
                                                <span>Create a Quiz</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={`chat-item-${document.id}-${index}`} className="chat-message-item">
                                    {msg.type === 'quiz' && msg.quizData && msg.quizState ? (
                                        <div className="message-bubble-wrapper flex items-start gap-2 w-full justify-start mb-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <AssignmentIcon className="w-8 h-8 text-blue-600" />
                                            </div>
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl rounded-bl-sm shadow-md p-2 sm:p-4 max-w-xl w-full">
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
                                        <ChatBubble message={msg} />
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

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'slides' ? 'flex' : 'hidden'}`}>
                    <SlidesTab document={document} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'podcast' ? 'flex' : 'hidden'}`}>
                    <PodcastTab document={document} />
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'quiz' ? 'flex' : 'hidden'}`}>
                    <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-slate-100 bg-white">
                        <div className="flex items-center gap-2">
                            <AssignmentIcon className="text-xl text-blue-500" />
                            <span className="font-semibold text-slate-700 text-sm">Quiz</span>
                        </div>
                    </div>
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
                                        onStudyTipsGenerated={(tips: string) => {
                                            if (document.quizTabData) {
                                                dispatch({
                                                    type: 'UPDATE_DOCUMENT',
                                                    payload: {
                                                        docId: document.id,
                                                        updates: { quizTabData: { ...document.quizTabData, studyTips: tips } }
                                                    }
                                                });
                                            }
                                        }}
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
                                        onStudyTipsGenerated={(tips: string) => {
                                            if (document.quizTabData) {
                                                dispatch({
                                                    type: 'UPDATE_DOCUMENT',
                                                    payload: {
                                                        docId: document.id,
                                                        updates: { quizTabData: { ...document.quizTabData, studyTips: tips } }
                                                    }
                                                });
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </React.Fragment>
        )
    }

    const activeTabLabel: Record<ActiveTab, string> = {
        summary: 'Summary',
        chat: 'Chat',
        quiz: 'Quiz',
        mindmap: 'Mind Map',
        slides: 'Slides',
        podcast: 'Podcast',
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header for both Mobile and Desktop */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center justify-between gap-2">
                    {/* Left side: Menu for mobile, PDF toggle for desktop */}
                    <button onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open file menu">
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
                        onClick={onPreviewClick}
                        className={`p-2 rounded-lg hover:bg-slate-100 md:hidden ${isPdfVisible ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}
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
                        <TabsComponent />
                    </div>
                )}
            </div>

            {isProcessing ? (
                <div className="flex flex-col items-center justify-center flex-1 bg-white text-slate-500 p-8 text-center">
                    <Spinner />
                    <h3 className="mt-4 font-semibold text-slate-700 text-lg">Preparing your session...</h3>
                    <p className="text-sm mt-1">Analyzing the document to create a summary and getting ready for your questions.</p>
                </div>
            ) : (
                <MainContent />
            )}

            <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm py-2 px-4 rounded-full shadow-lg transition-all duration-300 ${showCopyToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
                Summary copied to clipboard!
            </div>
        </div>
    );
};
