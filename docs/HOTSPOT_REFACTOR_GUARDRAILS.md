# Hotspot Refactor Guardrails

Updated: 2026-06-18

## Decision

The current P2 hotspot item is considered designed, but deeper automatic code movement is cancelled for now.

Codex has already completed the low-risk, pure boundaries:

- `services/documentMapper.ts`: Supabase document/folder row normalization.
- `services/geminiPayload.ts`: Gemini diagnostic payload metadata.
- `services/podcastPrompt.ts`: podcast script prompt construction.

Further movement inside `components/InteractionPanel.tsx`, `services/geminiService.ts`, `hooks/useFileHandler.ts`, or provider routing should not proceed as a broad refactor.

## Why The Next Layer Is Risky

- `InteractionPanel.tsx` owns quiz tab state, wrong-answer persistence, chat inline quiz state, and generated-content persistence triggers through `DocumentContext`.
- `geminiService.ts` still mixes generation prompts, transport calls, streaming behavior, OCR extraction decisions, and TTS synthesis.
- OCR relies on the persisted state contract `queued -> ocr_ready -> done/error`; breaking it can leave documents stuck after upload.
- TTS has known fragility around prompt wrapping, voice consistency, chunk order, retry strategy, and output format.
- Provider routing and diagnostic logs are operational controls, not just implementation details.

## Allowed Next Moves

Only proceed with one bounded target at a time:

1. Write characterization tests for the exact behavior being moved.
2. Move only pure helpers first, preserving public exports if existing components import them.
3. Run the full verification bar after each commit.
4. Leave a rollback hint in `SESSION_HANDOFF.md`.

## Explicit Deferrals

- Do not refactor TTS chunk synthesis without an audio regression check.
- Do not change OCR chunking, background polling, or document row state transitions without real diagnostic evidence.
- Do not split provider routing or transport behavior without tests around fallback order, error reporting, and diagnostic context.
- Do not extract `InteractionPanel` tab state into a hook until quiz completion, restart, wrong-answer save/delete, and study-tip persistence have targeted tests.

## Recommended First Future Target

The safest next actual code target is a pure quiz-state helper:

- Build tests for MCQ/FRQ initial quiz state creation.
- Extract `createInitialQuizTabState(type, questionCount)` from `InteractionPanel.tsx`.
- Keep all dispatch, persistence, and side effects inside `InteractionPanel`.

This keeps the first step away from API calls, Supabase writes, and document processing state.
