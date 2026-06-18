// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { renderInline } from './MarkdownRenderer';
import { AssignmentIcon, ChevronDownIcon, LightbulbIcon } from './icons';
import { normalizePresetQuestions, stripLeadingPresetQuestionIcon } from '../utils/presetQuestions';

interface PresetQuestionsProps {
    questions: unknown;
    onQuestionClick: (question: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const BRAIN_EMOJI_MARKER = '\u{1F9E0}';

export const PresetQuestions: React.FC<PresetQuestionsProps> = ({ questions, onQuestionClick, isOpen, setIsOpen }) => {
    const safeQuestions = React.useMemo(() => normalizePresetQuestions(questions) ?? [], [questions]);

    if (safeQuestions.length === 0) return null;
    
    // Collapsed "FAB" state
    if (!isOpen) {
        return (
            <div className="sticky bottom-1 z-10 flex justify-center">
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 bg-white rounded-full shadow-lg px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 border border-ink-200 transition-transform hover:scale-105 active:scale-95"
                    aria-expanded="false"
                    aria-label="Show suggested questions"
                >
                    <LightbulbIcon className="text-xl text-warning-500" />
                    <span>Try one of these questions</span>
                </button>
            </div>
        );
    }
    
    // Expanded "Card" state
    return (
        <div className="my-4 bg-ink-50 rounded-lg border border-ink-200 shadow-sm">
            <button 
                onClick={() => setIsOpen(false)} 
                className="w-full flex justify-between items-center text-sm font-medium text-ink-700 p-3 hover:bg-ink-100 rounded-t-lg"
                aria-expanded="true"
            >
                <span className="flex items-center font-semibold">
                    <LightbulbIcon className="text-xl mr-2 text-warning-500" />
                    Try one of these questions
                </span>
                <ChevronDownIcon className="text-xl" />
            </button>
            
            <div className="p-3 pt-0 grid grid-cols-1 gap-2">
                {safeQuestions.map((q, i) => {
                    const text = stripLeadingPresetQuestionIcon(q) || q;
                    const quizKeywords = ['quiz', '퀴즈'];
                    const isQuizQuestion = q.includes(BRAIN_EMOJI_MARKER) || quizKeywords.some(kw => text.toLowerCase().includes(kw));
                    const QuestionIcon = isQuizQuestion ? AssignmentIcon : LightbulbIcon;

                    return (
                        <button
                            key={i}
                            onClick={() => onQuestionClick(q)}
                            className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm leading-relaxed shadow-sm transition-all animate-fade-in-up ${
                                isQuizQuestion
                                ? 'bg-brand-100 border-brand-300 text-brand-900 hover:bg-brand-200 font-semibold'
                                : 'bg-white text-ink-700 border-ink-200 hover:border-brand-400 hover:bg-brand-50'
                            }`}
                             style={{ animationDelay: `${i * 100}ms` }}
                        >
                           <QuestionIcon className={`mt-0.5 text-base flex-shrink-0 ${isQuizQuestion ? 'text-brand-600' : 'text-warning-500'}`} />
                           <span className="flex-1 font-medium">{renderInline(text)}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
