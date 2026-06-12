-- ===================================================================
-- Fix "최근 7일 AI 호출 추이" graph showing all zeros
-- ===================================================================
-- Symptom: the admin dashboard chart shows the 7 date labels but no
-- bars, even when "오늘 상위 AI 사용자" lists active users.
--
-- Root cause: two versions of public.increment_ai_action exist in this
-- repo. The newer version (supabase/add_admin_stats.sql) also writes
-- to public.ai_usage_daily_log per call. If only the older version
-- (supabase/add_profiles.sql) was installed, public.profiles.ai_actions_today
-- still ticks up — which is why the admin user list shows real counts —
-- but the daily log stays empty, so the 7-day aggregation returns zeros.
--
-- This script:
--   1. Reinstalls the daily-log-writing increment_ai_action.
--   2. Backfills *today's* daily log from public.profiles so the chart
--      doesn't sit empty until the next user action.
--
-- Run in Supabase SQL Editor.
-- ===================================================================

-- ── 1) Ensure the log table exists with the right shape ─────────────
create table if not exists public.ai_usage_daily_log (
    user_id      uuid not null references auth.users(id) on delete cascade,
    usage_date   date not null,
    tier         text not null,
    action_count integer not null default 0,
    primary key (user_id, usage_date)
);

alter table public.ai_usage_daily_log enable row level security;

drop policy if exists "Admins can view daily log" on public.ai_usage_daily_log;
create policy "Admins can view daily log"
    on public.ai_usage_daily_log for select
    using (public.is_admin_user());

-- ── 2) Install the version that also writes to the daily log ────────
create or replace function public.increment_ai_action(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tier  text;
    v_count integer;
    v_limit constant integer := 20; -- free tier daily cap
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

    insert into public.ai_usage_daily_log (user_id, usage_date, tier, action_count)
    values (p_user_id, current_date, v_tier, 1)
    on conflict (user_id, usage_date)
    do update set
        action_count = ai_usage_daily_log.action_count + 1,
        tier         = excluded.tier;

    if v_tier = 'pro' then
        return jsonb_build_object('allowed', true, 'tier', v_tier, 'count', v_count, 'limit', -1);
    end if;

    if v_count > v_limit then
        update public.profiles
        set ai_actions_today = v_limit, updated_at = now()
        where id = p_user_id;
        return jsonb_build_object('allowed', false, 'tier', v_tier, 'count', v_limit, 'limit', v_limit);
    end if;

    return jsonb_build_object('allowed', true, 'tier', v_tier, 'count', v_count, 'limit', v_limit);
end; $$;

-- ── 3) Backfill today's log from public.profiles ────────────────────
-- For each profile whose counter is non-zero AND dated today, write a
-- single row into the daily log so the chart shows today's bar
-- immediately rather than waiting for the next API call.
insert into public.ai_usage_daily_log (user_id, usage_date, tier, action_count)
select id, current_date, tier, ai_actions_today
from public.profiles
where ai_actions_date = current_date
  and ai_actions_today > 0
on conflict (user_id, usage_date)
do update set
    action_count = greatest(ai_usage_daily_log.action_count, excluded.action_count),
    tier         = excluded.tier;

-- ── 4) VERIFY ───────────────────────────────────────────────────────
-- Should show one row per active user today.
select user_id, usage_date, tier, action_count
from public.ai_usage_daily_log
where usage_date = current_date
order by action_count desc;
