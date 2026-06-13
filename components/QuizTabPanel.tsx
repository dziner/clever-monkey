import * as React from 'react';
import type { DocumentData, QuizData, FRQData, QuizTabState } from '../types';
import type { ActiveTab } from './InteractionPanel';
import type { WrongAnswerRecord } from '../services/wrongAnswersService';
import { AssignmentIcon, ErrorOutlineIcon, StyleIcon } from './icons';
import { Spinner } from './Spinner';
import { LoginRequired } from './LoginRequired';
import { Quiz } from './Quiz';
import { FRQuiz } from './FRQuiz';
import { QuizGenerator } from './QuizGenerator';
import { WrongAnswersPanel } from './WrongAnswersNote';

// Quiz tab content (Quiz sub-view + 오답노트 sub-view). Lifted out of
// InteractionPanel so the parent's MainContent function stops carrying
// ~100 lines of quiz-specific UI. Pure render: every state and handler
// flows in via props, parent stays the source of truth.

export type QuizView = 'quiz' | 'wrong_answers';

interface QuizTabPanelProps {
    document: DocumentData;
    active: boolean;
    isGuest: boolean;
    onSignInClick: () => void;

    // Sub-view (Quiz vs 오답노트)
    quizView: QuizView;
    setQuizView: (v: QuizView) => void;

    // Quiz state + handlers
    isGeneratingQuiz: boolean;
    quizError: string | null;
    quizTabData: { quizContent: QuizData | FRQData; quizState: QuizTabState; studyTips?: string } | null | undefined;
    onGenerate: (type: 'mcq' | 'frq', count: number) => void;
    onStartNewQuiz: () => void;
    onQuizTabStateChange: (next: QuizTabState) => void;
    onRestartWithNewData: (data: QuizData | FRQData) => void;
    onStudyTipsGenerated: (tips: string) => void;

    // Wrong answers (오답노트)
    wrongAnswers: WrongAnswerRecord[];
    isLoadingWA: boolean;
    isLoggedInWA: boolean;
    onMarkReviewed: (id: string) => void;
    onDeleteWA: (id: string) => void;

    // Cross-tab nav (used by 'Flashcards' shortcut)
    onTabChange: (tab: ActiveTab) => void;
}

export const QuizTabPanel: React.FC<QuizTabPanelProps> = ({
    document, active, isGuest, onSignInClick,
    quizView, setQuizView,
    isGeneratingQuiz, quizError, quizTabData,
    onGenerate, onStartNewQuiz, onQuizTabStateChange,
    onRestartWithNewData, onStudyTipsGenerated,
    wrongAnswers, isLoadingWA, isLoggedInWA,
    onMarkReviewed, onDeleteWA,
    onTabChange,
}) => (
    <div className={`flex-1 flex-col bg-white overflow-hidden ${active ? 'flex' : 'hidden'}`}>
        {isGuest ? (
            <LoginRequired feature="퀴즈" onSignInClick={onSignInClick} />
        ) : (
            <>
                {/* Sub-tab strip: Quiz | 오답노트 */}
                <div className="flex-shrink-0 border-b border-ink-100 bg-white">
                    <div className="flex">
                        <button
                            type="button"
                            onClick={() => setQuizView('quiz')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${quizView === 'quiz' ? 'text-brand-600 border-brand-600' : 'text-ink-400 border-transparent hover:text-ink-700'}`}
                        >
                            <AssignmentIcon className="text-base" /> 퀴즈
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuizView('wrong_answers')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${quizView === 'wrong_answers' ? 'text-rose-600 border-rose-500' : 'text-ink-400 border-transparent hover:text-ink-700'}`}
                        >
                            <ErrorOutlineIcon className="text-base" /> 오답노트
                        </button>
                    </div>
                </div>

                {/* Quiz view */}
                {quizView === 'quiz' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        {isGeneratingQuiz && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Spinner />
                                <p className="mt-4 font-semibold text-ink-700">Generating your quiz... 🧠</p>
                            </div>
                        )}
                        {!isGeneratingQuiz && quizError && (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-danger-50 rounded-lg">
                                <p className="font-bold text-danger-700">Quiz Generation Failed</p>
                                <p className="text-danger-600 mt-2 text-sm">{quizError}</p>
                                <button onClick={onStartNewQuiz} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Try Again</button>
                            </div>
                        )}
                        {!isGeneratingQuiz && !quizTabData && !quizError && (
                            <QuizGenerator onGenerate={onGenerate} />
                        )}
                        {!isGeneratingQuiz && quizTabData && (
                            <div className="max-w-xl w-full mx-auto">
                                {quizTabData.quizState.type === 'mcq' ? (
                                    <Quiz
                                        data={quizTabData.quizContent as QuizData}
                                        onCreateAnotherQuiz={onStartNewQuiz}
                                        quizState={quizTabData.quizState}
                                        onStateChange={onQuizTabStateChange}
                                        documentContent={document.documentContent}
                                        onRestartWithNewData={onRestartWithNewData}
                                        studyTips={quizTabData.studyTips}
                                        onStudyTipsGenerated={onStudyTipsGenerated}
                                    />
                                ) : (
                                    <FRQuiz
                                        data={quizTabData.quizContent as FRQData}
                                        model={document.model}
                                        onCreateAnotherQuiz={onStartNewQuiz}
                                        quizState={quizTabData.quizState}
                                        onStateChange={onQuizTabStateChange}
                                        documentContent={document.documentContent}
                                        onRestartWithNewData={onRestartWithNewData}
                                        studyTips={quizTabData.studyTips}
                                        onStudyTipsGenerated={onStudyTipsGenerated}
                                    />
                                )}
                                <div className="mt-6 pt-4 border-t border-ink-100">
                                    <p className="text-xs font-semibold text-ink-400 mb-2">복습하기</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setQuizView('wrong_answers')}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                                        >
                                            <ErrorOutlineIcon className="text-lg" /> 오답노트 보기
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onTabChange('flashcards')}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
                                        >
                                            <StyleIcon className="text-lg" /> 플래시카드
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Wrong answers view */}
                {quizView === 'wrong_answers' && (
                    <WrongAnswersPanel
                        items={wrongAnswers}
                        isLoading={isLoadingWA}
                        isLoggedIn={isLoggedInWA}
                        onMarkReviewed={onMarkReviewed}
                        onDelete={onDeleteWA}
                    />
                )}
            </>
        )}
    </div>
);
