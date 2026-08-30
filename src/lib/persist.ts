import type { CanvasLabel, MeetNode, Participant, Screen, Status, WrapChoice } from '../types';

/**
 * PRD §9 데이터 유실 — 회의 중 새로고침·네트워크 단절에도 기록이 남아야 한다.
 * v1은 로컬 우선 저장. 서버 동기화는 후속(§11).
 */
const KEY = 'nonjeom.session.v1';

export interface Persisted {
  screen: Screen;
  title: string;
  participants: Participant[];
  partSeq: number;
  agendas: string[];
  nodes: MeetNode[];
  labels: CanvasLabel[];
  seq: number;
  labelSeq: number;
  startedAt: number;
  elapsed: number;
  collapsed: Record<string, boolean>;
  wrap: Record<string, WrapChoice>;
  wrapIds: string[] | null;
  wrapOrig: Record<string, Status>;
  savedAt: number;
}

export function save(data: Omit<Persisted, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // 장표 이미지(data URI)가 쿼터를 넘길 수 있다. 저장 실패해도 회의는 계속된다.
  }
}

export function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Persisted;
    if (!v || !Array.isArray(v.nodes)) return null;
    return v;
  } catch {
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
