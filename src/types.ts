// PRD §4 데이터 모델.
// 노드 하나가 주제이거나 발언이다. 둘의 차이는 kind와 어떤 필드를 쓰는지에만
// 있고, 트리 구조·상태·편집 방식은 동일하다. 승격·강등이 필드 교체 없이 되는 이유다.

export type NodeKind = 'topic' | 'utt';
export type Status = 'open' | 'hold' | 'bait' | 'decided';
export type Screen = 'setup' | 'meeting' | 'wrap' | 'minutes';

export interface Participant {
  /** 이름 중복을 허용하고, 중복 시 표시에만 순번을 붙인다(홍길동 1, 홍길동 2). */
  id: string;
  name: string;
}

export interface MeetNode {
  id: string;
  /** null이면 최상위 안건. 트리 구조의 유일한 근거 — 좌표는 저장하지 않는다(PRD 구현 주의). */
  parentId: string | null;
  kind: NodeKind;
  /** 주제에서는 제목, 발언에서는 "결국 하고 싶은 말" 한 줄. AI 요약이 채우는 칸. */
  summary: string;
  /** 들은 대로 적은 발언 원문. 승격돼도 유지된다. */
  rawText?: string;
  /** 이름이 아니라 참석자 id. 동명이인이 한 사람으로 묶이지 않는다. */
  speaker?: string;
  /** 발언 시각 HH:mm */
  at?: string;
  status: Status;
  /** 결정·보류의 내용 한 줄. 카드 하단 띠로 노출된다. */
  outcome?: string;
  /** 상태가 결정·보류로 바뀐 시각 */
  decidedAt: string | null;
  /** F로 적어둔 미분류 메모. 정리하면 해제된다. */
  unsorted?: boolean;
  /** 장표 이미지와 순번. 있으면 카드 위에 미리보기가 박힌다. */
  slide?: string;
  slideAr?: number;
  slideNo?: number;
  slideDoc?: string;
}

/** 트리에 속하지 않는 자유 메모·이미지. 레이아웃에 영향을 주지 않는다. */
export interface CanvasLabel {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fs: number;
  bold: boolean;
  underline: boolean;
  color: string;
  src?: string;
}

/** 세팅 단계에서 미리 올려둔 발표 자료 한 장 */
export interface DeckSlide {
  src: string;
  ar: number;
  doc: string;
}

export interface Box {
  id: string;
  left: number;
  top: number;
  w: number;
  h: number;
  cy: number;
  depth: number;
}

export type DropMode = 'self' | 'root' | 'child' | 'append';
export interface DropTarget {
  id: string | null;
  mode: DropMode;
}

export interface DragState {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface ComposeState {
  parentId: string;
  speaker: string;
  text: string;
}

export interface QuickState {
  text: string;
  speaker: string | null;
}

/** 회의 종료 화면에서 미결 한 건을 어떻게 처리했는지 */
export type WrapChoice = Status | 'next';
