-- ===================================================================
-- quiz_questions_seen: per-(user × document) memory of generated quiz
-- questions so the next generation can avoid duplicating them.
-- ===================================================================
-- wrong_answers only stores incorrect items, and quiz_sessions only
-- stores summary stats — neither is enough to deduplicate questions on
-- the NEXT generation. This table captures every question that was
-- shown to the user, so we can inject the recent N into the quiz
-- generation prompt as an "AVOID THESE" block.
--
-- Owner-only RLS, scoped (user_id, document_id). Cascades on user
-- delete (matches sibling tables). document_id stays TEXT to match the
-- existing quiz_sessions / wrong_answers convention (uploaded-doc ids
-- are timestamp-suffixed strings, not UUID-FK'd into documents).
--
-- Idempotent, safe to re-run.
-- ===================================================================

create table if not exists public.quiz_questions_seen (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    document_id   text not null,
    question_text text not null,
    quiz_type     text not null check (quiz_type in ('mcq', 'frq')),
    created_at    timestamptz not null default now()
);

alter table public.quiz_questions_seen enable row level security;

drop policy if exists "quiz_questions_seen_owner" on public.quiz_questions_seen;
create policy "quiz_questions_seen_owner"
    on public.quiz_questions_seen for all
    using (auth.uid() = user_id);

-- Fetch path is "give me the last N questions for this user+doc",
-- newest first — a composite index on (user_id, document_id, created_at
-- desc) is the right shape.
create index if not exists idx_quiz_questions_seen_user_doc
    on public.quiz_questions_seen (user_id, document_id, created_at desc);

-- Verify: should list the new policy and index.
select tablename, policyname from pg_policies where tablename = 'quiz_questions_seen';
select indexname from pg_indexes where tablename = 'quiz_questions_seen';
