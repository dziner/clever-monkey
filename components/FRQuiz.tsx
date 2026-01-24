// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import type { FRQData, FRUserAnswer, Model, FRQQuizState, FRQuestion } from '../types';
import { evaluateFRQAnswer, generateStudyTips } from '../services/geminiService';
import { Spinner } from './Spinner';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { MarkdownRenderer } from './MarkdownRenderer';

interface FRQuizProps {
    data: FRQData;
    model: Model;
    onCreateAnotherQuiz: () => void;
    quizState: FRQQuizState;
    onStateChange: (newState: FRQQuizState) => void;
    documentContent?: string;
    onRestartWithNewData?: (newQuizData: FRQData) => void;
    studyTips?: string;
    onStudyTipsGenerated: (tips: string) => void;
}

export const FRQuiz: React.FC<FRQuizProps> = ({ data, model, onCreateAnotherQuiz, quizState, onStateChange, documentContent, onRestartWithNewData, studyTips, onStudyTipsGenerated }) => {
    const { userAnswers, currentQuestionIndex, isFinished, isGrading } = quizState;
    
    const [localAnswerText, setLocalAnswerText] = React.useState('');
    const [isGeneratingTips, setIsGeneratingTips] = React.useState(false);


    React.useEffect(() => {
        const savedAnswer = userAnswers.find(a => a.questionIndex === currentQuestionIndex)?.userAnswerText || '';
        setLocalAnswerText(savedAnswer);
    }, [currentQuestionIndex, userAnswers]);
    
    React.useEffect(() => {
        if (isFinished && !isGrading && documentContent && userAnswers.length > 0 && !studyTips) {
            const fetchTips = async () => {
                setIsGeneratingTips(true);
                try {
                    const tips = await generateStudyTips(documentContent, data, userAnswers, model);
                    onStudyTipsGenerated(tips);
                } catch (error) {
                    console.error("Failed to generate study tips:", error);
                    onStudyTipsGenerated("Sorry, I couldn't generate study tips at this time.");
                } finally {
                    setIsGeneratingTips(false);
                }
            };
            fetchTips();
        }
    }, [isFinished, isGrading, documentContent, data, userAnswers, model, studyTips, onStudyTipsGenerated]);

    const commitLocalAnswer = () => {
        const updatedAnswers = [...userAnswers];
        const existingAnswerIndex = updatedAnswers.findIndex(a => a.questionIndex === currentQuestionIndex);
        const trimmedAnswer = localAnswerText.trim();

        if (existingAnswerIndex > -1) {
            if (trimmedAnswer) {
                updatedAnswers[existingAnswerIndex].userAnswerText = trimmedAnswer;
            } else {
                updatedAnswers.splice(existingAnswerIndex, 1);
            }
        } else if (trimmedAnswer) {
            updatedAnswers.push({ questionIndex: currentQuestionIndex, userAnswerText: trimmedAnswer });
        }
        updatedAnswers.sort((a,b) => a.questionIndex - b.questionIndex);
        return updatedAnswers;
    };

    const handleNext = () => {
        const updatedAnswers = commitLocalAnswer();
        if (currentQuestionIndex < data.questions.length - 1) {
            onStateChange({ ...quizState, userAnswers: updatedAnswers, currentQuestionIndex: currentQuestionIndex + 1 });
        }
    };

    const handleBack = () => {
        const updatedAnswers = commitLocalAnswer();
        if (currentQuestionIndex > 0) {
            onStateChange({ ...quizState, userAnswers: updatedAnswers, currentQuestionIndex: currentQuestionIndex - 1 });
        }
    };
    
    const handleFinishAndGrade = async () => {
        const finalAnswers = commitLocalAnswer();
        onStateChange({ ...quizState, userAnswers: finalAnswers, isFinished: true, isGrading: true });

        const gradingPromises = finalAnswers.map(answer => {
            const question = data.questions[answer.questionIndex];
            return evaluateFRQAnswer(question.questionText, question.explanation, answer.userAnswerText, model)
                .then(result => ({ ...answer, ...result }))
                .catch(error => {
                    console.error("Failed to grade answer:", error);
                    return { ...answer, score: 0, feedback: "Sorry, an error occurred while grading this answer." };
                });
        });

        const results = await Promise.all(gradingPromises);
        results.sort((a, b) => a.questionIndex - b.questionIndex);
        onStateChange({ ...quizState, userAnswers: results, isFinished: true, isGrading: false });
    };

    const handleRetryAll = () => {
        onStateChange({ ...quizState, userAnswers: [], currentQuestionIndex: 0, isFinished: false, isGrading: false });
    };

    const handleRetryLowScoring = () => {
        if (!onRestartWithNewData) return;
        const LOW_SCORE_THRESHOLD = 70;

        const lowScoringQuestions: FRQuestion[] = [];
        data.questions.forEach((q, index) => {
            const answer = userAnswers.find(a => a.questionIndex === index);
            if (answer && (answer.score ?? 100) < LOW_SCORE_THRESHOLD) {
                lowScoringQuestions.push(q);
            }
        });

        if (lowScoringQuestions.length > 0) {
            const newQuizData: FRQData = {
                ...data,
                title: `${data.title} (Retry)`,
                questions: lowScoringQuestions,
            };
            onRestartWithNewData(newQuizData);
        }
    };


    const totalQuestions = data.questions.length;

    if (isFinished) {
        const totalScore = userAnswers.reduce((acc, ans) => acc + (ans.score ?? 0), 0);
        const averageScore = userAnswers.length > 0 ? Math.round(totalScore / userAnswers.length) : 0;
        const hasLowScoring = userAnswers.some(a => (a.score ?? 100) < 70);

        return (
            <div className="space-y-4">
                {/* Results Card */}
                <div className="bg-green-50 border border-green-200 rounded-xl shadow-md p-4 text-slate-800 space-y-4">
                    <h2 className="text-lg font-bold text-center">{data.title} - Results</h2>
                     {isGrading ? (
                        <div className="flex flex-col items-center justify-center p-8">
                            <Spinner />
                            <p className="mt-4 font-semibold text-slate-700">AI is grading your answers...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div className="my-4 text-center">
                                <p className="text-sm text-slate-600">Average Score</p>
                                <p className={`text-4xl font-bold my-1 ${averageScore >= 70 ? 'text-green-600' : 'text-orange-600'}`}>{averageScore}%</p>
                            </div>
                            {data.questions.map((q, index) => {
                                const userAnswer = userAnswers.find(a => a.questionIndex === index);
                                if (!userAnswer) return null;
                                return (
                                    <div key={index} className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                                        <p className="font-semibold mb-2">{q.questionText}</p>
                                        <p className="p-2 bg-blue-50/50 border border-blue-200 rounded-md"><strong>Your answer:</strong> {userAnswer.userAnswerText}</p>
                                        <div className="mt-2 p-2 bg-yellow-50/50 border border-yellow-200 rounded-md">
                                            <div className="flex justify-between items-baseline">
                                                <p><span className="font-bold">Score:</span> <span className={`font-bold ${userAnswer.score >= 70 ? 'text-green-700' : 'text-orange-700'}`}>{userAnswer.score}/100</span></p>
                                            </div>
                                            <p><strong>Feedback:</strong> {userAnswer.feedback}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            
                            <div className="space-y-2 pt-2">
                                 <div className="grid grid-cols-2 gap-2">
                                    {hasLowScoring && onRestartWithNewData ? (
                                        <button
                                            onClick={handleRetryLowScoring}
                                            className="w-full px-4 py-2 bg-white border border-orange-500 text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm"
                                        >
                                            Retry Low-Scoring
                                        </button>
                                    ) : <div />}
                                    <button
                                        onClick={handleRetryAll}
                                        className={`w-full px-4 py-2 bg-white border border-blue-500 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm ${!hasLowScoring ? 'col-span-2' : ''}`}
                                    >
                                        Retry All
                                    </button>
                                </div>
                                <button
                                    onClick={onCreateAnotherQuiz}
                                    className="w-full text-center text-sm px-4 py-2 text-slate-600 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                                >
                                    Create a New Quiz
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Study Tips Card */}
                {!isGrading && documentContent && (
                    isGeneratingTips ? (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-4 flex flex-col items-center justify-center min-h-[10rem]">
                            <Spinner />
                            <p className="mt-2 text-sm font-semibold text-slate-600">Generating study tips...</p>
                        </div>
                    ) : studyTips && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-4 animate-fade-in-up text-slate-800">
                            <MarkdownRenderer content={studyTips} />
                        </div>
                    )
                )}
            </div>
        );
    }

    const currentQuestion = data.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    return (
        <div className="bg-green-50 border border-green-200 rounded-xl shadow-md p-4">
            <div className="text-slate-800 space-y-4">
                <h2 className="text-xl font-bold">{data.title}</h2>
                
                <div>
                    <p className="text-sm font-semibold text-slate-600 mb-1 text-right">
                        Question {currentQuestionIndex + 1} of {totalQuestions}
                    </p>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <p className="font-semibold text-slate-800 text-base pt-2">
                    {currentQuestion.questionText}
                </p>

                <textarea
                    value={localAnswerText}
                    onChange={(e) => setLocalAnswerText(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-4 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-400"
                    rows={8}
                    aria-label="Your answer"
                />
                
                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={handleBack}
                        disabled={currentQuestionIndex === 0}
                        className="flex items-center gap-1 px-4 py-2 text-slate-500 rounded-lg font-semibold hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeftIcon /> Back
                    </button>
                    
                    {isLastQuestion ? (
                        <button
                            onClick={handleFinishAndGrade}
                            disabled={isGrading}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-400 text-white rounded-lg font-semibold hover:bg-slate-500 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            Finish & Grade <CheckIcon />
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Next <ChevronRightIcon />
                        </button>
                    )}
                </div>
                
                <div className="pt-2 text-center">
                     <button
                        onClick={onCreateAnotherQuiz}
                        className="text-center text-sm text-slate-600 font-semibold hover:underline"
                    >
                        Start a New Quiz
                    </button>
                </div>
            </div>
        </div>
    );
};