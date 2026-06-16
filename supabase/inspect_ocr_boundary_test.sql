-- ===================================================================
-- Inspect OCR boundary test logs
-- ===================================================================
-- Run in Supabase Dashboard > SQL Editor after uploading the 200-page
-- PDF test file. Edit only the params CTE below, then paste the output
-- back into the working session.
--
-- This reads diagnostic metadata only. It does not read uploaded file
-- contents, extracted OCR text, prompts, or API keys.
-- ===================================================================

-- ── Params ─────────────────────────────────────────────────────────
-- Set one or both filters. Leave as null to inspect all recent OCR jobs.
with params as (
  select
    null::text as file_name_contains, -- e.g. 'my-200p-test'
    null::text as document_id,        -- e.g. 'doc_abc123'
    interval '12 hours' as lookback
)

-- ── 1) OCR boundary timeline, newest first ────────────────────────
select
  e.created_at,
  e.source,
  e.severity,
  e.stage,
  e.document_id,
  e.file_name,
  round(e.file_size / 1048576.0, 1) as mb,
  e.model,
  e.processing_state,
  coalesce(e.context->>'pageCount', e.context#>>'{preflight,numPages}') as page_count,
  e.context#>>'{preflight,classification}' as classification,
  e.context#>>'{preflight,textLayerChars}' as text_layer_chars,
  e.context->>'durationMs' as duration_ms,
  last_progress.last_stage,
  last_progress.last_elapsed_ms,
  last_progress.last_ms_left,
  last_progress.last_file_state,
  last_progress.last_text_length,
  e.context->>'extractedTextLength' as extracted_text_length,
  e.context->>'storedContentLength' as stored_content_length,
  e.context->>'tokenCount' as token_count,
  e.error_name,
  left(coalesce(e.error_message, e.context->>'raw', ''), 400) as error_or_raw
from public.diagnostic_events e
cross join params p
left join lateral (
  select
    elem->>'stage' as last_stage,
    elem->>'elapsedMs' as last_elapsed_ms,
    elem->>'msLeft' as last_ms_left,
    elem->>'fileState' as last_file_state,
    elem->>'textLength' as last_text_length
  from jsonb_array_elements(coalesce(e.context->'progressTrail', '[]'::jsonb)) with ordinality as trail(elem, ord)
  order by ord desc
  limit 1
) last_progress on true
where e.created_at > now() - p.lookback
  and (
    e.stage like 'background_ocr.%'
    or e.stage like 'processing.background_ocr.%'
    or e.stage in (
      'upload.pdf_preflight_checked',
      'upload.rejected.pdf_too_many_pages',
      'processing.started',
      'processing.completed'
    )
  )
  and (p.file_name_contains is null or e.file_name ilike '%' || p.file_name_contains || '%')
  and (p.document_id is null or e.document_id = p.document_id)
order by e.created_at desc
limit 80;

-- ── 2) Expanded progressTrail for background OCR rows ─────────────
-- Shows the exact OCR path: storage download -> Files upload ->
-- Files processing polls -> OCR generation/fallback/completion.
with params as (
  select
    null::text as file_name_contains, -- keep in sync with params above
    null::text as document_id,
    interval '12 hours' as lookback
)
select
  e.created_at as event_created_at,
  e.severity as event_severity,
  e.stage as event_stage,
  e.document_id,
  e.file_name,
  trail.ord as step_no,
  trail.elem->>'stage' as progress_stage,
  trail.elem->>'elapsedMs' as elapsed_ms,
  trail.elem->>'msLeft' as ms_left,
  trail.elem->>'pollCount' as poll_count,
  trail.elem->>'fileState' as file_state,
  round((trail.elem->>'fileSizeBytes')::numeric / 1048576.0, 1) as mb,
  trail.elem->>'model' as model,
  trail.elem->>'fallbackModel' as fallback_model,
  trail.elem->>'textLength' as text_length
from public.diagnostic_events e
cross join params p
cross join lateral jsonb_array_elements(coalesce(e.context->'progressTrail', '[]'::jsonb)) with ordinality as trail(elem, ord)
where e.created_at > now() - p.lookback
  and e.stage in (
    'background_ocr.completed',
    'background_ocr.empty_result',
    'background_ocr.failed',
    'background_ocr.patch_failed'
  )
  and (p.file_name_contains is null or e.file_name ilike '%' || p.file_name_contains || '%')
  and (p.document_id is null or e.document_id = p.document_id)
order by e.created_at desc, trail.ord;

-- ── 3) Current documents row for the same test ────────────────────
-- Confirms whether the background job patched the document row to
-- ocr_ready/done/error and how much bounded content was stored.
with params as (
  select
    null::text as file_name_contains, -- keep in sync with params above
    null::text as document_id,
    interval '12 hours' as lookback
)
select
  d.created_at,
  d.id as document_id,
  d.file_name,
  round(d.file_size / 1048576.0, 1) as mb,
  d.file_mime,
  d.processing_state,
  d.token_count,
  length(coalesce(d.document_content, '')) as stored_content_length,
  left(coalesce(d.error_message, ''), 400) as error_message
from public.documents d
cross join params p
where d.created_at > now() - p.lookback
  and (p.file_name_contains is null or d.file_name ilike '%' || p.file_name_contains || '%')
  and (p.document_id is null or d.id = p.document_id)
order by d.created_at desc
limit 20;

-- ── How to read the result quickly ────────────────────────────────
-- completed + extracted_text_length present:
--   OCR succeeded. Use duration_ms, token_count, and stored length to
--   decide whether 200 pages has enough headroom.
-- failed with last_stage before files_upload_completed:
--   Storage/download/Files upload boundary, not OCR token output.
-- failed during files_processing_poll:
--   Gemini Files processing/page-count/size boundary.
-- failed during ocr_generate_started or with MAX_TOKENS/RECITATION:
--   OCR output-generation boundary; chunk OCR is the likely next step.
-- patch_failed:
--   OCR completed but Supabase row update failed; not an OCR limit.
