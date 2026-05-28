-- ===================================================================
-- Add display_name to profiles
-- Run this in Supabase SQL Editor
-- ===================================================================

alter table public.profiles
  add column if not exists display_name text;

-- The return signature changes (extra display_name column), so drop & recreate
drop function if exists public.admin_get_user_stats();

create or replace function public.admin_get_user_stats()
returns table (
  id               uuid,
  email            text,
  display_name     text,
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
    p.display_name,
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
