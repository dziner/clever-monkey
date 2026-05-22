import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { fetchWrongAnswers, fetchQuizSessions } from '../services/wrongAnswersService';
import type { WrongAnswerRecord, QuizSession } from '../services/wrongAnswersService';
import { MenuIcon, AssignmentIcon, ErrorOutlineIcon, DocumentIcon, AutoAwesomeIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';
import { supabase } from '../services/supabaseClient';

interface DashboardPageProps {
    onMenuClick: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onMenuClick }) => {
    const { state } = useDocuments();
    const [wrongAnswers, setWrongAnswers] = React.useState<WrongAnswerRecord[]>([]);
    const [sessions, setSessions] = React.useState<QuizSession[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setIsLoggedIn(true);
                Promise.all([fetchWrongAnswers(), fetchQuizSessions(30)]).then(([wa, sess]) => {
                    setWrongAnswers(wa);
                    setSessions(sess);
                    setIsLoading(false);
                });
            } else {
                setIsLoggedIn(false);
                setIsLoading(false);
            }
        });
    }, []);

    const totalDocuments = state.documents.length;
    const totalTokens = state.documents.reduce((acc, doc) => acc + (doc.tokenCount ?? 0), 0);

    const pendingCount = wrongAnswers.filter(i => !i.reviewedAt).length;
    const reviewedCount = wrongAnswers.filter(i => !!i.reviewedAt).length;
    const totalWrong = wrongAnswers.length;
    const reviewRatePercent = totalWrong > 0 ? Math.round((reviewedCount / totalWrong) * 100) : 0;

    const recentSessions = sessions.slice(0, 10);

    const formatTokens = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden"
                        aria-label="Open menu"
                    >
                        <MenuIcon className="text-2xl" />
                    </button>
                    <AutoAwesomeIcon className="text-2xl text-purple-500 hidden md:block" />
                    <h1 className="text-lg font-bold text-slate-800">학습 대시보드</h1>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                </div>
            ) : !isLoggedIn ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <AutoAwesomeIcon className="text-3xl text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-700">로그인이 필요합니다</p>
                    <p className="text-sm text-slate-500">대시보드를 사용하려면 로그인하세요.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* 총 문서 수 */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <DocumentIcon className="text-xl text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-800">{totalDocuments}</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">총 문서 수</p>
                                </div>
                            </div>

                            {/* 총 토큰 사용량 */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <AutoAwesomeIcon className="text-xl text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-800">{formatTokens(totalTokens)}</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">총 토큰 사용량</p>
                                </div>
                            </div>

                            {/* 퀴즈 세션 수 */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                                    <AssignmentIcon className="text-xl text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-800">{sessions.length}</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">퀴즈 세션 수</p>
                                </div>
                            </div>

                            {/* 오답 복습률 */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                                    <ErrorOutlineIcon className="text-xl text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-800">{reviewRatePercent}%</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">오답 복습률</p>
                                </div>
                            </div>
                        </div>

                        {/* 퀴즈 성적 히스토리 */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h2 className="text-sm font-bold text-slate-700 mb-4">퀴즈 성적 히스토리 (최근 10회)</h2>
                            {recentSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                                    <AssignmentIcon className="text-4xl text-slate-300" />
                                    <p className="text-sm text-slate-400">아직 퀴즈 세션이 없습니다</p>
                                </div>
                            ) : (
                                <div className="flex items-end gap-2 h-36 px-1">
                                    {recentSessions.map((session, idx) => {
                                        const heightPercent = Math.max(4, session.score);
                                        const isMCQ = session.quizType === 'mcq';
                                        const barColor = isMCQ ? 'bg-blue-400 hover:bg-blue-500' : 'bg-green-400 hover:bg-green-500';
                                        return (
                                            <div
                                                key={session.id}
                                                className="flex-1 flex flex-col items-center justify-end gap-1 group relative"
                                                style={{ minWidth: 0 }}
                                            >
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                                    <div className="bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg text-center">
                                                        <div className="font-bold">{session.score}점</div>
                                                        <div className="text-slate-300 max-w-[120px] truncate">{session.documentName}</div>
                                                        <div className="text-slate-400">{isMCQ ? 'MCQ' : 'FRQ'} · {session.correctCount}/{session.totalQuestions}</div>
                                                    </div>
                                                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
                                                </div>
                                                {/* Bar */}
                                                <div
                                                    className={`w-full rounded-t-md transition-all duration-200 cursor-pointer ${barColor}`}
                                                    style={{ height: `${heightPercent}%` }}
                                                    title={`${session.score}점 - ${session.documentName}`}
                                                />
                                                {/* Score label */}
                                                <span className="text-[9px] text-slate-400 font-medium">{session.score}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {recentSessions.length > 0 && (
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-sm bg-blue-400" />
                                        <span className="text-[10px] text-slate-500">MCQ 객관식</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-sm bg-green-400" />
                                        <span className="text-[10px] text-slate-500">FRQ 주관식</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 오답노트 현황 */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h2 className="text-sm font-bold text-slate-700 mb-4">오답노트 현황</h2>
                            {totalWrong === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                                    <ErrorOutlineIcon className="text-4xl text-slate-300" />
                                    <p className="text-sm text-slate-400">아직 오답이 없습니다</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                                        <span>복습 진행도</span>
                                        <span className="text-slate-700 font-bold">{reviewedCount} / {totalWrong} 완료</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-3 bg-green-500 rounded-full transition-all duration-500"
                                            style={{ width: `${reviewRatePercent}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                                            <span className="text-xs text-slate-500">{pendingCount}개 복습 필요</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                            <span className="text-xs text-slate-500">{reviewedCount}개 복습 완료</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
