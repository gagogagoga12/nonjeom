import { COL_W, GAP, GAP_H, GAP_V, META_H, SLIDE_WS, ZONE } from '../constants';
import type { Box, MeetNode } from '../types';

/**
 * PRD CV-1 — 노드 위치는 parentId와 카드 실측 높이로 매번 계산한다.
 * 좌표는 저장하지 않는다. 어떤 경우에도 두 카드가 겹치지 않는다.
 */

export interface Zones {
  isUtt: boolean;
  /** 요약 칸과 원문 칸을 둘 다 쓰는가 */
  dual: boolean;
  /** 주제로 승격된 발언 — 발언자 칩과 시각을 그대로 유지한다 */
  wasUtt: boolean;
  rawZ: (typeof ZONE)['utt'];
  rawSrc: string;
}

/**
 * 예전 버전에서는 미분류 메모에 화자를 고르면 글이 rawText에만 남아 카드가 빈 채로 보였다
 * (미분류 메모는 summary에만 글이 있다는 전제를 깨뜨렸다 — sortAsTopic·SidePanel 참고).
 * 저장된 회의를 불러올 때 그 모양을 여기서 바로잡는다.
 */
export function sanitizeNodes(nodes: MeetNode[]): MeetNode[] {
  return nodes.map((n) =>
    n.unsorted && n.kind === 'topic' && !n.summary.trim() && (n.rawText || '').trim()
      ? { ...n, summary: n.rawText!, rawText: '' }
      : n
  );
}

/**
 * 요약/원문 두 영역을 쓸지, 어느 zone으로 그릴지 한 곳에서 결정한다.
 * 승격된 발언 노드도 발언 노드와 같은 두 영역 구조를 유지한다(PRD §5.6).
 */
export function zonesOf(n: MeetNode): Zones {
  const isUtt = n.kind === 'utt';
  const sum = (n.summary || '').trim();
  const raw = (n.rawText || '').trim();
  const dual = !!sum && !!raw;
  return {
    isUtt,
    dual,
    wasUtt: !isUtt && !!n.speaker && !!raw,
    rawZ: isUtt || dual ? ZONE.utt : ZONE.topic,
    // summary가 비어 있으면 rawText로 대신 그린다 — sortAsTopic과 같은 안전장치.
    // (예전 버전에서 만들어진 미분류 메모는 rawText에만 글이 있는 경우가 있어, 안 그러면 카드가 빈 채로 보인다)
    rawSrc: dual ? n.rawText! : isUtt ? n.rawText || '' : n.summary.trim() || n.rawText || ''
  };
}

/** 결정/보류 노드는 카드 아래에 결론 띠가 붙는다(PRD CV-2·§5.5) */
export function hasOutcome(n: MeetNode): boolean {
  return n.kind !== 'utt' && (n.status === 'decided' || n.status === 'hold');
}

export function outcomeH(n: MeetNode): number {
  if (!hasOutcome(n)) return 0;
  const t = (n.outcome || '').trim();
  const lines = t ? Math.max(1, Math.ceil(t.length / 24)) : 1;
  return 12 + Math.min(3, lines) * 17 + 13;
}

export interface Metrics {
  /** 텍스트 영역별 실측 줄 수. key = `${nodeId}:sum` | `${nodeId}:raw` */
  measured: Record<string, number>;
  /** 카드 본문 실측 높이. key = nodeId */
  measuredH: Record<string, number>;
  expanded: Record<string, boolean>;
  /** 지금 편집 중인 영역 key (편집창은 줄 수 제한 없이 전체를 보여준다) */
  editKey: string | null;
  slideZoom: number;
}

export function slideW(slideZoom: number): number {
  return SLIDE_WS[slideZoom] ?? 460;
}

export function slideBoxH(n: MeetNode, slideZoom: number): number {
  return Math.round(slideW(slideZoom) / (n.slideAr || 16 / 9));
}

/**
 * 줄 수 계산. 글자수 추정은 초기값으로만 쓰고, 실제로 렌더된 높이를 잰 값이
 * 있으면 그것을 쓴다(PRD §10 — 카드 높이는 추정하지 말고 실측한다).
 */
export function lineCount(
  text: string,
  z: { cpl: number; max: number },
  uncapped: boolean,
  key: string | null,
  m: Metrics
): number {
  const len = (text || '').trim().length;
  if (!len) return 0;
  const real = key != null ? m.measured[key] : null;
  const raw = real != null ? real : Math.ceil(len / z.cpl);
  if (uncapped) return raw;
  if (key && (m.expanded[key] || m.editKey === key)) return Math.max(1, raw);
  return Math.max(1, Math.min(z.max, raw));
}

/** 각 영역이 독립적으로 잘렸는지 판단 (영역별 ▾ 토글용, PRD CV-3) */
export function zoneMore(text: string, z: { cpl: number; max: number }, key: string, m: Metrics): boolean {
  return lineCount(text, z, true, key, m) > z.max;
}

export function nodeH(n: MeetNode, depth: number, m: Metrics): number {
  const z = zonesOf(n);
  const slideH = n.slide ? slideBoxH(n, m.slideZoom) : 0;
  const rawL = Math.max(1, lineCount(z.rawSrc, z.rawZ, false, n.id + ':raw', m));
  const body = z.rawZ.padV + rawL * z.rawZ.lh + GAP + META_H;
  const est = z.dual
    ? ZONE.sum.padV +
      Math.max(1, lineCount(n.summary, ZONE.sum, false, n.id + ':sum', m)) * ZONE.sum.lh +
      1 +
      body
    : Math.max(z.isUtt ? 92 : depth === 0 ? 70 : 68, body);
  // 결론 띠는 카드 본문(measuredH) 밖에 붙으므로 따로 더한다
  return Math.max(est + slideH, m.measuredH[n.id] || 0) + outcomeH(n);
}

interface Pos {
  x: number;
  cy: number;
  w: number;
  depth: number;
}

/**
 * 왼쪽에서 오른쪽으로 뻗는 트리. 최상위 안건이 좌측 열에 세로로 쌓이고,
 * 발언이 우측으로 붙는다(PRD §5.2).
 */
export function layout(
  nodes: MeetNode[],
  collapsed: Record<string, boolean>,
  m: Metrics
): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  const roots = nodes.filter((n) => !n.parentId);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  let cursor = 52;

  // 장표 노드는 폭이 다르므로, 자식의 x는 부모의 실제 폭에서 계산해 넘긴다
  const walk = (n: MeetNode, depth: number, px: number): Pos => {
    const kids = collapsed[n.id] ? [] : childrenOf(n.id);
    const w = n.slide ? slideW(m.slideZoom) : COL_W[Math.min(depth, 4)];
    const x = px;
    // cursor는 '다음 노드가 시작할 위쪽 경계'.
    // 높이가 제각각(장표 노드 등)이어도 겹치지 않는다.
    const h = nodeH(n, depth, m);
    if (!kids.length) {
      pos[n.id] = { x, cy: cursor + h / 2, w, depth };
      cursor += h + GAP_V;
      return pos[n.id];
    }
    const blockTop = cursor;
    const ys = kids.map((k) => walk(k, depth + 1, x + w + GAP_H).cy);
    let cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    // 자식 묶음보다 위로 삐져나가지 않게
    if (cy - h / 2 < blockTop) cy = blockTop + h / 2;
    // 부모가 더 크면 그만큼 밀어낸다
    if (cy + h / 2 + GAP_V > cursor) cursor = cy + h / 2 + GAP_V;
    pos[n.id] = { x, cy, w, depth };
    return pos[n.id];
  };

  roots.forEach((r) => {
    walk(r, 0, 40);
    cursor += 30;
  });
  return pos;
}

export function boxesOf(
  nodes: MeetNode[],
  collapsed: Record<string, boolean>,
  m: Metrics
): Box[] {
  const pos = layout(nodes, collapsed, m);
  const out: Box[] = [];
  for (const n of nodes) {
    const p = pos[n.id];
    if (!p) continue;
    const h = nodeH(n, p.depth, m);
    out.push({ id: n.id, left: p.x, top: Math.round(p.cy - h / 2), w: p.w, h, cy: p.cy, depth: p.depth });
  }
  return out;
}

export function descendants(nodes: MeetNode[], id: string): Record<string, true> {
  const out: Record<string, true> = {};
  const walk = (pid: string) => {
    for (const n of nodes) {
      if (n.parentId === pid && !out[n.id]) {
        out[n.id] = true;
        walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

/** 자기 자신·자기 자손 밑으로는 옮길 수 없다 (순환 방지) */
export function canReparent(nodes: MeetNode[], id: string, targetId: string | null): boolean {
  const m: Record<string, MeetNode> = {};
  nodes.forEach((n) => { m[n.id] = n; });
  const me = m[id];
  if (!me) return false;
  if (!targetId) return !!me.parentId;
  if (targetId === id) return false;
  if (me.parentId === targetId) return false;
  let p: MeetNode | undefined = m[targetId];
  while (p) {
    if (p.id === id) return false;
    p = p.parentId ? m[p.parentId] : undefined;
  }
  return true;
}

export function pathOf(nodes: MeetNode[], id: string): string[] {
  const m: Record<string, MeetNode> = {};
  nodes.forEach((n) => { m[n.id] = n; });
  const out: string[] = [];
  let p: MeetNode | undefined = m[id];
  while (p) {
    out.unshift(p.summary);
    p = p.parentId ? m[p.parentId] : undefined;
  }
  return out;
}
