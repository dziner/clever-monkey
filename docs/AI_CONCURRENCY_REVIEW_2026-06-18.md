# AI Concurrency Review - 2026-06-18

## Trigger

사용자 테스트에서 팟캐스트 생성 중 퀴즈 생성을 시작하면 오류가 발생했다. 증상은 순간적으로 AI 요청 부하가 몰릴 때 재현되는 것으로 보인다.

## Root Cause

이번 문제는 외부 무료/preview API의 한계만으로 보기는 어렵다. 앱 구조에도 명확한 취약점이 있었다.

- 각 탭이 자기 `loading` 상태만 관리했다.
  - 팟캐스트 스크립트, 팟캐스트 음성, 퀴즈, 마인드맵, 플래시카드, 채팅이 서로의 진행 상태를 몰랐다.
  - 사용자가 탭을 바꿔 다른 생성 버튼을 누르면 요청이 동시에 나갈 수 있었다.
- 서버 라우터에는 provider fallback이 있지만, per-user/per-document 작업 직렬화는 없다.
  - 예: `podcast`와 `quiz` 모두 첫 단계에서 Gemini 계열로 들어갈 수 있어 같은 무료 tier/key/quota pressure를 동시에 받을 수 있다.
  - fallback은 실패 이후의 회복 장치이지, 동시 시작 자체를 막는 장치는 아니다.
- 팟캐스트 음성 합성은 기본적으로 순차 처리지만, split-half fallback에서 두 half를 `Promise.all`로 동시에 요청하는 작은 burst 지점이 있었다.
- 서술형 채점은 답안 수만큼 `Promise.all`로 채점을 동시에 실행해, 질문 수가 많을수록 burst가 커질 수 있었다.

결론: 실제 장애는 외부 모델/무료 tier의 rate limit 또는 preview TTS 불안정성과, 클라이언트의 전역 AI 작업 조율 부재가 겹친 결과로 보는 것이 맞다.

## Implemented Guard

이번 패치에서 `AiJobProvider`를 추가해 `InteractionPanel` 아래 AI 작업을 하나의 슬롯으로 조율한다.

동시에 시작하지 못하도록 막은 작업:

- 채팅 답변 생성
- 퀴즈 생성
- 마인드맵 생성
- 플래시카드 생성
- 팟캐스트 스크립트 생성
- 팟캐스트 음성 합성
- 퀴즈 완료 후 자동 학습 팁 생성
- 서술형 퀴즈 채점

사용자가 다른 생성 작업 중 버튼을 누르면, 실제 오류로 처리하지 않고 회색 안내 메시지로 "현재 어떤 AI 생성 중인지"를 알려준다.

## Burst Reduction

- `FRQuiz` 채점은 `Promise.all` 병렬 처리에서 순차 처리로 변경했다.
- TTS split-half fallback은 두 half를 병렬 요청하지 않고 순차 요청하도록 변경했다.

이 변경은 전체 완료 시간을 조금 늘릴 수 있지만, 실패율을 높이는 순간 요청 피크를 낮추는 목적이다.

## Remaining Risk

- 현재 guard는 같은 React app session 안에서만 동작한다.
  - 같은 사용자가 브라우저 탭을 두 개 열거나, 다른 기기에서 동시에 생성하면 막지 못한다.
- Netlify 함수는 stateless/serverless라 단순 in-memory lock은 안정적인 전역 락이 아니다.
- 무료/preview provider quota가 이미 소진된 경우에는 직렬화해도 실패할 수 있다.

## Future Option

실사용에서 multi-tab/multi-device 충돌이 계속 보이면 다음 단계는 server-side durable job lock이다.

권장 방향:

- Supabase에 `ai_generation_jobs` 또는 document/user scoped lock table 추가.
- RPC로 `try_acquire_ai_job_lock(user_id, document_id, job_kind, ttl_seconds)` / `release_ai_job_lock(job_id)` 제공.
- Netlify function이 provider 호출 전 lock을 확인하고, lock 획득 실패 시 409/429와 재시도 가능 메시지를 반환.
- TTL 만료로 orphan lock을 자동 회수.

이 단계는 DB schema/RPC/API error contract를 바꾸므로, 지금보다 위험도가 높다. 현재는 클라이언트 세션 내 충돌 방지가 더 낮은 위험의 1차 안전장치다.
