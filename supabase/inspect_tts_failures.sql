-- ===================================================================
-- Inspect recent podcast-TTS failures (diagnostic_events)
-- ===================================================================
-- The client logs every Gemini proxy failure to diagnostic_events with
-- the real HTTP status + message. Run this to see WHAT kind of failure
-- TTS hit, so we can tell a timeout (502/504/network, long wait) apart
-- from a no-audio 500, a 429 quota, or a 413 too-large.
--
-- Run in Supabase Dashboard > SQL Editor.
-- ===================================================================

-- 1) Recent TTS failure rows, newest first.
select
    created_at,
    stage,                 -- api.gemini.tts.failed | api.gemini.tts.network_failed
    error_status,          -- 502/504 = function timeout, 500 = no audio, 429 = quota
    error_name,
    left(error_message, 200) as error_message,
    is_guest
from public.diagnostic_events
where stage like 'api.gemini.tts%'
order by created_at desc
limit 50;

-- 2) Failure breakdown by status over the last 24h — the shape of the
--    problem at a glance (e.g. "all 504" = timeout, "all 500" = no audio).
select
    coalesce(error_status, 0) as status,
    count(*)                  as occurrences
from public.diagnostic_events
where stage like 'api.gemini.tts%'
  and created_at > now() - interval '24 hours'
group by error_status
order by occurrences desc;
