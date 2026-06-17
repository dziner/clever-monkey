# Session Handoff — Clever Monkey

## Codex Context Scan — 2026-06-16

> 목적: Claude가 주도한 구조를 Codex가 보조할 때, Claude가 모르는 변경이 비가역적으로 굳지 않도록 추적 데이터를 남긴다.

### 현재 기준점

- 브랜치: `main`
- 기준 커밋: `8192360` — `fix(admin): log terminal upload rejections at 'error' so the feed shows them`
- 작업 트리 확인 시점: clean (`main...origin/main`)
- 최근 30개 커밋 작성자: Claude

### 최근 30개 커밋에서 읽은 개선 방향

1. OCR/대용량 PDF 안정화
   - 텍스트 PDF는 브라우저 pdf.js 로컬 추출을 우선한다.
   - 대용량 스캔 PDF는 26초 동기 Netlify 함수 한계를 피하기 위해 `extract-ocr-background`로 넘기고, `documents.processing_state`를 `queued -> ocr_ready -> done/error`로 폴링한다.
   - 빈 OCR 결과를 조용히 성공 처리하지 않고, safety/finish reason 또는 타임아웃 사유를 사용자와 관리자 로그에 드러낸다.
   - page-count preflight와 server-side diagnostic logging으로 실패를 기다리기 전에 차단하거나 관측 가능하게 만든다.

2. Podcast/TTS 안정화
   - 긴 스크립트/음성 생성이 함수 timeout에 닿지 않도록 podcast script는 streaming, TTS는 작은 chunk로 처리한다.
   - TTS preview 모델은 instruction wrapper나 `temperature: 0` 같은 추가 config에 취약했으므로, 서버 TTS payload는 원문 text + audio modality + voice만 유지한다.
   - chunk 간 voice consistency 때문에 TTS는 sequential 처리한다. 같은 chunk 재시도 후 split-half fallback으로 전환한다.
   - 합성 오디오는 refresh 이후에도 살아남도록 storage persistence를 둔다.

3. Admin observability/capacity
   - 기능별 API 사용량, 실제 429/quota/503 rejection, provider/model/family/variant를 admin에서 볼 수 있게 했다.
   - 최근 에러 feed는 `diagnostic_events`/RPC 기반으로 live refresh한다.
   - background OCR처럼 client request 밖에서 실패하는 작업도 server diagnostic으로 feed에 올라오게 한다.

4. Quiz/학습 루프
   - `user x document x quiz_type` 단위 질문 이력을 저장해 같은 퀴즈가 반복되는 동기 저하를 줄인다.
   - `InteractionPanel`에서 `ChatTabPanel`, `QuizTabPanel`, `ChatModeToggles`를 분리해 큰 파일의 충돌면을 줄이기 시작했다.

### 확인한 병목과 주의점

- Netlify synchronous/streaming 함수는 약 26초 hard limit가 있다. Heartbeat는 idle cut을 막을 뿐 실행 시간을 늘리지 않는다.
- Background function은 15분 예산이 있지만 결과 전달은 Supabase row patch에 의존한다. `patchDocument`, `processing_state`, `error_message` 계약을 함부로 바꾸면 queued 문서가 stuck될 수 있다.
- 무료 AI quota/RPM 및 provider flakiness가 실제 천장이다. `router.ts`, `providers.ts`, `shared.ts`의 key rotation/rejection tracking은 용량 관측의 핵심 경계다.
- TTS preview는 깨지기 쉬운 경로다. prompt wrapper, temperature, 병렬 chunk 처리, voice label 복원은 이미 회귀를 만든 이력이 있으므로 재도입하지 않는다.
- Supabase migration/RPC 파일들이 기능과 짝을 이룬다. UI/서비스만 바꾸고 SQL을 누락하면 admin dashboard/feed가 조용히 빈 상태가 될 수 있다.
- Hotspot 파일은 `services/geminiService.ts`, `netlify/functions/gemini.ts`, `netlify/functions/lib/shared.ts`, `netlify/functions/lib/filesApiOcr.ts`, `hooks/useFileHandler.ts`다. 변경 시 작은 단위와 테스트 우선.

### Codex 작업 기록 규칙

- Codex는 Claude의 메인 구조를 임의로 재설계하지 않는다. 변경은 버그 수정, 관측성 보강, 테스트/문서 보강처럼 보조적이고 되돌릴 수 있는 단위로 제한한다.
- 앞으로의 작업 후보와 우선순위는 `docs/TODO.md`에 등록한다. 새 요청이 오면 먼저 backlog에 추가하고, 상위 우선순위부터 처리하되 매번 사용자 의도와 운영 리스크로 재판단한다.
- 작업 전 이 섹션 아래에 intent, touched files, expected risk를 짧게 남긴다.
- 작업 후 changed files, validation command/result, Claude handoff note, rollback hint를 남긴다.
- DB schema/RPC, Netlify function protocol, storage path/state machine, provider routing 변경은 반드시 별도 handoff note를 남기고, 가능한 한 migration 파일과 테스트를 함께 둔다.
- 불확실하면 구조 변경보다 diagnostic/log/test를 먼저 추가한다.

### Codex work log

- 2026-06-16: 최근 30개 커밋, `CLAUDE.md`, `SESSION_HANDOFF.md`, `docs/CODEBASE_HEALTH_PLAN.md`, `docs/LOAD_TEST_REPORT.md`, `docs/SWOT_AND_ROADMAP.md`, OCR/TTS/admin/quiz hotspot 파일을 읽고 위 컨텍스트를 기록함. 코드 동작 변경 없음.
- 2026-06-16 intent: 이미지/스캔 PDF의 실제 실패 경계를 찾기 위해 background OCR 경로에 진행 단계 diagnostic trail을 추가한다. Touched files 예상: `netlify/functions/lib/filesApiOcr.ts`, `netlify/functions/extract-ocr-background.ts`, 필요 시 unit test. Risk: OCR 실행 경로 hot path이므로 동작 변경 없이 observer callback만 추가하고, DB schema/RPC 변경은 하지 않는다.
- 2026-06-16 result: OCR 실행 방식은 바꾸지 않고 추적만 추가함. Changed files: `utils/pdfPreflightCheck.ts`, `tests/unit/pdfPreflightCheck.test.ts`, `hooks/useFileHandler.ts`, `services/geminiService.ts`, `netlify/functions/lib/filesApiOcr.ts`, `netlify/functions/extract-ocr-background.ts`, `supabase/add_admin_recent_errors.sql`, `services/profileService.ts`, `components/AdminRecentErrors.tsx`. Background OCR diagnostic context now records `pageCount`, preflight classification/page/text probe metadata, `durationMs`, and compact `progressTrail` stages (`storage_download_*`, `files_upload_*`, `files_processing_*`, `ocr_generate_*`). Admin recent error expanded row shows a compact `ocr:` summary when the RPC has `context`. Validation: Homebrew installed Node `v26.3.0` with npm/npx `11.16.0`; `npm install` added the missing `@breezystack/lamejs` package to `node_modules` without package file changes; `git diff --check`, `npx tsc --noEmit`, and `npx vitest run` all passed (`25` files, `146` tests). Claude handoff note: rerun `supabase/add_admin_recent_errors.sql` so the RPC returns `context`; then upload a scanned PDF under the 200-page limit and inspect `diagnostic_events.context.progressTrail` or the admin feed expanded row. Rollback hint: revert the observer additions and RPC/context UI changes; no new DB columns were introduced.
- 2026-06-16 result: Admin recent log now has an `Error / Error+Warn` segmented toggle. `admin_get_recent_errors` gained `p_include_warnings`; `adminGetRecentErrors` only sends the new arg when warnings are requested so the default Error view remains compatible until SQL is rerun. PDF page-limit copy now says "페이지의 내용이 이미지로 구성된 PDF 파일" instead of "이미지 PDF/스캔 PDF"; that policy rejection logs as `warn`, and StudyPage/FileListItem render it with amber warning styling instead of a red failure presentation. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all passed. Browser verification was attempted after starting Vite at `http://127.0.0.1:5173/`, but the Browser plugin reported no available `iab` browser sessions (`agent.browsers.list()` returned `[]`).
- 2026-06-16 fix: User reported Error+Warn appeared empty and clarified the intended semantics: Error = errors only, Error+Warn = error OR warn union. Root cause was likely that `supabase/add_admin_recent_errors.sql` had not been run yet; user then ran it. Code was hardened anyway: Error+Warn now tries the new `p_include_warnings=true` RPC first, and if that fails falls back to merging the old error RPC with a direct warning query. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run` passed.
- 2026-06-16 intent: P1 items for image-content PDF OCR boundary and chunk OCR design. User is manually testing a 200-page cut of the previously failing document, so Codex should not infer a new limit yet. Touched files expected: docs/Supabase SQL only. Risk: avoid changing OCR runtime or `SCANNED_PDF_PAGE_LIMIT` until real diagnostic evidence is reviewed.
- 2026-06-16 result: Added `supabase/inspect_ocr_boundary_test.sql` to inspect the live 200-page test by file name or document id, including `background_ocr.*` rows, final document state, compact `progressTrail` last stage, duration, extracted/stored text lengths, token count, and raw error text. Added `docs/OCR_BOUNDARY_TEST.md` with decision rules for whether a 200-page success/failure indicates upload, Files processing, OCR generation, patch, or finalization bottleneck. Added `docs/OCR_CHUNK_DESIGN.md` with a non-invasive chunk OCR design review: preserve `queued -> ocr_ready -> done/error`, start with feature-flagged prompt-range chunking only if logs justify it, and defer a durable chunk table until necessary. TODO updated: chunk design review done; boundary test remains open pending the user's real 200-page logs. Rollback hint: remove the two docs and one SQL helper; no runtime code, DB schema, or policy limit changed.
- 2026-06-16 intent: User reported OCR boundary evidence: 50-page image-content PDF succeeded, 100-page failed, 80-page failed but did not appear in logs. Treat missing log as P0 because it blocks reliable limit selection. Risk: fix observability without changing OCR runtime or `SCANNED_PDF_PAGE_LIMIT`.
- 2026-06-16 result: Added a client-side watchdog diagnostic in `hooks/useBackgroundProcessing.ts`. When a queued background OCR document exceeds the 16-minute poll window, the client now patches the `documents` row to `processing_state='error'` and logs `processing.background_ocr.poll_timeout` with file metadata, storage path, model, queued duration, and timeout config. This catches the gap where a Netlify background function may be killed before `background_ocr.failed` can be written. Updated `docs/OCR_BOUNDARY_TEST.md` with 50/80/100-page evidence and told future agents not to change the 200-page policy until the 80-page failure class is recorded. Rollback hint: revert the `useBackgroundProcessing` timeout logging block and the doc/TODO updates; no DB schema or OCR path changed.
- 2026-06-16 intent: User noticed file list items reserve too much right-side space for hidden rename/delete buttons, causing filenames to truncate early. Risk: small sidebar layout change; preserve existing rename/delete behavior and visual tone.
- 2026-06-16 result: Updated `components/FileListItem.tsx` so rename/delete controls no longer occupy flex layout width while hidden. The item content now uses the full row width, and the controls appear as an absolute right-side hover/focus overlay pill. TODO moved this item to Done. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, and `npm run build` passed. Browser plugin setup reported `Browser is not available: iab`, so direct in-app visual verification could not run. `npx playwright test` was attempted; smoke specs passed but `appShell.spec.ts` had 8 existing expectation failures around landing/legal/404 copy or routing, so that was logged as a separate P2 TODO rather than mixed with the file-list change. Rollback hint: revert `components/FileListItem.tsx` to put the action buttons back in normal flow.
- 2026-06-17 intent: Continue by TODO priority. User asked to proceed P1 without breaking existing working behavior, and to add podcast length work. Risk: image-content PDF limit change should only affect OCR-bound PDFs, not text-layer PDFs; podcast length change must preserve single-narrator and sequential TTS chunk behavior.
- 2026-06-17 result: Lowered `SCANNED_PDF_PAGE_LIMIT` from 200 to 50 based on real tests where a 50-page image-content PDF succeeded and 80/100-page cuts failed. Updated `docs/OCR_BOUNDARY_TEST.md`, `supabase/inspect_ocr_boundary_test.sql`, and TODO to treat 60-70 page retesting as a later evidence-gathering task before any increase. Added a regression unit test pinning the 50-page ceiling. Added podcast script length presets: default `standard` now prompts for about 750 words, `long` for about 1,200 words, while user-written duration/word-count instructions still override the preset. `components/PodcastTab.tsx` now shows a compact `분량` option next to the existing direction field. `synthesizeSpeech` and TTS chunking were not structurally changed; comments were updated to reflect longer scripts. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run` (`25` files, `147` tests), `npm run build`, and `npx playwright test tests/e2e/smoke.spec.ts` all passed. Browser plugin setup still reported `Browser is not available: iab`, so direct in-app visual verification could not run. Rollback hint: revert `utils/pdfPreflightCheck.ts` limit/test/doc changes for the OCR cap, and revert the `PodcastTab`/`generatePodcastScript` length preset additions for podcast behavior.
- 2026-06-17 intent: Implement P1 multi-variable preflight for image-content PDFs based on competitive research. Risk: keep text-layer PDFs on the existing local extraction path; add file-size/bytes-per-page diagnostics and clearer copy without changing the OCR state machine or background processing contract.
- 2026-06-17 result: Added `docs/PDF_UPLOAD_LIMIT_RESEARCH.md` and moved the multi-variable preflight task to Done. `utils/pdfPreflightCheck.ts` now keeps the 50-page image-content PDF cap and adds a separate 50MB OCR file-size cap before storage upload. Preflight results/diagnostics now include `fileSizeBytes`, `bytesPerPage`, `riskFlags`, `reasonCode`, and file/page limit values; near-limit image-content PDFs log `upload.pdf_preflight_risky_image_content` as a warning while still continuing. Rejection copy now explains that OCR cost varies by scan resolution, table/figure density, page size, and file size, while text-layer PDFs remain exempt from image-content OCR guards. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run tests/unit/pdfPreflightCheck.test.ts` (`8` tests), `npx vitest run` (`25` files, `149` tests), `npm test -- --run`, `npm run build`, and `npx playwright test tests/e2e/smoke.spec.ts` all passed. Rollback hint: revert the `SCANNED_PDF_FILE_SIZE_*` constants, risk diagnostics, `useFileHandler` reasonCode handling, and the related doc/test changes.
- 2026-06-17 note: User clarified that text-based PDFs over 600 pages already load and analyze quickly. Do not add page-count restrictions to text-layer PDFs; page/file OCR guards should apply only after text-layer probing classifies the PDF as image-content/scanned.
- 2026-06-17 intent: Fix first-time signup display-name modal layout, especially mobile. Risk: keep the change scoped to `NamePromptModal` so shared modal/input/button primitives and auth flow behavior are not disturbed.
- 2026-06-17 result: `NamePromptModal` now uses the smaller modal width and compact internal spacing: smaller monkey mark, tighter heading/body copy, single responsive paragraph, and medium-height CTA. Common `Modal`, `Input`, and `Button` primitives were not changed. Validation included a Playwright fixture rendering the modal with real Vite/Tailwind CSS at 360x640, 390x844, and 1024x768; all had no horizontal overflow and the dialog/button stayed within the viewport. Rollback hint: revert only `components/NamePromptModal.tsx` and the TODO/handoff entries.
- 2026-06-17 intent: Fix first-run onboarding tour card position from step 3 onward and verify desktop/mobile. Risk: preserve tour content and flow; only harden anchor selection/layout so hidden duplicate `data-tour` nodes cannot produce a 0x0 top-left anchor.
- 2026-06-17 result: `utils/tourLayout.ts` now ignores zero-size/offscreen anchors and exposes `getVisibleTourAnchorRect`; `OnboardingTour` uses it and re-measures on the next frame/short timeout after step changes. This prevents hidden desktop/mobile duplicate tour buttons from pinning the card near the viewport origin. Added unit coverage for hidden duplicate anchors and zero-size anchor fallback. Playwright fixture verified 3/4 and 4/4 cards at desktop 1024x768, mobile 390x844, and mobile 360x640: no horizontal overflow, cards fit viewport, and not top-left stuck. Rollback hint: revert `components/OnboardingTour.tsx`, `utils/tourLayout.ts`, `tests/unit/tourLayout.test.ts`, and the docs entries.
- 2026-06-17 intent: Upgrade admin user management without hard-deleting accounts. User clarified that admin deletion should mark accounts inactive and recoverable for 30 days from a separate deleted-account section. Risk: avoid touching the existing self hard-delete function, keep Claude's admin/RPC structure, and leave SQL trace because UI changes require Supabase migration.
- 2026-06-17 result: Added `supabase/add_admin_soft_delete.sql` with `profiles.account_status`, deactivation metadata, `restore_until`, `admin_soft_delete_user`, and `admin_restore_user`. The SQL also makes DB admin checks require an active profile and prevents inactive users from incrementing AI usage. `AdminPage` now separates active accounts from deleted accounts, replaces confusing Pro/Admin toggle buttons with explicit tier/role selects, and adds confirm dialogs for delete 처리/복구. `AdminUserTable` now shows account status, disables tier/role controls for inactive rows, and exposes restore-only actions. `App` shows an inactive-account block screen and suppresses name prompt/onboarding for inactive profiles. Validation: `git diff --check`, `npx tsc --noEmit`, targeted admin tests, full `npx vitest run` (27 files, 156 tests), `npm run build`, and `npx playwright test tests/e2e/smoke.spec.ts` passed. Browser plugin setup still reported `Browser is not available: iab`. Full `npx playwright test` still fails 8 existing `appShell.spec.ts` expectations around landing/legal/404 text, while smoke 2 tests pass. Claude handoff note: run `supabase/add_admin_soft_delete.sql` in Supabase SQL Editor before expecting delete/restore RPCs to work. Rollback hint: revert `supabase/add_admin_soft_delete.sql`, `types.ts` profile status fields, `services/profileService.ts` account action calls, `services/adminConfig.ts`, `App.tsx`, `pages/AdminPage.tsx`, `components/AdminUserTable.tsx`, `components/ConfirmDialog.tsx`, and the admin tests/docs entries.
- 2026-06-17 intent: Start conservative refactoring for efficiency/consistency after scanning recent commits, TODO, health docs, and hotspots. Risk: do not combine high-risk OCR/TTS/provider/upload changes with broad UI cleanup; restore full verification signal first.
- 2026-06-17 result: Added `docs/REFACTOR_PLAN.md` with architecture snapshot, learned risk boundaries, refactor groups A-D, and explicit deferrals. Fixed the stale app-shell safety net: `services/supabaseClient.ts` now keeps production fail-fast for missing Supabase env vars but uses a local dummy client in dev/test so public routes render instead of blanking; `App.tsx` now handles `/privacy`, `/terms`, and unknown routes above the empty guest workspace branch. Updated `tests/e2e/appShell.spec.ts` to assert current landing/legal/404 UI. Extracted `components/InactiveAccountScreen.tsx`, `components/AdminStatCard.tsx`, and `components/AdminUsersTab.tsx`, reducing `App.tsx` and `AdminPage.tsx` responsibility without changing admin state ownership. Validation: `git diff --check`, `npx tsc --noEmit`, `npm test` (27 files, 156 tests), `npm run build`, and full `npx playwright test` (10 tests) all passed. Handoff note: follow-up refactors are now tracked in TODO: admin service boundary split first, then high-risk InteractionPanel/geminiService splitting only with targeted tests. Rollback hint: revert `docs/REFACTOR_PLAN.md`, the app-shell route/env changes, `tests/e2e/appShell.spec.ts`, and the three extracted components plus their imports.
- 2026-06-17 intent: Follow-up refactor stage 1. Split admin-only service concerns out of `profileService.ts` after the app-shell/admin UI extraction stabilized. Risk: medium import churn; do not alter Supabase RPC names, admin state ownership, soft-delete/restore behavior, or OCR/TTS/upload paths.
- 2026-06-17 result: Added `services/adminService.ts` for admin user stats/profile updates/soft-delete/restore/API stats/DB stats/recent error RPC wrappers and admin-facing types. Added `services/profileMapper.ts` so `profileService.ts` and `adminService.ts` can share profile row normalization without a service import cycle. Updated `AdminPage`, `Admin*` components, `utils/adminStats`, and admin unit tests to import admin-only types/functions from `adminService`. `profileService.ts` now only handles current-user profile read/upsert/update flows. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run tests/unit/adminStats.test.ts tests/unit/adminUserTable.test.tsx`, `npm test` (27 files, 156 tests), `npm run build`, and full `npx playwright test` (10 tests) passed. Handoff note: this is a code organization change only; no DB schema/RPC semantics changed. Rollback hint: move admin exports back into `services/profileService.ts`, remove `services/adminService.ts`/`services/profileMapper.ts`, and restore imports.
- 2026-06-17 intent: Follow-up refactor stage 2. Split a low-risk public shell presentational component without changing routing/auth/document state. Risk: low JSX movement; keep landing footer links and language behavior identical.
- 2026-06-17 result: Added `components/LegalFooter.tsx` and moved the `IdleStateView` trust footer into it. `IdleStateView.tsx` now imports the footer instead of defining legal links locally. Validation: `git diff --check`, `npx tsc --noEmit`, `npm test` (27 files, 156 tests), `npm run build`, and full `npx playwright test` (10 tests) passed. Handoff note: this is a presentation-only boundary cleanup. Rollback hint: inline `LegalFooter` back into `IdleStateView.tsx` and remove `components/LegalFooter.tsx`.
- 2026-06-17 intent: Follow-up refactor stage 3. Take the safest first step in Group D by extracting only the pure Supabase row normalization from `DocumentContext.tsx`. Risk: medium because reload behavior depends on defaults; avoid changing fetch effects, reducer actions, default folder creation, background OCR polling, or upload retry logic.
- 2026-06-17 result: Added `services/documentMapper.ts` with `mapFolderRow`, `mapDocumentRow`, and exported row types. `DocumentContext.tsx` now delegates folder/document row normalization to that service while keeping provider state/effects in place. Added `tests/unit/documentMapper.test.ts` to lock legacy chat fallback, processing state fallback, nullable optional columns, storage uploadState, and folder mapping. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run tests/unit/documentMapper.test.ts`, `npm test` (28 files, 161 tests), `npm run build`, and full `npx playwright test` (10 tests) passed. Handoff note: OCR `queued -> ocr_ready -> done/error` and generated-content persistence were not changed. Rollback hint: inline mapper code back into `DocumentContext.tsx`, remove `services/documentMapper.ts`, and delete `tests/unit/documentMapper.test.ts`.
- 2026-06-17 intent: Follow-up refactor stage 4. Split only Gemini proxy diagnostic payload metadata from `geminiService.ts`. Risk: low to medium because these helpers feed admin error context; do not alter prompts, provider routing, OCR extraction, or TTS chunking.
- 2026-06-17 result: Added `services/geminiPayload.ts` with `GeminiPayload`, `summarizeGeminiPayload`, `modelForPayload`, and `storagePathForPayload`. `geminiService.ts` now imports those helpers and keeps actual network/generation behavior in place. Added `tests/unit/geminiPayload.test.ts` for generateContent, inline OCR, storage OCR, and TTS diagnostic summaries. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run tests/unit/geminiPayload.test.ts`, `npm test` (29 files, 165 tests), `npm run build`, and full `npx playwright test` (10 tests) passed. Handoff note: diagnostics shape is intentionally preserved; no endpoint, prompt, model, or TTS behavior changed. Rollback hint: inline helpers back into `geminiService.ts` and delete `services/geminiPayload.ts` plus its unit test.
- 2026-06-17 intent: Follow-up refactor stage 5. Split only the podcast script prompt builder from `geminiService.ts`. Risk: medium because prompt text affects generation quality; keep streaming call, provider task, TTS normalization/chunking, and existing exports unchanged.
- 2026-06-17 result: Added `services/podcastPrompt.ts` with `PodcastScriptLength`, `PODCAST_SCRIPT_LENGTH_GUIDE`, and `buildPodcastScriptPrompt`. `generatePodcastScript` now delegates prompt construction to that builder, while `geminiService` still re-exports the type/guide for existing imports. Added `tests/unit/podcastPrompt.test.ts` covering standard/long length guides, user direction handling, and one-narrator constraints. Validation: `git diff --check`, `npx tsc --noEmit`, `npx vitest run tests/unit/podcastPrompt.test.ts`, `npm test` (30 files, 168 tests), `npm run build`, and full `npx playwright test` (10 tests) passed. Handoff note: this does not touch actual audio synthesis, chunk split, voice selection, or provider fallback. Rollback hint: inline the builder back into `generatePodcastScript`, remove `services/podcastPrompt.ts`, and delete the prompt unit test.
- 2026-06-18 intent: Process P2 hotspot refactor design item. Risk: high if automatically continuing into `InteractionPanel` tab-state hooks, OCR/upload state machine, TTS synthesis, or provider routing without characterization tests.
- 2026-06-18 result: Added `docs/HOTSPOT_REFACTOR_GUARDRAILS.md` and marked the P2 design item done. Decision: deeper automatic code movement is cancelled for now because the next layers cross persisted quiz state, wrong-answer save/delete, OCR `queued -> ocr_ready -> done/error`, TTS chunk behavior, and provider diagnostics. Safe splits already completed: document row mapper, Gemini payload diagnostics, podcast prompt builder. Handoff note: next safe code target is a side-effect-free quiz-state helper only after characterization tests. Rollback hint: remove the guardrail doc and restore the P2 TODO item if the team wants a different refactor strategy.
- 2026-06-18 intent: Process P2 inactive-account retention policy. Risk: high if enabling automatic hard delete because it would irreversibly remove user content and diagnostic evidence.
- 2026-06-18 result: Chose conservative policy: no automatic hard delete. Added `docs/ACCOUNT_RETENTION_POLICY.md` and `supabase/add_admin_retention_policy.sql`; the SQL updates `admin_restore_user` so expired inactive accounts cannot be restored after `restore_until`. Admin UI now shows expired accounts as `복구 만료` and disables the restore button. Unit coverage added for expired restore UI. Handoff note: run `supabase/add_admin_retention_policy.sql` after `supabase/add_admin_soft_delete.sql` in Supabase SQL Editor. User self-delete through `/.netlify/functions/delete-account` remains an immediate hard-delete path and is intentionally separate. Rollback hint: revert the policy SQL/doc plus AdminUserTable/AdminUsersTab/AdminPage copy/test changes.
- 2026-06-18 intent: Process P2 image-content PDF copy cleanup. Risk: low, but do not change OCR limits or text-layer behavior while copy is being cleaned up.
- 2026-06-18 result: Centralized the hard-rejection copy in `utils/pdfPreflightCheck.ts` so both page-count and file-size rejections explain the same shape: PDF type, detected pages/MB, current stable criteria, why page count varies by scan density/layout/file size, and the recommended split/compress action. Updated `docs/PDF_UPLOAD_LIMIT_RESEARCH.md` selected copy and tightened unit expectations. Handoff note: `FileListItem` warning styling still keys on "페이지의 내용이 이미지로 구성된 PDF 파일", which the new copy preserves. Rollback hint: revert the copy builder and restore the previous inline reason strings/tests.
- 2026-06-18 intent: Process P2 60-70 page image-content PDF retest. Risk: high if Codex uses synthetic/unrelated PDFs or changes `SCANNED_PDF_PAGE_LIMIT` without real Supabase diagnostic evidence.
- 2026-06-18 result: Retest execution canceled and recorded. There is no controlled 60-70 page sample upload or live `diagnostic_events`/`documents` evidence in the workspace, so changing the 50-page policy would be guesswork. Updated `docs/OCR_BOUNDARY_TEST.md` and `docs/TODO.md`; no runtime behavior changed. Handoff note: rerun this only with a real user upload and `supabase/inspect_ocr_boundary_test.sql` output. Rollback hint: move the TODO item back to P2 if a valid sample/log arrives.
- 2026-06-18 intent: Process P2 npm audit dependency hygiene. Risk: medium if using `npm audit fix --force`, because that can force major Vite/plugin changes.
- 2026-06-18 result: Current `npm audit --json` showed only one low `@babel/core` advisory, not the older four-item snapshot. Ran non-forced `npm audit fix`, which updated Babel transitive dev dependencies in `package-lock.json` only and brought audit vulnerabilities to 0. No `package.json` direct dependency or Vite major upgrade changed. Rollback hint: revert `package-lock.json` plus the TODO/handoff audit notes.
- 2026-06-18 intent: Process P2 IP rate-limit map pruning. Risk: medium because this sits on the anonymous/unverified request defense boundary.
- 2026-06-18 result: Added idle-entry pruning to `tooManyRequestsByIp` without changing the per-IP 30 requests/minute policy or the O(30) hot-IP cap. Pruning runs at most once per rate window and removes entries whose timestamps have all expired, reducing long-lived warm-instance memory growth from unique stale IPs. Added unit coverage for active-window preservation and expired-entry removal; updated the stress test to verify 100k unique stale IPs can be pruned. Handoff note: this is memory hygiene only, not a rate-limit threshold change. Rollback hint: revert `netlify/functions/lib/shared.ts`, `tests/unit/rateLimiter.test.ts`, `tests/stress/infra.stress.test.ts`, and docs/TODO notes.
- 2026-06-18 intent: Start frontend/CSS design QA pass using Product Design guidance. Risk: broad visual cleanup can accidentally redesign Claude's existing product language.
- 2026-06-18 result: Added `docs/UI_REVIEW_2026-06-18.md` with severity-ranked findings. First fix: `Modal` now has `mobilePresentation` so auth can be full-screen on mobile while desktop stays card-sized; default sheets now bottom-align on mobile instead of fighting `items-end` with `my-auto`. `AuthModal` uses full-screen mobile presentation. Added Playwright coverage for mobile auth fullscreen and desktop auth card sizing. Handoff note: next P1 is custom overlay cleanup for `UpgradeModal`, `FileListPanel` delete confirmation, and `FlashcardsTab` settings; do not change their actions, only presentation/safe-area consistency. Rollback hint: remove `mobilePresentation` changes, restore AuthModal card layout, and delete the new app-shell auth assertion plus UI review doc entries.

> 이전 세션이 API 400 오류로 중단되어 새 세션에서 이어가기 위한 컨텍스트 기록.
> 작성: 2026-05-23 / 브랜치: `claude/affectionate-curie-fVBXy`

## 현재 상태 요약 (2026-05-23 갱신)

- `node_modules` 재설치 완료.
- **`npx tsc --noEmit` 0 오류** ✅ (아래 6개 오류 모두 해결됨).
- `npm run build` 통과 ✅ / `npm test` 통과(유닛 테스트 파일 없음) ✅.
- `tests/unit` 미존재, e2e smoke 1개만.

### 해결한 tsc 오류 6개 (이번 세션)

1. `Quiz.tsx`/`FRQuiz.tsx`: `onStudyTipsGenerated`를 optional로 변경 + 호출부 옵셔널 체이닝 → 채팅 인라인 Quiz prop 누락 해소.
2. `tsconfig.json` `lib`: `ES2022` → `ES2023` (`Array.findLast` 지원).
3. `DocumentContext.tsx`: `DocumentRow`의 `processing_state`/`model`을 `DocumentData[...]` 유니온 타입으로 보정.
4. `@netlify/functions` devDependency 설치 (`Handler` 타입).
5-6. `tsconfig.json` `types`에 `vite/client` 추가 (`import.meta.env`).

## 이전 세션이 하던 작업: 퀴즈 "Study Tips" 기능

퀴즈 완료 시 AI가 학습 팁을 생성해 보여주는 기능. 대부분 구현됐으나 한 군데가 미완성.

구현 완료된 부분:
- `services/geminiService.ts:315` `generateStudyTips()` 함수
- `components/Quiz.tsx`, `components/FRQuiz.tsx`: `studyTips?`, `onStudyTipsGenerated`(필수) prop 추가 + 완료 시 자동 생성 로직 + 렌더링
- `types.ts:121` `studyTips?: string`
- `components/InteractionPanel.tsx`: `handleStudyTipsGenerated` 핸들러, 퀴즈 **탭**(라인 603/614)에서 prop 전달 ✅

미완성:
- `components/InteractionPanel.tsx:507` **채팅 인라인 Quiz**에 `onStudyTipsGenerated`(및 `documentContent`/`onRestartWithNewData`/`studyTips`) 미전달 → tsc 오류.

## tsc 오류 6개 분류

1. `InteractionPanel.tsx:507` — 채팅 인라인 Quiz에 `onStudyTipsGenerated` 누락. **(미완성 기능)**
   - 해결안: `onStudyTipsGenerated`를 optional로 바꾸고 호출부 guard, 또는 인라인 Quiz에도 핸들러 전달. 채팅 인라인 퀴즈에는 `documentContent`가 없어 팁 생성 비적용이 자연스러움 → optional 처리 권장.
2. `InteractionPanel.tsx:497` — `Array.findLast` 미지원. tsconfig `lib`에 `ES2023` 추가 필요.
3. `DocumentContext.tsx:229` — `doc.processing_state`(string)가 `DocumentProcessingState`에 비할당. `DocumentRow` 타입 또는 캐스팅 보정 필요. **(기존 잠재 오류)**
4. `gemini.ts:1` — `@netlify/functions` 타입 모듈 없음. devDependency 미설치(빌드 산출물 아님).
5-6. `supabaseClient.ts:4-5` — `import.meta.env` 타입 없음. tsconfig `types`에 `vite/client` 추가 필요.

## 최근 커밋 (이 브랜치 = main + 아래)

- `29d7bc6` Add API & DB usage stats to admin dashboard
- `a7eb281` Add admin back-office and free/pro tier system
- `d953ebd` Standardize design consistency across pages

## 환경 / 규칙 (CLAUDE.md 발췌)

- `src/` 폴더 없음 — 모든 파일 루트.
- 라우트는 `routes.ts`의 `ROUTES.*` 사용.
- Gemini 호출은 `useAIGeneration` 훅 + Netlify Function 프록시(`/api/gemini`).
- 작업 완료 후: `npm run build` / `npm test` / `npx playwright test` / `npx tsc --noEmit`.
- 작업은 `claude/affectionate-curie-fVBXy` 브랜치에서 진행·커밋·푸시.

## 다음 작업 제안

1. study-tips 기능 런타임 동작 검증 (퀴즈 완료 → AI 팁 표시). 아직 브라우저 검증 미실시.
2. (선택) 유닛 테스트 추가 — 현재 `tests/unit` 없음.
