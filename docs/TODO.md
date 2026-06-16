# Clever Monkey TODO

이 파일은 Claude와 Codex가 함께 이어받는 작업 backlog다.

## 운영 원칙

- 새 작업 아이디어나 발견된 리스크는 먼저 여기에 등록한다.
- 처리 순서는 기본적으로 Priority 순서를 따르되, 사용자 테스트 결과와 운영 리스크에 따라 매번 재판단한다.
- Claude가 만든 메인 구조를 임의로 바꾸지 않는다. 구조 변경이 필요한 항목은 먼저 관측 데이터, 테스트, rollback 기준을 남긴다.
- 완료한 항목은 `Done`으로 옮기고, 관련 커밋/검증/주의점을 짧게 적는다.

## Priority

### P0 - Next

현재 없음.

### P1 - Soon

- [ ] 페이지 내용이 이미지로 구성된 PDF의 OCR 실패 경계 테스트
  - 이유: 현재 200페이지 제한은 안정성 정책이며, 실제 실패 경계는 데이터가 부족하다.
  - 현재 상태: 사용자 테스트에서 50페이지 성공, 100페이지 실패, 80페이지 실패. 80페이지 실패 로그 누락 경로는 보강 완료, 같은 80페이지 재테스트 로그 확인 필요.
  - 방법: `supabase/inspect_ocr_boundary_test.sql`로 `diagnostic_events.context.progressTrail`과 `documents.processing_state` 확인.
  - 산출물: 페이지 수, 파일 크기, duration, 마지막 stage, textLength 기준으로 제한값 조정 여부 결정.

### P2 - Later

- [ ] `appShell.spec.ts` e2e 기대값 최신 UI에 맞게 갱신
  - 발견: 파일 리스트 UI 수정 검증 중 `npx playwright test`에서 smoke 2개는 통과했지만 `appShell.spec.ts` 8개가 실패.
  - 원인 후보: 현재 랜딩/법적 페이지/404 카피 또는 라우팅과 테스트 기대 문자열이 맞지 않음.
  - 주의: 이번 파일 리스트 hover overlay 변경과 직접 관련 없는 기존 테스트 정합성 문제로 분리.

- [ ] npm audit dependency hygiene
  - 현재 상태: `npm audit` reports 4 vulnerabilities in dev/build tooling (`vite`, `@vitejs/plugin-react`, `esbuild`, `@babel/core`).
  - 판단: 배포 런타임 즉시 취약점보다는 build-time/supply-chain 잠재 리스크로 분류.
  - 처리: `npm audit fix --force`는 Vite major upgrade를 유도하므로 별도 작업으로 `vite`, `@vitejs/plugin-react`, `vitest` 호환성을 함께 검증한다.
  - 검증: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, 필요한 e2e.

- [ ] IP rate-limit map pruning 검토
  - 출처: `docs/LOAD_TEST_REPORT.md`
  - 이유: 고유 IP가 매우 많을 때 웜 인스턴스 메모리가 증가할 수 있다.
  - 우선순위: 낮음. Netlify 콜드스타트 특성상 즉시 위험은 낮다.

## Done

- [x] 2026-06-16 파일 목록 항목 우측 버튼 예약 여백 제거
  - 현상: 수정/삭제 버튼이 보이지 않을 때도 flex 영역을 차지해 파일명이 지나치게 짧게 잘림.
  - 수정: `FileListItem`의 수정/삭제 버튼을 normal flow에서 absolute hover/focus overlay로 변경.
  - 효과: 평소에는 파일명/메타 영역이 전체 폭을 쓰고, hover/focus 시 버튼 pill이 오른쪽 위를 덮어 표시됨.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build` 통과. `npx playwright test`는 기존 `appShell.spec.ts` 기대값 문제로 8개 실패, smoke 2개 통과.

- [x] 2026-06-16 80페이지 이미지 내용 기반 PDF 실패 로그 누락 경로 보강
  - 현상: 50페이지 성공, 100페이지 실패, 80페이지 실패. 단 80페이지 실패는 로그에 기록되지 않음.
  - 가설: background OCR이 Netlify 15분 제한 등으로 종료되고, client poll timeout 경로가 UI error만 만들고 `diagnostic_events`/`documents`에 남기지 않는 관측성 구멍.
  - 수정: `useBackgroundProcessing` timeout 경로에서 documents row를 `error`로 patch하고 `processing.background_ocr.poll_timeout` diagnostic event를 남김.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build` 통과.

- [x] 2026-06-16 페이지 내용이 이미지로 구성된 PDF의 chunk OCR 설계 검토
  - 문서: `docs/OCR_CHUNK_DESIGN.md`
  - 결론: 기존 `queued -> ocr_ready -> done/error` state contract는 유지하고, 필요 시 feature flag 기반 prompt-range 실험부터 시작한다.
  - 주의: 실제 200페이지 테스트 로그가 `ocr_generate_*`/MAX_TOKENS/RECITATION 쪽 병목을 가리킬 때 구현 검토.

- [x] 2026-06-16 OCR 실패 경계 테스트 로그 분석 쿼리 추가
  - 문서: `docs/OCR_BOUNDARY_TEST.md`
  - SQL: `supabase/inspect_ocr_boundary_test.sql`
  - 상태: 실제 200페이지 업로드 결과 로그를 기다리는 중. 제한값은 아직 변경하지 않음.

- [x] 2026-06-16 Admin Error+Warn 토글 fallback 수정
  - 현상: SQL 미실행 상태에서 `p_include_warnings` RPC 호출이 실패해 Error+Warn 모드가 빈 상태처럼 보였다.
  - 수정: 새 RPC가 있으면 `p_include_warnings=true` 결과를 사용하고, 실패 시 error RPC + warning 직접 조회를 합쳐 표시.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run` 통과.

- [x] 2026-06-16 Supabase에서 `supabase/add_admin_recent_errors.sql` 재실행
  - 실행자: 사용자
  - 효과: admin recent errors RPC가 `diagnostic_events.context`와 `p_include_warnings`를 지원.

- [x] 2026-06-16 Admin recent log에 Error / Error+Warn 토글 추가
  - 기본 Error 모드는 기존 RPC와 호환되도록 error만 조회.
  - Error+Warn 모드에서만 `p_include_warnings=true`를 전달.
  - Warning row는 amber chip/hover로 표시.

- [x] 2026-06-16 이미지 내용 기반 PDF 제한 문구와 severity 정리
  - 사용자 문구를 "페이지의 내용이 이미지로 구성된 PDF 파일"로 변경.
  - 페이지 수 제한 diagnostic severity를 `warn`으로 변경.
  - StudyPage/FileListItem에서 해당 안내는 빨간 실패 화면 대신 amber 경고 톤으로 표시.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run` 통과.

- [x] 2026-06-16 OCR background progress trail 추가
  - `diagnostic_events.context`에 preflight metadata, duration, progressTrail 기록.
  - Admin recent error 상세에 compact `ocr:` summary 추가.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run` 통과.
