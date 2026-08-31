# 논점 — 회의 논점 시각화 서비스

회의를 **트리로 기록**한다. 논의 주제가 노드가 되고, 그 주제에 대한 각 발언이 자식 노드로 붙는다.
발언 중 하나가 새로운 쟁점이면 그 자리에서 주제로 승격시킨다.
회의가 끝나면 트리에서 **결론과 미결이 자동으로 추려진다.**

> **설계 제1원칙 — 즉시성.** 회의는 사람을 기다려주지 않는다. 기록자가 화면을 찾아 헤매는 순간
> 기록은 끊긴다. 모든 입력은 캔버스를 벗어나지 않고, 최소 조작으로 끝나야 한다.

구현 기준 문서는 [`docs/prd.pdf`](docs/prd.pdf) (PRD v1.0)이며, 화면 동작의 근거는
확정된 프로토타입 [`docs/prototype/논점 - 회의 논점 시각화 서비스.dc.html`](docs/prototype)이다.

---

## 실행

```bash
npm install
npm run dev          # http://localhost:5173
```

AI 요약까지 함께 쓰려면 API 키를 넣고 프록시 서버를 같이 띄운다.

```bash
cp .env.example .env      # ANTHROPIC_API_KEY 채우기
npm run dev:all           # 웹 + AI 서버 동시 실행
```

키가 없거나 서버가 꺼져 있어도 **앱은 온전히 동작한다.** AI 요약은 규칙 기반 로컬 요약기로
자동 우회하며, 요약 칸은 언제나 직접 편집할 수 있다 (PRD §8).

```bash
npm run build        # 프로덕션 번들
npm run preview      # 번들 확인
npx tsc --noEmit     # 타입 검사
```

**세 가지 기능은 전부 선택이고, 없으면 앱이 그만큼만 조용히 줄어든다.**

| 없을 때 | 결과 |
|---|---|
| AI 서버 | 로컬 규칙 요약기로 우회. 요약 칸은 언제나 수동 편집 |
| Firebase 설정 | 로컬 전용 모드. 회의는 `localStorage`에만 남는다 |
| 로그인 | 클라우드 저장 안 함. 회의 진행에는 영향 없음 |

---

## 배포 (GitHub Pages)

`main`에 푸시하면 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)이
타입 검사 → 빌드 → Pages 배포를 돌린다. 최초 1회만 아래를 해주면 된다.

1. **저장소 Settings → Pages → Source: `GitHub Actions`**
2. **Settings → Secrets and variables → Actions → Variables** 에 Firebase 웹 설정 6개를 넣는다
   (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`).
   비워두면 로컬 전용 모드로 빌드된다.

배포 주소는 `https://<사용자>.github.io/nonjeom/` 이다. `BASE_PATH`를 워크플로에서 넘겨
Vite `base`를 저장소 이름에 맞추고, `404.html`을 `index.html` 사본으로 두어 하위 경로 진입도 받는다.

> **알아둘 것 두 가지.**
> - **비공개 저장소에서 Pages를 쓰려면 GitHub Pro 이상**이 필요하다. Free 플랜이면 저장소를
>   공개로 바꿔야 한다.
> - **Pages 사이트 자체는 누구나 접근 가능**하다(접근 제어가 붙는 Private Pages는 Enterprise 전용).
>   저장소가 비공개여도 배포된 앱은 공개된다. 다만 배포되는 건 `dist/`뿐이라
>   `docs/`의 PRD·프로토타입 자료는 올라가지 않는다.

**AI 요약은 배포본에서 로컬 요약기로 동작한다.** Pages는 정적 호스팅이라 `server/index.ts`가
설 자리가 없다 — `/api/ai/*` 요청이 404가 나면 클라이언트가 즉시 로컬로 우회한다(설계대로).
배포본에서도 Claude 요약을 쓰려면 프록시를 따로 올리고(Cloud Run·Functions·Workers 등)
`src/lib/ai.ts`의 호출 주소를 그쪽으로 돌리면 된다.

---

## 데이터베이스 (Firestore)

**로컬 우선, 클라우드 동기화.** PRD §9가 권한 구조 그대로다 — `localStorage`가 회의 중
진실의 원본이고, Firestore는 그 위에 얹혀 **회의 단위 저장·목록·재열람**을 담당한다
(PRD §11의 후속 논의 항목에 대한 답).

- 로컬 저장은 변경 후 0.6초, 클라우드 동기화는 4초 간격으로 밀어낸다. 회의록이 생성되는
  순간에는 주기를 기다리지 않고 즉시 저장한다.
- 클라우드 저장이 실패해도 **회의는 멈추지 않는다.** 로컬 기록이 남아 있고, 헤더의 표시가
  빨간색으로 바뀐다(눌러서 재시도).
- 세팅 화면에서 지난 회의를 열면 그 문서로 이어서 쓴다.

### 최초 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만든다.
2. **Authentication → Sign-in method → Google** 을 켠다.
3. **Authentication → Settings → Authorized domains** 에 `<사용자>.github.io` 를 추가한다.
   (안 하면 배포본에서 로그인 팝업이 막힌다.)
4. **Firestore Database** 를 만든다 (프로덕션 모드).
5. 규칙과 색인을 배포한다.
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes --project <프로젝트 id>
   ```
6. 웹 앱을 등록하고 `firebaseConfig` 값을 `.env`(로컬)와 저장소 Variables(배포)에 넣는다.

### 문서 구조

```
meetings/{meetingId}
  ownerId          로그인한 사용자 uid — 접근 제어의 근거
  title, screen, participants[], agendas[]
  nodes[]          회의 트리 전체 (PRD §4 데이터 모델)
  labels[]         캔버스 자유 텍스트
  seq, labelSeq, partSeq, startedAt, elapsed
  collapsed, wrap, wrapIds, wrapOrig
  topicCount, uttCount, openCount   목록용 집계 (문서를 통째로 읽지 않으려고)
  slidesLocalOnly  장표 이미지가 빠졌는지
  updatedAt        serverTimestamp
```

[`firestore.rules`](firestore.rules)는 `ownerId == request.auth.uid` 하나로 잠근다 —
자기 회의만 읽고 쓰며, 수정 시 소유자를 바꿔치기할 수 없다. 그 밖의 모든 경로는 막혀 있다.
Firebase 웹 설정값은 비밀이 아니다(클라이언트 번들에 그대로 실린다). **접근 제어는 전적으로
이 규칙이 한다.**

> **장표 이미지는 Firestore에 올라가지 않는다.** 한 장이 수백 KB인 data URI라 문서 한계
> (1MB)를 즉시 넘긴다. 노드 자체는 남기고 이미지만 떼어내므로 회의록 구조는 어느 기기에서든
> 온전히 열리고, 그림만 올린 기기에 남는다(`slidesLocalOnly` 표시). Firebase Storage로
> 옮기는 것이 정공법이며 후속 과제다.

---

## 화면

| 화면 | 하는 일 | PRD |
|---|---|---|
| 세팅 | 제목 · 참석자 · 안건 · 발표 자료(PDF·이미지) | §5.1 |
| 캔버스 | 트리 기록, 발언 입력, 상태·결론 관리 | §5.2–5.7 |
| 미결 정리 | 남은 미결을 하나씩 결정·보류·떡밥·다음 회의로 처리 | §5.8 |
| 회의록 | 상태별로 정리된 회의록 + 텍스트 복사 | §5.8 |

## 조작 (피그마 손버릇 그대로)

| 조작 | 동작 |
|---|---|
| `Space` + 드래그 / 휠 클릭 드래그 | 캔버스 이동 |
| 휠 / `⇧`+휠 | 세로 / 가로 이동 |
| `⌘`·`Ctrl` + 휠 | 커서 기준 확대·축소 (30–200%) |
| `F` | 일단 적어두기 |
| `T` | 텍스트 도구 (빈 곳을 드래그해 영역을 그린다) |
| 노드 텍스트 더블클릭 | 그 자리에서 편집 |
| `↑` / `↓` | 선택된 노드의 순서 변경 (하위 발언이 함께 이동) |
| `Del` / `Backspace` | 선택된 노드·텍스트 박스 삭제 |
| `⌘`·`Ctrl` + `Z` | 되돌리기 (최대 60단계) |
| `Esc` | 가장 안쪽 레이어 하나만 닫기 |
| `⌘`·`Ctrl` + `V` | 클립보드 이미지를 장표 노드로 |
| 노드 우측 `+` → `Tab` → `⌘⏎` | 발언 한 건 추가 (조작 3회, 화면 이동 0회) |

노드를 끌어 놓으면 세 가지 결과 중 하나다 — **다른 노드 근처**(반경 72px)면 그 노드의 자식으로,
**빈 곳**이면 최상위 안건으로, **원래 자리**면 취소.

---

## 구조

```
src/
  App.tsx              상태 소유자. 전역 입력·레이아웃 실측·되돌리기·저장을 담당한다
  api.ts               화면이 호출하는 동작 인터페이스 (App이 구현)
  types.ts             데이터 모델 (PRD §4)
  constants.ts         상태 색·존 규격·스냅 반경 등 수치 상수
  theme.ts             Ant Design 토큰 (PRD §9 디자인 시스템)
  lib/
    layout.ts          트리 레이아웃. 좌표는 저장하지 않고 매 렌더 계산한다 (CV-1)
    ai.ts              AI 호출 + 로컬 우회
    summarize.ts       규칙 기반 로컬 요약기
    pdf.ts             PDF·이미지 → 장표 노드 (§7)
    persist.ts         로컬 우선 저장 (§9 데이터 유실)
    firebase.ts        Firebase 지연 초기화 + 구글 로그인
    cloud.ts           Firestore 회의 저장소 (저장·목록·재열람)
    text.ts            참석자 표시·시각·IME 판정
  screens/             Setup · Meeting · Wrap · Minutes
  components/          NodeCard · ComposePopover · QuickNote · SidePanel · CanvasLabels · CloudBar
server/
  index.ts             Claude 프록시 (브라우저에 키를 두지 않기 위한 얇은 층)
firestore.rules        접근 제어 — 자기 회의만 읽고 쓴다
firestore.indexes.json ownerId + updatedAt 복합 색인 (지난 회의 목록용)
.github/workflows/
  deploy.yml           GitHub Pages 배포
docs/
  prd.pdf              구현 기준 문서
  prototype/           확정된 프로토타입과 디자인 시스템
```

### 데이터 모델 (PRD §4)

노드 하나가 주제이거나 발언이다. 둘의 차이는 `kind`와 어떤 필드를 쓰는지에만 있고,
트리 구조·상태·편집 방식은 동일하다. **승격·강등이 필드 교체 없이 되는 이유다.**

```ts
{ id, parentId, kind: 'topic'|'utt', summary, rawText, speaker, at,
  status: 'open'|'hold'|'bait'|'decided', outcome, decidedAt,
  unsorted, slide, slideNo }
```

`parentId`가 트리 구조의 유일한 근거다. **노드 좌표는 저장하지 않는다** — 위치는 매 렌더마다
`parentId`와 카드 실측 높이로 계산한다. 드래그는 좌표를 옮기는 조작이 아니라 `parentId`를
바꾸는 조작이다.

### 상태 색 (PRD §5.5)

| 상태 | 색 | 의미 |
|---|---|---|
| 논의중 | `cyan-7` `#08979c` | 기본값. 미결 트래커에 잡힌다 |
| 보류 | `gold-7` `#d48806` | 결론 칸이 열린다. 무엇 때문에 보류인지 적는다 |
| 떡밥 | `purple-7` `#531dab` | 지금 다룰 주제는 아니지만 버리지 않는다 |
| 결정됨 | `green-7` `#389e0d` | 결론 칸이 열린다. 회의록 결정사항으로 실린다 |

램프 7단계를 쓴 이유는 흰 배경과 자기 1단계 틴트 위에서 모두 4.5:1을 넘기기 때문이다.
선택 표시(브랜드 블루 `#1677ff`)와 겹치지 않도록 '논의중'에 cyan을 썼다.

---

## AI (PRD §8)

AI는 **선택적이고 보조적**이다. 쓰지 않아도 서비스가 온전히 동작해야 하며, 입력 동선에
단계를 추가하지 않는다. 사용자가 발언을 입력한 *뒤에* 필요할 때 누른다.

- **발언 요약** — 원문을 한 문장으로 줄여 요약 칸에 채운다. 그대로 수정할 수 있다.
- **결론 추출** — 결정·보류로 바꿀 때 하위 발언들에서 결론 한 줄을 뽑아 결론 칸에 채운다.
- 실패·지연 시 로컬 요약기로 즉시 우회한다. 요약 칸은 언제나 수동 편집 가능하다.
- 입력값은 **해당 노드와 하위 발언 텍스트로 한정**한다. 회의 전체를 통째로 보내지 않는다.

서버는 `claude-opus-5`를 `output_config.effort: "low"`로 호출한다(한 문장 요약은 가벼운
작업이라 지연과 비용을 낮춘다). 문체 규칙은 캐시 프리픽스로 고정했고, 정책 거절에 대비해
서버측 폴백(`fallbacks: "default"`)을 켜뒀다.

---

## 구현 시 지킨 것 (PRD §10 함정)

프로토타입에서 실제로 발생했고 원인이 규명된 문제들이다.

- **카드 높이는 추정하지 않고 실측한다.** 단, 내용 영역이 카드 높이만큼 늘어나 있으면
  측정값이 매번 커지는 무한 성장 루프가 생긴다 — 내용 영역은 내용 높이대로 둔다.
- **선택 시 카드를 확대하지 않는다.** `scale`은 레이아웃 박스를 넘어 이웃을 덮는다.
  선택 표시는 테두리·그림자로만 한다.
- **떠 있는 요소의 자리를 레이아웃에 포함한다.** 선택 노드 위에 뜨는 툴바만큼 세로 간격
  (`GAP_V`)을 확보한다.
- **누름 상태에 `preventDefault`를 걸지 않는다.** `:active`가 해제되지 않고 남는다.
- **포커스 주인은 캔버스다.** 입력칸이 아닌 것을 누르면 포커스를 캔버스로 되돌린다.
  단, 팝업 내부는 예외로 둬야 커서가 입력칸에 남는다.
- **휠 델타를 정규화한다.** 마우스 휠(120)과 트랙패드(약 8)를 같이 쓰면 확대가 계단처럼 튄다.
- **중앙 정렬 스크롤 컨테이너에 `align-items: flex-start`를 함께 준다.** `justify-content: center`
  만 주면 stretch가 카드를 화면 높이로 늘린다.
- **툴바는 접힌다.** 좁은 폭에서 버튼이 줄바꿈되므로 버튼은 `flex: none; white-space: nowrap`.
  겹치는 레이어는 고정값이 아니라 툴바 실측 높이를 따라간다.
- **참석자를 이름으로 비교하지 않는다.** 동명이인이 한 사람으로 묶여 한 명을 지우면 전부 지워진다.

## 비기능 (PRD §9)

- 노드 100개 규모에서 편집 중 프레임 드랍이 없어야 한다.
- 회의 중 새로고침·네트워크 단절에도 기록이 남는다 — 로컬 우선 저장(`localStorage`),
  세팅 화면에서 "이어하기"로 복구한다.
- 본문 최소 12px, 텍스트 대비 4.5:1 이상. 회의실 프로젝터에서 읽히는 것이 실질 기준이다.
- 데스크톱 브라우저 1280px 이상 1차 타깃. 좁아지면 우측 패널이 캔버스 위로 겹쳐 뜬다.
- `prefers-reduced-motion` 대응.

## v1에서 하지 않는 것

음성 인식·자동 전사, 실시간 다중 편집, 할 일 관리·캘린더·지라 연동, 모바일 전용 레이아웃.

## 후속 논의 (PRD §11)

- **장표 저장** — 지금은 이미지가 올린 기기에만 남는다. Firebase Storage로 옮기고 Firestore에는
  URL만 두는 것이 정공법. PPTX 서버 변환과 만료 정책도 여기에 붙는다.
- **배포본의 AI 요약** — Pages는 정적이라 프록시가 없다. Cloud Run·Functions에 올리면 해결된다.
- 회의록 내보내기 형식(마크다운·PDF·문서 도구 연동).
- 다음 회의로 넘긴 미결을 새 회의 세팅에서 자동으로 불러오는 흐름.
- 노드를 최상위로 떼어내는 버튼(현재는 드래그만 가능).

> 회의 데이터 영속화 범위는 Firestore로 답했다 — 회의 단위 저장·목록·재열람.
