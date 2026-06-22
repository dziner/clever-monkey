-- ===================================================================
-- Admin soft-delete / restore for profiles
-- Run this in Supabase SQL Editor after the existing profile/admin SQL.
-- ===================================================================
-- Intent:
--   Admin "delete" does NOT remove auth.users or user data immediately.
--   It marks the profile inactive and keeps a 30-day restore window.
--   The admin Users tab reads these columns through admin_get_user_stats().
-- ===================================================================

-- ── 1) Profile status columns ──────────────────────────────────────
alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'inactive')),
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references auth.users(id) on delete set null,
  add column if not exists deactivation_reason text,
  add column if not exists restore_until timestamptz;

create index if not exists profiles_account_status_idx
  on public.profiles (account_status, restore_until);

-- Users may still read their own inactive profile so the app can show a
-- blocked-account screen. The write policy additionally prevents an inactive
-- user from self-restoring by issuing a direct client update.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id and account_status = 'active')
  with check (auth.uid() = id and account_status = 'active');

-- ── 2) Active-admin guard ──────────────────────────────────────────
-- Preserve the bootstrap email behavior from make_admin.sql, but do not let
-- an inactive profile pass the DB-level admin gate.
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((
      select p.role = 'admin' and p.account_status = 'active'
      from public.profiles p
      where p.id = auth.uid()
    ), false)
    or coalesce((
      select lower(u.email) = lower('voicemakesme@gmail.com')
             and coalesce(p.account_status, 'active') = 'active'
      from auth.users u
      left join public.profiles p on p.id = u.id
      where u.id = auth.uid()
    ), false);
$$;

-- ── 3) Admin account actions ───────────────────────────────────────
create or replace function public.admin_soft_delete_user(
  p_user_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Admins cannot delete their own account from the dashboard';
  end if;

  update public.profiles
  set
    account_status = 'inactive',
    deactivated_at = now(),
    deactivated_by = auth.uid(),
    deactivation_reason = coalesce(nullif(p_reason, ''), 'admin_soft_delete'),
    restore_until = now() + interval '30 days',
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end; $$;

create or replace function public.admin_restore_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  update public.profiles
  set
    account_status = 'active',
    deactivated_at = null,
    deactivated_by = null,
    deactivation_reason = null,
    restore_until = null,
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end; $$;

-- Keep the tier/role update RPC in this migration too. The Users tab needs
-- this function even when Stripe checkout has not been enabled yet.
create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_tier text default null,
  p_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  if p_tier is not null and p_tier not in ('free', 'pro') then
    raise exception 'Invalid tier';
  end if;

  if p_role is not null and p_role not in ('user', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.profiles
  set
    tier = coalesce(p_tier, tier),
    role = coalesce(p_role, role),
    updated_at = now()
  where id = p_user_id
    and account_status = 'active';

  if not found then
    select exists(select 1 from public.profiles where id = p_user_id) into v_exists;
    if v_exists then
      raise exception 'Cannot update an inactive profile';
    end if;
    raise exception 'Profile not found';
  end if;
end; $$;

grant execute on function public.admin_update_user_profile(uuid, text, text) to authenticated;

-- ── 4) AI action guard for inactive accounts ───────────────────────
-- Keep the latest category/model logging shape. Inactive users fail before
-- counters/log tables are incremented.
create table if not exists public.ai_usage_daily_log (
  user_id      uuid not null references auth.users(id) on delete cascade,
  usage_date   date not null,
  tier         text not null,
  action_count integer not null default 0,
  primary key (user_id, usage_date)
);

create table if not exists public.ai_usage_by_category_daily (
  usage_date   date    not null,
  api_category text    not null,
  model        text    not null default '',
  call_count   integer not null default 0,
  rate_rejects integer not null default 0,
  quota_rejects integer not null default 0,
  overload_count integer not null default 0,
  primary key (usage_date, api_category, model)
);

alter table public.ai_usage_by_category_daily
  add column if not exists rate_rejects integer not null default 0,
  add column if not exists quota_rejects integer not null default 0,
  add column if not exists overload_count integer not null default 0;

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
  v_tier   text;
  v_status text;
  v_count  integer;
  v_limit constant integer := 20; -- free tier daily cap
begin
  select tier, account_status
  into v_tier, v_status
  from public.profiles
  where id = p_user_id;

  if not found then
    return jsonb_build_object('allowed', false, 'error', 'Profile not found');
  end if;

  if v_status = 'inactive' then
    return jsonb_build_object(
      'allowed', false,
      'tier', v_tier,
      'count', 0,
      'limit', 0,
      'error', 'Account is inactive'
    );
  end if;

  update public.profiles
  set
    ai_actions_today = case
      when ai_actions_date < current_date then 1
      else ai_actions_today + 1
    end,
    ai_actions_date = current_date,
    updated_at = now()
  where id = p_user_id
  returning tier, ai_actions_today into v_tier, v_count;

  insert into public.ai_usage_daily_log (user_id, usage_date, tier, action_count)
  values (p_user_id, current_date, v_tier, 1)
  on conflict (user_id, usage_date)
  do update set
    action_count = ai_usage_daily_log.action_count + 1,
    tier = excluded.tier;

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

-- ── 5) Admin users RPC with status fields ──────────────────────────
drop function if exists public.admin_get_user_stats();

create or replace function public.admin_get_user_stats()
returns table (
  id                    uuid,
  email                 text,
  display_name          text,
  role                  text,
  tier                  text,
  tier_expires_at       timestamptz,
  account_status        text,
  deactivated_at        timestamptz,
  deactivated_by        uuid,
  deactivation_reason   text,
  restore_until         timestamptz,
  ai_actions_today      integer,
  ai_actions_date       date,
  created_at            timestamptz,
  language              text,
  document_count        bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  return query
  select
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.tier,
    p.tier_expires_at,
    p.account_status,
    p.deactivated_at,
    p.deactivated_by,
    p.deactivation_reason,
    p.restore_until,
    p.ai_actions_today,
    p.ai_actions_date,
    p.created_at,
    p.language,
    count(d.id)
  from public.profiles p
  left join public.documents d on d.user_id = p.id
  group by p.id
  order by
    case when p.account_status = 'inactive' then 1 else 0 end,
    p.created_at desc;
end; $$;

-- ── 6) Quick checks ────────────────────────────────────────────────
-- select id, email, account_status, deactivated_at, restore_until
-- from public.admin_get_user_stats()
-- order by created_at desc
-- limit 20;
