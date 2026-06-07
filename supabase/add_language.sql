-- ===================================================================
-- Add language preference to profiles
-- Run this in Supabase SQL Editor
-- ===================================================================
-- Stores the user's preferred language for AI-generated content.
-- NULL means "follow browser/OS language" (the default).
-- Stored values are short codes such as 'ko', 'en', 'ja', 'zh', etc.

alter table public.profiles
  add column if not exists language text;
