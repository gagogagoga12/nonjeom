import type { Status } from './types';

export interface StatusSpec {
  /** 회의록·패널에 쓰는 긴 이름 */
  l: string;
  /** 캔버스 툴바처럼 좁은 곳에 쓰는 짧은 이름 */
  s: string;
  /** Ant Tag 프리셋 램프 이름 */
  tone: 'cyan' | 'gold' | 'purple' | 'green';
  /** 램프 7단계 — 흰 배경과 자기 1단계 틴트 위에서 모두 4.5:1을 넘긴다(PRD §5.5·§9) */
  c: string;
  /** 램프 1단계 */
  bg: string;
}

// PRD §5.5 상태와 결론.
// 선택 표시에 쓰는 브랜드 블루(#1677ff)와 겹치지 않도록 '논의중'은 cyan을 쓴다.
export const ST: Record<Status, StatusSpec> = {
  open: { l: '논의중', s: '논의', tone: 'cyan', c: '#08979c', bg: '#e6fffb' },
  hold: { l: '보류', s: '보류', tone: 'gold', c: '#d48806', bg: '#fffbe6' },
  bait: { l: '떡밥', s: '떡밥', tone: 'purple', c: '#531dab', bg: '#f9f0ff' },
  decided: { l: '결정됨', s: '결정', tone: 'green', c: '#389e0d', bg: '#f6ffed' }
};

export const ORDER: Status[] = ['open', 'hold', 'bait', 'decided'];

/** 깊이별 카드 폭. 최상위 안건이 좁고 발언이 붙는 아래 층은 넓다. */
export const COL_W = [206, 226, 226, 226, 226];

/** 형제 카드 사이 세로 간격. 선택 노드 위에 뜨는 툴바(-37px)를 포함해 잡는다(PRD §10 '떠 있는 요소의 자리를 레이아웃에 포함한다'). */
export const GAP_V = 50;
/** 부모 카드 오른쪽 끝과 자식 카드 왼쪽 끝 사이 간격 */
export const GAP_H = 52;

export interface Zone {
  fs: number;
  lh: number;
  /** 그 크기에서 한 줄에 들어가는 한글 글자 수 — 실측 전 초기 추정값으로만 쓴다 */
  cpl: number;
  max: number;
  padV: number;
}

// 글자 영역은 zone마다 px line-height를 고정하고, 클립 높이와 카드 높이 모두 그 값만 쓴다.
export const ZONE: Record<'sum' | 'utt' | 'topic', Zone> = {
  sum: { fs: 14, lh: 22, cpl: 15, max: 2, padV: 25 },
  utt: { fs: 14, lh: 22, cpl: 15, max: 3, padV: 26 },
  topic: { fs: 14, lh: 22, cpl: 15, max: 2, padV: 26 }
};

export const META_H = 20;
export const GAP = 7;

/** 장표 노드 크기 4단계(PRD SLD-4) — 큰 단계에서는 장표 내용이 읽혀야 한다 */
export const SLIDE_WS = [300, 460, 660, 900];
export const SLIDE_ZOOM_LABELS = ['작게', '보통', '크게', '최대'];

/** 드래그 스냅 반경 (PRD §6 — 겹치지 않아도 반경 72px 안이면 가장 가까운 노드가 대상) */
export const SNAP = 72;

/** 확대 범위 30–200% (PRD §6) */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;

/** 되돌리기 최대 60단계 (PRD §6) */
export const UNDO_LIMIT = 60;

/** 호버 툴바 실측 폭 — 종류별로 버튼 수가 다르다 */
export const BAR_W = { topic: 200, utt: 212 };

export const LABEL_SIZES = [12, 14, 16, 20, 26, 34];
export const LABEL_COLORS = ['rgba(0,0,0,0.88)', '#ff4d4f', '#52c41a', '#1677ff'];
