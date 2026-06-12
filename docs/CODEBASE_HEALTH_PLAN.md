# Clever Monkey 코드베이스 건강 진단 및 개선 계획

작성일: 2026-06-12

## 1. 서비스 방향성 컨센서스

이전 Claude 진행 문맥(`SESSION_HANDOFF.md`, `docs/SWOT_AND_ROADMAP.md`)과 현재 구현 상태를 기준으로, Clever Monkey의 제품 정체성은 다음으로 합의한다.

- 단순 PDF 요약기가 아니라, 업로드한 학습 자료를 중심으로 요약, 대화, 퀴즈, 오답 복습, 플래시카드, 마인드맵, 팟캐스트까지 이어주는 AI 학습 동반자다.
- 차별화 요소는 몽키 페르소나, 다국어 지원, 모바일 1급 UX, 인지심리 기반 학습 루프(퀴즈 종료, 오답 복습, 간격 반복, 진행 대시보드)다.
- 상용화 관점의 핵심 품질은 신뢰 레이어(계정 관리, 법적 페이지, 삭제), 대용량 자료 처리 안정성, 무료 API 한도 절약, 실패 시 학습자를 탓하지 않는 안내다.
- 따라서 리팩토링은 “큰 프레임워크 교체”보다 학습 루프와 문서 처리 안정성을 해치지 않는 작은 경계 정리부터 진행한다.

## 2. 현재 구조 진단

현재 구조는 Vite 루트형 React 앱으로, `src/` 없이 루트의 도메인 폴더를 사용한다. 이 관례는 유지한다.

주요 집중 파일:

- `services/uiStrings.ts`: 11개 언어 키가 한 파일에 집중되어 있다. 누락 감지는 쉽지만 파일이 커져 탐색 비용이 높다.
- `components/InteractionPanel.tsx`: 채팅, 퀴즈, 마인드맵, 플래시카드, 팟캐스트 진입을 모두 조율해 변경 충돌 위험이 높다.
- `services/geminiService.ts`: 클라이언트 AI 요청, PDF 텍스트 추출, 프롬프트 예산, JSON repair가 섞여 있다.
- `contexts/DocumentContext.tsx`: Supabase load/download/sync와 문서 reducer가 함께 있어 데이터 계약 변경 시 영향 범위가 넓다.
- `netlify/functions/lib/shared.ts`: 서버 라우팅, 키풀, rate limit, Supabase RPC 유틸이 잘 모였지만 타입 경계가 중요하다.

## 3. 이번 단계에서 선택한 개선

이번 단계는 이미 해결한 대용량 업로드 안정화의 연장선에서, 회귀 위험이 낮고 서비스 목표와 맞는 정리를 수행한다.

- 대용량 PDF 실패를 재유발할 수 있는 브라우저 PDF 재압축 유틸 제거.
- 더 이상 사용하지 않는 `jsPDF`, `html2canvas`, `lottie-player`, AI Studio import map 제거.
- favicon을 Vite 기본값에서 Clever Monkey 브랜드 자산으로 교체.
- Supabase env presence 로그를 개발 환경으로 제한.
- Supabase row mapper와 Gemini/Netlify 경계의 `any`를 구체 타입으로 축소.
- pdf.js CDN global 접근을 명시 타입으로 감싼다.

## 4. 다음 단계 권장 순서

1. `InteractionPanel.tsx` 분리
   채팅 메시지 렌더링, 탭별 생성 핸들러, 퀴즈 persistence를 작은 훅/컴포넌트로 나눈다.

2. `geminiService.ts` 분리
   `documentExtraction`, `jsonParsing`, `promptBuilders`, `generationApi`로 나눠 AI 기능 추가 시 충돌을 줄인다.

3. i18n 구조 개선
   키는 유지하되 feature별 섹션 또는 파일 생성 스크립트를 도입해 11개 언어 누락을 더 빨리 발견한다.

4. 문서 처리 observability
   업로드 방식(standard/TUS), 추출 방식(local text/Files API OCR), 실패 원인을 문서 상태에 저장해 고객 지원과 디버깅을 쉽게 한다.

5. 학습 루프 고도화
   진행 대시보드와 플래시카드/오답 데이터를 연결해 “오늘 할 일”을 Overview 첫 화면에 노출한다.

## 5. 변경 원칙

- 문서 처리 안정성, 학습 데이터 보존, 계정 신뢰 레이어를 최우선으로 둔다.
- 큰 파일 분할은 테스트와 함께 별도 PR/커밋 단위로 진행한다.
- 사용자가 보는 실패 문구는 기술 코드보다 행동 가능한 안내를 우선한다.
- AI API payload는 항상 예산을 둔다. 전체 원문을 매 요청마다 보내는 구조는 피한다.
