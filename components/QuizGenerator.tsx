import * as React from 'react';
import { AssignmentIcon, BrainIcon, AutoAwesomeIcon } from './icons';

interface QuizGeneratorProps {
    onGenerate: (type: 'mcq' | 'frq', count: number) => void;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({ onGenerate }) => {
    const [quizType, setQuizType] = React.useState<'mcq' | 'frq'>('mcq');
    const [questionCount, setQuestionCount] = React.useState(5);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onGenerate(quizType, questionCount);
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-card border border-ink-200">
            <h3 className="text-lg font-display font-bold text-ink-900 tracking-tight mb-1 text-center">새 퀴즈 만들기</h3>
            <p className="text-xs text-ink-500 text-center mb-6">유형과 문항 수를 정하면 AI가 즉시 생성합니다.</p>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type selector */}
                <div>
                    <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-[0.14em] mb-2">유형</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setQuizType('mcq')}
                            className={[
                                'flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all',
                                quizType === 'mcq'
                                    ? 'bg-brand-50 text-brand-800 border-brand-400 ring-2 ring-brand-500/20'
                                    : 'bg-white hover:bg-ink-50 border-ink-200 text-ink-700',
                            ].join(' ')}
                        >
                            <AssignmentIcon className="text-base" />
                            객관식
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuizType('frq')}
                            className={[
                                'flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all',
                                quizType === 'frq'
                                    ? 'bg-success-50 text-success-700 border-success-500/60 ring-2 ring-success-500/20'
                                    : 'bg-white hover:bg-ink-50 border-ink-200 text-ink-700',
                            ].join(' ')}
                        >
                            <BrainIcon className="text-base" />
                            주관식
                        </button>
                    </div>
                </div>

                {/* Count */}
                <div>
                    <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-[0.14em] mb-2">문항 수</label>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button type="button" onClick={() => setQuestionCount(c => Math.max(1, c - 1))} className="w-9 h-9 rounded-lg border border-ink-200 bg-white font-bold text-ink-600 hover:bg-ink-50 text-base flex items-center justify-center shrink-0">−</button>
                        <input
                            type="number"
                            value={questionCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setQuestionCount(Math.max(1, Math.min(20, val)));
                            }}
                            className="w-14 h-9 text-center font-bold text-ink-900 bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                            min={1}
                            max={20}
                        />
                        <button type="button" onClick={() => setQuestionCount(c => Math.min(20, c + 1))} className="w-9 h-9 rounded-lg border border-ink-200 bg-white font-bold text-ink-600 hover:bg-ink-50 text-base flex items-center justify-center shrink-0">+</button>
                        <div className="w-px h-6 bg-ink-200 mx-1" />
                        <div className="flex items-center gap-1.5">
                            {[5, 10, 20].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setQuestionCount(num)}
                                    className={[
                                        'w-9 h-9 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center shrink-0',
                                        questionCount === num
                                            ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                                            : 'bg-white hover:bg-ink-50 border-ink-200 text-ink-600',
                                    ].join(' ')}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 h-11 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-soft"
                >
                    <AutoAwesomeIcon className="text-base" />
                    퀴즈 생성
                </button>
            </form>
        </div>
    );
};
