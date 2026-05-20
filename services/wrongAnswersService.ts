import { supabase } from './supabaseClient';
import type { QuizData, FRQData, MCQQuizState, FRQQuizState, QuizTabState } from '../types';

export interface WrongAnswerRecord {
  id: string;
  sessionId: string;
  documentId: string;
  documentName: string;
  questionText: string;
  quizType: 'mcq' | 'frq';
  // MCQ
  options?: string[];
  correctAnswerIndex?: number;
  userAnswerIndex?: number;
  // FRQ
  userAnswerText?: string;
  score?: number;
  // Common
  explanation: string;
  createdAt: string;
  reviewedAt?: string | null;
}

function toRecord(row: any): WrongAnswerRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    documentId: row.document_id,
    documentName: row.document_name,
    questionText: row.question_text,
    quizType: row.quiz_type,
    options: row.options ?? undefined,
    correctAnswerIndex: row.correct_answer_index ?? undefined,
    userAnswerIndex: row.user_answer_index ?? undefined,
    userAnswerText: row.user_answer_text ?? undefined,
    score: row.score ?? undefined,
    explanation: row.explanation,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
  };
}

export async function saveQuizSession(
  documentId: string,
  documentName: string,
  quizContent: QuizData | FRQData,
  quizState: QuizTabState
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const isMCQ = quizState.type === 'mcq';
  const totalQuestions = quizContent.questions.length;
  let score: number;
  let correctCount: number;
  let wrongRows: object[];

  if (isMCQ) {
    const state = quizState as MCQQuizState;
    const data = quizContent as QuizData;
    correctCount = state.userAnswers.filter(a => a.isCorrect).length;
    score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    wrongRows = state.userAnswers
      .filter(a => !a.isCorrect)
      .map(a => {
        const q = data.questions[a.questionIndex];
        return {
          user_id: user.id,
          document_id: documentId,
          document_name: documentName,
          question_text: q.questionText,
          quiz_type: 'mcq',
          options: q.options,
          correct_answer_index: q.correctAnswerIndex,
          user_answer_index: a.selectedOptionIndex,
          explanation: q.explanation,
        };
      });
  } else {
    const state = quizState as FRQQuizState;
    const data = quizContent as FRQData;
    const LOW = 70;
    const totalScore = state.userAnswers.reduce((s, a) => s + (a.score ?? 0), 0);
    score = state.userAnswers.length > 0 ? Math.round(totalScore / state.userAnswers.length) : 0;
    correctCount = state.userAnswers.filter(a => (a.score ?? 0) >= LOW).length;
    wrongRows = state.userAnswers
      .filter(a => (a.score ?? 0) < LOW)
      .map(a => {
        const q = data.questions[a.questionIndex];
        return {
          user_id: user.id,
          document_id: documentId,
          document_name: documentName,
          question_text: q.questionText,
          quiz_type: 'frq',
          user_answer_text: a.userAnswerText,
          score: a.score,
          explanation: q.explanation,
        };
      });
  }

  const { data: session, error: sessionErr } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: user.id,
      document_id: documentId,
      document_name: documentName,
      quiz_type: isMCQ ? 'mcq' : 'frq',
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    console.error('Failed to save quiz session:', sessionErr);
    return;
  }

  if (wrongRows.length > 0) {
    const { error: waErr } = await supabase
      .from('wrong_answers')
      .insert(wrongRows.map(r => ({ ...r, session_id: session.id })));
    if (waErr) console.error('Failed to save wrong answers:', waErr);
  }
}

export async function fetchWrongAnswers(): Promise<WrongAnswerRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('wrong_answers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch wrong answers:', error);
    return [];
  }

  return (data ?? []).map(toRecord);
}

export async function markReviewed(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('wrong_answers')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteWrongAnswer(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('wrong_answers')
    .delete()
    .eq('id', id);
  return !error;
}
