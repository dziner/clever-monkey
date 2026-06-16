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
