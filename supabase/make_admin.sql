-- ===================================================================
-- Bootstrap Admin Account  (run in the Supabase SQL Editor)
-- ===================================================================
-- 👉 Replace the email below with the address you sign in with
--    (Google or email/password). It is used in EVERY statement.
-- ===================================================================

-- ── DIAGNOSTIC ───────────────────────────────────────────────────────
-- 0a) All auth.users rows for that email. If you have MULTIPLE rows here,
--     you signed up more than once (e.g. email signup AND Google OAuth).
--     The currently active session uses ONE of these UIDs — the others
--     are orphans.
select id as auth_user_id, email, created_at, last_sign_in_at,
       raw_user_meta_data->>'provider' as provider
from auth.users
where lower(email) = lower('voicemakesme@gmail.com')
order by last_sign_in_at desc nulls last;

-- 0b) All profile rows for that email AND for any uid in auth.users
--     matching that email. If a profile.id has no matching auth.users row,
--     it's orphaned (the auth.users row was deleted but the profile
--     row remained) — those can never be matched by getMyProfile().
select p.id as profile_id, p.email, p.role, p.tier, p.created_at,
       case when u.id is null then '⚠️ ORPHAN (no auth.users)' else 'ok' end as status
from public.profiles p
left join auth.users u on u.id = p.id
where lower(p.email) = lower('voicemakesme@gmail.com')
   or p.id in (select id from auth.users where lower(email) = lower('voicemakesme@gmail.com'));

-- ── FIX ──────────────────────────────────────────────────────────────
-- 1) Delete any orphan profile rows for this email (profile.id with no
--    matching auth.users). They can never be retrieved by the client
--    and confuse the dashboard view.
delete from public.profiles p
where lower(p.email) = lower('voicemakesme@gmail.com')
  and not exists (select 1 from auth.users u where u.id = p.id);

-- 2) UPSERT a profile row for EVERY current auth.users row with this
--    email, setting role=admin and tier=pro. This covers the case where
--    you have a fresh signup whose profile was never created (trigger
--    only fires on INSERT — manual deletions break that chain).
insert into public.profiles (id, email, role, tier)
select id, email, 'admin', 'pro'
from auth.users
where lower(email) = lower('voicemakesme@gmail.com')
on conflict (id) do update
  set role = 'admin',
      tier = 'pro',
      email = excluded.email,
      updated_at = now();

-- 3) Bulletproof DB-level admin: is_admin_user() — every admin RPC and
--    RLS policy relies on this. Returns true if EITHER profiles.role is
--    'admin' OR the signed-in user's email matches the bootstrap address.
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

-- ── VERIFY ───────────────────────────────────────────────────────────
-- 4) Final state. You should see one row per active auth.users entry,
--    all with role='admin' and tier='pro'.
select p.id, p.email, p.role, p.tier,
       u.last_sign_in_at,
       u.raw_user_meta_data->>'provider' as provider
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.email) = lower('voicemakesme@gmail.com')
order by u.last_sign_in_at desc nulls last;
