-- =============================================================
-- Clever Monkey — Flashcards Migration
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ---------------------------------------------------------------
-- flashcard_decks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id   TEXT NOT NULL,
  document_name TEXT NOT NULL,
  title         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decks_owner" ON public.flashcard_decks FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_decks_user ON public.flashcard_decks (user_id, created_at DESC);

-- ---------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id          UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  front            TEXT NOT NULL,
  back             TEXT NOT NULL,
  -- SM-2 spaced repetition fields
  easiness_factor  FLOAT NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  due_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flashcards_owner" ON public.flashcards FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due  ON public.flashcards (user_id, due_date);
