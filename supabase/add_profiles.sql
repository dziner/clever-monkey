-- ===================================================================
-- Profiles & Tier System Migration
-- Run this in Supabase SQL Editor
-- ===================================================================

-- 1. Profiles table
create table if not exists public.profiles (
  id            uuid        references auth.users(id) on delete cascade primary key,
  email         text        not null,
  role          text        not null default 'user'
                            check (role in ('user', 'admin')),
  tier          text        not null default 'free'
                            check (tier in ('free', 'pro')),
  tier_expires_at timestamptz,
  ai_actions_today integer  not null default 0,
  ai_actions_date  date     not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Security-definer helper (avoids RLS recursion)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 4. Policies
drop policy if exists "Users can view own profile"  on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin_user());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin_user());

-- 5. Auto-update updated_at trigger
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 6. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email, updated_at = now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Atomic AI action increment (called from Netlify function)
create or replace function public.increment_ai_action(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier  text;
  v_count integer;
  v_limit constant integer := 20; -- free tier daily limit
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

  -- Pro: unlimited
  if v_tier = 'pro' then
    return jsonb_build_object('allowed', true, 'tier', v_tier, 'count', v_count, 'limit', -1);
  end if;

  -- Free: cap at daily limit (rollback extra increment)
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

-- 8. Admin stats function (returns all users + doc counts)
create or replace function public.admin_get_user_stats()
returns table (
  id               uuid,
  email            text,
  role             text,
  tier             text,
  ai_actions_today integer,
  ai_actions_date  date,
  created_at       timestamptz,
  document_count   bigint
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
    p.role,
    p.tier,
    p.ai_actions_today,
    p.ai_actions_date,
    p.created_at,
    count(d.id)
  from public.profiles p
  left join public.documents d on d.user_id = p.id
  group by p.id
  order by p.created_at desc;
end; $$;

-- ===================================================================
-- To make yourself admin: run this once with your user ID
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ===================================================================
