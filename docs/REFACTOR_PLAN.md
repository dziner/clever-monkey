# Clever Monkey Refactor Plan

Updated: 2026-06-17

## Intent

Improve maintainability and verification confidence without changing Claude's core architecture. This is a conservative refactor track: restore stale safety nets first, then split obvious UI/service boundaries in small commits, and leave OCR/TTS/provider hot paths untouched unless tests and operational logs justify the move.

## Current Architecture Snapshot

- Root Vite React app without `src/`; keep this convention.
- Route-level shells live in `App.tsx`, with auth/profile/document contexts mounted globally.
- Document state is centralized in `contexts/DocumentContext.tsx`; upload and processing orchestration lives mostly in `hooks/useFileHandler.ts` and `hooks/useBackgroundProcessing.ts`.
- AI client functions are concentrated in `services/geminiService.ts`; server routing/key limits are in `netlify/functions/lib/*`.
- Admin observability and user management are concentrated in `pages/AdminPage.tsx` plus `components/Admin*`.
- Shared UI primitives live in `components/ui`, but several route pages still define local presentational pieces.

## Recently Learned Risk Boundaries

- Text-layer PDFs over 600 pages are known to work; page/file OCR guards must apply only after image-content classification.
- Background OCR depends on the `queued -> ocr_ready -> done/error` state contract and Supabase row patching. Do not reshape this contract casually.
- TTS is fragile: avoid instruction wrappers, `temperature: 0`, parallel chunk synthesis, or voice-label changes without audio regression checks.
- Supabase SQL/RPC files are part of the runtime contract. UI changes that depend on RPCs must ship with migration files and handoff notes.
- Full Playwright had been failing because `appShell.spec.ts` was stale and the public shell blanked when Supabase env vars were missing in dev/test.

## Refactor Groups

### Group A - Verification Safety Nets

Goal: make the automated suite trustworthy before deeper refactors.

- Keep public app shell rendering in dev/test even when Supabase env vars are absent; production should still fail fast.
- Update `appShell.spec.ts` to assert current landing/legal/404 behavior.
- Expected validation: `npx tsc --noEmit`, `npx playwright test tests/e2e/appShell.spec.ts`, then full `npx playwright test`.
- Risk: low. It affects dev/test behavior and public route ordering, not authenticated data flows.

### Group B - Low-Risk UI Boundary Splits

Goal: reduce large route files without changing data contracts.

- Extract one-off shell UI from `App.tsx` when it is self-contained.
- Split admin users presentation/actions into explicit components where props make state ownership clear.
- Expected validation: unit tests for extracted components plus app shell/smoke E2E.
- Risk: low to medium. JSX movement can cause layout regressions; keep tests close.

### Group C - Admin Service Boundary

Goal: reduce `profileService.ts` growth from profile + admin + API stats concerns.

- Move admin-only RPC wrappers/types into an admin service module after UI split stabilizes.
- Keep exported types backward-compatible during transition.
- Risk: medium. Many imports touch admin/profile data; perform only after Group B is green.

### Group D - High-Risk Domain Hotspots

Goal: eventually reduce collision risk in OCR/TTS/AI paths.

- `services/geminiService.ts`: split prompt builders, podcast helpers, extraction, and transport.
- `hooks/useFileHandler.ts`: extract upload diagnostics and persistence helpers.
- `contexts/DocumentContext.tsx`: separate row mapping from reducer/state actions.
- Risk: high. These paths are tied to large file handling, retry recovery, provider routing, and user data persistence. Do not start without targeted tests and rollback notes.

## Current Execution Plan

1. Complete Group A.
2. Do one small Group B extraction and verify.
3. Record findings in `SESSION_HANDOFF.md` and `docs/TODO.md`.
4. Run the full verification bar before commit: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test`.

## Deferrals

- Do not refactor OCR chunking, TTS chunk synthesis, or provider routing in this pass.
- Do not change scanned/image-content PDF limits in this pass.
- Do not alter Supabase hard-delete/self-delete semantics while admin inactive recovery policy is still being validated.
