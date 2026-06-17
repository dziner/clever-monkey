# Clever Monkey TODO

이 파일은 Claude와 Codex가 함께 이어받는 작업 backlog다.

## 운영 원칙

- 새 작업 아이디어나 발견된 리스크는 먼저 여기에 등록한다.
- 처리 순서는 기본적으로 Priority 순서를 따르되, 사용자 테스트 결과와 운영 리스크에 따라 매번 재판단한다.
- Claude가 만든 메인 구조를 임의로 바꾸지 않는다. 구조 변경이 필요한 항목은 먼저 관측 데이터, 테스트, rollback 기준을 남긴다.
- 텍스트 레이어 PDF는 600페이지 이상 실제 테스트에서도 빠르게 처리되었으므로 페이지 수 제한을 추가하지 않는다. 페이지/용량 제한은 페이지 내용을 이미지로 읽어야 하는 PDF에만 적용한다.
- 완료한 항목은 `Done`으로 옮기고, 관련 커밋/검증/주의점을 짧게 적는다.

## Priority

### P0 - Next

현재 없음.

### P1 - Soon

현재 없음.

### P2 - Later

- [ ] `InteractionPanel.tsx` / `geminiService.ts` 고위험 분리 설계
  - 배경: 두 파일은 기능 추가 충돌 가능성이 높은 hotspot이지만, 채팅/퀴즈/팟캐스트/OCR 계약이 얽혀 있다.
  - 방향: prompt builders, generation transport, tab state hooks, quiz persistence를 순차 분리한다.
  - 주의: TTS single-narrator/sequential chunk와 OCR `queued -> ocr_ready -> done/error` 계약을 변경하지 않는다.
  - 진행: `DocumentContext` row mapper처럼 순수하고 테스트 가능한 경계부터 분리 완료. 실제 generation/upload state machine 분리는 아직 보류.

- [ ] inactive 계정 30일 경과 후 영구삭제/보존 정책 확정
  - 배경: 어드민 삭제는 현재 `inactive` 상태 전환 + 30일 복구 기한으로 구현한다.
  - 남은 결정: 30일 경과 후 자동 hard delete를 둘지, 관리자 수동 삭제만 둘지, 사용자 문서/스토리지/진단 로그 보존 기간을 어떻게 맞출지 정해야 한다.
  - 주의: `netlify/functions/delete-account.ts`의 사용자 본인 hard delete 경로와 혼동하지 않는다.

- [ ] 이미지 내용 기반 PDF 안내 문구 A/B 또는 문안 정리
  - 배경: "50페이지 제한"만 노출하면 파일 용량, 판형, 정보 밀도에 따른 차이를 설명하지 못해 혼란을 줄 수 있다.
  - 초안: `docs/PDF_UPLOAD_LIMIT_RESEARCH.md`의 Suggested User Copy 참고.

- [ ] 페이지 내용이 이미지로 구성된 PDF 60~70페이지 재테스트
  - 배경: 사용자 테스트에서 50페이지 성공, 80/100페이지 실패를 확인해 현재 제한을 50페이지로 보수 조정.
  - 방법: 60~70페이지 파일을 재테스트하고 `supabase/inspect_ocr_boundary_test.sql`로 `progressTrail`, `durationMs`, 마지막 stage 확인.
  - 판단: 반복 성공과 충분한 시간 여유가 있을 때만 `SCANNED_PDF_PAGE_LIMIT` 상향 검토.

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

- [x] 2026-06-17 리팩토링 4차: DocumentContext row mapper 분리
  - 배경: `DocumentContext.tsx`의 Supabase row -> `DocumentData` 변환이 provider 내부에 inline으로 있어, reload fallback 동작을 테스트하기 어려웠다.
  - 수정: `services/documentMapper.ts`에 `mapFolderRow`, `mapDocumentRow`, row 타입을 추가하고 `DocumentContext`는 이를 사용하도록 변경.
  - 테스트: `tests/unit/documentMapper.test.ts` 추가. legacy chat fallback, processing_state fallback, nullable column normalization, storage uploadState mapping을 고정.
  - 주의: documents/folders fetch, default folder creation, auth reload guard, background OCR state contract는 변경하지 않음.
  - 검증: `git diff --check`, `npx tsc --noEmit`, targeted mapper unit test, `npm test`, `npm run build`, `npx playwright test` 통과.

- [x] 2026-06-17 리팩토링 3차: public shell LegalFooter 분리
  - 배경: `IdleStateView.tsx` 안에 법적 링크/footer가 로컬 컴포넌트로 남아 있어 랜딩 화면 책임과 trust footer 책임이 섞여 있었다.
  - 수정: `components/LegalFooter.tsx`를 추가하고 `IdleStateView`는 이를 import하도록 변경.
  - 영향: 표시 문구, 링크, `useUser` 기반 언어 선택은 그대로 유지. 라우팅/auth/document state 변경 없음.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test` 통과.

- [x] 2026-06-17 리팩토링 2차: admin service boundary split
  - 배경: `profileService.ts`가 일반 프로필, admin user management, API/DB stats/recent error RPC를 함께 들고 있어 계속 커지고 있었다.
  - 수정: `services/adminService.ts`를 추가해 admin-only RPC/types를 분리하고, `services/profileMapper.ts`로 row mapper를 공유해 service 간 순환 import를 피함.
  - 영향: `profileService.ts`는 현재 로그인 사용자 profile CRUD만 담당. `AdminPage`, `Admin*` components, `utils/adminStats`, 관련 unit tests는 `adminService` type/function을 직접 참조.
  - 주의: Supabase SQL/RPC 계약, admin UI state ownership, soft-delete/restore 정책은 변경하지 않음.
  - 검증: `git diff --check`, `npx tsc --noEmit`, targeted admin unit tests, `npm test`, `npm run build`, `npx playwright test` 통과.

- [x] 2026-06-17 리팩토링 1차: app shell 안전망 복구 및 admin/user shell 경계 분리
  - 분석: 최근 히스토리와 handoff 기준으로 OCR/TTS/upload는 고위험 hotspot이므로 이번 패스에서는 건드리지 않음.
  - 문서: `docs/REFACTOR_PLAN.md`에 구조 진단, 위험 경계, 단계별 그룹(A-D), deferral 기준 기록.
  - Group A: Supabase env가 없는 dev/test에서도 public shell이 빈 화면이 되지 않도록 fallback client를 두고, production에서는 env 누락을 계속 fail-fast 처리.
  - Group A: `/privacy`, `/terms`, unknown route가 게스트 empty workspace에 막히지 않도록 public full-screen route guard를 추가하고 `appShell.spec.ts`를 최신 UI에 맞춤.
  - Group B: `InactiveAccountScreen`, `AdminStatCard`, `AdminUsersTab`을 분리해 `App.tsx`와 `AdminPage.tsx` 책임을 축소.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test` 통과.

- [x] 2026-06-17 어드민 회원 관리 soft-delete/restore 및 대시보드형 권한 관리
  - 요청: 관리자가 회원을 삭제할 수 있되, 실제 hard delete가 아니라 `inactive` 상태로 전환하고 30일 내 복구할 수 있게 한다.
  - DB: `supabase/add_admin_soft_delete.sql` 추가. `profiles.account_status`, `deactivated_at`, `deactivated_by`, `deactivation_reason`, `restore_until` 컬럼과 `admin_soft_delete_user`, `admin_restore_user` RPC를 추가.
  - UI: 어드민 사용자 탭을 활성 계정/삭제된 계정 섹션으로 분리하고, Pro/Admin 토글 버튼을 요금제/권한 select + 명시적 삭제 처리/복구 action으로 교체.
  - 보호: inactive 계정은 클라이언트에서 차단 화면을 보고, 새 SQL 적용 후 DB admin gate와 AI action increment도 active 계정만 통과.
  - 주의: 30일 경과 후 자동 hard delete/purge는 아직 정책 미확정이므로 P2로 분리.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test tests/e2e/smoke.spec.ts` 통과. `npx playwright test` 전체는 기존 `appShell.spec.ts` 기대값 불일치 8건으로 실패, smoke 2건은 통과.

- [x] 2026-06-17 첫 가이드 투어 3/4 이후 좌상단 고정 버그 수정
  - 현상: PC에서 첫 가이드 모달이 3번 단계부터 화면 좌상단에 고정되어 보임.
  - 원인: desktop/mobile 또는 collapsed/full 패널에 같은 `data-tour` anchor가 중복될 때, 숨겨진 0x0 요소가 먼저 측정될 수 있음.
  - 수정: tour layout이 실제 viewport 안에 보이는 anchor만 선택하고, 0x0/offscreen anchor는 centered fallback으로 처리.
  - 검증: Playwright fixture로 desktop 1024x768, mobile 390x844, mobile 360x640에서 3/4·4/4 card가 viewport 안에 있고 좌상단 고정이 아님을 확인.

- [x] 2026-06-17 첫 회원가입 이름 입력 모달 모바일 레이아웃 정리
  - 현상: 가입 직후 프로필 이름 입력 모달이 큰 카드/여백/CTA 높이 때문에 화면에서 깨져 보임.
  - 수정: `NamePromptModal`만 `sm` modal 폭으로 줄이고, 아이콘/본문/CTA spacing을 compact하게 조정.
  - 주의: 공통 `Modal`, `Input`, `Button` primitive는 변경하지 않아 다른 화면 영향 범위를 줄임.
  - 검증: Playwright fixture로 360x640, 390x844, 1024x768 viewport에서 overflow 없음, dialog/button viewport 내 표시 확인.

- [x] 2026-06-17 이미지 내용 기반 PDF 업로드 제한 정책을 다변수 preflight로 개선
  - 배경: 경쟁/유사 서비스 조사 결과, 스캔한 PDF는 페이지 수만으로 안정성을 설명하기 어렵고 파일 크기, 텍스트 추출 가능 여부, 페이지당 정보 밀도, 시각 처리/OCR 가능 여부가 함께 영향을 준다.
  - 문서: `docs/PDF_UPLOAD_LIMIT_RESEARCH.md`
  - 수정: image-content PDF에 50페이지 제한과 별도로 50MB OCR 파일 크기 제한을 추가.
  - 진단: preflight context에 `fileSizeBytes`, `bytesPerPage`, `riskFlags`, file/page limit 값을 남김.
  - 문구: 페이지 수만 원인처럼 보이지 않도록 스캔 해상도, 표/그림 밀도, 판형, 파일 용량에 따라 달라질 수 있음을 안내.
  - 주의: 텍스트 레이어 PDF의 빠른 로컬 추출 경로는 제한하지 않음.

- [x] 2026-06-17 팟캐스트 생성 기본 분량 확대 및 길이 옵션 추가
  - 요청: 기본 생성 분량이 짧으므로 현재 기준 2~3배 정도로 늘린다.
  - 수정: 기본 `표준` 길이를 약 750단어로 조정하고, `길게` 옵션은 약 1,200단어로 추가.
  - UI: 팟캐스트 composer에 `분량` segmented option을 추가. 기본값은 `표준`.
  - 주의: 기존 단일 화자 prompt와 sequential TTS chunk 처리 흐름은 유지.
  - 검증: `git diff --check`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test tests/e2e/smoke.spec.ts` 통과.

- [x] 2026-06-17 페이지 내용이 이미지로 구성된 PDF 제한값 50페이지로 조정
  - 근거: 같은 실패 원본을 자른 실제 테스트에서 50페이지는 성공, 80/100페이지는 실패.
  - 수정: `SCANNED_PDF_PAGE_LIMIT`를 200에서 50으로 낮춤. 텍스트 레이어 PDF는 계속 페이지 제한 없이 로컬 추출 경로를 사용.
  - 문서: `docs/OCR_BOUNDARY_TEST.md`, `supabase/inspect_ocr_boundary_test.sql`
  - 주의: 60~70페이지 재테스트 전에는 상향하지 않는다.
  - 검증: `tests/unit/pdfPreflightCheck.test.ts`에 50페이지 ceiling 고정 테스트 추가.

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
