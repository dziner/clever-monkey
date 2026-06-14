-- ===================================================================
-- Per-category AI usage tracking + real rejection (429/503) counters
-- ===================================================================
-- Builds on add_api_category_stats.sql. Two real data sources power the
-- admin "capacity" dashboard:
--   1. call_count  — how many calls WE sent per category/model (success
--      path; written by increment_ai_action()).
--   2. reject counters — how many times the upstream actually refused us
--      with a rate-limit (429) or quota (RESOURCE_EXHAUSTED) error. THIS
--      is the ground-truth "how close to the ceiling are we" signal that
--      mirrors Google AI Studio's "Total API Errors" graph. Written by
--      record_api_rejection() from the Netlify key-pool when a key gets
--      cooled down.
--
-- Run in Supabase Dashboard > SQL Editor (idempotent; safe to re-run).
-- ===================================================================

-- ── 1) Columns for rejection counts (added to the existing table) ──
create table if not exists public.ai_usage_by_category_daily (
    usage_date   date    not null,
    api_category text    not null,
    model        text    not null default '',
    call_count   integer not null default 0,
    primary key (usage_date, api_category, model)
);

alter table public.ai_usage_by_category_daily
    add column if not exists rate_rejects   integer not null default 0,
    add column if not exists quota_rejects  integer not null default 0,
    add column if not exists overload_count integer not null default 0;

alter table public.ai_usage_by_category_daily enable row level security;
drop policy if exists "Admins can read category usage" on public.ai_usage_by_category_daily;
create policy "Admins can read category usage"
    on public.ai_usage_by_category_daily for select
    using (public.is_admin_user());

-- ── 2) record_api_rejection: bump the right reject counter ─────────
-- p_kind is one of 'rate' | 'quota' | 'overload'. The Netlify function
-- calls this (service-role) whenever the key pool records an exhaustion
-- or the model reports overload. usage_date defaults to today.
create or replace function public.record_api_rejection(
    p_category text,
    p_model    text,
    p_kind     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.ai_usage_by_category_daily
        (usage_date, api_category, model, call_count, rate_rejects, quota_rejects, overload_count)
    values (
        current_date,
        coalesce(p_category, 'other'),
        coalesce(p_model, ''),
        0,
        case when p_kind = 'rate'     then 1 else 0 end,
        case when p_kind = 'quota'    then 1 else 0 end,
        case when p_kind = 'overload' then 1 else 0 end
    )
    on conflict (usage_date, api_category, model)
    do update set
        rate_rejects   = ai_usage_by_category_daily.rate_rejects   + (case when p_kind = 'rate'     then 1 else 0 end),
        quota_rejects  = ai_usage_by_category_daily.quota_rejects  + (case when p_kind = 'quota'    then 1 else 0 end),
        overload_count = ai_usage_by_category_daily.overload_count + (case when p_kind = 'overload' then 1 else 0 end);
end; $$;

-- ── 3) admin_get_api_category_stats: include reject counters ───────
create or replace function public.admin_get_api_category_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today jsonb;
    v_week  jsonb;
begin
    if not public.is_admin_user() then
        raise exception 'Access denied: admin role required';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'api_category', api_category, 'model', model,
        'call_count', call_count,
        'rate_rejects', rate_rejects, 'quota_rejects', quota_rejects, 'overload_count', overload_count
    ) order by call_count desc), '[]'::jsonb)
    into v_today
    from public.ai_usage_by_category_daily
    where usage_date = current_date;

    select coalesce(jsonb_agg(jsonb_build_object(
        'api_category', api_category, 'model', model,
        'call_count', call_count,
        'rate_rejects', rate_rejects, 'quota_rejects', quota_rejects, 'overload_count', overload_count
    ) order by call_count desc), '[]'::jsonb)
    into v_week
    from (
        select api_category, model,
            sum(call_count)::int     as call_count,
            sum(rate_rejects)::int    as rate_rejects,
            sum(quota_rejects)::int   as quota_rejects,
            sum(overload_count)::int  as overload_count
        from public.ai_usage_by_category_daily
        where usage_date > current_date - interval '7 days'
        group by api_category, model
    ) t;

    return jsonb_build_object('today', v_today, 'week', v_week);
end; $$;

-- ── 4) Verify ──────────────────────────────────────────────────────
select api_category, model, call_count, rate_rejects, quota_rejects, overload_count
from public.ai_usage_by_category_daily
where usage_date > current_date - interval '7 days'
order by call_count desc;
