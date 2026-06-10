-- ===================================================================
-- ⚠️  DESTRUCTIVE: Reset All User Data  ⚠️
-- ===================================================================
-- This wipes EVERY user account and ALL their data so you can start
-- from a clean slate. Use only on staging / when you have decided to
-- throw away all current users.
--
-- After running this script:
--   1. All auth.users rows are gone (every user must sign up again).
--   2. All profiles / documents / folders / annotations / quiz history
--      / wrong answers / flashcards / AI usage logs are gone.
--
-- The TABLES themselves and their triggers / RLS / functions are kept
-- intact — only the rows are removed. So the app continues to work
-- exactly as before; it just has no users yet.
--
-- 📁 STORAGE BUCKET — handle separately:
-- Supabase blocks direct DELETE on storage.objects from SQL
-- ("Direct deletion from storage tables is not allowed").
-- After running this script, empty the "docs" bucket manually:
--     Supabase dashboard → Storage → docs bucket →
--     Select all files → Delete.
-- (Skipping this step is harmless — orphan files just sit there
--  unreachable, since the owner accounts no longer exist.)
--
-- After running this, the next person to sign in via the app will
-- automatically get a profile row via the handle_new_user trigger.
-- Run supabase/make_admin.sql ONCE more after that to make yourself
-- admin again.
-- ===================================================================

-- ── SAFETY CHECK ────────────────────────────────────────────────────
-- Comment out this block ONLY when you really intend to wipe everything.
-- Leaving it active will abort the transaction.
do $$
begin
    raise exception
      'SAFETY: comment out this DO block in reset_users.sql to run the reset.';
end $$;

-- ── PREVIEW (what will be deleted) ──────────────────────────────────
-- These SELECTs show the current row counts. Confirm before proceeding.
select 'auth.users'           as table_name, count(*) as rows from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'documents',          count(*) from public.documents
union all select 'folders',            count(*) from public.folders
union all select 'annotations',        count(*) from public.annotations
union all select 'quiz_sessions',      count(*) from public.quiz_sessions
union all select 'wrong_answers',      count(*) from public.wrong_answers
union all select 'flashcard_decks',    count(*) from public.flashcard_decks
union all select 'flashcards',         count(*) from public.flashcards
union all select 'ai_usage_daily_log', count(*) from public.ai_usage_daily_log
union all select 'storage.objects (docs) — wipe manually via dashboard',
                 count(*) from storage.objects where bucket_id = 'docs';

-- ── WIPE PUBLIC SCHEMA ──────────────────────────────────────────────
-- Order matters because of FK references. truncate cascade handles it.
truncate table
    public.flashcards,
    public.flashcard_decks,
    public.wrong_answers,
    public.quiz_sessions,
    public.annotations,
    public.documents,
    public.folders,
    public.ai_usage_daily_log,
    public.profiles
restart identity cascade;

-- ── WIPE AUTH ───────────────────────────────────────────────────────
-- Cascade also clears auth.identities, refresh_tokens, sessions, etc.
delete from auth.users;

-- ── VERIFY ──────────────────────────────────────────────────────────
select 'auth.users'           as table_name, count(*) as rows from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'documents',          count(*) from public.documents
union all select 'folders',            count(*) from public.folders
union all select 'annotations',        count(*) from public.annotations
union all select 'quiz_sessions',      count(*) from public.quiz_sessions
union all select 'wrong_answers',      count(*) from public.wrong_answers
union all select 'flashcard_decks',    count(*) from public.flashcard_decks
union all select 'flashcards',         count(*) from public.flashcards
union all select 'ai_usage_daily_log', count(*) from public.ai_usage_daily_log
union all select 'storage.objects (docs) — wipe manually via dashboard',
                 count(*) from storage.objects where bucket_id = 'docs';
-- All public + auth counts should be 0. The storage count will reflect
-- whatever is left in the bucket — empty it manually via the dashboard.
