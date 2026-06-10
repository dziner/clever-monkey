-- ===================================================================
-- ⚠️  DESTRUCTIVE: Reset All User Data  ⚠️
-- ===================================================================
-- Wipes EVERY user account and ALL their data for a clean slate.
-- The TABLES, triggers, RLS policies and functions are kept intact —
-- only the rows are removed. The app keeps working; it just has no
-- users yet.
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │ STEP 1 (DO THIS FIRST — in the dashboard, NOT here):            │
-- │   Supabase → Storage → "docs" bucket → select all → Delete.     │
-- │                                                                  │
-- │ Why: storage.objects.owner has a FK on auth.users(id) with      │
-- │ ON DELETE CASCADE. Deleting auth.users from SQL tries to cascade │
-- │ into storage.objects, which trips Supabase's protect_delete()    │
-- │ guard:                                                           │
-- │   ERROR 42501: Direct deletion from storage tables is not        │
-- │   allowed. Use the Storage API instead.                          │
-- │ Emptying the bucket through the dashboard (which uses the        │
-- │ Storage API) removes those rows so the cascade has nothing to    │
-- │ delete and the guard never fires.                                │
-- └─────────────────────────────────────────────────────────────────┘
--
-- STEP 2: run THIS script in the SQL Editor (after emptying the bucket).
-- STEP 3: sign up again in the app, then run supabase/make_admin.sql.
-- ===================================================================

-- ── SAFETY CHECK ────────────────────────────────────────────────────
-- Comment out this block ONLY when you really intend to wipe everything.
do $$
begin
    raise exception
      'SAFETY: comment out this DO block in reset_users.sql to run the reset.';
end $$;

-- ── PREFLIGHT: bucket must be empty first ───────────────────────────
-- Aborts with a clear message if any storage object still references a
-- user we're about to delete. Empty the docs bucket (Step 1) and retry.
do $$
declare
    n integer;
begin
    select count(*) into n
    from storage.objects
    where owner is not null;

    if n > 0 then
        raise exception
          'Storage still has % object(s) with an owner. Empty the docs bucket via the dashboard FIRST (Storage → docs → select all → Delete), then re-run.', n;
    end if;
end $$;

-- ── PREVIEW (what will be deleted) ──────────────────────────────────
select 'auth.users'           as table_name, count(*) as rows from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'documents',          count(*) from public.documents
union all select 'folders',            count(*) from public.folders
union all select 'annotations',        count(*) from public.annotations
union all select 'quiz_sessions',      count(*) from public.quiz_sessions
union all select 'wrong_answers',      count(*) from public.wrong_answers
union all select 'flashcard_decks',    count(*) from public.flashcard_decks
union all select 'flashcards',         count(*) from public.flashcards
union all select 'ai_usage_daily_log', count(*) from public.ai_usage_daily_log;

-- ── WIPE PUBLIC SCHEMA ──────────────────────────────────────────────
-- Order handled by truncate cascade (FK references).
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
-- With the bucket emptied there are no storage.objects to cascade into,
-- so protect_delete() never fires. Cascade still clears auth.identities,
-- refresh_tokens, sessions, etc.
delete from auth.users;

-- ── VERIFY (every count should be 0) ────────────────────────────────
select 'auth.users'           as table_name, count(*) as rows from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'documents',          count(*) from public.documents
union all select 'folders',            count(*) from public.folders
union all select 'annotations',        count(*) from public.annotations
union all select 'quiz_sessions',      count(*) from public.quiz_sessions
union all select 'wrong_answers',      count(*) from public.wrong_answers
union all select 'flashcard_decks',    count(*) from public.flashcard_decks
union all select 'flashcards',         count(*) from public.flashcards
union all select 'ai_usage_daily_log', count(*) from public.ai_usage_daily_log;
