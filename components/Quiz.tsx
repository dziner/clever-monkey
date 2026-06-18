// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import type { QuizData, UserAnswer, MCQQuizState, QuizQuestion } from '../types';
import { renderInline } from './MarkdownRenderer';
import { CheckIcon, XIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { generateStudyTips } from '../services/geminiService';
import { useUser } from '../contexts/UserContext';
import { t } from '../services/uiStrings';
import { Spinner } from './Spinner';
import { MarkdownRenderer } from './MarkdownRenderer';
import { aiJobBusyMessage, useAiJobGate } from '../contexts/AiJobContext';

type LegacyQuizState = MCQQuizState & { showResults?: boolean };

interface QuizProps {
    data: QuizData;
    documentId?: string;
    onCreateAnotherQuiz: () => void;
    quizState: MCQQuizState;
    onStateChange: (newState: MCQQuizState) => void;
    documentContent?: string;
    onRestartWithNewData?: (newQuizData: QuizData) => void;
    studyTips?: string;
    onStudyTipsGenerated?: (tips: string) => void;
}

export const Quiz: React.FC<QuizProps> = ({ data, documentId, onCreateAnotherQuiz, quizState, onStateChange, documentContent, onRestartWithNewData, studyTips, onStudyTipsGenerated }) => {
    const { userProfile } = useUser();
    const aiJobGate = useAiJobGate();
    const language = userProfile?.language ?? null;
    const { userAnswers, currentQuestionIndex } = quizState;
    // Handle legacy state from chat history which might use `showResults`.
    const isFinished = quizState.isFinished ?? (quizState as LegacyQuizState).showResults ?? false;

    // Local state to manage interaction within a single question
    const [selectedOption, setSelectedOption] = React.useState<number | undefined>(undefined);
    const [isChecked, setIsChecked] = React.useState(false);
    const [isGeneratingTips, setIsGeneratingTips] = React.useState(false);
    const [tipsGateMessage, setTipsGateMessage] = React.useState<string | null>(null);
    const tipsStartedRef = React.useRef(false);


    const totalQuestions = data.questions.length;
    const currentQuestion = data.questions[currentQuestionIndex];

    // Effect to sync local state when navigating between questions
    React.useEffect(() => {
        const userAnswer = userAnswers.find(a => a.questionIndex === currentQuestionIndex);
        if (userAnswer) {
            setSelectedOption(userAnswer.selectedOptionIndex);
            setIsChecked(true);
        } else {
            setSelectedOption(undefined);
            setIsChecked(false);
        }
    }, [currentQuestionIndex, userAnswers]);

    React.useEffect(() => {
        if (!isFinished) {
            tipsStartedRef.current = false;
            setTipsGateMessage(null);
        }
    }, [isFinished]);
    
    React.useEffect(() => {
        if (isFinished && documentContent && userAnswers.length > 0 && !studyTips && !isGeneratingTips && !tipsStartedRef.current) {
            const fetchTips = async () => {
                const aiJobLease = aiJobGate.tryStartJob({
                    kind: 'study_tips',
                    documentId: documentId ?? 'quiz',
                    label: '학습 팁 생성',
                });
                if (aiJobLease.ok === false) {
                    setTipsGateMessage(aiJobBusyMessage(aiJobLease.activeJob));
                    return;
                }
                tipsStartedRef.current = true;
                setTipsGateMessage(null);
                setIsGeneratingTips(true);
                try {
                    const tips = await generateStudyTips(documentContent, data, userAnswers, 'gemini-2.5-flash', language);
                    onStudyTipsGenerated?.(tips);
                } catch (error) {
                    console.error("Failed to generate study tips:", error);
                    onStudyTipsGenerated?.(t('studyTips.error', language));
                } finally {
                    setIsGeneratingTips(false);
                    aiJobLease.finish();
                }
            };
            fetchTips();
        }
    // language is in the dep array so a profile language change between
    // finishing the quiz and the tips fetch regenerates in the new language.
    }, [isFinished, documentContent, data, userAnswers, studyTips, onStudyTipsGenerated, language, aiJobGate, documentId, isGeneratingTips]);

    // Browser-level guard against accidental refresh / tab close while a
    // quiz is mid-progress. Browsers ignore the custom message text (a
    // legacy spam mitigation) but still show their own "leave site?" UI
    // when preventDefault is called — which is the protection we want.
    React.useEffect(() => {
        const inProgress = !isFinished && userAnswers.length > 0 && userAnswers.length < totalQuestions;
        if (!inProgress) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isFinished, userAnswers.length, totalQuestions]);

    const handleOptionSelect = (optionIndex: number) => {
        if (isChecked) return;
        setSelectedOption(optionIndex);
    };

    const handleCheckAnswer = () => {
        if (selectedOption === undefined) return;

        const isCorrect = currentQuestion.correctAnswerIndex === selectedOption;
        const newUserAnswer: UserAnswer = { 
            questionIndex: currentQuestionIndex, 
            selectedOptionIndex: selectedOption, 
            isCorrect 
        };

        const updatedAnswers = userAnswers.filter(a => a.questionIndex !== currentQuestionIndex);
        updatedAnswers.push(newUserAnswer);
        updatedAnswers.sort((a, b) => a.questionIndex - b.questionIndex);

        onStateChange({ ...quizState, userAnswers: updatedAnswers });
    };

    const handleNext = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            onStateChange({ ...quizState, currentQuestionIndex: currentQuestionIndex + 1 });
        } else {
            onStateChange({ ...quizState, isFinished: true });
        }
    };
    
    const handleRetryAll = () => {
        onStateChange({ ...quizState, userAnswers: [], currentQuestionIndex: 0, isFinished: false });
    };

    const handleRetryIncorrect = () => {
        if (!onRestartWithNewData) return;

        const incorrectQuestions: QuizQuestion[] = [];
        data.questions.forEach((q, index) => {
            const answer = userAnswers.find(a => a.questionIndex === index);
            if (answer && !answer.isCorrect) {
                incorrectQuestions.push(q);
            }
        });

        if (incorrectQuestions.length > 0) {
            const newQuizData: QuizData = {
                ...data,
                title: `${data.title} (Retry)`,
                questions: incorrectQuestions,
            };
            onRestartWithNewData(newQuizData);
        }
    };

    // Final results view
    if (isFinished) {
        const numCorrect = userAnswers.filter(a => a.isCorrect).length;
        const score = totalQuestions > 0 ? Math.round((numCorrect / totalQuestions) * 100) : 0;
        const hasIncorrect = numCorrect < totalQuestions;
        // Peak-end-rule celebration: a one-liner that adapts to the actual
        // result instead of a flat "Quiz complete." Stays warm even when
        // the score is mid — the goal is encouragement, not grading.
        const celebrationKey = score === 100
            ? 'quiz.celebrate.perfect'
            : score >= 70
                ? 'quiz.celebrate.great'
                : 'quiz.celebrate.good';

        return (
            <div className="space-y-4">
                {/* Results Card */}
                <div className="bg-brand-50 border border-brand-200 rounded-xl shadow-md p-4 text-ink-800 space-y-4">
                    <h2 className="text-lg font-bold text-center">{data.title} - Results</h2>

                    <div className="my-4 text-center">
                        <p className="text-sm text-ink-700">You scored</p>
                        <p className="text-4xl font-bold text-ink-800 my-1">{score}%</p>
                        <p className="text-sm font-semibold">{numCorrect} out of {totalQuestions} correct</p>
                        <p className="mt-3 text-sm text-brand-700 font-semibold">{t(celebrationKey, language)}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            {hasIncorrect && onRestartWithNewData ? (
                                <button
                                    onClick={handleRetryIncorrect}
                                    className="w-full px-4 py-2 bg-white border border-orange-500 text-warning-600 rounded-lg font-semibold hover:bg-warning-50 transition-colors text-sm"
                                >
                                    Retry Incorrect
                                </button>
                            ) : <div />}
                            <button
                                onClick={handleRetryAll}
                                className={`w-full px-4 py-2 bg-white border border-brand-500 text-brand-600 rounded-lg font-semibold hover:bg-brand-50 transition-colors text-sm ${!hasIncorrect ? 'col-span-2' : ''}`}
                            >
                                Retry All
                            </button>
                        </div>
                        <button
                            onClick={onCreateAnotherQuiz}
                            className="w-full text-center text-sm px-4 py-2 text-ink-700 rounded-lg font-semibold hover:bg-ink-200 transition-colors"
                        >
                            Create a New Quiz
                        </button>
                    </div>
                </div>

                {/* Study Tips Card */}
                {documentContent && (
                    isGeneratingTips ? (
                        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-4 flex flex-col items-center justify-center min-h-[10rem]">
                            <Spinner />
                            <p className="mt-2 text-sm font-semibold text-ink-700">Generating study tips...</p>
                        </div>
                    ) : tipsGateMessage ? (
                        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-4 text-center text-sm font-medium text-ink-500">
                            {tipsGateMessage}
                        </div>
                    ) : studyTips && (
                        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-4 animate-fade-in-up text-ink-800">
                            <MarkdownRenderer content={studyTips} />
                        </div>
                    )
                )}
            </div>
        );
    }

    // Question view
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    return (
        <div className="bg-brand-50 border border-brand-200 rounded-xl shadow-md p-4">
            <div className="text-ink-800 space-y-4">
                <h2 className="text-lg font-bold">{data.title}</h2>
                
                {/* Progress */}
                <div>
                    <p className="text-sm font-semibold text-ink-700 mb-1 text-right">
                        Question {currentQuestionIndex + 1} of {totalQuestions}
                    </p>
                    <div className="w-full bg-ink-200 rounded-full h-1.5">
                        <div 
                            className="bg-brand-500 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Question */}
                <div key={currentQuestionIndex} className="bg-white p-3 rounded-lg border border-ink-200">
                    <p className="font-semibold text-sm mb-2">
                        {renderInline(currentQuestion.questionText)}
                    </p>
                    <div className="space-y-2">
                        {currentQuestion.options.map((option, oIndex) => {
                            const isOptionSelectedByUser = selectedOption === oIndex;
                            const isCorrectOption = currentQuestion.correctAnswerIndex === oIndex;
                            
                            let stateClasses = '';
                            if (isChecked) {
                                if (isCorrectOption) {
                                    stateClasses = 'border-success-500 bg-success-50 text-success-700 font-semibold';
                                } else if (isOptionSelectedByUser) { // and not correct
                                    stateClasses = 'border-danger-500 bg-danger-50 text-danger-700 font-semibold';
                                } else {
                                    stateClasses = 'bg-ink-50 border-ink-300 text-ink-700 opacity-70';
                                }
                            } else {
                                if (isOptionSelectedByUser) {
                                    stateClasses = 'bg-brand-100 text-brand-800 border-brand-400 ring-2 ring-brand-300';
                                } else {
                                    stateClasses = 'bg-ink-50 hover:bg-ink-100 border-ink-300 text-ink-700';
                                }
                            }

                            return (
                                <button
                                    key={oIndex}
                                    onClick={() => handleOptionSelect(oIndex)}
                                    disabled={isChecked}
                                    className={`w-full text-left p-2 rounded-lg border text-sm transition-all flex items-start space-x-3 ${stateClasses}`}
                                >
                                    <span className="font-semibold mt-0.5">{String.fromCharCode(65 + oIndex)}.</span>
                                    <span>{renderInline(option)}</span>
                                </button>
                            );
                        })}
                    </div>
                    {isChecked && (
                        <div className="mt-3 p-2 bg-warning-50 rounded-md text-sm animate-fade-in-up">
                            <strong>Explanation:</strong> {renderInline(currentQuestion.explanation)}
                        </div>
                    )}
                </div>
                
                {/* Navigation */}
                <div className="flex justify-end items-center gap-2">
                    {!isChecked ? (
                        <button
                            onClick={handleCheckAnswer}
                            disabled={selectedOption === undefined}
                            className="flex items-center gap-1 px-4 py-2 bg-success-600 text-white rounded-lg font-semibold hover:bg-success-700 transition-colors disabled:bg-ink-300 disabled:cursor-not-allowed"
                        >
                            Check Answer <CheckIcon />
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors"
                        >
                            {isLastQuestion ? 'See Results' : 'Next'} <ChevronRightIcon />
                        </button>
                    )}
                </div>
                
                <button
                    onClick={onCreateAnotherQuiz}
                    className="w-full text-center text-sm px-4 py-2 text-ink-700 rounded-lg font-semibold hover:bg-ink-200 transition-colors"
                >
                    Create a New Quiz
                </button>
            </div>
        </div>
    );
};
