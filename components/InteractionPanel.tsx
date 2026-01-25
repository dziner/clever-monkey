// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import type { DocumentData, ChatMessage, QuizData, FRQData, MCQQuizState, QuizTabState, Annotation, AnnotationAnchor, AnnotationKind } from '../types';
import { ChatIcon, CopyIcon, DownloadIcon, MenuIcon, PreviewIcon, AssignmentIcon, BrainIcon, ChevronLeftIcon, ChevronRightIcon, NoteIcon, HighlightIcon, MoreVertIcon, TrashIcon, EditIcon, AddIcon, XIcon } from './icons';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatBubble } from './ChatBubble';
import { PresetQuestions } from './PresetQuestions';
import { Quiz } from './Quiz';
import { useDocuments } from '../contexts/DocumentContext';
import { Spinner } from './Spinner';
import { useChat } from '../hooks/useChat';
import { ChatInput } from './ChatInput';
import { SelectionView } from './SelectionView';
import { QuizGenerator } from './QuizGenerator';
import { FRQuiz } from './FRQuiz';
import { generateQuiz } from '../services/geminiService';
import { getErrorMessage } from '../utils/errors';
import { createAnnotation, deleteAnnotation, updateAnnotation } from '../services/annotationService';

// Assuming jspdf and html2canvas are loaded from CDN
declare const jspdf: any;

interface InteractionPanelProps {
    document: DocumentData;
    onMenuClick: () => void;
    onPreviewClick: () => void;
    isPdfVisible: boolean;
    isPdfViewerCollapsed: boolean;
    onTogglePdfViewer: () => void;

    activeTab: 'summary' | 'chat' | 'quiz' | 'annotations';
    onTabChange: (tab: 'summary' | 'chat' | 'quiz' | 'annotations') => void;
    editingAnnotationId: string | null;
    onEditingAnnotationChange: (id: string | null) => void;
}

export const InteractionPanel: React.FC<InteractionPanelProps> = ({
    document,
    onMenuClick,
    onPreviewClick,
    isPdfVisible,
    isPdfViewerCollapsed,
    onTogglePdfViewer,
    activeTab,
    onTabChange,
    editingAnnotationId,
    onEditingAnnotationChange
}) => {
    const { dispatch } = useDocuments();
    const [view, setView] = React.useState<'selection' | 'content'>('selection');
    // activeTab is now controlled by prop

    const [showCopyToast, setShowCopyToast] = React.useState(false);
    const [isPresetQuestionsOpen, setIsPresetQuestionsOpen] = React.useState(false);
    const [annotationDraft, setAnnotationDraft] = React.useState('');
    const [annotationColor, setAnnotationColor] = React.useState('#FDE68A');
    const [annotationKind, setAnnotationKind] = React.useState<AnnotationKind>('note');
    const [annotationAnchor, setAnnotationAnchor] = React.useState<AnnotationAnchor | null>(null);
    const [annotationError, setAnnotationError] = React.useState<string | null>(null);
    const [isSavingAnnotation, setIsSavingAnnotation] = React.useState(false);

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

    // Reset view when document changes, but persist quiz state
    React.useEffect(() => {
        setView('selection');
        // Reset local states on doc change
        setQuizError(null);
        setAnnotationDraft('');
        setAnnotationAnchor(null);
        setAnnotationError(null);
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
            const updatedQuizTabData = {
                ...document.quizTabData,
                quizState: newState,
            };

            // When a finished quiz is restarted, clear the previous study tips.
            if (document.quizTabData.quizState.isFinished && !newState.isFinished) {
                delete updatedQuizTabData.studyTips;
            }

            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: {
                        quizTabData: updatedQuizTabData
                    }
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
    const annotations = React.useMemo(() => {
        return (document.annotations ?? [])
            .filter((annotation) => Boolean(annotation.content?.note?.trim()))
            .slice()
            .sort((a, b) => {
            if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
            if (!a.createdAt || !b.createdAt) return 0;
            return a.createdAt.localeCompare(b.createdAt);
        });
    }, [document.annotations]);

    const currentPage = document.currentPage ?? 1;



    const handleSaveAnnotation = async () => {
        setAnnotationError(null);
        if (!annotationDraft.trim() && !annotationAnchor?.textQuote) {
            setAnnotationError('Please add a note or capture a selection before saving.');
            return;
        }

        setIsSavingAnnotation(true);
        const anchor: AnnotationAnchor = annotationAnchor ?? {
            page: currentPage,
            rects: [],
            textQuote: annotationDraft.trim() || undefined,
        };

        const created = await createAnnotation({
            documentId: document.id,
            pageNumber: anchor.page,
            kind: annotationKind,
            anchor,
            content: {
                note: annotationDraft.trim() || undefined,
                color: annotationColor,
            },
        });

        if (created) {
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: { annotations: [...(document.annotations ?? []), created] },
                },
            });
            setAnnotationDraft('');
            setAnnotationAnchor(null);
            setAnnotationKind('note');
        } else {
            setAnnotationError('Failed to save annotation.');
        }

        setIsSavingAnnotation(false);
    };

    const handleUpdateAnnotation = async (id: string, content: { note?: string, color?: string }) => {
        const updated = await updateAnnotation(id, { content });
        if (updated) {
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: {
                        annotations: (document.annotations ?? []).map(a => a.id === id ? updated : a)
                    }
                }
            });
            onEditingAnnotationChange(null);
        }
    };

    const handleDeleteAnnotation = async (annotation: Annotation) => {
        const deleted = await deleteAnnotation(annotation.id);
        if (!deleted) return;
        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: {
                docId: document.id,
                updates: {
                    annotations: (document.annotations ?? []).filter(item => item.id !== annotation.id),
                },
            },
        });
    };

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

    const TabsComponent = () => (
        <div className="p-1.5 bg-slate-100/70 rounded-2xl flex items-center gap-1 border border-slate-200/60 w-full overflow-x-auto">
            {[
                { id: 'summary', icon: CopyIcon, label: 'Summary' },
                { id: 'chat', icon: ChatIcon, label: 'Chat' },
                { id: 'quiz', icon: AssignmentIcon, label: 'Quiz' },
                { id: 'annotations', icon: NoteIcon, label: 'Notes' }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id as any)}
                    className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                >
                    <tab.icon className="text-lg sm:text-xl" />
                    <span className="hidden sm:inline">{tab.label}</span>
                </button>
            ))}
        </div>
    );

    const MainContent = () => {
        if (view === 'selection') {
            return (
                <SelectionView
                    onSelect={(selection) => {
                        setView('content');
                        onTabChange(selection);
                    }}
                />
            );
        }
        return (
            <React.Fragment>
                <div className="hidden md:flex p-4 border-b border-slate-200 bg-white flex-shrink-0">
                    <div className="w-full max-w-sm mx-auto relative">
                        <TabsComponent />
                    </div>
                </div>

                <div className={`flex-1 flex-col overflow-y-auto ${activeTab === 'summary' ? 'flex' : 'hidden'}`}>
                    <div className="flex-shrink-0 p-4 bg-white border-b">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-slate-800">Summary</h3>
                            <div className="flex items-center space-x-2">
                                <button onClick={handleCopyToClipboard} className="flex items-center space-x-1 text-sm text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100">
                                    <CopyIcon className="text-xl" /> <span>Copy</span>
                                </button>
                                <button onClick={handleDownloadPdf} className="flex items-center space-x-1 text-sm text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100">
                                    <DownloadIcon className="text-xl" /> <span>PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div ref={summaryRef} className="p-6 bg-white text-slate-800">
                        <MarkdownRenderer content={document.summary} />
                    </div>
                </div>

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
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

                <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'quiz' ? 'flex' : 'hidden'}`}>
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

                <div className={`flex-1 flex flex-col md:flex-row bg-white overflow-hidden ${activeTab === 'annotations' ? 'flex' : 'hidden'}`}>
                    <div className="flex-1 md:flex-none md:w-[420px] flex flex-col border-r border-slate-200 bg-white h-full">
                        <div className="flex-shrink-0 p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <NoteIcon className="text-blue-500" />
                                <span>Notes</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">{annotations.length}</span>
                            </h4>

                        </div>



                        <div className="flex-1 overflow-y-auto min-h-0 bg-white scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            {annotations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center p-6">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <HighlightIcon className="text-slate-300 text-xl" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">No notes yet</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Add a note to see it listed here.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {annotations.map(annotation => {
                                        const isEditing = annotation.id === editingAnnotationId;
                                        return (
                                            <div
                                                key={annotation.id}
                                                className={`group relative flex gap-4 p-4 transition-colors ${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50 cursor-pointer'}`}
                                                onClick={() => {
                                                    if (!isEditing) {
                                                        dispatch({
                                                            type: 'UPDATE_DOCUMENT',
                                                            payload: { docId: document.id, updates: { currentPage: annotation.pageNumber } }
                                                        });
                                                    }
                                                }}
                                            >
                                                <div className="flex flex-col items-center gap-2 pt-1 flex-shrink-0 w-10">
                                                    <span className="text-[10px] font-black text-slate-300 group-hover:text-slate-400 transition-colors uppercase tracking-wider">
                                                        PG {annotation.pageNumber}
                                                    </span>
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                                                        style={{ backgroundColor: `${annotation.content?.color || '#FDE68A'}30` }}
                                                    >
                                                        {annotation.kind === 'highlight' ? (
                                                            <HighlightIcon className="text-sm" style={{ color: annotation.content?.color ? '#b45309' : '#d97706' }} />
                                                        ) : (
                                                            <NoteIcon className="text-sm text-blue-600" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    {isEditing ? (
                                                        <div className="animate-in fade-in zoom-in-95 duration-200">
                                                            <textarea
                                                                autoFocus
                                                                defaultValue={annotation.content?.note || ''}
                                                                className="w-full p-3 rounded-lg border border-blue-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none mb-2"
                                                                rows={3}
                                                                placeholder="Enter your note..."
                                                                id={`edit-note-${annotation.id}`}
                                                            />
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex gap-2">
                                                                    {['#FDE68A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#E9D5FF'].map(c => (
                                                                        <button
                                                                            key={c}
                                                                            onClick={() => {
                                                                                const note = (window.document.getElementById(`edit-note-${annotation.id}`) as HTMLTextAreaElement).value;
                                                                                handleUpdateAnnotation(annotation.id, { note, color: c });
                                                                            }}
                                                                            className={`w-5 h-5 rounded-full border border-slate-200 ${annotation.content?.color === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                                                            style={{ backgroundColor: c }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); onEditingAnnotationChange(null); }}
                                                                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const note = (window.document.getElementById(`edit-note-${annotation.id}`) as HTMLTextAreaElement).value;
                                                                            handleUpdateAnnotation(annotation.id, { note, color: annotation.content?.color });
                                                                        }}
                                                                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <React.Fragment>
                                                            {annotation.anchor.textQuote && (
                                                                <blockquote className="text-xs text-slate-500 border-l-2 border-slate-200 pl-2 mb-1.5 italic line-clamp-2 group-hover:border-slate-300 transition-colors">
                                                                    "{annotation.anchor.textQuote}"
                                                                </blockquote>
                                                            )}
                                                            {annotation.content?.note ? (
                                                                <p className="text-sm font-medium text-slate-800 leading-snug cursor-text" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditingAnnotationChange(annotation.id);
                                                                }}>
                                                                    {annotation.content.note}
                                                                </p>
                                                            ) : (
                                                                !annotation.anchor.textQuote && (
                                                                    <p className="text-sm text-slate-400 italic cursor-pointer hover:text-blue-500 hover:underline" onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onEditingAnnotationChange(annotation.id);
                                                                    }}>
                                                                        Add a note...
                                                                    </p>
                                                                )
                                                            )}

                                                            <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {new Date(annotation.createdAt || '').toLocaleDateString()}
                                                                </span>
                                                                <div className="flex-1" />
                                                                <button
                                                                    className="p-1 px-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onEditingAnnotationChange(annotation.id);
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteAnnotation(annotation);
                                                                    }}
                                                                    title="Delete annotation"
                                                                >
                                                                    <TrashIcon className="text-sm" />
                                                                </button>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:flex flex-1 bg-slate-50 flex-col h-full overflow-y-auto relative items-center justify-center p-8">
                        {annotationAnchor ? (
                            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Add Note
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setAnnotationAnchor(null);
                                            setAnnotationDraft('');
                                            setAnnotationError(null);
                                        }}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="text-xl" />
                                    </button>
                                </div>

                                <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setAnnotationKind('note')}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${annotationKind === 'note' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <NoteIcon className="text-sm inline mr-2 mb-0.5" />
                                        Note
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnnotationKind('highlight')}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${annotationKind === 'highlight' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <HighlightIcon className="text-sm inline mr-2 mb-0.5" />
                                        Highlight
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <textarea
                                            placeholder={annotationKind === 'highlight' ? 'Add an optional note to your highlight...' : 'Type your note content here...'}
                                            className="w-full h-32 p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all placeholder:text-slate-400"
                                            value={annotationDraft}
                                            onChange={(event) => setAnnotationDraft(event.target.value)}
                                            autoFocus
                                        ></textarea>
                                        <div className="absolute bottom-3 right-3">
                                            <input
                                                type="color"
                                                value={annotationColor}
                                                onChange={(event) => setAnnotationColor(event.target.value)}
                                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white cursor-pointer shadow-sm hover:scale-105 transition-transform"
                                                title="Change Color"
                                            />
                                        </div>
                                    </div>

                                    {annotationError && (
                                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                            {annotationError}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveAnnotation}
                                        disabled={isSavingAnnotation}
                                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isSavingAnnotation ? <Spinner /> : <React.Fragment><AddIcon className="text-lg" /> Save Annotation</React.Fragment>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-8 max-w-sm mx-auto opacity-60">
                                <div className="w-24 h-24 bg-slate-200/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <NoteIcon className="text-4xl text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-2">No Selection</h3>
                                <p className="text-slate-500">
                                    Select text on the document to add a highlight or note, or click the <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-200 rounded text-xs mx-1"><AddIcon className="text-xs" /></span> button to add a standalone note.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </React.Fragment>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header for both Mobile and Desktop */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center justify-between gap-2">
                    {/* Left side: Menu for mobile, Panel toggle for desktop */}
                    <button onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open file menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <button
                        onClick={onTogglePdfViewer}
                        className="hidden md:inline-flex p-2 text-slate-600 rounded-lg hover:bg-slate-100"
                        aria-label={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                        title={isPdfViewerCollapsed ? "Show document viewer" : "Collapse document viewer"}
                    >
                        {isPdfViewerCollapsed ? <ChevronRightIcon className="text-2xl" /> : <ChevronLeftIcon className="text-2xl" />}
                    </button>

                    {/* Center: File name / Back to selection */}
                    <div className="flex-1 min-w-0 text-center">
                        <button
                            onClick={() => setView('selection')}
                            className="w-full max-w-xs mx-auto text-center font-semibold text-slate-700 truncate px-2 hover:bg-slate-100 rounded-md py-1 transition-colors disabled:hover:bg-transparent disabled:cursor-default"
                            disabled={view === 'selection'}
                            title={document.fileName}
                        >
                            {document.fileName}
                        </button>
                    </div>

                    {/* Right side: Preview for mobile */}
                    <button
                        onClick={onPreviewClick}
                        className={`p-2 rounded-lg hover:bg-slate-100 md:hidden ${isPdfVisible ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}
                        aria-label={isPdfVisible ? 'Hide document preview' : 'Show document preview'}
                    >
                        <PreviewIcon className="text-2xl" />
                    </button>
                    {/* Spacer for desktop to balance the layout */}
                    <div className="hidden md:inline-flex w-10 h-10"></div>
                </div>
                {!isProcessing && view === 'content' && (
                    <div className="px-2 pb-2 md:hidden">
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
