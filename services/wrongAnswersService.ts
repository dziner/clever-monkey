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

interface WrongAnswerRow {
  id: string;
  session_id: string;
  document_id: string;
  document_name: string;
  question_text: string;
  quiz_type: 'mcq' | 'frq';
  options: string[] | null;
  correct_answer_index: number | null;
  user_answer_index: number | null;
  user_answer_text: string | null;
  score: number | null;
  explanation: string;
  created_at: string;
  reviewed_at: string | null;
}

interface QuizSessionRow {
  id: string;
  document_id: string;
  document_name: string;
  quiz_type: 'mcq' | 'frq';
  score: number;
  total_questions: number;
  correct_count: number;
  created_at: string;
}

function toRecord(row: WrongAnswerRow): WrongAnswerRecord {
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

  return ((data ?? []) as WrongAnswerRow[]).map(toRecord);
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

export interface QuizSession {
  id: string;
  documentId: string;
  documentName: string;
  quizType: 'mcq' | 'frq';
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
}

export async function fetchQuizSessions(limit = 30): Promise<QuizSession[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('Failed to fetch quiz sessions:', error); return []; }
  return ((data ?? []) as QuizSessionRow[]).map(row => ({
    id: row.id,
    documentId: row.document_id,
    documentName: row.document_name,
    quizType: row.quiz_type,
    score: row.score,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    createdAt: row.created_at,
  }));
}

// Keep the stored display name in sync after a document is renamed.
// Linkage is always by document_id (immutable); this only refreshes the
// denormalized name shown in history/lists.
export async function renameDocumentReferences(documentId: string, newName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tables = ['quiz_sessions', 'wrong_answers', 'flashcard_decks'] as const;
  await Promise.all(
    tables.map(table =>
      supabase
        .from(table)
        .update({ document_name: newName })
        .eq('user_id', user.id)
        .eq('document_id', documentId)
        .then(({ error }) => {
          if (error) console.error(`Failed to update document_name in ${table}:`, error);
        })
    )
  );
}
