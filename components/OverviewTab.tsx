import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { DocumentData } from '../types';
import type { ActiveTab } from './InteractionPanel';
import { ROUTES } from '../routes';
import {
    ChatIcon, AssignmentIcon, AccountTreeIcon, SlideshowIcon, HeadphonesIcon,
    CopyIcon, ErrorOutlineIcon, StyleIcon, ChevronDownIcon, ChevronUpIcon,
} from './icons';
import { MarkdownRenderer } from './MarkdownRenderer';
import { fetchQuizSessions, fetchWrongAnswers } from '../services/wrongAnswersService';
import type { QuizSession } from '../services/wrongAnswersService';
import { fetchDecks } from '../services/flashcardsService';

interface OverviewStats {
    latestQuiz?: QuizSession;
    quizAttempts: number;
    wrongCount: number;
    dueCards: number;
    totalCards: number;
}

interface OverviewTabProps {
    document: DocumentData;
    onSelectTab: (tab: ActiveTab) => void;
}

const QUICK_TOOLS: { id: ActiveTab; label: string; icon: React.FC<React.HTMLAttributes<HTMLSpanElement>> }[] = [
    { id: 'chat', label: 'Chat', icon: ChatIcon },
    { id: 'quiz', label: 'Quiz', icon: AssignmentIcon },
    { id: 'mindmap', label: 'Mind Map', icon: AccountTreeIcon },
    { id: 'slides', label: 'Slides', icon: SlideshowIcon },
    { id: 'podcast', label: 'Podcast', icon: HeadphonesIcon },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({ document, onSelectTab }) => {
    const navigate = useNavigate();
    const [stats, setStats] = React.useState<OverviewStats | null>(null);
    const [summaryExpanded, setSummaryExpanded] = React.useState(false);

    React.useEffect(() => {
        let active = true;
        (async () => {
            const [sessions, wrongs, decks] = await Promise.all([
                fetchQuizSessions(),
                fetchWrongAnswers(),
                fetchDecks(),
            ]);
            if (!active) return;
            const docSessions = sessions.filter(s => s.documentName === document.fileName);
            const docWrongs = wrongs.filter(w => w.documentId === document.id);
            const docDecks = decks.filter(d => d.documentId === document.id);
            setStats({
                latestQuiz: docSessions[0],
                quizAttempts: docSessions.length,
                wrongCount: docWrongs.length,
                dueCards: docDecks.reduce((s, d) => s + d.dueCards, 0),
                totalCards: docDecks.reduce((s, d) => s + d.totalCards, 0),
            });
        })();
        return () => { active = false; };
    }, [document.id, document.fileName]);

    const summaryPreview = (document.summary || '').trim();

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            <div className="max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
                {/* Summary */}
                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <CopyIcon className="text-lg text-blue-500" />
                        <h2 className="font-bold text-slate-800 text-sm">요약</h2>
                    </div>
                    {summaryPreview ? (
                        summaryExpanded ? (
                            <div className="text-slate-800">
                                <MarkdownRenderer content={summaryPreview} />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{summaryPreview}</p>
                        )
                    ) : (
                        <p className="text-sm text-slate-400">요약이 아직 없습니다.</p>
                    )}
                    {summaryPreview && (
                        <button
                            type="button"
                            onClick={() => setSummaryExpanded(v => !v)}
                            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                            {summaryExpanded ? <>간략히 <ChevronUpIcon className="text-base" /></> : <>전체 요약 보기 <ChevronDownIcon className="text-base" /></>}
                        </button>
                    )}
                </section>

                {/* Progress */}
                <section>
                    <h2 className="px-1 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">학습 진척</h2>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => onSelectTab('quiz')}
                            className="flex flex-col items-start gap-1 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
                        >
                            <AssignmentIcon className="text-xl text-blue-500" />
                            <span className="text-xs font-medium text-slate-400">퀴즈</span>
                            <span className="text-lg font-bold text-slate-800 leading-none">
                                {stats?.latestQuiz ? `${stats.latestQuiz.score}%` : '–'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                {stats ? (stats.quizAttempts > 0 ? `${stats.quizAttempts}회 응시` : '아직 없음') : '...'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(ROUTES.WRONG_ANSWERS)}
                            className="flex flex-col items-start gap-1 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-rose-300 hover:shadow-md transition-all text-left"
                        >
                            <ErrorOutlineIcon className="text-xl text-rose-500" />
                            <span className="text-xs font-medium text-slate-400">오답노트</span>
                            <span className="text-lg font-bold text-slate-800 leading-none">
                                {stats ? stats.wrongCount : '...'}
                            </span>
                            <span className="text-[11px] text-slate-400">개 복습 대기</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(ROUTES.FLASHCARDS, { state: { openGenerate: stats?.totalCards === 0, source: 'document', documentId: document.id } })}
                            className="flex flex-col items-start gap-1 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left"
                        >
                            <StyleIcon className="text-xl text-purple-500" />
                            <span className="text-xs font-medium text-slate-400">플래시카드</span>
                            <span className="text-lg font-bold text-slate-800 leading-none">
                                {stats ? (stats.totalCards > 0 ? stats.dueCards : '–') : '...'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                {stats ? (stats.totalCards > 0 ? `/ ${stats.totalCards}장 복습` : '카드 만들기') : '...'}
                            </span>
                        </button>
                    </div>
                </section>

                {/* Quick tool launch */}
                <section>
                    <h2 className="px-1 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">학습 도구</h2>
                    <div className="grid grid-cols-5 gap-2">
                        {QUICK_TOOLS.map(tool => (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => onSelectTab(tool.id)}
                                className="flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 hover:text-blue-600 text-slate-500 transition-all"
                            >
                                <tool.icon className="text-xl" />
                                <span className="text-[10px] font-semibold leading-none text-center">{tool.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
