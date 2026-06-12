import { supabase } from './supabaseClient';
import type { WrongAnswerRecord } from './wrongAnswersService';

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  dueDate: string;         // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface FlashcardDeck {
  id: string;
  documentId: string;
  documentName: string;
  title: string;
  createdAt: string;
  totalCards: number;
  dueCards: number;
}

interface FlashcardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string | null;
}

interface FlashcardDeckRow {
  id: string;
  document_id: string;
  document_name: string;
  title: string;
  created_at: string;
}

// Quality ratings (Anki-style mapped to SM-2 0-5)
export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy';
const QUALITY_MAP: Record<ReviewQuality, number> = {
  again: 1,
  hard: 2,
  good: 4,
  easy: 5,
};

function sm2Update(card: Flashcard, quality: ReviewQuality): Partial<Flashcard> {
  const q = QUALITY_MAP[quality];
  let { easinessFactor, intervalDays, repetitions } = card;

  if (quality === 'again') {
    // Lapse: stays due today so it can re-appear in the same session
    // (the UI re-queues it locally) and remains due tomorrow if abandoned.
    repetitions = 0;
    intervalDays = 0;
  } else if (quality === 'hard') {
    // Move on, but keep the next interval short — small bump, never grow via EF.
    if (repetitions === 0) intervalDays = 1;
    else intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    repetitions += 1;
  } else if (quality === 'good') {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easinessFactor);
    repetitions += 1;
  } else {
    // easy
    if (repetitions === 0) intervalDays = 4;
    else if (repetitions === 1) intervalDays = 7;
    else intervalDays = Math.round(intervalDays * easinessFactor * 1.3);
    repetitions += 1;
  }

  easinessFactor = Math.max(1.3, easinessFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  const due = new Date();
  due.setDate(due.getDate() + intervalDays);

  return {
    easinessFactor,
    intervalDays,
    repetitions,
    dueDate: due.toISOString().split('T')[0],
    lastReviewedAt: new Date().toISOString(),
  };
}

export function previewIntervalLabel(card: Flashcard, quality: ReviewQuality): string {
  if (quality === 'again') return '오늘 다시';
  const { intervalDays } = sm2Update(card, quality);
  const days = intervalDays ?? 0;
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  if (days < 30) return `${days}일 뒤`;
  if (days < 365) return `${Math.round(days / 30)}개월 뒤`;
  return `${Math.round(days / 365)}년 뒤`;
}

function toCard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    easinessFactor: row.easiness_factor,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueDate: row.due_date,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
  };
}

export async function createDeck(
  documentId: string,
  documentName: string,
  title: string,
  cards: Array<{ front: string; back: string }>
): Promise<FlashcardDeck | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: deck, error: deckErr } = await supabase
    .from('flashcard_decks')
    .insert({ user_id: user.id, document_id: documentId, document_name: documentName, title })
    .select('*')
    .single();

  if (deckErr || !deck) { console.error('Failed to create deck:', deckErr); return null; }

  const cardRows = cards.map(c => ({
    user_id: user.id,
    deck_id: deck.id,
    front: c.front,
    back: c.back,
  }));

  const { error: cardsErr } = await supabase.from('flashcards').insert(cardRows);
  if (cardsErr) console.error('Failed to insert cards:', cardsErr);

  return {
    id: deck.id,
    documentId: deck.document_id,
    documentName: deck.document_name,
    title: deck.title,
    createdAt: deck.created_at,
    totalCards: cards.length,
    dueCards: cards.length,
  };
}

export async function createDeckFromWrongAnswers(
  wrongAnswers: WrongAnswerRecord[],
  title: string
): Promise<FlashcardDeck | null> {
  if (wrongAnswers.length === 0) return null;
  const first = wrongAnswers[0];
  const cards = wrongAnswers.map(wa => ({
    front: wa.questionText,
    back: wa.explanation,
  }));
  return createDeck(first.documentId, first.documentName, title, cards);
}

export async function fetchDecks(): Promise<FlashcardDeck[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: decks, error } = await supabase
    .from('flashcard_decks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !decks) return [];

  const today = new Date().toISOString().split('T')[0];

  const deckRows = (decks ?? []) as FlashcardDeckRow[];
  const decksWithCounts = await Promise.all(deckRows.map(async deck => {
    const { count: total } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('deck_id', deck.id);

    const { count: due } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('deck_id', deck.id)
      .lte('due_date', today);

    return {
      id: deck.id,
      documentId: deck.document_id,
      documentName: deck.document_name,
      title: deck.title,
      createdAt: deck.created_at,
      totalCards: total ?? 0,
      dueCards: due ?? 0,
    };
  }));

  return decksWithCounts;
}

export async function fetchDueCards(deckId: string): Promise<Flashcard[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('deck_id', deckId)
    .lte('due_date', today)
    .order('due_date', { ascending: true });

  if (error) { console.error('Failed to fetch due cards:', error); return []; }
  return ((data ?? []) as FlashcardRow[]).map(toCard);
}

export async function fetchAllCards(deckId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('deck_id', deckId);

  if (error) { console.error('Failed to fetch cards:', error); return []; }
  return ((data ?? []) as FlashcardRow[]).map(toCard);
}

export async function reviewCard(cardId: string, card: Flashcard, quality: ReviewQuality): Promise<void> {
  const updates = sm2Update(card, quality);
  const { error } = await supabase
    .from('flashcards')
    .update({
      easiness_factor: updates.easinessFactor,
      interval_days: updates.intervalDays,
      repetitions: updates.repetitions,
      due_date: updates.dueDate,
      last_reviewed_at: updates.lastReviewedAt,
    })
    .eq('id', cardId);

  if (error) console.error('Failed to review card:', error);
}

export async function deleteDeck(deckId: string): Promise<boolean> {
  const { error } = await supabase.from('flashcard_decks').delete().eq('id', deckId);
  return !error;
}
