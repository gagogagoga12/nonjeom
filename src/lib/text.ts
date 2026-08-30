import type { Participant } from '../types';

/**
 * 참석자 id → 표시 이름. 동명이인은 뒤에 순번을 붙여 화면에서도 구분된다.
 * PRD §10 — 참석자를 이름으로 비교하지 않는다.
 */
export function personLabel(participants: Participant[], id?: string): string {
  if (!id) return '';
  const i = participants.findIndex((p) => p.id === id);
  if (i < 0) return '';
  const nm = participants[i].name;
  const same = participants.filter((p) => p.name === nm);
  if (same.length < 2) return nm;
  return nm + ' ' + (same.findIndex((p) => p.id === id) + 1);
}

/** 성이 겹치는 경우가 많아 이름(뒤 두 글자)으로 표시 — 외국어 이름은 앞 두 글자 */
export function shortName(name: string): string {
  const n = (name || '').trim();
  if (!n) return '';
  if (/^[가-힣]{3,4}$/.test(n)) return n.slice(1);
  if (/^[가-힣]{2}$/.test(n)) return n;
  return n.slice(0, 2);
}

/** 회의 시작 시각 + 경과초 → HH:mm */
export function clock(startedAt: number, elapsed: number): string {
  const d = new Date(startedAt + elapsed * 1000);
  const h = d.getHours();
  const m = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function dateLabel(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} (${WEEK[d.getDay()]})`;
}

/** 한글 IME 조합 중 Enter는 확정용이므로 무시 (PRD UTT-5) */
export function isComposing(e: { nativeEvent?: unknown; keyCode?: number }): boolean {
  const ne = (e.nativeEvent ?? e) as { isComposing?: boolean; keyCode?: number };
  return !!ne.isComposing || ne.keyCode === 229;
}

export function isField(el: EventTarget | Element | null): boolean {
  if (!el || !(el as Element).tagName) return false;
  const e = el as HTMLElement;
  const t = e.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.isContentEditable === true;
}
