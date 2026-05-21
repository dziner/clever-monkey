-- Add generated content columns to documents table
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS mind_map_data JSONB;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS slides_data    JSONB;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS podcast_data   JSONB;
