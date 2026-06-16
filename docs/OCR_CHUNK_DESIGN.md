# Chunk OCR Design Review

Purpose: prepare a safe path for image-content PDFs that are too large for one OCR response, while preserving the existing document state contract.

## Current Contract To Preserve

- `documents.processing_state = 'queued'`: background OCR is running.
- `documents.processing_state = 'ocr_ready'`: OCR text has been written to `documents.document_content`; the client should summarize and generate preset questions.
- `documents.processing_state = 'done'`: summary/questions are complete.
- `documents.processing_state = 'error'`: user-facing retry path should remain available.

Do not introduce new required top-level states unless Claude explicitly chooses a migration. Chunk progress can be tracked in diagnostics or a separate table without changing this contract.

## Why Chunking May Be Needed

The current background OCR sends the whole file to Gemini Files API and asks for one exhaustive transcription. This has three likely ceilings:

- Files processing time: the uploaded PDF stays in `PROCESSING` too long.
- OCR output generation: one response hits output token limits or empty/blocked finish reasons.
- Reliability/retry blast radius: one failure discards all progress for a large file.

The 200-page boundary test should decide which ceiling is real for the current documents.

## Options

### Option A: Prompt Range Chunking

Ask Gemini to OCR page ranges from the same uploaded file, for example pages 1-25, 26-50, and so on.

- Pros: smallest code change; no PDF splitting dependency; can reduce output-token pressure.
- Cons: each chunk still references the full processed file; page-range compliance may be imperfect; repeated full-file requests may be expensive and slow.
- Best use: diagnostic experiment after logs show `ocr_generate_*` is the bottleneck, not Files processing.

### Option B: Real PDF Page Splitting

Split the original PDF into smaller page-range PDFs, upload each chunk to Gemini Files API, OCR each chunk, then join text in page order.

- Pros: reduces Files processing and output generation per request; cleaner retries; stronger page boundaries.
- Cons: requires a PDF splitting dependency or service-side tool; higher implementation risk inside Netlify background functions; must handle storage cleanup.
- Best use: if logs show Files processing or upload/generation time scales poorly with full-file size.

### Option C: User-Driven Splitting Only

Keep the current policy and ask users to split image-content PDFs above the safe limit.

- Pros: no architecture risk; current UX already explains the limit.
- Cons: pushes work to users; does not recover the 35MB/500-page class automatically.
- Best use: until boundary logs prove chunking is worth the extra moving parts.

## Recommended First Implementation If Needed

Start with a feature-flagged experiment, not a default path:

- Gate with a server env flag such as `OCR_CHUNK_MODE=prompt_range`.
- Only run for signed-in users and image-content PDFs that are under the current upload/file-size ceiling.
- Keep `documents.processing_state` as `queued` for the whole OCR run.
- Record chunk progress in `diagnostic_events.context`, including:
  - `chunkIndex`
  - `chunkCount`
  - `pageStart`
  - `pageEnd`
  - `attempt`
  - `durationMs`
  - `textLength`
  - `model`
  - `fallbackModel`
  - `errorMessage`
- Patch `documents` only once when all chunks have succeeded.
- On final success, join chunk text in page order, estimate tokens from full joined text, then store the existing sampled `document_content`.
- On failure, patch `processing_state = 'error'` with a message naming the failed page range.

This keeps rollback simple: turn off the env flag and the old single-pass background OCR remains the default.

## Durable Partial Success

If prompt range chunking is not enough, add a separate table rather than changing the `documents` state machine:

```sql
create table public.document_ocr_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  page_start integer not null,
  page_end integer not null,
  status text not null check (status in ('pending', 'running', 'done', 'error')),
  attempts integer not null default 0,
  text text,
  token_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
```

RLS should mirror `documents_owner`. This table allows retries from the failed chunk only, but it is a larger DB change and should wait until logs prove it is necessary.

## Retry Policy

- Retry transient network and 5xx failures per chunk.
- Keep existing overload fallback behavior.
- Limit chunk retries to a small number, such as three attempts.
- If one chunk fails permanently, stop and surface the page range to the user.
- Do not silently produce partial summaries from missing chunks.

## Chunk Size Starting Point

Use the boundary test to pick the first chunk size. If no better evidence exists:

- Start with 25 pages per chunk for dense scanned documents.
- Consider 50 pages only if 200-page OCR succeeds with good headroom.
- Reduce below 25 pages if output token or recitation failures repeat.

## Risks

- Prompt range chunking can duplicate or skip text if the model does not follow page boundaries.
- Real PDF splitting adds dependency and memory risk inside background functions.
- More OCR calls increase quota usage and overload exposure.
- Storing chunk text increases privacy/storage surface; keep RLS and cleanup explicit.

## Rollback

- For Option A, disable the env flag and leave the current single-pass OCR path intact.
- For Option B or the chunk table, keep migrations additive and avoid making existing rows depend on chunk state.
- Do not remove the current user-facing split-file guidance until chunk OCR has repeated success on real logs.
