-- ===================================================================
-- Repair Profiles + Bootstrap Admin   (run in the Supabase SQL Editor)
-- ===================================================================
-- Use this when a signed-in user has NO profile row (the app shows
-- "no profile row" / sidebar stuck on FREE / admin denied), and/or to
-- (re)grant admin. It repairs every moving part:
--   • the handle_new_user trigger that auto-creates profiles on signup
--   • the RLS policies that let users read/insert their own profile
--   • a profile row for every existing auth.users (set to admin/pro)
--   • is_admin_user() honoring a bootstrap email
--
-- 👉 Replace the email below with the address you sign in with.
-- ===================================================================

-- ── 0) DIAGNOSE ─────────────────────────────────────────────────────
-- Compare these two: the auth.users id MUST have a matching profiles id.
select 'auth.users' as src, id, email from auth.users
where lower(email) = lower('voicemakesme@gmail.com')
union all
select 'profiles' as src, id, email from public.profiles
where lower(email) = lower('voicemakesme@gmail.com');

-- ── 1) Ensure the signup trigger exists (auto-creates profiles) ─────
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

-- ── 2) Reassert RLS so users can read/insert/update their own row ───
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"  on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles"
  on public.profiles for select using (public.is_admin_user());
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can update any profile"
  on public.profiles for update using (public.is_admin_user());

-- ── 3) Create/promote a profile row for EVERY auth.users (admin/pro) ─
insert into public.profiles (id, email, role, tier)
select id, email, 'admin', 'pro'
from auth.users
where lower(email) = lower('voicemakesme@gmail.com')
on conflict (id) do update
  set role = 'admin', tier = 'pro', email = excluded.email, updated_at = now();

-- ── 4) Bulletproof DB-level admin (honors bootstrap email) ──────────
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
    or coalesce((select lower(email) = lower('voicemakesme@gmail.com')
                 from auth.users where id = auth.uid()), false);
$$;

-- ── 5) VERIFY — should show your row with role=admin, tier=pro ──────
select p.id, p.email, p.role, p.tier
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.email) = lower('voicemakesme@gmail.com');
