-- ===================================================================
-- Admin Stats: API Usage & DB/Storage Stats
-- Run this in Supabase SQL Editor (after add_profiles.sql)
-- ===================================================================

-- 1. Daily AI usage log table (for historical trend)
create table if not exists public.ai_usage_daily_log (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  usage_date   date        not null default current_date,
  tier         text        not null default 'free',
  action_count integer     not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, usage_date)
);

alter table public.ai_usage_daily_log enable row level security;

create policy "Admins can view usage logs"
  on public.ai_usage_daily_log for select
  using (public.is_admin_user());

-- 2. Update increment_ai_action to also write to daily log
create or replace function public.increment_ai_action(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier  text;
  v_count integer;
  v_limit constant integer := 20;
begin
  update public.profiles
  set
    ai_actions_today = case
      when ai_actions_date < current_date then 1
      else ai_actions_today + 1
    end,
    ai_actions_date  = current_date,
    updated_at       = now()
  where id = p_user_id
  returning tier, ai_actions_today into v_tier, v_count;

  if not found then
    return jsonb_build_object('allowed', false, 'error', 'Profile not found');
  end if;

  -- Write to daily log (upsert)
  insert into public.ai_usage_daily_log (user_id, usage_date, tier, action_count)
  values (p_user_id, current_date, v_tier, 1)
  on conflict (user_id, usage_date)
  do update set
    action_count = ai_usage_daily_log.action_count + 1,
    tier = excluded.tier;

  -- Pro: unlimited
  if v_tier = 'pro' then
    return jsonb_build_object('allowed', true, 'tier', v_tier, 'count', v_count, 'limit', -1);
  end if;

  -- Free: cap
  if v_count > v_limit then
    update public.profiles
    set ai_actions_today = v_limit, updated_at = now()
    where id = p_user_id;

    return jsonb_build_object(
      'allowed', false,
      'tier',    v_tier,
      'count',   v_limit,
      'limit',   v_limit,
      'error',   'Daily AI action limit reached. Upgrade to Pro for unlimited access.'
    );
  end if;

  return jsonb_build_object('allowed', true, 'tier', v_tier, 'count', v_count, 'limit', v_limit);
end; $$;

-- 3. Admin API stats: today + last 7 days trend
create or replace function public.admin_get_api_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_today  integer;
  v_active_today integer;
  v_near_limit   integer;
  v_last_7_days  jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  -- Today from profiles (most accurate for current day)
  select
    coalesce(sum(ai_actions_today), 0),
    count(*) filter (where ai_actions_today > 0),
    count(*) filter (where tier = 'free' and ai_actions_today >= 15)
  into v_total_today, v_active_today, v_near_limit
  from public.profiles
  where ai_actions_date = current_date;

  -- Last 7 days from log table
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date',         to_char(d.day, 'MM/DD'),
        'total_actions', coalesce(l.total_actions, 0),
        'active_users',  coalesce(l.active_users, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into v_last_7_days
  from (
    select generate_series(
      current_date - interval '6 days',
      current_date,
      interval '1 day'
    )::date as day
  ) d
  left join (
    select
      usage_date,
      sum(action_count)          as total_actions,
      count(distinct user_id)    as active_users
    from public.ai_usage_daily_log
    where usage_date >= current_date - interval '6 days'
    group by usage_date
  ) l on l.usage_date = d.day;

  return jsonb_build_object(
    'total_actions_today', v_total_today,
    'active_users_today',  v_active_today,
    'users_near_limit',    v_near_limit,
    'last_7_days',         v_last_7_days
  );
end; $$;

-- 4. Admin DB stats: table counts + storage
create or replace function public.admin_get_db_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_count     bigint;
  v_total_size    bigint;
  v_quiz_sessions bigint;
  v_wrong_answers bigint;
  v_folders       bigint;
  v_docs_today    bigint;
  v_docs_week     bigint;
  v_storage_bytes bigint := 0;
  v_annotations   bigint;
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  select count(*), coalesce(sum(file_size), 0)
  into v_doc_count, v_total_size
  from public.documents;

  select count(*) into v_quiz_sessions  from public.quiz_sessions;
  select count(*) into v_wrong_answers  from public.wrong_answers;
  select count(*) into v_folders        from public.folders;

  select count(*) into v_docs_today
  from public.documents where created_at >= current_date;

  select count(*) into v_docs_week
  from public.documents where created_at >= current_date - interval '6 days';

  begin
    select coalesce(sum((metadata->>'size')::bigint), 0)
    into v_storage_bytes
    from storage.objects where bucket_id = 'docs';
  exception when others then
    v_storage_bytes := v_total_size;
  end;

  begin
    select count(*) into v_annotations from public.annotations;
  exception when others then
    v_annotations := 0;
  end;

  return jsonb_build_object(
    'document_count',       v_doc_count,
    'total_file_size_bytes', v_total_size,
    'storage_bytes',        v_storage_bytes,
    'quiz_sessions',        v_quiz_sessions,
    'wrong_answers',        v_wrong_answers,
    'folders',              v_folders,
    'annotations',          coalesce(v_annotations, 0),
    'docs_created_today',   v_docs_today,
    'docs_created_week',    v_docs_week
  );
end; $$;
