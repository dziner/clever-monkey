import * as React from 'react';
import { fetchQuizSessions, fetchWrongAnswers } from '../services/wrongAnswersService';
import { useUser } from '../contexts/UserContext';
import { t } from '../services/uiStrings';
import { computeStreak, averageScore, dailyCounts, type DashboardSession } from '../utils/progressStats';
import { BarChartIcon, CheckIcon, BoltIcon, AssignmentIcon, ErrorOutlineIcon } from './icons';

/**
 * Compact per-user dashboard rendered at the top of Overview. Cards show
 * streak / 7-day average / 7-day quiz count / pending wrong-answer
 * reviews, plus a 7-day bar chart of daily quiz counts. Data is the
 * already-collected quiz_sessions + wrong_answers — no extra schema.
 *
 * Zero-data path (new user) returns a calm encouragement instead of a
 * grid of zeros, keeping the cognitive load of the empty state low.
 */
export const ProgressDashboard: React.FC = () => {
    const { userProfile } = useUser();
    const lang = userProfile?.language;
    const [sessions, setSessions] = React.useState<DashboardSession[] | null>(null);
    const [pendingReviews, setPendingReviews] = React.useState<number>(0);

    React.useEffect(() => {
        let active = true;
        (async () => {
            const [quizSessions, wrongs] = await Promise.all([
                fetchQuizSessions(60),
                fetchWrongAnswers(),
            ]);
            if (!active) return;
            setSessions(quizSessions.map(s => ({ score: s.score, createdAt: s.createdAt })));
            setPendingReviews(wrongs.filter(w => !w.reviewedAt).length);
        })();
        return () => { active = false; };
    }, []);

    // Skeleton until first fetch resolves
    if (sessions === null) {
        return (
            <div className="bg-white rounded-2xl border border-ink-200 p-4 animate-pulse">
                <div className="h-4 w-24 bg-ink-100 rounded mb-3" />
                <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 bg-ink-50 rounded-lg" />
                    <div className="h-16 bg-ink-50 rounded-lg" />
                    <div className="h-16 bg-ink-50 rounded-lg" />
                    <div className="h-16 bg-ink-50 rounded-lg" />
                </div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-ink-200 p-5 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <BarChartIcon className="text-xl" />
                </div>
                <h3 className="text-h4 mb-1">{t('dash.empty.title', lang)}</h3>
                <p className="text-body-sm text-ink-500">{t('dash.empty.body', lang)}</p>
            </div>
        );
    }

    const streak = computeStreak(sessions);
    const avg = averageScore(sessions, 7);
    const trend = dailyCounts(sessions, 7);
    const quizzes7d = trend.reduce((s, d) => s + d.count, 0);
    const maxCount = Math.max(1, ...trend.map(d => d.count));

    return (
        <div className="bg-white rounded-2xl border border-ink-200 p-4">
            <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-3">
                {t('dash.title', lang)}
            </h3>
            <div className="grid grid-cols-2 gap-2">
                <StatCard
                    icon={<BoltIcon className="text-base text-warning-600" />}
                    label={t('dash.streak.label', lang)}
                    value={String(streak)}
                    unit={t('dash.streak.unit', lang)}
                />
                <StatCard
                    icon={<CheckIcon className="text-base text-success-600" />}
                    label={t('dash.avgScore.label', lang)}
                    value={String(avg)}
                    unit={t('dash.avgScore.unit', lang)}
                />
                <StatCard
                    icon={<AssignmentIcon className="text-base text-brand-600" />}
                    label={t('dash.quizzes.label', lang)}
                    value={String(quizzes7d)}
                    unit={t('dash.quizzes.unit', lang)}
                />
                <StatCard
                    icon={<ErrorOutlineIcon className="text-base text-danger-600" />}
                    label={t('dash.review.label', lang)}
                    value={pendingReviews === 0 ? '0' : String(pendingReviews)}
                    unit={pendingReviews === 0 ? t('dash.review.empty', lang) : t('dash.review.unit', lang)}
                />
            </div>

            {/* 7-day trend bars */}
            <div className="mt-4">
                <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">
                    {t('dash.trend.title', lang)}
                </p>
                <div className="flex items-end gap-1.5 h-14">
                    {trend.map(({ dayKey, count }) => {
                        // Always reserve a 4-px floor so an empty day is
                        // still visible as a ghost tick — better than the
                        // bar disappearing entirely.
                        const ratio = count / maxCount;
                        const height = count === 0 ? 4 : Math.max(8, ratio * 56);
                        const dayLabel = dayKey.slice(5).replace('-', '/');
                        return (
                            <div key={dayKey} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className={`w-full rounded-md transition-colors ${count > 0 ? 'bg-brand-500' : 'bg-ink-100'}`}
                                    style={{ height }}
                                    title={`${dayLabel}: ${count}`}
                                />
                                <span className="text-[10px] text-ink-400">{dayLabel}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; unit: string }> = ({ icon, label, value, unit }) => (
    <div className="rounded-xl bg-ink-50 px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
            {icon}
            <p className="text-[11px] font-semibold text-ink-500 truncate">{label}</p>
        </div>
        <p className="text-xl font-bold text-ink-900 leading-none">{value}</p>
        <p className="text-[11px] text-ink-500 mt-1 truncate">{unit}</p>
    </div>
);
