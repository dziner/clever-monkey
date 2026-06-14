-- ===================================================================
-- Per-category AI usage tracking
-- ===================================================================
-- Adds a small companion table to ai_usage_daily_log that records each
-- billable AI action under a category (chat / summary / quiz / podcast_tts
-- / extract_storage / …). The existing increment_ai_action() RPC gains a
-- second parameter (p_category text default 'other') and writes both the
-- per-user counter (unchanged) AND a per-category daily counter.
--
-- The admin dashboard reads admin_get_api_category_stats() to render
-- per-feature usage cards so the operator can decide where to (1) buy a
-- paid key, (2) add more rotating keys, or (3) shift load to Groq.
--
-- Run in Supabase Dashboard > SQL Editor.
-- ===================================================================

-- ── 1) Per-category counter table ──────────────────────────────────
create table if not exists public.ai_usage_by_category_daily (
    usage_date   date    not null,
    api_category text    not null,
    model        text    not null default '',
    call_count   integer not null default 0,
    primary key (usage_date, api_category, model)
);

alter table public.ai_usage_by_category_daily enable row level security;

drop policy if exists "Admins can read category usage" on public.ai_usage_by_category_daily;
create policy "Admins can read category usage"
    on public.ai_usage_by_category_daily for select
    using (public.is_admin_user());

create index if not exists ai_usage_cat_date_idx
    on public.ai_usage_by_category_daily (usage_date desc, api_category);

-- ── 2) Updated increment_ai_action (category + model arg) ──────────
-- Same return shape; new args have defaults so existing callers still
-- work. The body of the function is identical to the
-- supabase/add_admin_stats version, plus the category bump at the end.
create or replace function public.increment_ai_action(
    p_user_id  uuid,
    p_category text default 'other',
    p_model    text default ''
)
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

    -- Per-user daily log (existing chart)
    insert into public.ai_usage_daily_log (user_id, usage_date, tier, action_count)
    values (p_user_id, current_date, v_tier, 1)
    on conflict (user_id, usage_date)
    do update set
        action_count = ai_usage_daily_log.action_count + 1,
        tier         = excluded.tier;

    -- Per-category daily log (new dashboard)
    insert into public.ai_usage_by_category_daily (usage_date, api_category, model, call_count)
    values (current_date, coalesce(p_category, 'other'), coalesce(p_model, ''), 1)
    on conflict (usage_date, api_category, model)
    do update set call_count = ai_usage_by_category_daily.call_count + 1;

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

-- ── 3) Admin RPC: category × model totals for today + last 7 days ──
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

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'api_category', api_category,
                'model',        model,
                'call_count',   call_count
            )
            order by call_count desc
        ),
        '[]'::jsonb
    )
    into v_today
    from public.ai_usage_by_category_daily
    where usage_date = current_date;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'api_category', api_category,
                'model',        model,
                'call_count',   call_count
            )
            order by call_count desc
        ),
        '[]'::jsonb
    )
    into v_week
    from (
        select api_category, model, sum(call_count)::int as call_count
        from public.ai_usage_by_category_daily
        where usage_date > current_date - interval '7 days'
        group by api_category, model
    ) t;

    return jsonb_build_object(
        'today',   v_today,
        'week',    v_week
    );
end; $$;

-- ── 4) Verify ──────────────────────────────────────────────────────
select api_category, model, sum(call_count) as week_calls
from public.ai_usage_by_category_daily
where usage_date > current_date - interval '7 days'
group by api_category, model
order by week_calls desc;
