-- ===================================================================
-- Diagnose large-file upload failures
-- ===================================================================
-- Run in Supabase Dashboard > SQL Editor, then paste the output back.
-- These queries read the diagnostic_events table that the client writes
-- on every upload/processing failure. No file contents are stored —
-- only stage, error message/status, file size, and timing metadata.
-- ===================================================================

-- ── 1) Failure breakdown over the last 3 days ──────────────────────
-- Groups by stage + error so we can see whether failures are dominated
-- by overload (503), function timeout (502/504), OCR-specific errors,
-- or something else.
select
  stage,
  severity,
  error_status,
  left(coalesce(error_message, ''), 80) as error_sample,
  count(*) as hits,
  max(created_at)        as last_seen,
  round(avg(file_size) / 1048576.0, 1) as avg_mb,
  max(file_type)         as file_type
from public.diagnostic_events
where created_at > now() - interval '3 days'
group by stage, severity, error_status, left(coalesce(error_message, ''), 80)
order by hits desc
limit 40;

-- ── 2) Just the large-file attempts (>2.5MB), most recent first ────
-- The 2.5MB threshold is where the client switches to the server
-- storage/Files-API OCR path. This shows the exact journey of each big
-- upload: which stages it reached and where it died.
select
  created_at,
  stage,
  error_status,
  left(coalesce(error_message, ''), 100) as error_message,
  round(file_size / 1048576.0, 1) as mb,
  file_name,
  file_type,
  model
from public.diagnostic_events
where created_at > now() - interval '3 days'
  and file_size > 2.5 * 1048576
order by created_at desc
limit 60;

-- ── 3) Per-file timeline for the file in the screenshot ────────────
-- Replace the filename if testing a different file. Shows whether the
-- same upload produced multiple different errors on retries.
select
  created_at,
  stage,
  severity,
  error_status,
  left(coalesce(error_message, ''), 120) as error_message
from public.diagnostic_events
where file_name ilike '%hsk4wbb%'
order by created_at desc
limit 40;
