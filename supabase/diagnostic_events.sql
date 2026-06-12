-- =============================================================
-- Clever Monkey — Diagnostic Events
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================
-- Stores structured upload/processing failures for debugging.
-- No file contents, prompts, API keys, or extracted document text are stored.

create table if not exists public.diagnostic_events (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  occurred_at       text,
  source            text not null default 'client',
  severity          text not null check (severity in ('info', 'warn', 'error')),
  stage             text not null,
  message           text not null,
  user_id           uuid references auth.users(id) on delete set null,
  client_session_id text,
  document_id       text,
  file_name         text,
  file_size         bigint,
  file_mime         text,
  file_extension    text,
  file_type         text,
  storage_path      text,
  model             text,
  processing_state  text,
  is_guest          boolean not null default false,
  error_name        text,
  error_message     text,
  error_stack       text,
  error_status      integer,
  error_code        text,
  context           jsonb not null default '{}'::jsonb,
  user_agent        text,
  url_path          text
);

create index if not exists diagnostic_events_created_idx
  on public.diagnostic_events (created_at desc);

create index if not exists diagnostic_events_user_created_idx
  on public.diagnostic_events (user_id, created_at desc);

create index if not exists diagnostic_events_stage_created_idx
  on public.diagnostic_events (stage, created_at desc);

create index if not exists diagnostic_events_doc_idx
  on public.diagnostic_events (document_id);

alter table public.diagnostic_events enable row level security;

drop policy if exists "Admins can view diagnostic events" on public.diagnostic_events;
create policy "Admins can view diagnostic events"
  on public.diagnostic_events for select
  using (public.is_admin_user());
