-- =============================================================
-- Clever Monkey — Full Database Migration
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================

-- ---------------------------------------------------------------
-- 1. folders
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folders (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders_owner" ON public.folders FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_folders_user ON public.folders (user_id);

-- ---------------------------------------------------------------
-- 2. documents
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id         TEXT REFERENCES public.folders(id) ON DELETE SET NULL,
  file_name         TEXT NOT NULL,
  file_size         BIGINT NOT NULL DEFAULT 0,
  file_mime         TEXT,
  file_type         TEXT NOT NULL DEFAULT 'pdf',   -- 'pdf' | 'image' | 'text'
  storage_path      TEXT,
  summary           TEXT NOT NULL DEFAULT '',
  chat_history      JSONB NOT NULL DEFAULT '[]',
  preset_questions  JSONB,
  token_count       INTEGER,
  processing_state  TEXT NOT NULL DEFAULT 'reading',
  error_message     TEXT,
  model             TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  answer_scope      TEXT NOT NULL DEFAULT 'document',
  monkey_mode       BOOLEAN NOT NULL DEFAULT FALSE,
  document_content  TEXT,
  quiz_tab_data     JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_owner" ON public.documents FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_documents_user   ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents (user_id, folder_id);

-- ---------------------------------------------------------------
-- 3. annotations
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.annotations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  TEXT NOT NULL,
  page_number  INT NOT NULL,
  kind         TEXT NOT NULL,
  anchor       JSONB NOT NULL,
  content      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS annotations_user_doc_page_idx
  ON public.annotations (user_id, document_id, page_number);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations_select_own" ON public.annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "annotations_insert_own" ON public.annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotations_update_own" ON public.annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "annotations_delete_own" ON public.annotations FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS annotations_set_updated_at ON public.annotations;
CREATE TRIGGER annotations_set_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_annotations_updated_at();

-- ---------------------------------------------------------------
-- 4. quiz_sessions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id      TEXT NOT NULL,
  document_name    TEXT NOT NULL,
  quiz_type        TEXT NOT NULL CHECK (quiz_type IN ('mcq', 'frq')),
  score            INTEGER NOT NULL,
  total_questions  INTEGER NOT NULL,
  correct_count    INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_sessions_owner" ON public.quiz_sessions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON public.quiz_sessions (user_id, created_at DESC);

-- ---------------------------------------------------------------
-- 5. wrong_answers
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wrong_answers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id           UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  document_id          TEXT NOT NULL,
  document_name        TEXT NOT NULL,
  question_text        TEXT NOT NULL,
  quiz_type            TEXT NOT NULL CHECK (quiz_type IN ('mcq', 'frq')),
  options              JSONB,
  correct_answer_index INTEGER,
  user_answer_index    INTEGER,
  user_answer_text     TEXT,
  score                INTEGER,
  explanation          TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at          TIMESTAMPTZ
);

ALTER TABLE public.wrong_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wrong_answers_owner" ON public.wrong_answers FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wrong_answers_user     ON public.wrong_answers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_document ON public.wrong_answers (user_id, document_id);

-- ---------------------------------------------------------------
-- 6. Storage bucket  (run separately if SQL editor doesn't support it)
-- ---------------------------------------------------------------
-- If the INSERT fails, create the bucket manually in:
-- Storage > New bucket > Name: "docs" > Public: OFF
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "docs_owner_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "docs_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "docs_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);
