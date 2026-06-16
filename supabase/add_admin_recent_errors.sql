-- ===================================================================
-- admin_get_recent_errors: paginated recent error feed for the admin
-- overview dashboard.
-- ===================================================================
-- Reads the existing diagnostic_events table (no new schema). Returns
-- the most recent severity='error' rows by default, or severity in
-- ('error', 'warn') when p_include_warnings=true, newest first, with
-- the reporter's email joined in. Keyset pagination via p_before
-- (created_at cursor) powers the "더 보기" button without OFFSET drift.
--
-- Admin-gated by is_admin_user(), matching the other admin_* RPCs.
-- Idempotent — safe to re-run.
-- ===================================================================

drop function if exists public.admin_get_recent_errors(integer, timestamptz);
drop function if exists public.admin_get_recent_errors(integer, timestamptz, boolean);

create function public.admin_get_recent_errors(
    p_limit  integer default 20,
    p_before timestamptz default null,
    p_include_warnings boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rows  jsonb;
    v_limit integer;
begin
    if not public.is_admin_user() then
        raise exception 'Access denied: admin role required';
    end if;

    -- Clamp page size to a sane range (the UI loads 20 at a time, caps
    -- the visible list at 40); never let a caller pull the whole table.
    v_limit := least(greatest(coalesce(p_limit, 20), 1), 40);

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
        select
            e.id,
            e.created_at,
            e.stage,
            e.severity,
            e.message,
            e.error_status,
            e.error_name,
            e.error_message,
            e.file_name,
            e.file_size,
            e.model,
            e.is_guest,
            e.context,
            u.email as user_email
        from public.diagnostic_events e
        left join auth.users u on u.id = e.user_id
        where (e.severity = 'error' or (p_include_warnings and e.severity = 'warn'))
          and (p_before is null or e.created_at < p_before)
        order by e.created_at desc
        limit v_limit
    ) t;

    return v_rows;
end; $$;

-- Verify (run as an admin): returns the latest error rows.
-- select public.admin_get_recent_errors(20, null);
-- Verify warnings too:
-- select public.admin_get_recent_errors(20, null, true);
