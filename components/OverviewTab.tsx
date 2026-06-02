import * as React from 'react';
import type { DocumentData } from '../types';
import type { ActiveTab } from './InteractionPanel';
import {
    ChatIcon, AssignmentIcon, AccountTreeIcon, StyleIcon, HeadphonesIcon,
    ErrorOutlineIcon, ChevronDownIcon, ChevronUpIcon, AutoAwesomeIcon,
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
    { id: 'flashcards', label: 'Cards', icon: StyleIcon },
    { id: 'podcast', label: 'Podcast', icon: HeadphonesIcon },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({ document, onSelectTab }) => {
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
            const docSessions = sessions.filter(s => s.documentId === document.id);
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
    }, [document.id]);

    const summaryPreview = (document.summary || '').trim();

    return (
        <div className="flex-1 overflow-y-auto bg-ink-50">
            <div className="max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
                {/* Summary card */}
                <section className="bg-white border border-ink-200 rounded-lg p-4 shadow-card">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                                <AutoAwesomeIcon className="text-base text-brand-700" />
                            </div>
                            <h2 className="text-h3">요약</h2>
                        </div>
                        {summaryPreview ? (
                            summaryExpanded ? (
                                <div className="text-ink-800 prose-sm">
                                    <MarkdownRenderer content={summaryPreview} />
                                </div>
                            ) : (
                                <p className="text-body text-ink-600 line-clamp-4">{summaryPreview}</p>
                            )
                        ) : (
                            <p className="text-body text-ink-400">요약이 아직 없습니다.</p>
                        )}
                        {summaryPreview && (
                            <button
                                type="button"
                                onClick={() => setSummaryExpanded(v => !v)}
                                className="mt-3 inline-flex items-center gap-1 text-caption text-brand-600 hover:text-brand-700"
                            >
                                {summaryExpanded
                                    ? <>간략히 보기 <ChevronUpIcon className="text-base" /></>
                                    : <>전체 요약 보기 <ChevronDownIcon className="text-base" /></>}
                            </button>
                        )}
                    </div>
                </section>

                {/* Progress stats */}
                <section>
                    <h2 className="px-1 mb-2 text-eyebrow">학습 진척</h2>
                    <div className="grid grid-cols-3 gap-2.5">
                        <StatTile
                            tone="brand"
                            label="퀴즈"
                            value={stats?.latestQuiz ? `${stats.latestQuiz.score}%` : '–'}
                            sub={stats ? (stats.quizAttempts > 0 ? `${stats.quizAttempts}회 응시` : '아직 없음') : '...'}
                            icon={AssignmentIcon}
                            onClick={() => onSelectTab('quiz')}
                        />
                        <StatTile
                            tone="rose"
                            label="오답노트"
                            value={stats ? String(stats.wrongCount) : '...'}
                            sub="개 복습 대기"
                            icon={ErrorOutlineIcon}
                            onClick={() => onSelectTab('quiz')}
                        />
                        <StatTile
                            tone="purple"
                            label="플래시카드"
                            value={stats ? (stats.totalCards > 0 ? String(stats.dueCards) : '–') : '...'}
                            sub={stats ? (stats.totalCards > 0 ? `/ ${stats.totalCards}장` : '카드 만들기') : '...'}
                            icon={StyleIcon}
                            onClick={() => onSelectTab('flashcards')}
                        />
                    </div>
                </section>

                {/* Quick tools */}
                <section>
                    <h2 className="px-1 mb-2 text-eyebrow">학습 도구</h2>
                    <div className="grid grid-cols-5 gap-2">
                        {QUICK_TOOLS.map(tool => (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => onSelectTab(tool.id)}
                                className="group flex flex-col items-center gap-1.5 p-3 bg-white border border-ink-200 rounded-xl shadow-soft hover:border-brand-300 hover:shadow-card transition-all"
                            >
                                <div className="w-9 h-9 rounded-lg bg-ink-50 group-hover:bg-brand-50 flex items-center justify-center transition-colors">
                                    <tool.icon className="text-lg text-ink-500 group-hover:text-brand-600 transition-colors" />
                                </div>
                                <span className="text-[10px] font-bold leading-none text-center text-ink-600 group-hover:text-brand-700 transition-colors">
                                    {tool.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

interface StatTileProps {
    tone: 'brand' | 'rose' | 'purple';
    label: string;
    value: string;
    sub: string;
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    onClick: () => void;
}

const TONE_MAP = {
    brand:  { iconBg: 'bg-brand-50',  iconText: 'text-brand-600',  hover: 'hover:border-brand-300' },
    rose:   { iconBg: 'bg-rose-50',   iconText: 'text-rose-600',   hover: 'hover:border-rose-300' },
    purple: { iconBg: 'bg-purple-50', iconText: 'text-purple-600', hover: 'hover:border-purple-300' },
};

const StatTile: React.FC<StatTileProps> = ({ tone, label, value, sub, icon: Icon, onClick }) => {
    const t = TONE_MAP[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'group flex flex-col items-start gap-1 p-4 bg-white border border-ink-200 rounded-lg shadow-card',
                'transition-transform duration-200 ease-out active:scale-[0.98] text-left',
                t.hover,
            ].join(' ')}
        >
            <div className={`w-8 h-8 rounded-lg ${t.iconBg} flex items-center justify-center`}>
                <Icon className={`text-base ${t.iconText}`} />
            </div>
            <span className="text-eyebrow">{label}</span>
            <span className="text-22 font-extrabold text-ink-900 leading-none tracking-tight tabular-nums">{value}</span>
            <span className="text-13 text-ink-500">{sub}</span>
        </button>
    );
};
