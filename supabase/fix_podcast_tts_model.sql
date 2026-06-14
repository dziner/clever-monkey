-- ===================================================================
-- One-shot cleanup: re-attribute TTS call rows that landed with an
-- empty model column.
-- ===================================================================
-- Before this fix the TTS proxy passed an empty string to
-- increment_ai_action because the client doesn't send a model field
-- (the TTS model is fixed server-side). Those rows render as
-- "Unknown" on the admin capacity dashboard. New rows after the
-- gemini.ts fix attribute calls to 'gemini-2.5-flash-preview-tts'
-- correctly, but already-recorded ones need this merge to consolidate.
--
-- Safe to re-run (idempotent: the empty-model rows are deleted on the
-- last step; a second run finds nothing to merge).
--
-- Run in Supabase Dashboard > SQL Editor.
-- ===================================================================

-- Move counts from the empty-model rows onto the correct
-- gemini-2.5-flash-preview-tts rows for the same (date, category).
insert into public.ai_usage_by_category_daily
    (usage_date, api_category, model, call_count, rate_rejects, quota_rejects, overload_count)
select
    usage_date,
    api_category,
    'gemini-2.5-flash-preview-tts',
    call_count,
    rate_rejects,
    quota_rejects,
    overload_count
from public.ai_usage_by_category_daily
where api_category = 'podcast_tts' and model = ''
on conflict (usage_date, api_category, model)
do update set
    call_count     = ai_usage_by_category_daily.call_count     + excluded.call_count,
    rate_rejects   = ai_usage_by_category_daily.rate_rejects   + excluded.rate_rejects,
    quota_rejects  = ai_usage_by_category_daily.quota_rejects  + excluded.quota_rejects,
    overload_count = ai_usage_by_category_daily.overload_count + excluded.overload_count;

-- Drop the now-merged empty-model rows so the dashboard stops showing
-- "Unknown" for podcast TTS.
delete from public.ai_usage_by_category_daily
where api_category = 'podcast_tts' and model = '';

-- Verify: should return only rows with model = 'gemini-2.5-flash-preview-tts'.
select usage_date, api_category, model, call_count
from public.ai_usage_by_category_daily
where api_category = 'podcast_tts'
order by usage_date desc, call_count desc;
