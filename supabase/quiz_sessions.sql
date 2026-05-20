-- Quiz sessions table: stores summary of each completed quiz
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  quiz_type   TEXT NOT NULL CHECK (quiz_type IN ('mcq', 'frq')),
  score       INTEGER NOT NULL,       -- 0-100 percent
  total_questions INTEGER NOT NULL,
  correct_count   INTEGER NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wrong answers table: one row per incorrect/low-scoring question
CREATE TABLE IF NOT EXISTS wrong_answers (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id          UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  document_id         TEXT NOT NULL,
  document_name       TEXT NOT NULL,
  question_text       TEXT NOT NULL,
  quiz_type           TEXT NOT NULL CHECK (quiz_type IN ('mcq', 'frq')),
  -- MCQ fields
  options             JSONB,
  correct_answer_index INTEGER,
  user_answer_index   INTEGER,
  -- FRQ fields
  user_answer_text    TEXT,
  score               INTEGER,        -- 0-100, FRQ only
  -- Common
  explanation         TEXT NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at         TIMESTAMP WITH TIME ZONE
);

-- Row Level Security
ALTER TABLE quiz_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_answers  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_sessions_owner"  ON quiz_sessions  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "wrong_answers_owner"  ON wrong_answers  FOR ALL USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wrong_answers_user      ON wrong_answers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_document  ON wrong_answers (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user      ON quiz_sessions  (user_id, created_at DESC);
