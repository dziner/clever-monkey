// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';

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
        <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Create a Quiz</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setQuizType('mcq')}
                            className={`p-3 rounded-lg border text-sm font-medium transition-all ${quizType === 'mcq' ? 'bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'}`}
                        >
                            Multiple Choice (MCQ)
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuizType('frq')}
                             className={`p-3 rounded-lg border text-sm font-medium transition-all ${quizType === 'frq' ? 'bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'}`}
                        >
                            Free Response (FRQ)
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 text-center">Number of Questions</label>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {/* Stepper and Input */}
                        <button type="button" onClick={() => setQuestionCount(c => Math.max(1, c - 1))} className="w-10 h-10 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 text-lg flex items-center justify-center shrink-0">-</button>
                        <input 
                            type="number"
                            value={questionCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                    setQuestionCount(Math.max(1, Math.min(20, val)));
                                }
                            }}
                            className="w-16 h-10 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            max="20"
                        />
                        <button type="button" onClick={() => setQuestionCount(c => Math.min(20, c + 1))} className="w-10 h-10 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 text-lg flex items-center justify-center shrink-0">+</button>
                        
                        {/* Separator */}
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        
                        {/* Presets */}
                        <div className="flex items-center gap-2">
                            {[5, 10, 20].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setQuestionCount(num)}
                                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center shrink-0 ${questionCount === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                <button
                    type="submit"
                    className="w-full text-center px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    Generate Quiz
                </button>
            </form>
        </div>
    );
};