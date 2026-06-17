# OCR Boundary Test

Purpose: find the practical limit for PDF files whose page content is image-based, without changing the current processing contract or guessing from one failure.

## Current Test

- Target: user-provided page-range cuts of the previously failing image-content PDF.
- Current policy limit: 50 pages for image-content PDFs.
- Current file-size limit: 50MB for image-content PDFs, matching Gemini PDF understanding limits.
- Current OCR path: upload to Supabase Storage, trigger `extract-ocr-background`, OCR through Gemini Files API, patch `documents.processing_state` to `ocr_ready`, then client finalizes summary/questions.

## Current Evidence

| Date | Pages | Result | Notes |
| --- | ---: | --- | --- |
| 2026-06-16 | 50 | Success | First known successful cut from the previously failing document. |
| 2026-06-16 | 80 | Failed | User reported no diagnostic log was visible. Treat as an observability bug before changing the limit from this run alone. |
| 2026-06-16 | 100 | Failed | Confirms the practical boundary for this document is below 100 pages. |
| 2026-06-18 | 60-70 | Not run | Canceled in Codex P2 pass because no real sample upload/log evidence was available in the repo. Keep the 50-page policy unchanged. |

Do not raise the current page policy yet. The 50-page cap is conservative because 50 pages succeeded while 80 and 100 pages failed on the same source document. The 50MB file cap is a separate safety guard: successful storage/File API upload is not the same as successful Gemini PDF understanding.

## How To Capture Logs

1. Upload a page-range test PDF while signed in.
2. Wait until the document reaches `done` or `error`, or until it has clearly exceeded the background job window.
3. In Supabase SQL Editor, run [inspect_ocr_boundary_test.sql](../supabase/inspect_ocr_boundary_test.sql).
4. Set `file_name_contains` or `document_id` in all three params CTEs before running.
5. Save these fields in the working notes:
   - page count
   - file size in MB
   - final `documents.processing_state`
   - `background_ocr.completed/failed/patch_failed` stage
   - `durationMs`
   - last `progressTrail` stage
   - `extractedTextLength`
   - `storedContentLength`
   - `tokenCount`
   - `error_name`, `error_message`, and `context.raw`

## Decision Rules

- If a file above 50 pages repeatedly succeeds with clear headroom, consider raising the page policy in small steps.
- If 60-70 pages succeeds but `durationMs` is near the 13-minute background deadline, keep the 50-page policy and prioritize chunk OCR.
- If a file is near or above 50MB, treat file size as a hard OCR processing risk even when page count is low.
- If `bytesPerPage` is high, prefer compression/downsampling or smaller page ranges before raising page limits.
- If it fails before `files_upload_completed`, the boundary is file transfer or Files API upload stability. Page count alone is the wrong limit; add file-size evidence.
- If it fails during repeated `files_processing_poll`, the boundary is Gemini Files processing. Use page count and MB together when adjusting the policy.
- If it fails after `ocr_generate_started`, especially with `MAX_TOKENS`, `RECITATION`, empty output, or a very large partial response, the boundary is OCR output generation. Chunk OCR is the right next design.
- If it reaches `background_ocr.completed` but then `patch_failed`, OCR itself succeeded. Fix Supabase patch reliability before changing PDF limits.
- If it reaches `ocr_ready` but later fails during summary/questions, this is not an OCR boundary. Investigate client finalization and prompt budget instead.
- If the UI errors after a long queued state but no `background_ocr.failed` row exists, check for `processing.background_ocr.poll_timeout`. That means the background function likely died or never patched the row, and the client-side watchdog produced the terminal error.

## Limit Adjustment Guidance

- Do not raise the 50-page cap from a single successful run.
- Do not lower the 50-page cap from a single upstream overload/503 unless it repeats.
- Lower the cap only if the same class of 50-page file repeatedly fails from timeout, Files processing, or OCR output limits.
- The MB guard is now explicit for image-content PDFs. Do not remove it unless the OCR provider/path changes and validation proves a higher file-size ceiling safe.
- Do not use synthetic or unrelated PDFs to decide the 60-70 page boundary. The useful evidence must come from the same class of real image-content PDFs and include Supabase diagnostic rows.

## Suggested Evidence Table

| Date | Pages | MB | Result | Duration ms | Last progress stage | Extracted chars | Tokens | Error/raw | Decision |
| --- | ---: | ---: | --- | ---: | --- | ---: | ---: | --- | --- |
| 2026-06-16 | 50 | TBD | Success | TBD | TBD | TBD | TBD | TBD | Current conservative cap |
| 2026-06-16 | 80 | TBD | Failed | TBD | Missing before poll-timeout logging | TBD | TBD | No log | Retest after poll-timeout logging |
| 2026-06-16 | 100 | TBD | Failed | TBD | TBD | TBD | TBD | TBD | Above current cap |

## Claude Handoff Notes

- This test intentionally relies on real diagnostic logs, not synthetic PDFs.
- The current instrumentation already records the useful trail in `diagnostic_events.context.progressTrail`.
- `SCANNED_PDF_PAGE_LIMIT` is now 50. Avoid raising it until 60-70 page retests produce usable logs.
- 2026-06-18 Codex P2 pass did not run a 60-70 page upload because there was no controlled test file or live Supabase log in the workspace. This is a deliberate cancellation, not evidence for or against raising the limit.
