# Clever Monkey Refactor Plan

Updated: 2026-06-17

## Intent

Improve maintainability and verification confidence without changing Claude's core architecture. This is a conservative refactor track: restore stale safety nets first, then split obvious UI/service boundaries in small commits, and leave OCR/TTS/provider hot paths untouched unless tests and operational logs justify the move.

## Current Architecture Snapshot

- Root Vite React app without `src/`; keep this convention.
- Route-level shells live in `App.tsx`, with auth/profile/document contexts mounted globally.
- Document state is centralized in `contexts/DocumentContext.tsx`; upload and processing orchestration lives mostly in `hooks/useFileHandler.ts` and `hooks/useBackgroundProcessing.ts`.
- AI client functions are concentrated in `services/geminiService.ts`; server routing/key limits are in `netlify/functions/lib/*`.
- Admin UI state ownership remains in `pages/AdminPage.tsx` plus `components/Admin*`; admin RPC/type wrappers now live in `services/adminService.ts`.
- Current-user profile CRUD lives in `services/profileService.ts`, with row mapping shared through `services/profileMapper.ts`.
- Shared UI primitives live in `components/ui`; extracted route-adjacent presentational pieces live beside feature components, for example `components/LegalFooter.tsx`.

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

- Status: completed on 2026-06-17 after Group B stabilized.
- Admin-only RPC wrappers/types now live in `services/adminService.ts`.
- `services/profileMapper.ts` shares profile row mapping without introducing a `profileService` <-> `adminService` import cycle.
- Risk: medium. Many imports touch admin/profile data; perform only after Group B is green.

### Group D - High-Risk Domain Hotspots

Goal: eventually reduce collision risk in OCR/TTS/AI paths.

- Status: start only with pure, testable boundaries. `services/documentMapper.ts` now covers Supabase document/folder row normalization from `DocumentContext.tsx`.
- `services/geminiService.ts`: payload diagnostics split to `services/geminiPayload.ts`; podcast script prompt split to `services/podcastPrompt.ts`; quiz/flashcard/mindmap/slides prompt builders, extraction, transport, and TTS synthesis still need separate targeted plans.
- `hooks/useFileHandler.ts`: extract upload diagnostics and persistence helpers.
- `contexts/DocumentContext.tsx`: row mapping split completed; reducer/state actions and Supabase effects still live in the provider.
- Risk: high. These paths are tied to large file handling, retry recovery, provider routing, and user data persistence. Do not start without targeted tests and rollback notes.

## Current Execution Plan

1. Current low-risk refactor round is complete through admin service, public shell footer, document mapper, Gemini payload diagnostics, and podcast prompt builder splits.
2. Next code movement should start only after choosing a specific hotspot and writing a targeted test/rollback plan for it.
3. Keep deeper OCR/TTS/provider/upload movement deferred until operational logs or tests justify that exact change.
4. Run the full verification bar before code commits: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test`.

## Deferrals

- Do not refactor OCR chunking, TTS chunk synthesis, or provider routing in this pass.
- Do not change scanned/image-content PDF limits in this pass.
- Do not alter Supabase hard-delete/self-delete semantics while admin inactive recovery policy is still being validated.
