# Kopay-style 디자인 & 인터랙션 가이드라인 (MUST-FOLLOW)

> 이 문서는 **강제 규칙(spec)** 이다. 바이브코딩 시 항상 참조하고, "되도록"이 아니라 **반드시** 지킨다.
> 목표: Kopay에서 느낀 "정갈하고 완성도 높은 핀테크 룩앤필 + 부드러운 인터랙션"을 다른 서비스에 1:1로 이식.
> 핵심 철학: **토큰을 어긴 순간 미려함이 깨진다.** 임의값(magic number) 금지. 모든 값은 아래 토큰에서만 고른다.

---

## 0. 절대 원칙 (TL;DR — 이것만 어겨도 룩앤필 붕괴)

1. **여백은 4px 배수만.** `13px`, `7px` 같은 값 금지. (4·8·12·16·20·24·…)
2. **그림자는 사실상 1종**(`0 1px 2px rgba(0,0,0,.05)`). 면 분리는 그림자가 아니라 **배경톤 + 라운드 + 보더**로.
3. **위계는 색이 아니라 굵기로.** 본문은 거의 다 16px, 강약은 400/600/800 웨이트 대비로.
4. **컬러는 토스 그레이 램프 + 오렌지 브랜드만.** 채도 높은 색 남발 금지.
5. **롤링/전환은 `transform + transition 500ms ease-in-out`.** `left/top/margin` 애니메이션 금지(리플로우).
6. **폰트는 Pretendard.** (아래 §2 필수 적용)
7. **모바일 퍼스트 고정폭.** 줌 비활성, `viewport-fit=cover`.
8. **아이콘은 단일 세트(Phosphor)만.** 세트 혼용 금지.

---

## 1. 컬러 시스템 (MUST)

채워야 할 곳에만 토큰을 쓴다. HEX 직접 입력 금지 — 변수/Tailwind 토큰으로만.

### 1.1 브랜드 (오렌지 램프)
| 토큰 | HEX | 용도 |
|------|-----|------|
| `brand/tint-50` | `#FFF9F6` | 가장 옅은 배경 |
| `brand/tint-100` | `#FFF4EB` | 배지/섹션 강조 배경 |
| `brand/alpha-10` | `rgba(255,145,77,.1)` | 칩/배지 배경(예: "+5% 리워드") |
| **`brand/500`** | **`#FF914D`** | **주 버튼, 활성 탭, 강조 아이콘 (기본 브랜드색)** |
| `brand/hover` | `#FF7A2E` | hover |
| `brand/strong` | `#FF6B00` | 그라데이션/강한 강조 |
| `brand/pressed` | `#E85F30` | 눌림 상태 |

> 브랜드색은 **점이 아니라 램프**다. 버튼 default→hover→pressed는 반드시 `#FF914D → #FF7A2E → #E85F30` 순서로.

### 1.2 그레이 (토스 램프 — 그대로 사용)
| 토큰 | HEX | 역할 |
|------|-----|------|
| `gray/900` | `#191F28` | 제목/최강조 텍스트 |
| `gray/800` | `#333D4B` | 본문 강조 |
| `gray/700` | `#4E5968` | 기본 본문 |
| `gray/500` | `#8B95A1` | 보조 텍스트 |
| `gray/400` | `#B0B8C1` | 비활성/플레이스홀더 |
| `gray/300` | `#C4C9D1` | 보더 |
| `gray/250` | `#D1D6DB` | 보더(연함) |
| `gray/200` | `#E5E8EB` | 디바이더/라인 |
| `gray/150` | `#F2F4F6` | 보조 면(칩/소형 카드 배경) |
| `gray/100` | `#F9FAFB` | 옅은 배경 |
| `gray/50` | `#F7F8FA` | **페이지 기본 배경** |
| white | `#FFFFFF` | **카드/시트 배경** |

### 1.3 시맨틱
| 토큰 | HEX | 용도 |
|------|-----|------|
| `info` | `#1B64DA` | 링크/정보 |
| `info-tint` | `rgba(27,100,218,.1)` | 정보 배지 배경 |

### 1.4 역할 매핑 (반드시 이 매핑대로)
- 페이지 배경 = `gray/50` `#F7F8FA` / 카드 = `white`. **이 톤 차이로 면을 나눈다.**
- 제목 = `gray/900`, 본문 = `gray/700`, 보조 = `gray/500`, 비활성 = `gray/400`.
- 보더/디바이더 = `gray/200`. 칩 배경 = `gray/150`.
- 주 CTA = `brand/500`, 눌림 = `brand/pressed`. 리워드/혜택 배지 = `brand/alpha-10` 배경 + `brand/strong` 텍스트.

---

## 2. 폰트 = Pretendard (MUST)

> 원본 Kopay는 시스템 폰트를 썼지만, **본 가이드는 Pretendard를 의무화**한다. 한글 자간/굵기 일관성이 미려함의 핵심.

### 2.1 적용
```css
/* Pretendard Variable 권장 (CDN) */
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.min.css");

:root {
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
    system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
}
html, body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
```
```js
// tailwind.config.js
fontFamily: { sans: ['"Pretendard Variable"','Pretendard','-apple-system','BlinkMacSystemFont','system-ui','"Apple SD Gothic Neo"','"Noto Sans KR"','sans-serif'] }
```
규칙:
- **모든 텍스트는 Pretendard.** 폰트 세트 혼용 금지(숫자도 Pretendard, 별도 모노 폰트 쓰지 말 것).
- 숫자가 흔들리지 않게 금액/카운터에는 `font-variant-numeric: tabular-nums` 적용.
- `letter-spacing`은 건드리지 않는다(Pretendard 기본값 유지). 한글에서 자간 임의 조정 금지.

### 2.2 타이포 스케일 (위계는 굵기로)
| 역할 | size | weight | line-height | 색 |
|------|------|--------|-------------|----|
| Hero 헤드라인 | 28px | 800 | 1.3 | gray/900 |
| 섹션 타이틀 | 18–20px | 700 | 1.35 | gray/900 |
| 서브헤드 | 16px | 600 | 1.4 | gray/800 |
| **본문(기본)** | **16px** | **400** | **1.5** | gray/700 |
| 금액/강조 | 16px | 800 | 1.4 | gray/900 |
| 보조/캡션 | 13px | 400 | 1.45 | gray/500 |
| 배지/마이크로 | 11–12px | 400–600 | 1.4 | 문맥색 |

규칙:
- **본문 기본은 16px.** 사이즈를 늘리기 전에 **굵기(400→600→800)부터** 올려 위계를 만든다.
- 허용 사이즈: 10·11·12·13·14·15·16·17·18·20·22·24·26·28·… (이 목록 밖 사이즈 금지).
- 허용 웨이트: 400 / 600 / 700 / 800 (필요시 500·900). 그 외 금지.
- line-height는 1.3(타이틀)~1.5(본문) 범위에서만.

---

## 3. 스페이싱 & 레이아웃 (MUST)

### 3.1 스페이싱 스케일 = 4px 베이스 (Tailwind 기본)
허용값(px): **2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64**.
- 컴포넌트 **내부 패딩**: 카드 16px(`p-4`), 큰 카드/시트 20–24px.
- 요소 **간 간격**: 관련 요소 8px, 그룹 간 16px, 섹션 간 24–32px.
- 리스트 아이템 세로 간격 12–16px, 가로 스크롤 카드 간 12px.
- **절대 금지**: 5/7/13/15/18px 같은 비스케일 값.

### 3.2 레이아웃 골격
- **모바일 퍼스트 단일 컬럼.** 콘텐츠 좌우 패딩 16px(`px-4`) 고정.
- 뷰포트 메타: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover` (줌 비활성 + 노치 대응).
- **하단 고정 탭바**(4탭 권장): 활성 탭 아이콘/라벨 = `brand/500`, 비활성 = `gray/400`. safe-area 패딩(`env(safe-area-inset-bottom)`) 반영.
- 상단 헤더: 좌측 back(←), 중앙 타이틀(16px/700), 우측 액션. 높이 일정하게.
- 섹션 = "타이틀(좌) + 더보기 →(우)" 헤더 + 콘텐츠. 더보기는 `gray/500`.

### 3.3 면 분리 규칙 (그림자 대신 톤)
1. 페이지 배경 `gray/50` 위에 `white` 카드를 얹는다.
2. 카드는 **라운드 + (옵션) `gray/200` 1px 보더 + 약그림자 1종**.
3. 칩/태그는 `gray/150` 배경 + 라운드 pill.
> 떠 있는 느낌을 그림자로 강조하지 말 것. 톤·라운드로 충분하다.

---

## 4. 모양: 라운드 & 그림자 (MUST)

### 4.1 Radius
| 토큰 | 값 | 용도 |
|------|----|----|
| sm | 6–8px | 작은 요소/인풋 일부 |
| lg | 14px | 일반 카드/입력 |
| xl | 18px | 중형 카드 |
| 2xl | 24px | 대형 카드/바텀시트 |
| pill | 9999px | 배지·칩·필터 탭·일부 CTA |
규칙: 카드 기본은 **14px 또는 24px**. 칩/배지/세그먼트는 **무조건 pill(9999)**.

### 4.2 Shadow (3종만, 사실상 card 1종)
```
card:       0 1px 2px 0 rgba(0,0,0,0.05)      /* 거의 모든 카드 */
sheet:      0 20px 60px -15px rgba(0,0,0,0.08) /* 모달/바텀시트 */
brand-glow: 0 8px 48px 0 rgba(255,145,77,0.35) /* 핵심 CTA에만, 아껴서 */
```
이 외 그림자 신규 정의 금지.

---

## 5. 인터랙션 & 모션 (MUST — "부드러움"의 핵심)

### 5.1 트랜지션 토큰
- duration: **100 / 200 / 300 / 500 / 700ms** 만 사용.
- easing: `ease-in-out`(이동/슬라이드), `ease-out`(등장), `ease-in`(퇴장).
- 기본 hover/색 변화 = `transition-colors duration-200`.
- 눌림 = `active:scale-[.98]` + `transition-transform duration-100~200`.

### 5.2 롤링 캐러셀 (배너/카드) — 반드시 이 방식
```
- 트랙: flex, 슬라이드당 width 100%
- 이동: transform: translateX(-100% * index)   ← left/margin 쓰지 말 것
- 트랜지션: transition-transform duration-500 ease-in-out
- 자동재생: setInterval로 index = (index+1) % length   (modulo 무한 루프)
  · 히어로 배너: 3500ms
  · 텍스트/소형 롤: 4000ms
- 터치 스와이프: touchstart에서 clientX 저장 → touchend 델타가 |Δ| ≥ 50px면 prev/next
- 인디케이터: "1 / N" 또는 dot. 활성 dot = brand/500
```
> 서로 다른 주기(3.5s·4s)의 롤링이 동시에 돌면 화면이 "살아있게" 느껴진다 — 의도적으로 주기를 어긋나게 둔다.

### 5.3 데이터 갱신
- 잔액/리워드 등 라이브 수치는 **30초(30000ms) 폴링**으로 조용히 업데이트(깜빡임 없이 값만 교체).

### 5.4 로딩 / 상태
- 로딩 스피너: `@keyframes spin 1s linear infinite`.
- 스켈레톤: `@keyframes pulse 2s cubic-bezier(.4,0,.6,1) infinite` (회색 블록 `gray/150`).
- **커스텀 keyframes는 이 2개(spin/pulse) 외 만들지 않는다.** 나머지 모션은 전부 transition 기반.

### 5.5 페이지 전환
- 라우트 전환은 fade/slide 가벼운 트랜지션(150–300ms). 과한 패럴랙스·바운스 금지.

### 5.6 미세 인터랙션 체크리스트 (반드시 적용)
- [ ] 모든 탭/버튼/카드 클릭 요소에 `active:scale-[.98]` + `transition`.
- [ ] hover 가능한 환경에선 `transition-colors duration-200`.
- [ ] 가로 스크롤 리스트는 `scroll-snap`(snap-x mandatory) 적용.
- [ ] 배지/칩은 pill + `brand/alpha-10` 배경.
- [ ] 금액 표기 `tabular-nums`로 자릿수 흔들림 제거.

---

## 6. 아이콘 (MUST)
- **단일 세트: Phosphor Icons** (`@phosphor-icons/*`). 다른 세트와 혼용 금지.
- 굵기는 한 가지(regular 또는 bold) 통일. 크기는 4px 스케일(16/20/24px).
- 탭바 아이콘 활성 = `brand/500`, 비활성 = `gray/400`.

---

## 7. 컴포넌트 레시피 (복붙용 패턴)

### 7.1 Primary 버튼
```html
<button class="w-full h-14 rounded-2xl bg-[#FF914D] text-white text-base font-bold
               transition-transform duration-150 active:scale-[.98]
               hover:bg-[#FF7A2E]">
  입장
</button>
```

### 7.2 리워드 배지(칩)
```html
<span class="px-2 py-1 rounded-full text-xs font-semibold
             bg-[rgba(255,145,77,.1)] text-[#FF6B00]">+5% 리워드</span>
```

### 7.3 카드
```html
<div class="bg-white rounded-2xl p-4 shadow-[0_1px_2px_0_rgba(0,0,0,.05)]
            border border-[#E5E8EB]">…</div>
```

### 7.4 섹션 헤더
```html
<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-bold text-[#191F28]">기프티콘</h2>
  <button class="text-sm text-[#8B95A1]">더보기 →</button>
</div>
```

### 7.5 롤링 캐러셀(요지)
```html
<div class="overflow-hidden">
  <div class="flex transition-transform duration-500 ease-in-out"
       :style="{ transform: `translateX(-${index*100}%)` }">
    <div class="w-full shrink-0" v-for="s in slides">…</div>
  </div>
</div>
```
```js
setInterval(() => { index.value = (index.value + 1) % slides.length }, 3500)
```

---

## 8. 금지 사항 (DON'T)
- ❌ 4px 비배수 여백(5/7/13/15/18px)
- ❌ 그림자 남용 / 신규 그림자 정의
- ❌ 사이즈로만 위계 만들기(굵기 먼저)
- ❌ 채도 높은 보조 색 추가(팔레트 밖 색)
- ❌ `left/margin/top` 애니메이션 (transform만)
- ❌ 아이콘 세트 혼용
- ❌ Pretendard 외 폰트 / 임의 자간
- ❌ spin·pulse 외 커스텀 keyframes 난발
- ❌ 과한 바운스/패럴랙스/오버스크롤 효과

---

## 9. 빠른 검수 체크리스트 (PR/완성 전)
- [ ] 모든 색이 §1 토큰에서 나왔는가
- [ ] 폰트가 Pretendard이고 금액에 tabular-nums가 걸렸는가
- [ ] 모든 여백이 4px 배수인가
- [ ] 본문 16px / 위계가 굵기로 표현됐는가
- [ ] 카드가 톤+라운드로 분리되고 그림자는 card 1종인가
- [ ] 클릭 요소에 active:scale + transition이 있는가
- [ ] 캐러셀이 translateX + 500ms ease-in-out + modulo + 스와이프 50px인가
- [ ] 아이콘이 Phosphor 단일 세트인가
- [ ] 페이지 배경 #F7F8FA / 카드 #FFFFFF 인가
