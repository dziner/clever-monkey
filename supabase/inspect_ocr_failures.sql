-- ===================================================================
-- Inspect recent OCR failures (diagnostic_events)
-- ===================================================================
-- Every Gemini OCR failure (both inline /api/gemini extractText and the
-- streaming /api/gemini-stream extractTextFromStorage) is logged with
-- stage prefix 'api.gemini.extract' or 'api.gemini_stream_ocr.'.
-- Run this to see WHAT class of failure the user hit so we can tell a
-- safety block (BLOCK_*) apart from a finish-reason cutoff
-- (MAX_TOKENS/SAFETY/RECITATION), a timeout (502/504), a network drop,
-- or an empty model response.
--
-- Run in Supabase Dashboard > SQL Editor.
-- ===================================================================

-- 1) Recent OCR failure rows, newest first. The new server-side empty
--    detection puts the actual reason in error_message (e.g.
--    "Model returned no text (block=SAFETY)", "(finish=MAX_TOKENS)").
select
    created_at,
    stage,
    error_status,
    error_name,
    left(error_message, 250) as error_message,
    file_name,
    file_size,
    file_mime,
    is_guest
from public.diagnostic_events
where stage like 'api.gemini%ocr%'
   or stage like 'api.gemini.extractText%'
order by created_at desc
limit 50;

-- 2) Shape of the problem at a glance — distribution of failure stages
--    over the last 24h, so the dominant failure mode is obvious.
select
    stage,
    coalesce(error_status, 0) as status,
    count(*)                  as occurrences
from public.diagnostic_events
where (stage like 'api.gemini%ocr%' or stage like 'api.gemini.extractText%')
  and created_at > now() - interval '24 hours'
group by stage, error_status
order by occurrences desc;
