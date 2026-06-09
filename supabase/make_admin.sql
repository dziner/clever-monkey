-- ===================================================================
-- Bootstrap Admin Account  (run in the Supabase SQL Editor)
-- ===================================================================
-- Why this exists:
--   Admin rights are stored in public.profiles.role. Editing a user in
--   the Supabase dashboard's *Authentication* panel does NOT change that
--   column, so the app keeps showing the account as a normal user. This
--   script makes a specific email a permanent admin in a way that cannot
--   drift out of sync.
--
-- 👉 Replace the email below with the address you sign in with
--    (Google or email/password). It is used in EVERY statement.
-- ===================================================================

-- 0) PREREQUISITE: you must have signed in to the app at least once with
--    this email so that a row exists in auth.users. Verify here — this
--    should return exactly one row.
select id, email, created_at
from auth.users
where lower(email) = lower('voicemakesme@gmail.com');

-- 1) UPSERT the profile row.
--    • If profiles row exists → updates role to 'admin'.
--    • If it was deleted / never created → re-creates it from auth.users.
insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where lower(email) = lower('voicemakesme@gmail.com')
on conflict (id) do update
  set role = 'admin',
      email = excluded.email,
      updated_at = now();

-- 2) Bulletproof DB-level admin: is_admin_user() — the function every
--    admin RLS policy and admin RPC relies on — now returns true if EITHER
--    the profiles.role is 'admin' OR the signed-in user's email matches the
--    bootstrap address. This means admin access works even if the profiles
--    row is missing, was reset, or hasn't synced yet.
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(
      (select role = 'admin' from public.profiles where id = auth.uid()),
      false
    )
    or coalesce(
      (select lower(email) = lower('voicemakesme@gmail.com')
       from auth.users
       where id = auth.uid()),
      false
    );
$$;

-- 3) VERIFY — should show your row with role = 'admin'.
select id, email, role, tier, created_at
from public.profiles
where lower(email) = lower('voicemakesme@gmail.com');
