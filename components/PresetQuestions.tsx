// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { renderInline } from './MarkdownRenderer';
import { ChevronDownIcon, ChevronUpIcon, LightbulbIcon } from './icons';

interface PresetQuestionsProps {
    questions: string[];
    onQuestionClick: (question: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const PresetQuestions: React.FC<PresetQuestionsProps> = ({ questions, onQuestionClick, isOpen, setIsOpen }) => {
    
    // Collapsed "FAB" state
    if (!isOpen) {
        return (
            <div className="sticky bottom-1 z-10 flex justify-center">
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 bg-white rounded-full shadow-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-transform hover:scale-105 active:scale-95"
                    aria-expanded="false"
                    aria-label="Show suggested questions"
                >
                    <LightbulbIcon className="text-xl text-yellow-500" />
                    <span>Try one of these questions</span>
                </button>
            </div>
        );
    }
    
    // Expanded "Card" state
    return (
        <div className="my-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
            <button 
                onClick={() => setIsOpen(false)} 
                className="w-full flex justify-between items-center text-sm font-medium text-slate-600 p-3 hover:bg-slate-100 rounded-t-lg"
                aria-expanded="true"
            >
                <span className="flex items-center font-semibold">
                    <LightbulbIcon className="text-xl mr-2 text-yellow-500" />
                    Try one of these questions
                </span>
                <ChevronDownIcon className="text-xl" />
            </button>
            
            <div className="p-3 pt-0 grid grid-cols-1 gap-2">
                {questions.map((q, i) => {
                     // Simple regex to split emoji from text
                    const match = q.match(/^(.*?)\s(.*)$/);
                    const emoji = match ? match[1] : '';
                    const text = match ? match[2] : q;
                    const quizKeywords = ['quiz', '퀴즈'];
                    const isQuizQuestion = q.includes('🧠') || quizKeywords.some(kw => text.toLowerCase().includes(kw));

                    return (
                        <button
                            key={i}
                            onClick={() => onQuestionClick(q)}
                            className={`p-3 rounded-lg text-left border transition-all shadow-sm flex items-start space-x-2 animate-fade-in-up ${
                                isQuizQuestion
                                ? 'bg-brand-100 border-brand-300 text-brand-900 hover:bg-brand-200 font-semibold'
                                : 'bg-white text-ink-700 border-ink-200 hover:border-brand-400 hover:bg-brand-50'
                            }`}
                             style={{ animationDelay: `${i * 100}ms` }}
                        >
                           <span className="text-lg mt-0.5">{emoji}</span>
                           <span className="flex-1 font-medium">{renderInline(text)}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};