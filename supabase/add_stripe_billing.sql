-- ===================================================================
-- Stripe Billing / Pro subscription integration
-- Run this in Supabase SQL Editor before enabling Stripe checkout.
-- ===================================================================

-- ── 1) Stripe linkage columns ─────────────────────────────────────
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_cancel_at_period_end boolean not null default false;

create unique index if not exists profiles_stripe_customer_id_uq
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_uq
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ── 2) Prevent client-side privilege escalation ───────────────────
-- Existing app writes only email/display_name/language from the browser.
-- Tier, role, and all stripe_* fields must be changed only by service-role
-- functions or security-definer admin RPCs.
revoke update on public.profiles from authenticated;
grant update (id, email, display_name, language) on public.profiles to authenticated;

-- ── 3) Admin profile update RPC ───────────────────────────────────
-- Replaces direct browser updates to role/tier after the column-level
-- privilege clamp above.
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
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end; $$;

grant execute on function public.admin_update_user_profile(uuid, text, text) to authenticated;

-- ── 4) Operational checks ─────────────────────────────────────────
-- select id, email, tier, stripe_customer_id, stripe_subscription_status
-- from public.profiles
-- order by created_at desc
-- limit 20;
