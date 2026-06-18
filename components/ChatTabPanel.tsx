import * as React from 'react';
import type { DocumentData, ChatMessage, MCQQuizState } from '../types';
import type { ActiveTab } from './InteractionPanel';
import { ChatIcon, SearchIcon, XIcon, AssignmentIcon } from './icons';
import { ChatBubble } from './ChatBubble';
import { Quiz } from './Quiz';
import { ChatInput } from './ChatInput';
import { PresetQuestions } from './PresetQuestions';
import { MonkeyModeToggle, AnswerScopeToggle } from './ChatModeToggles';
import { aiJobBusyMessage, useAiJobGate } from '../contexts/AiJobContext';

// Chat tab content. Lifted from InteractionPanel so the parent file
// stops needing to render ~130 lines of chat-specific JSX inline. The
// component is a pure render — every piece of state and every handler
// flows in via props, which keeps the parent the single source of
// truth for chat state. Behavior is byte-identical to the previous
// inline version; this is a code move, not a redesign.

interface ChatTabPanelProps {
    document: DocumentData;
    active: boolean;

    // Search header
    chatSearch: string;
    setChatSearch: (v: string) => void;
    isChatSearchOpen: boolean;
    toggleChatSearch: () => void;
    chatSearchRef: React.RefObject<HTMLInputElement>;

    // Message list
    chatContainerRef: React.RefObject<HTMLDivElement>;
    isBotTyping: boolean;
    isPreparingSuggestions: boolean;
    onSendMessage: (message: string) => void;
    onCreateAnotherQuiz: () => void;
    onQuizStateChange: (index: number, state: MCQQuizState) => void;
    onTabChange: (tab: ActiveTab) => void;

    // Preset questions panel
    canShowPresetQuestions: boolean;
    isPresetQuestionsOpen: boolean;
    setIsPresetQuestionsOpen: (open: boolean) => void;

    // Chat-mode toggles
    onMonkeyModeChange: (next: boolean) => void;
    onScopeChange: (next: 'document' | 'general') => void;
}

export const ChatTabPanel: React.FC<ChatTabPanelProps> = ({
    document, active,
    chatSearch, setChatSearch,
    isChatSearchOpen, toggleChatSearch, chatSearchRef,
    chatContainerRef, isBotTyping, isPreparingSuggestions,
    onSendMessage, onCreateAnotherQuiz, onQuizStateChange, onTabChange,
    canShowPresetQuestions, isPresetQuestionsOpen, setIsPresetQuestionsOpen,
    onMonkeyModeChange, onScopeChange,
}) => {
    const { activeJob } = useAiJobGate();
    const busyWithOtherAiJob = activeJob && activeJob.kind !== 'chat' ? activeJob : null;
    const hasPresetQuestions = Array.isArray(document.presetQuestions) && document.presetQuestions.length > 0;
    const matchCount = chatSearch
        ? document.chatHistory.filter(m => m.text.toLowerCase().includes(chatSearch.toLowerCase())).length
        : 0;

    return (
        <div className={`flex-1 flex-col bg-white overflow-hidden ${active ? 'flex' : 'hidden'}`}>
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-white">
                <div className="flex items-center gap-2">
                    <ChatIcon className="text-xl text-brand-500" />
                    <span className="font-semibold text-ink-700 text-sm">Chat</span>
                    {chatSearch && (
                        <span className="text-xs text-ink-400">{matchCount} matches</span>
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
                <div className="flex-shrink-0 px-4 py-2 border-b border-ink-100 bg-ink-50">
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm" />
                        <input
                            ref={chatSearchRef}
                            type="text"
                            value={chatSearch}
                            onChange={e => setChatSearch(e.target.value)}
                            placeholder="Search messages…"
                            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                        />
                        {chatSearch && (
                            <button type="button" onClick={() => setChatSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                                <XIcon className="text-sm" />
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4"
                role="log"
                aria-live="polite"
                aria-label="Chat history"
            >
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
                    const prevUserMsg: ChatMessage | undefined = msg.isError
                        ? document.chatHistory.slice(0, index).findLast(m => m.sender === 'user')
                        : undefined;
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
                                            onCreateAnotherQuiz={onCreateAnotherQuiz}
                                            quizState={msg.quizState}
                                            onStateChange={(newState) => onQuizStateChange(index, newState)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <ChatBubble
                                    message={msg}
                                    onRetry={prevUserMsg ? () => onSendMessage(prevUserMsg.text) : undefined}
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
                {hasPresetQuestions && canShowPresetQuestions && (
                    <PresetQuestions
                        isOpen={isPresetQuestionsOpen}
                        setIsOpen={setIsPresetQuestionsOpen}
                        questions={document.presetQuestions}
                        onQuestionClick={(q) => {
                            onSendMessage(q);
                            setIsPresetQuestionsOpen(false);
                        }}
                    />
                )}
            </div>
            <div className="p-4 bg-ink-50 border-t border-ink-200">
                <div className="max-w-3xl mx-auto">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <MonkeyModeToggle on={document.monkeyMode} onChange={onMonkeyModeChange} />
                        <AnswerScopeToggle scope={document.answerScope} onChange={onScopeChange} />
                    </div>
                    <ChatInput
                        isBotTyping={isBotTyping}
                        isMonkeyMode={document.monkeyMode}
                        isDisabled={Boolean(busyWithOtherAiJob)}
                        disabledReason={busyWithOtherAiJob ? aiJobBusyMessage(busyWithOtherAiJob) : null}
                        onSendMessage={(message) => {
                            onSendMessage(message);
                            setIsPresetQuestionsOpen(false);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
