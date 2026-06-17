import * as React from 'react';
import type { WrongAnswerRecord } from '../services/wrongAnswersService';
import {
    AssignmentIcon, BrainIcon, ChevronDownIcon, ChevronUpIcon,
    CheckIcon, TrashIcon, ErrorOutlineIcon, XIcon,
} from './icons';
import { Spinner } from './Spinner';

// Wrong-answers list rendered inside the Quiz tab. Extracted from
// InteractionPanel because it has no state coupling to the parent — the
// data + handlers are passed in as props — and because the card itself
// is a stateful (expand/collapse) unit best kept beside its container.

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface WrongAnswerCardProps {
    item: WrongAnswerRecord;
    onMarkReviewed: (id: string) => void;
    onDelete: (id: string) => void;
}

const WrongAnswerCard: React.FC<WrongAnswerCardProps> = ({ item, onMarkReviewed, onDelete }) => {
    const [expanded, setExpanded] = React.useState(false);
    const isReviewed = !!item.reviewedAt;
    return (
        <div className={`rounded-xl border transition-all duration-200 ${isReviewed ? 'border-ink-100 bg-ink-50/50' : 'border-ink-200 bg-white shadow-sm'}`}>
            <button type="button" className="w-full text-left p-3 flex items-start gap-3" onClick={() => setExpanded(e => !e)}>
                <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${item.quizType === 'mcq' ? 'bg-info-50 text-info-600' : 'bg-success-50 text-success-600'}`}>
                    {item.quizType === 'mcq' ? <AssignmentIcon className="text-sm" /> : <BrainIcon className="text-sm" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isReviewed ? 'text-ink-400 line-through' : 'text-ink-800'}`}>{item.questionText}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-ink-400">{formatDate(item.createdAt)}</span>
                        {item.quizType === 'frq' && item.score !== undefined && (
                            <span className={`text-xs font-semibold ${item.score < 40 ? 'text-danger-500' : 'text-warning-500'}`}>{item.score}점</span>
                        )}
                        {isReviewed && <span className="text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full font-medium">복습완료</span>}
                    </div>
                </div>
                <div className="flex-shrink-0 text-ink-300">
                    {expanded ? <ChevronUpIcon className="text-lg" /> : <ChevronDownIcon className="text-lg" />}
                </div>
            </button>
            {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-ink-100 pt-2">
                    {item.quizType === 'mcq' && item.options && (
                        <div className="space-y-1">
                            {item.options.map((opt, i) => {
                                const isCorrect = i === item.correctAnswerIndex;
                                const isUser = i === item.userAnswerIndex;
                                let cls = 'text-ink-500 bg-ink-50';
                                if (isCorrect) cls = 'text-success-700 bg-success-50 border border-success-200 font-semibold';
                                else if (isUser) cls = 'text-danger-700 bg-danger-50 border border-danger-200 line-through';
                                return (
                                    <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${cls}`}>
                                        <span className="font-bold mr-1.5">{String.fromCharCode(65 + i)}.</span>{opt}
                                        {isCorrect && (
                                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-success-600">
                                                <CheckIcon className="text-xs" /> 정답
                                            </span>
                                        )}
                                        {isUser && !isCorrect && (
                                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-danger-500">
                                                <XIcon className="text-xs" /> 내 답
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {item.quizType === 'frq' && item.userAnswerText && (
                        <div className="text-xs p-2.5 bg-danger-50 border border-danger-100 rounded-lg">
                            <span className="font-semibold text-danger-700 block mb-0.5">내 답</span>
                            <span className="text-ink-700">{item.userAnswerText}</span>
                        </div>
                    )}
                    <div className="text-xs p-2.5 bg-brand-50 border border-brand-100 rounded-lg">
                        <span className="font-semibold text-brand-700 block mb-0.5">{item.quizType === 'frq' ? '모범 답안' : '해설'}</span>
                        <span className="text-ink-700 leading-relaxed">{item.explanation}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                        {!isReviewed && (
                            <button type="button" onClick={() => onMarkReviewed(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-success-700 bg-success-50 hover:bg-success-100 border border-success-200 rounded-lg">
                                <CheckIcon className="text-xs" /> 복습완료
                            </button>
                        )}
                        <button type="button" onClick={() => onDelete(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:text-danger-600 hover:bg-danger-50 border border-ink-200 rounded-lg">
                            <TrashIcon className="text-xs" /> 삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface WrongAnswersPanelProps {
    items: WrongAnswerRecord[];
    isLoading: boolean;
    isLoggedIn: boolean;
    onMarkReviewed: (id: string) => void;
    onDelete: (id: string) => void;
}

export const WrongAnswersPanel: React.FC<WrongAnswersPanelProps> = ({ items, isLoading, isLoggedIn, onMarkReviewed, onDelete }) => {
    const pendingCount = items.filter(i => !i.reviewedAt).length;

    if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    if (!isLoggedIn) return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <ErrorOutlineIcon className="text-3xl text-ink-300" />
            <p className="font-semibold text-ink-700">로그인이 필요합니다</p>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto">
            {items.length > 0 && (
                <div className="px-4 py-2.5 border-b border-ink-100 bg-white flex items-center gap-3">
                    <span className="text-sm font-bold text-ink-800">{items.length}</span>
                    <span className="text-xs text-ink-500">전체</span>
                    <span className="w-px h-4 bg-ink-200" />
                    <span className="text-sm font-bold text-rose-600">{pendingCount}</span>
                    <span className="text-xs text-ink-500">복습 필요</span>
                </div>
            )}
            <div className="p-3 space-y-2">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
                            <ErrorOutlineIcon className="text-3xl text-rose-300" />
                        </div>
                        <div>
                            <p className="font-semibold text-ink-600">오답이 아직 없습니다</p>
                            <p className="text-sm text-ink-400 mt-1">퀴즈를 풀면 틀린 문제가 여기에 저장됩니다.</p>
                        </div>
                    </div>
                ) : (
                    items.map(item => (
                        <WrongAnswerCard key={item.id} item={item} onMarkReviewed={onMarkReviewed} onDelete={onDelete} />
                    ))
                )}
            </div>
        </div>
    );
};
