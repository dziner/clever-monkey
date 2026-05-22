import React from 'react';
import { MenuIcon, TrashIcon, CheckIcon, ErrorOutlineIcon, AssignmentIcon, BrainIcon, ChevronDownIcon, ChevronUpIcon } from '../components/icons';
import { fetchWrongAnswers, markReviewed, deleteWrongAnswer } from '../services/wrongAnswersService';
import type { WrongAnswerRecord } from '../services/wrongAnswersService';
import { Spinner } from '../components/Spinner';
import { supabase } from '../services/supabaseClient';

interface WrongAnswersPageProps {
    onMenuClick: () => void;
}

type FilterType = 'all' | 'mcq' | 'frq';
type FilterStatus = 'all' | 'pending' | 'reviewed';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const WrongAnswerCard: React.FC<{
    item: WrongAnswerRecord;
    onMarkReviewed: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ item, onMarkReviewed, onDelete }) => {
    const [expanded, setExpanded] = React.useState(false);
    const isReviewed = !!item.reviewedAt;

    return (
        <div className={`rounded-xl border transition-all duration-200 ${isReviewed ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 bg-white shadow-sm'}`}>
            {/* Card header — always visible */}
            <button
                type="button"
                className="w-full text-left p-4 flex items-start gap-3"
                onClick={() => setExpanded(e => !e)}
            >
                <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    item.quizType === 'mcq' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>
                    {item.quizType === 'mcq' ? <AssignmentIcon className="text-base" /> : <BrainIcon className="text-base" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isReviewed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {item.questionText}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-400 truncate max-w-[160px]" title={item.documentName}>
                            {item.documentName}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                        {item.quizType === 'frq' && item.score !== undefined && (
                            <>
                                <span className="text-slate-300">·</span>
                                <span className={`text-xs font-semibold ${item.score < 40 ? 'text-red-500' : 'text-orange-500'}`}>
                                    {item.score}점
                                </span>
                            </>
                        )}
                        {isReviewed && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">복습완료</span>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0 text-slate-300">
                    {expanded ? <ChevronUpIcon className="text-xl" /> : <ChevronDownIcon className="text-xl" />}
                </div>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                    {/* MCQ: show options */}
                    {item.quizType === 'mcq' && item.options && (
                        <div className="space-y-1.5">
                            {item.options.map((opt, i) => {
                                const isCorrect = i === item.correctAnswerIndex;
                                const isUserAnswer = i === item.userAnswerIndex;
                                let cls = 'text-slate-500 bg-slate-50';
                                if (isCorrect) cls = 'text-green-700 bg-green-50 border border-green-200 font-semibold';
                                else if (isUserAnswer) cls = 'text-red-700 bg-red-50 border border-red-200 line-through';
                                return (
                                    <div key={i} className={`text-xs px-3 py-2 rounded-lg ${cls}`}>
                                        <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                        {opt}
                                        {isCorrect && <span className="ml-2 text-green-600">✓ 정답</span>}
                                        {isUserAnswer && !isCorrect && <span className="ml-2 text-red-500">✗ 내 답</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* FRQ: show answers */}
                    {item.quizType === 'frq' && item.userAnswerText && (
                        <div className="space-y-2">
                            <div className="text-xs p-3 bg-red-50 border border-red-100 rounded-lg">
                                <span className="font-semibold text-red-700 block mb-1">내 답</span>
                                <span className="text-slate-700">{item.userAnswerText}</span>
                            </div>
                        </div>
                    )}

                    {/* Explanation / ideal answer */}
                    <div className="text-xs p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <span className="font-semibold text-blue-700 block mb-1">
                            {item.quizType === 'frq' ? '모범 답안' : '해설'}
                        </span>
                        <span className="text-slate-700 leading-relaxed">{item.explanation}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        {!isReviewed && (
                            <button
                                type="button"
                                onClick={() => onMarkReviewed(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                            >
                                <CheckIcon className="text-sm" /> 복습완료
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors"
                        >
                            <TrashIcon className="text-sm" /> 삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const WrongAnswersPage: React.FC<WrongAnswersPageProps> = ({ onMenuClick }) => {
    const [items, setItems] = React.useState<WrongAnswerRecord[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);
    const [filterDoc, setFilterDoc] = React.useState<string>('all');
    const [filterType, setFilterType] = React.useState<FilterType>('all');
    const [filterStatus, setFilterStatus] = React.useState<FilterStatus>('pending');

    // 집중 복습 모드
    const [isReviewMode, setIsReviewMode] = React.useState(false);
    const [reviewQueue, setReviewQueue] = React.useState<WrongAnswerRecord[]>([]);
    const [reviewIndex, setReviewIndex] = React.useState(0);
    const [showAnswer, setShowAnswer] = React.useState(false);
    const [reviewedInSession, setReviewedInSession] = React.useState(0);

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setIsLoggedIn(true);
                fetchWrongAnswers().then(data => {
                    setItems(data);
                    setIsLoading(false);
                });
            } else {
                setIsLoggedIn(false);
                setIsLoading(false);
            }
        });
    }, []);

    const handleMarkReviewed = async (id: string) => {
        const ok = await markReviewed(id);
        if (ok) {
            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, reviewedAt: new Date().toISOString() } : item
            ));
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await deleteWrongAnswer(id);
        if (ok) setItems(prev => prev.filter(item => item.id !== id));
    };

    // Derived data
    const uniqueDocs = React.useMemo(() => {
        const names = [...new Set(items.map(i => i.documentName))];
        return names.sort();
    }, [items]);

    const filtered = React.useMemo(() => {
        return items.filter(item => {
            if (filterDoc !== 'all' && item.documentName !== filterDoc) return false;
            if (filterType !== 'all' && item.quizType !== filterType) return false;
            if (filterStatus === 'pending' && item.reviewedAt) return false;
            if (filterStatus === 'reviewed' && !item.reviewedAt) return false;
            return true;
        });
    }, [items, filterDoc, filterType, filterStatus]);

    const pendingCount = items.filter(i => !i.reviewedAt).length;
    const reviewedCount = items.filter(i => !!i.reviewedAt).length;

    const selectCls = "text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none cursor-pointer";

    // 집중 복습 모드 핸들러
    const startReviewMode = () => {
        const pending = items.filter(i => !i.reviewedAt);
        setReviewQueue(pending);
        setReviewIndex(0);
        setShowAnswer(false);
        setReviewedInSession(0);
        setIsReviewMode(true);
    };

    const handleKnowIt = async () => {
        const current = reviewQueue[reviewIndex];
        await handleMarkReviewed(current.id);
        setReviewedInSession(n => n + 1);
        setShowAnswer(false);
        setReviewIndex(i => i + 1);
    };

    const handleReviewAgain = () => {
        setReviewQueue(q => [...q, q[reviewIndex]]);
        setShowAnswer(false);
        setReviewIndex(i => i + 1);
    };

    // 집중 복습 모드 UI
    if (isReviewMode) {
        const isDone = reviewIndex >= reviewQueue.length;
        const current = isDone ? null : reviewQueue[reviewIndex];
        const total = reviewQueue.length;

        if (isDone) {
            return (
                <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-8 text-center gap-6">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckIcon className="text-5xl text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">복습 완료!</h2>
                        <p className="text-slate-500 mt-2">총 {reviewedInSession}개 문제를 복습했습니다 🎉</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsReviewMode(false)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        오답노트로 돌아가기
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full bg-slate-50">
                {/* 복습 모드 헤더 */}
                <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="p-3 h-14 flex items-center gap-3">
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">집중 복습</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
                                        style={{ width: `${total > 0 ? (reviewIndex / total) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-600 flex-shrink-0">
                                    {reviewIndex} / {total}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsReviewMode(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                        >
                            나가기
                        </button>
                    </div>
                </div>

                {/* 복습 카드 */}
                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-4 gap-4">
                    <div className="w-full max-w-xl">
                        {/* 문제 유형 배지 */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                current!.quizType === 'mcq'
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-green-50 text-green-600'
                            }`}>
                                {current!.quizType === 'mcq' ? '객관식 MCQ' : '주관식 FRQ'}
                            </span>
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">{current!.documentName}</span>
                        </div>

                        {/* 문제 */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-base font-semibold text-slate-800 leading-relaxed">
                                {current!.questionText}
                            </h2>

                            {/* MCQ 선택지 (답 보기 전에도 보여줌) */}
                            {current!.quizType === 'mcq' && current!.options && (
                                <div className="mt-4 space-y-2">
                                    {current!.options.map((opt, i) => {
                                        let cls = 'border-slate-200 bg-slate-50 text-slate-600';
                                        if (showAnswer) {
                                            if (i === current!.correctAnswerIndex) {
                                                cls = 'border-green-300 bg-green-50 text-green-800 font-semibold';
                                            } else if (i === current!.userAnswerIndex) {
                                                cls = 'border-red-200 bg-red-50 text-red-700 line-through';
                                            }
                                        }
                                        return (
                                            <div key={i} className={`text-sm px-4 py-2.5 rounded-xl border ${cls}`}>
                                                <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                                {opt}
                                                {showAnswer && i === current!.correctAnswerIndex && (
                                                    <span className="ml-2 text-green-600 font-bold">✓ 정답</span>
                                                )}
                                                {showAnswer && i === current!.userAnswerIndex && i !== current!.correctAnswerIndex && (
                                                    <span className="ml-2 text-red-500">✗ 내 답</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 답 보기 후 해설 */}
                            {showAnswer && (
                                <div className="mt-4 space-y-3">
                                    {current!.quizType === 'frq' && current!.userAnswerText && (
                                        <div className="text-sm p-3 bg-red-50 border border-red-100 rounded-xl">
                                            <span className="font-semibold text-red-700 block mb-1">내 답</span>
                                            <span className="text-slate-700">{current!.userAnswerText}</span>
                                        </div>
                                    )}
                                    <div className="text-sm p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                        <span className="font-semibold text-blue-700 block mb-1">
                                            {current!.quizType === 'frq' ? '모범 답안' : '해설'}
                                        </span>
                                        <span className="text-slate-700 leading-relaxed">{current!.explanation}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 버튼 영역 */}
                        {!showAnswer ? (
                            <div className="mt-4 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowAnswer(true)}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    답 보기
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 flex gap-3 justify-center">
                                <button
                                    type="button"
                                    onClick={handleKnowIt}
                                    className="flex-1 max-w-[200px] px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-sm text-sm"
                                >
                                    ✅ 알아요
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReviewAgain}
                                    className="flex-1 max-w-[200px] px-4 py-3 bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-semibold hover:bg-orange-200 transition-colors text-sm"
                                >
                                    🔁 다시 볼게요
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center gap-3">
                    <button type="button" onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <ErrorOutlineIcon className="text-2xl text-orange-500 hidden md:block" />
                    <h1 className="text-lg font-bold text-slate-800">오답노트</h1>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                </div>
            ) : !isLoggedIn ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <ErrorOutlineIcon className="text-3xl text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-700">로그인이 필요합니다</p>
                    <p className="text-sm text-slate-500">오답노트를 저장하려면 로그인하세요.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Stats bar */}
                    <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold text-slate-800">{items.length}</span>
                            <span className="text-xs text-slate-500 font-medium">전체</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold text-orange-500">{pendingCount}</span>
                            <span className="text-xs text-slate-500 font-medium">복습 필요</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold text-green-600">{reviewedCount}</span>
                            <span className="text-xs text-slate-500 font-medium">복습 완료</span>
                        </div>
                        {items.length > 0 && (
                            <div className="ml-auto flex items-center gap-3">
                                {pendingCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={startReviewMode}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        🎯 집중 복습 시작
                                    </button>
                                )}
                                <div>
                                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-2 bg-green-500 rounded-full transition-all"
                                            style={{ width: `${items.length > 0 ? Math.round((reviewedCount / items.length) * 100) : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-right mt-0.5">
                                        {items.length > 0 ? Math.round((reviewedCount / items.length) * 100) : 0}% 완료
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filters */}
                    {items.length > 0 && (
                        <div className="px-4 py-3 flex items-center gap-2 flex-wrap bg-white border-b border-slate-100">
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)} className={selectCls}>
                                <option value="all">전체 상태</option>
                                <option value="pending">복습 필요</option>
                                <option value="reviewed">복습 완료</option>
                            </select>
                            <select value={filterType} onChange={e => setFilterType(e.target.value as FilterType)} className={selectCls}>
                                <option value="all">모든 유형</option>
                                <option value="mcq">객관식 (MCQ)</option>
                                <option value="frq">주관식 (FRQ)</option>
                            </select>
                            {uniqueDocs.length > 1 && (
                                <select value={filterDoc} onChange={e => setFilterDoc(e.target.value)} className={`${selectCls} max-w-[180px]`}>
                                    <option value="all">모든 교재</option>
                                    {uniqueDocs.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* List */}
                    <div className="p-4 space-y-2 max-w-2xl mx-auto w-full">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center">
                                    <ErrorOutlineIcon className="text-4xl text-orange-300" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-600">오답이 아직 없습니다</p>
                                    <p className="text-sm text-slate-400 mt-1">퀴즈를 풀면 틀린 문제가 여기에 자동으로 저장됩니다.</p>
                                </div>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                                <p className="font-semibold text-slate-500">조건에 맞는 문제가 없습니다</p>
                                <button type="button" onClick={() => { setFilterDoc('all'); setFilterType('all'); setFilterStatus('all'); }}
                                    className="text-sm text-blue-600 hover:underline">
                                    필터 초기화
                                </button>
                            </div>
                        ) : (
                            filtered.map(item => (
                                <WrongAnswerCard
                                    key={item.id}
                                    item={item}
                                    onMarkReviewed={handleMarkReviewed}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
