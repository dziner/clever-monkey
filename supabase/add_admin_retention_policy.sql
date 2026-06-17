-- ===================================================================
-- Admin inactive-account retention policy
-- Run after supabase/add_admin_soft_delete.sql.
-- ===================================================================
-- Policy:
--   - Admin deletion remains a soft-delete.
--   - Restore is allowed only while restore_until >= now().
--   - Expired inactive accounts are NOT automatically hard-deleted.
--   - Manual purge/hard-delete needs a separate approved procedure.
-- ===================================================================

create or replace function public.admin_restore_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_restore_until timestamptz;
begin
  if not public.is_admin_user() then
    raise exception 'Access denied: admin role required';
  end if;

  select account_status, restore_until
  into v_status, v_restore_until
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_status = 'inactive' and v_restore_until is not null and v_restore_until < now() then
    raise exception 'Restore window has expired';
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
end; $$;

-- Quick check: expired inactive accounts retained for manual review.
-- select id, email, account_status, deactivated_at, restore_until
-- from public.admin_get_user_stats()
-- where account_status = 'inactive' and restore_until < now()
-- order by restore_until asc;
