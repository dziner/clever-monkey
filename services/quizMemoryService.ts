// Per-(user × document × quiz_type) memory of generated quiz questions.
// Used to seed the next generation's prompt with an "AVOID THESE" block
// so the learner doesn't see the same question twice. MCQ and FRQ are
// tracked separately on purpose: the same underlying concept may
// reasonably appear as both an MCQ and a free-response question without
// feeling like a duplicate to the user.
//
// All access goes through the quiz_questions_seen table, which is RLS-
// gated to the owner (auth.uid() = user_id). Guests have no rows and
// these helpers no-op for them.

import { supabase } from './supabaseClient';
import { QUIZ_HISTORY_LIMIT } from '../utils/quizMemory';

const TABLE = 'quiz_questions_seen';

/**
 * Fetch the most-recent question stems the user has already seen for
 * this (document, quiz_type), newest first. Returns at most
 * QUIZ_HISTORY_LIMIT rows so the avoidance prompt stays bounded.
 * Returns [] on any error / missing user — the caller treats an empty
 * list as "no history" and generates normally.
 */
export async function fetchRecentQuestions(
    userId: string | null,
    documentId: string,
    quizType: 'mcq' | 'frq',
): Promise<string[]> {
    if (!userId) return [];
    const { data, error } = await supabase
        .from(TABLE)
        .select('question_text')
        .eq('user_id', userId)
        .eq('document_id', documentId)
        .eq('quiz_type', quizType)
        .order('created_at', { ascending: false })
        .limit(QUIZ_HISTORY_LIMIT);
    if (error) {
        console.error('[quizMemory] fetch failed:', error);
        return [];
    }
    return (data ?? [])
        .map(r => (r as { question_text?: string }).question_text)
        .filter((q): q is string => typeof q === 'string' && q.length > 0);
}

/**
 * Record the questions just generated. Fire-and-forget: a persist
 * failure shouldn't block the user from taking the quiz they're
 * already looking at. Skipped for guests and for empty inputs.
 */
export async function recordSeenQuestions(
    userId: string | null,
    documentId: string,
    quizType: 'mcq' | 'frq',
    questions: string[],
): Promise<void> {
    if (!userId || questions.length === 0) return;
    const rows = questions
        .map(q => q?.trim())
        .filter((q): q is string => !!q)
        .map(question_text => ({ user_id: userId, document_id: documentId, question_text, quiz_type: quizType }));
    if (rows.length === 0) return;
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) console.error('[quizMemory] insert failed:', error);
}
