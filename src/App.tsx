import React from 'react';
import {
  BAR_W, ORDER, SNAP, ST, UNDO_LIMIT, ZONE, ZOOM_MAX, ZOOM_MIN
} from './constants';
import {
  boxesOf, canReparent, descendants, hasOutcome, lineCount, type Metrics, zonesOf
} from './lib/layout';
import { aiOutcome, aiSummary, probeAi } from './lib/ai';
import { filesToShots, type Shot } from './lib/pdf';
import * as persist from './lib/persist';
import { clock, isField, mmss, personLabel } from './lib/text';
import type {
  Box, CanvasLabel, ComposeState, DeckSlide, DragState, DropTarget,
  MeetNode, Participant, QuickState, Screen, Status, WrapChoice
} from './types';
import type { AppApi } from './api';
import * as cloud from './lib/cloud';
import { isCloudConfigured, signIn, signOutAccount, watchAccount, type Account } from './lib/firebase';
import SetupScreen from './screens/SetupScreen';
import MeetingScreen from './screens/MeetingScreen';
import WrapScreen from './screens/WrapScreen';
import MinutesScreen from './screens/MinutesScreen';

export interface AppState {
  screen: Screen;
  title: string;
  /** 참석자는 이름이 아니라 id로 구분한다 (동명이인이 한 사람으로 묶이지 않도록) */
  participants: Participant[];
  partSeq: number;
  partDraft: string;
  agendaDraft: string;
  deck: DeckSlide[];
  agendas: string[];

  nodes: MeetNode[];
  seq: number;
  currentId: string | null;
  focusId: string | null;
  hoverId: string | null;

  drag: DragState | null;
  dropTarget: DropTarget | null;
  quick: QuickState | null;
  compose: ComposeState | null;
  panel: 'node' | 'tracker' | null;

  textMode: boolean;
  labels: CanvasLabel[];
  labelEdit: string | null;
  labelSel: string | null;
  labelSeq: number;
  drawRect: { x: number; y: number; w: number; h: number } | null;

  notice: string | null;
  lightbox: string | null;
  slideZoom: number;
  vw: number;
  barH: number;

  /** AI 요약 직후 뜨는 되돌리기 (PRD §8 — 마음에 안 들면 되돌린다) */
  undo: { id: string; prev: string } | null;
  aiBusy: string | null;

  zoom: number;
  pan: { x: number; y: number };
  collapsed: Record<string, boolean>;
  expanded: Record<string, boolean>;
  panning: boolean;
  animate: boolean;
  spaceDown: boolean;

  editId: string | null;
  editZone: 'sum' | 'raw' | null;
  editText: string;

  startedAt: number;
  elapsed: number;
  wrap: Record<string, WrapChoice>;
  wrapIds: string[] | null;
  wrapOrig: Record<string, Status>;
  quotes: Record<string, boolean>;
  copied: boolean;
  /** 저장된 회의가 있으면 세팅 화면에서 이어하기를 제안한다 */
  saved: persist.Persisted | null;

  // ─ 클라우드 (Firestore). 설정·로그인이 없으면 전부 비활성이고 앱은 로컬 전용으로 돈다.
  account: Account | null;
  /** 이 회의의 Firestore 문서 id. 로그인 상태로 시작하면 발급된다. */
  meetingId: string | null;
  sync: 'idle' | 'saving' | 'saved' | 'error';
  syncAt: number;
  cloudList: cloud.MeetingSummary[];
  cloudBusy: boolean;
}

const initialState = (): AppState => ({
  screen: 'setup',
  title: '',
  participants: [],
  partSeq: 1,
  partDraft: '',
  agendaDraft: '',
  deck: [],
  agendas: [],
  nodes: [],
  seq: 1,
  currentId: null,
  focusId: null,
  hoverId: null,
  drag: null,
  dropTarget: null,
  quick: null,
  compose: null,
  panel: null,
  textMode: false,
  labels: [],
  labelEdit: null,
  labelSel: null,
  labelSeq: 1,
  drawRect: null,
  notice: null,
  lightbox: null,
  slideZoom: 1,
  vw: typeof window === 'undefined' ? 1440 : window.innerWidth,
  barH: 44,
  undo: null,
  aiBusy: null,
  zoom: 1,
  pan: { x: 24, y: 12 },
  collapsed: {},
  expanded: {},
  panning: false,
  animate: false,
  spaceDown: false,
  editId: null,
  editZone: null,
  editText: '',
  startedAt: Date.now(),
  elapsed: 0,
  wrap: {},
  wrapIds: null,
  wrapOrig: {},
  quotes: {},
  copied: false,
  saved: null,
  account: null,
  meetingId: null,
  sync: 'idle',
  syncAt: 0,
  cloudList: [],
  cloudBusy: false
});

export default class App extends React.Component<Record<string, never>, AppState> implements AppApi {
  state: AppState = initialState();

  /** 캔버스 DOM. 키보드의 기본 주인이다(PRD CV-7). */
  cv: HTMLDivElement | null = null;
  composeEl: HTMLDivElement | null = null;
  quickEl: HTMLDivElement | null = null;
  editEl: HTMLTextAreaElement | null = null;
  barEl: HTMLDivElement | null = null;

  /** 실제로 렌더된 글자 높이를 재서 줄 수를 확정한다 (글자수 추정은 초기값) */
  measured: Record<string, number> = {};
  textEls: Record<string, HTMLElement | null> = {};
  /** 카드 내용의 실제 높이도 재서, 추정이 모자라면 레이아웃이 그만큼 벌어지게 한다 */
  measuredH: Record<string, number> = {};
  cardEls: Record<string, HTMLElement | null> = {};

  private timer: number | undefined;
  private noticeT: number | undefined;
  private undoT: number | undefined;
  private autoPanT: number | undefined;
  private saveT: number | undefined;
  private cloudT: number | undefined;
  private unwatchAccount: (() => void) | null = null;
  private barRO: ResizeObserver | null = null;
  private wheelH: ((e: WheelEvent) => void) | null = null;
  /** 노드 본체 누름 시작점 (5px 넘게 끌면 '옮기기'로 전환) */
  private nd0: { id: string; x: number; y: number } | null = null;
  /** 텍스트 박스 이동·리사이즈 시작점 */
  private lb0: (Partial<CanvasLabel> & { mx: number; my: number; moved?: boolean; handle?: string; id: string }) | null = null;
  /** T 도구로 영역을 그리는 시작점 */
  private tb0: { x: number; y: number; moved: boolean } | null = null;
  private d0: { x: number; y: number; pan: { x: number; y: number } } | null = null;
  private lastPt: { clientX: number; clientY: number } | null = null;
  /** 되돌리기 스택 (PRD §6 — 최대 60단계) */
  private hist: { nodes: MeetNode[]; labels: CanvasLabel[] }[] = [];
  private histAt = 0;
  private restoring = false;
  private prevSnap: { nodes: MeetNode[]; labels: CanvasLabel[] } | null = null;

  // ─────────────────────────────────────────────────────────── 수명주기

  componentDidMount(): void {
    this.timer = window.setInterval(() => {
      if (this.state.screen === 'meeting') this.setState((s) => ({ elapsed: s.elapsed + 1 }));
    }, 1000);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('paste', this.onPaste);
    window.addEventListener('mousedown', this.onGlobalDown, true);
    window.addEventListener('resize', this.onResize);
    this.prevSnap = { nodes: this.state.nodes, labels: this.state.labels };
    const saved = persist.load();
    if (saved && saved.nodes.length) this.setState({ saved });
    void probeAi();
    // 로그인 상태가 확인되면 지난 회의 목록을 끌어온다. 설정이 없으면 즉시 null이 온다.
    this.unwatchAccount = watchAccount((account) => {
      this.setState({ account }, () => {
        if (account) void this.refreshCloudList();
        else this.setState({ cloudList: [], meetingId: null, sync: 'idle' });
      });
    });
    requestAnimationFrame(() => this.measureText());
  }

  componentWillUnmount(): void {
    clearInterval(this.timer);
    clearTimeout(this.noticeT);
    clearTimeout(this.undoT);
    clearTimeout(this.saveT);
    clearTimeout(this.cloudT);
    this.unwatchAccount?.();
    this.stopAutoPan();
    this.barRO?.disconnect();
    if (this.cv && this.wheelH) this.cv.removeEventListener('wheel', this.wheelH);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('paste', this.onPaste);
    window.removeEventListener('mousedown', this.onGlobalDown, true);
    window.removeEventListener('resize', this.onResize);
  }

  componentDidUpdate(): void {
    this.measureText();
    this.measureCards();
    // 되돌리기용 스냅샷. 직전 상태를 직접 보관한다.
    const s = this.state;
    const p = this.prevSnap;
    if (p && (p.nodes !== s.nodes || p.labels !== s.labels)) {
      if (this.restoring) {
        this.restoring = false;
      } else {
        const now = Date.now();
        const sameSize = p.nodes.length === s.nodes.length && p.labels.length === s.labels.length;
        // 타이핑처럼 연속된 미세 변경은 하나로 묶는다
        if (!(sameSize && this.histAt && now - this.histAt < 700)) {
          this.hist.push(p);
          if (this.hist.length > UNDO_LIMIT) this.hist.shift();
        }
        this.histAt = now;
      }
      this.scheduleSave();
    }
    this.prevSnap = { nodes: s.nodes, labels: s.labels };
  }

  /**
   * PRD §9 데이터 유실 — 회의 중 새로고침에도 기록이 남아야 한다.
   * 로컬이 진실의 원본이고, 로그인돼 있으면 Firestore로 한 박자 늦게 흘려보낸다.
   */
  private scheduleSave(): void {
    if (this.state.screen === 'setup') return;
    clearTimeout(this.saveT);
    this.saveT = window.setTimeout(() => {
      const s = this.state;
      persist.save({
        screen: s.screen, title: s.title, participants: s.participants, partSeq: s.partSeq,
        agendas: s.agendas, nodes: s.nodes, labels: s.labels, seq: s.seq, labelSeq: s.labelSeq,
        startedAt: s.startedAt, elapsed: s.elapsed, collapsed: s.collapsed,
        wrap: s.wrap, wrapIds: s.wrapIds, wrapOrig: s.wrapOrig,
        meetingId: s.meetingId
      });
      this.scheduleCloudSync();
    }, 600);
  }

  /**
   * Firestore 동기화. 로컬 저장보다 훨씬 느슨한 주기로 밀어낸다 —
   * 타이핑 한 글자마다 쓰기를 날리면 요금과 지연만 는다.
   * 실패해도 로컬 기록은 남아 있으므로 회의는 멈추지 않는다.
   */
  private scheduleCloudSync(): void {
    if (!this.state.account || !this.state.meetingId) return;
    if (this.cloudT) return;
    this.cloudT = window.setTimeout(() => {
      this.cloudT = undefined;
      void this.syncNow();
    }, 4000);
  }

  private async syncNow(): Promise<void> {
    const s = this.state;
    const owner = s.account?.uid;
    const id = s.meetingId;
    if (!owner || !id || s.screen === 'setup') return;
    this.setState({ sync: 'saving' });
    const res = await cloud.saveMeeting(owner, id, {
      title: s.title, screen: s.screen, participants: s.participants, agendas: s.agendas,
      nodes: s.nodes, labels: s.labels, seq: s.seq, labelSeq: s.labelSeq, partSeq: s.partSeq,
      startedAt: s.startedAt, elapsed: s.elapsed, collapsed: s.collapsed,
      wrap: s.wrap, wrapIds: s.wrapIds, wrapOrig: s.wrapOrig
    });
    if (res.ok) {
      this.setState({ sync: 'saved', syncAt: Date.now() });
      return;
    }
    this.setState({ sync: 'error' });
    if (res.reason === 'too-large') this.notify('회의가 너무 커서 클라우드 저장에 실패했습니다');
  }

  private onResize = (): void => {
    if (window.innerWidth < 1280 !== this.state.vw < 1280) this.setState({ vw: window.innerWidth });
  };

  // ─────────────────────────────────────────────────────────── 파생값

  byId(): Record<string, MeetNode> {
    const m: Record<string, MeetNode> = {};
    this.state.nodes.forEach((n) => { m[n.id] = n; });
    return m;
  }
  childrenOf(id: string): MeetNode[] { return this.state.nodes.filter((n) => n.parentId === id); }
  uttsOf(id: string): MeetNode[] {
    return this.state.nodes.filter((n) => n.parentId === id && n.kind === 'utt');
  }
  editKey(): string | null {
    const s = this.state;
    return s.editId ? s.editId + ':' + (s.editZone === 'sum' ? 'sum' : 'raw') : null;
  }
  metrics(): Metrics {
    return {
      measured: this.measured,
      measuredH: this.measuredH,
      expanded: this.state.expanded,
      editKey: this.editKey(),
      slideZoom: this.state.slideZoom
    };
  }
  boxes(): Box[] {
    return boxesOf(this.state.nodes, this.state.collapsed, this.metrics());
  }
  clock(): string { return clock(this.state.startedAt, this.state.elapsed); }
  label(id?: string): string { return personLabel(this.state.participants, id); }

  // ─────────────────────────────────────────────────────────── 실측

  /**
   * PRD §10 — 카드 높이는 추정하지 말고 실측한다.
   * 단, 내용 영역이 카드 높이만큼 늘어나 있으면 측정값이 매번 커지는
   * 무한 성장 루프가 생긴다 — 내용 영역은 내용 높이대로 둔다.
   */
  measureCards(): void {
    let changed = false;
    const next = { ...this.measuredH };
    for (const id of Object.keys(this.cardEls)) {
      const el = this.cardEls[id];
      if (!el || !el.isConnected) {
        if (next[id] != null) { delete next[id]; changed = true; }
        continue;
      }
      let h = Math.ceil(el.scrollHeight);
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i] as HTMLElement;
        h = Math.max(h, Math.ceil(c.offsetTop + c.offsetHeight));
      }
      if (h > 0 && next[id] !== h) { next[id] = h; changed = true; }
    }
    if (changed) { this.measuredH = next; this.forceUpdate(); }
  }

  measureText(): void {
    let changed = false;
    const next = { ...this.measured };
    for (const key of Object.keys(this.textEls)) {
      const el = this.textEls[key];
      if (!el || !el.isConnected) {
        if (next[key] != null) { delete next[key]; changed = true; }
        continue;
      }
      // 편집 중에는 원문 div가 숨겨져 높이가 0이 된다 — 직전 측정값을 유지한다
      if (!el.scrollHeight) continue;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const lines = Math.max(1, Math.round(el.scrollHeight / lh));
      if (next[key] !== lines) { next[key] = lines; changed = true; }
    }
    if (changed) { this.measured = next; this.forceUpdate(); }
  }

  // ─────────────────────────────────────────────────────────── 전역 입력

  private onMouseMove = (e: MouseEvent): void => {
    // 텍스트 박스 이동·리사이즈
    if (this.lb0) {
      const b = this.lb0;
      const dx = (e.clientX - b.mx) / this.state.zoom;
      const dy = (e.clientY - b.my) / this.state.zoom;
      if (Math.abs(dx) + Math.abs(dy) > 2) b.moved = true;
      if (b.handle) {
        const patch: Partial<CanvasLabel> = {};
        if (b.handle.includes('e')) patch.w = Math.max(60, Math.round(b.w! + dx));
        if (b.handle.includes('s')) patch.h = Math.max(28, Math.round(b.h! + dy));
        if (b.handle.includes('w')) {
          const w = Math.max(60, Math.round(b.w! - dx));
          patch.w = w; patch.x = Math.round(b.x! + b.w! - w);
        }
        if (b.handle.includes('n')) {
          const h = Math.max(28, Math.round(b.h! - dy));
          patch.h = h; patch.y = Math.round(b.y! + b.h! - h);
        }
        this.patchLabel(b.id, patch);
        return;
      }
      this.patchLabel(b.id, { x: Math.round(b.x! + dx), y: Math.round(b.y! + dy) });
      return;
    }
    // T 도구로 텍스트 박스 영역 그리기
    if (this.tb0) {
      const p = this.toCanvas(e.clientX, e.clientY);
      this.tb0.moved = Math.abs(p.x - this.tb0.x) > 6 || Math.abs(p.y - this.tb0.y) > 6;
      this.setState({
        drawRect: {
          x: Math.min(this.tb0.x, p.x), y: Math.min(this.tb0.y, p.y),
          w: Math.abs(p.x - this.tb0.x), h: Math.abs(p.y - this.tb0.y)
        }
      });
      return;
    }
    // 노드 본체를 5px 이상 끌면 그때부터 '노드 옮기기'로 전환 (클릭 선택과 구분)
    if (!this.state.drag && this.nd0) {
      if (Math.abs(e.clientX - this.nd0.x) + Math.abs(e.clientY - this.nd0.y) < 5) return;
      const n = this.byId()[this.nd0.id];
      if (!n) { this.nd0 = null; return; }
      const id = this.nd0.id;
      this.nd0 = null;
      window.getSelection?.()?.removeAllRanges?.();
      this.setState({
        drag: { id, text: n.summary || n.rawText || '', x: e.clientX, y: e.clientY },
        dropTarget: this.hitTest(e),
        compose: null, hoverId: null
      });
      return;
    }
    if (this.state.panning && this.d0) {
      this.setState({
        animate: false,
        pan: this.clampPan({
          x: this.d0.pan.x + (e.clientX - this.d0.x),
          y: this.d0.pan.y + (e.clientY - this.d0.y)
        })
      });
      return;
    }
    if (!this.state.drag) return;
    this.lastPt = { clientX: e.clientX, clientY: e.clientY };
    this.setState({
      drag: { ...this.state.drag, x: e.clientX, y: e.clientY },
      dropTarget: this.hitTest(e)
    });
    this.autoPan();
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.tb0) {
      const t = this.tb0, r = this.state.drawRect;
      this.tb0 = null;
      // 그린 영역이 있으면 그 크기로, 그냥 클릭이면 기본 크기로
      this.addLabel(
        t.moved && r
          ? { x: r.x, y: r.y, w: Math.max(90, r.w), h: Math.max(34, r.h) }
          : { x: t.x, y: t.y, w: 280, h: 44 }
      );
      return;
    }
    if (this.lb0) { this.lb0 = null; return; }
    this.nd0 = null;
    this.stopAutoPan();
    if (this.state.panning) this.setState({ panning: false });
    if (!this.state.drag) return;
    // 놓은 지점으로 한 번 더 판정 (마지막 move 이후 화면이 움직였을 수 있음)
    if (typeof e.clientX === 'number') {
      this.lastPt = { clientX: e.clientX, clientY: e.clientY };
      const t = this.hitTest(this.lastPt);
      if (t) { this.setState({ dropTarget: t }, () => this.commitDrop()); return; }
    }
    this.commitDrop();
  };

  /**
   * PRD §10 — 포커스 주인을 명확히 한다.
   * 버튼·칩에 포커스가 남으면 Space·방향키·Del이 캔버스로 오지 않는다.
   * 입력칸이 아닌 것을 눌렀으면 포커스를 캔버스로 되돌린다.
   * 단, 팝업 내부는 예외로 둬야 커서가 입력칸에 남는다.
   */
  private onGlobalDown = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const keep = target?.closest?.('[data-keep-focus="1"]');
    if (this.state.screen === 'meeting' && !keep && !isField(target)) {
      requestAnimationFrame(() => this.focusCanvas());
    }
    if (!this.state.compose) return;
    if (this.composeEl && target && this.composeEl.contains(target)) return;
    this.setState({ compose: null });
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && this.state.spaceDown) this.setState({ spaceDown: false, panning: false });
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.state.screen !== 'meeting') return;
    // 실제로 글을 쓰는 칸에 커서가 있을 때만 단축키를 비켜준다
    const typing = isField(document.activeElement) || isField(e.target as Element);

    // ⌘/Ctrl+Z 되돌리기 (입력칸 안에서는 브라우저 기본 되돌리기를 그대로 둔다)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'ㅋ') && !e.shiftKey) {
      if (typing) return;
      e.preventDefault();
      this.undoLast();
      return;
    }
    if (e.code === 'Space' && !typing) {
      e.preventDefault();
      if (!this.state.spaceDown) this.setState({ spaceDown: true });
      return;
    }
    if (typing) return;

    // Esc는 한 번에 가장 안쪽 레이어 하나만 닫는다 (PRD §6)
    if (e.key === 'Escape') {
      const s = this.state;
      if (s.lightbox) { this.setState({ lightbox: null }); return; }
      if (s.drag) { this.setState({ drag: null, dropTarget: null }); return; }
      if (s.labelEdit) { this.closeLabel(); return; }
      if (s.quick) { this.setState({ quick: null }); return; }
      if (s.compose) { this.setState({ compose: null }); return; }
      if (s.textMode) { this.setState({ textMode: false, drawRect: null }); return; }
      if (s.labelSel) { this.setState({ labelSel: null }); return; }
      if (s.panel) { this.setState({ panel: null }); return; }
      if (s.currentId) { this.setState({ currentId: null, focusId: null }); return; }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const id = this.state.currentId;
      if (!id || this.state.drag) return;
      e.preventDefault();
      this.moveSibling(id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.state.labelSel) {
        e.preventDefault();
        this.removeLabel(this.state.labelSel);
        return;
      }
      const id = this.state.currentId;
      if (id) { e.preventDefault(); this.deleteNode(id); }
      return;
    }
    // Tab: 선택된 노드에 발언 입력 팝오버를 연다 ('+' 버튼과 동일한 동작). 노드 종류(주제·발언) 상관없이 동작한다.
    // Shift+Tab: 선택된 노드 우측에 새 논의 주제를 바로 연결한다(발언 노드에서 곁가지 논의를 띄울 때).
    if (e.key === 'Tab') {
      const id = this.state.currentId;
      const s = this.state;
      if (!id || s.drag || s.compose || s.quick || s.labelEdit || s.textMode) return;
      e.preventDefault();
      if (e.shiftKey) this.addChildTopic(id);
      else this.openCompose(id);
      return;
    }
    // F: 일단 적어두기 (ㄹ = 한글 자판의 같은 키)
    if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') { e.preventDefault(); this.openQuick(); return; }
    // T: 텍스트 도구
    if (e.key === 't' || e.key === 'T' || e.key === 'ㅅ') {
      e.preventDefault();
      this.setState((x) => ({ textMode: !x.textMode, currentId: null, editId: null, compose: null }));
    }
  };

  /** ⌘/Ctrl+V — 클립보드 이미지를 장표 노드로 올린다 (PRD §6) */
  private onPaste = (e: ClipboardEvent): void => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgs = items
      .filter((it) => it.type?.startsWith('image'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (!imgs.length) return;
    if (this.state.screen === 'meeting' && !this.state.labelEdit && !this.state.editId) {
      e.preventDefault();
      this.addSlides(imgs);
    }
  };

  // ─────────────────────────────────────────────────────────── 캔버스 좌표·이동

  focusCanvas(): void {
    const el = this.cv;
    if (!el || isField(document.activeElement)) return;
    if (document.activeElement === el) return;
    el.focus({ preventScroll: true });
  }

  toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const el = this.cv;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const s = this.state;
    return {
      x: Math.round((clientX - r.left - s.pan.x) / s.zoom),
      y: Math.round((clientY - r.top - s.pan.y) / s.zoom)
    };
  }

  /** 콘텐츠가 화면 밖으로 완전히 사라지지 않도록 이동 범위를 제한 */
  clampPan(pan: { x: number; y: number }, zoom?: number): { x: number; y: number } {
    const el = this.cv;
    const b = this.boxes();
    if (!el || !b.length) return pan;
    const z = zoom ?? this.state.zoom;
    const minX = Math.min(...b.map((n) => n.left));
    const maxX = Math.max(...b.map((n) => n.left + n.w));
    const minY = Math.min(...b.map((n) => n.top));
    const maxY = Math.max(...b.map((n) => n.top + n.h));
    const vw = el.clientWidth, vh = el.clientHeight, KEEP = 120;
    return {
      x: Math.max(Math.min(pan.x, vw - KEEP - minX * z), KEEP - maxX * z),
      y: Math.max(Math.min(pan.y, vh - KEEP - minY * z), KEEP - maxY * z)
    };
  }

  /** 커서 기준 확대·축소. 범위 30–200% (PRD §6) */
  zoomAt(next: number, px?: number, py?: number): void {
    const el = this.cv;
    if (!el) return;
    const z = this.state.zoom, p = this.state.pan;
    const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(next * 100) / 100));
    if (nz === z) return;
    const cx = px ?? el.clientWidth / 2;
    const cy = py ?? el.clientHeight / 2;
    this.setState({
      zoom: nz,
      animate: false,
      pan: this.clampPan({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }, nz)
    });
  }

  /** 새 노드가 캔버스 밖이면 그만큼만 팬 보정 (툴바 자리 여유 포함) */
  ensureVisible(id: string | null): void {
    if (!id) return;
    const b = this.boxes().find((k) => k.id === id);
    const el = this.cv;
    if (!b || !el) return;
    const z = this.state.zoom, p = this.state.pan;
    const M = 44, TOP = 44;
    const vw = el.clientWidth, vh = el.clientHeight;
    const l = b.left * z + p.x, r = (b.left + b.w) * z + p.x;
    const t = b.top * z + p.y, bo = (b.top + b.h) * z + p.y;
    let dx = 0, dy = 0;
    if (r > vw - M) dx = vw - M - r;
    if (l + dx < M) dx = M - l;
    if (bo > vh - M) dy = vh - M - bo;
    if (t + dy < TOP) dy = TOP - t;
    if (dx || dy) this.setState({ animate: true, pan: { x: p.x + dx, y: p.y + dy } });
  }

  /** 미결 트래커 행 클릭 → 캔버스가 해당 노드로 이동한다 (PRD §5.7) */
  focusOn(id: string, markFocus = true): void {
    const b = this.boxes().find((k) => k.id === id);
    if (!b) return;
    const el = this.cv;
    const z = this.state.zoom;
    const vw = el ? el.clientWidth : 800, vh = el ? el.clientHeight : 520;
    this.setState({
      focusId: markFocus ? id : null,
      currentId: id,
      animate: true,
      pan: this.clampPan({ x: vw / 2 - (b.left + b.w / 2) * z, y: vh / 2 - b.cy * z }, z)
    });
  }

  /** 툴바가 캔버스 좌우로 삐져나가지 않게 노드 기준 오프셋을 계산 */
  clampBar(b: Box, isUtt: boolean): number {
    const el = this.cv;
    if (!el) return 0;
    const z = this.state.zoom, px = this.state.pan.x, M = 8;
    const max = (el.clientWidth - M - px) / z - (isUtt ? BAR_W.utt : BAR_W.topic) - b.left;
    const min = (M - px) / z - b.left;
    return Math.round(Math.max(min, Math.min(0, max)));
  }

  /** 드래그 중 캔버스 가장자리에 커서를 두면 화면이 따라 흐른다 */
  private autoPan(): void {
    const el = this.cv, p = this.lastPt;
    if (!el || !p) { this.stopAutoPan(); return; }
    const r = el.getBoundingClientRect(), EDGE = 68, SPEED = 15;
    let dx = 0, dy = 0;
    if (p.clientX < r.left + EDGE) dx = SPEED;
    else if (p.clientX > r.right - EDGE) dx = -SPEED;
    if (p.clientY < r.top + EDGE) dy = SPEED;
    else if (p.clientY > r.bottom - EDGE) dy = -SPEED;
    if (!dx && !dy) { this.stopAutoPan(); return; }
    if (this.autoPanT) return;
    this.autoPanT = window.setInterval(() => {
      if (!this.state.drag) { this.stopAutoPan(); return; }
      this.setState(
        (x) => ({ animate: false, pan: this.clampPan({ x: x.pan.x + dx, y: x.pan.y + dy }, x.zoom) }),
        () => { if (this.lastPt) this.setState({ dropTarget: this.hitTest(this.lastPt) }); }
      );
    }, 16);
  }
  private stopAutoPan(): void {
    if (this.autoPanT) { clearInterval(this.autoPanT); this.autoPanT = undefined; }
  }

  /**
   * 놓기 대상 판정 (PRD §6 노드 드래그 — 놓기의 세 가지 결과).
   * 겹치지 않아도 반경 72px 안에 들어오면 가장 가까운 노드가 대상이 된다.
   */
  hitTest(e: { clientX: number; clientY: number }): DropTarget | null {
    const el = this.cv;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const z = this.state.zoom, p = this.state.pan;
    const cx = (e.clientX - r.left - p.x) / z;
    const cy = (e.clientY - r.top - p.y) / z;
    const skip = this.state.drag ? this.state.drag.id : null;
    const kids = skip ? descendants(this.state.nodes, skip) : {};
    const boxes = this.boxes();
    // 끌던 노드가 원래 있던 자리로 돌아오면 '취소'
    if (skip) {
      const self = boxes.find((b) => b.id === skip);
      if (self && cx >= self.left - 12 && cx <= self.left + self.w + 12 &&
          cy >= self.top - 12 && cy <= self.top + self.h + 12) {
        return { id: skip, mode: 'self' };
      }
    }
    let hit: Box | null = null, bestD = Infinity;
    for (const b of boxes) {
      if (b.id === skip || kids[b.id]) continue;
      const dx = Math.max(b.left - cx, 0, cx - (b.left + b.w));
      const dy = Math.max(b.top - cy, 0, cy - (b.top + b.h));
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; hit = b; }
    }
    if (!hit || bestD > SNAP) return { id: null, mode: 'root' };
    return { id: hit.id, mode: cx > hit.left + hit.w * 0.42 ? 'child' : 'append' };
  }

  private commitDrop(): void {
    const d = this.state.drag, t = this.state.dropTarget;
    this.setState({ drag: null, dropTarget: null });
    if (!d || !t) return;
    // 원래 자기 자리에 다시 놓으면 취소
    if (t.mode === 'self') {
      this.setState({ currentId: d.id, notice: '취소했습니다' }, () => this.clearNotice());
      return;
    }
    // 빈 곳에 놓으면 최상위 안건으로 떼어낸다
    const target = t.mode === 'root' ? null : t.id;
    if (!canReparent(this.state.nodes, d.id, target)) {
      this.setState({ currentId: d.id, notice: '취소했습니다. 연결은 그대로입니다' }, () => {
        this.ensureVisible(d.id);
        this.clearNotice();
      });
      return;
    }
    this.setState(
      (s) => ({
        nodes: s.nodes.map((n) => (n.id === d.id ? { ...n, parentId: target } : n)),
        currentId: d.id,
        // 접힌 노드에 붙이면 펼쳐서 결과가 보이게
        collapsed: target ? { ...s.collapsed, [target]: false } : s.collapsed
      }),
      () => this.ensureVisible(d.id)
    );
  }

  notify(msg: string): void {
    this.setState({ notice: msg }, () => this.clearNotice());
  }
  private clearNotice(): void {
    clearTimeout(this.noticeT);
    this.noticeT = window.setTimeout(() => this.setState({ notice: null }), 1700);
  }

  // ─────────────────────────────────────────────────────────── 세팅 (PRD §5.1)

  setTitle(v: string): void { this.setState({ title: v }); }
  setPartDraft(v: string): void { this.setState({ partDraft: v }); }

  /** SET-2 — 이름이 같아도 서로 다른 참석자로 저장한다 */
  addParticipant(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.setState((x) => ({
      participants: x.participants.concat([{ id: 'p' + x.partSeq, name: v }]),
      partSeq: x.partSeq + 1,
      partDraft: ''
    }));
  }
  removeParticipant(id: string): void {
    this.setState((x) => ({ participants: x.participants.filter((p) => p.id !== id) }));
  }
  setAgendaDraft(v: string): void { this.setState({ agendaDraft: v }); }
  addAgenda(title: string): void {
    const v = title.trim();
    if (!v) return;
    this.setState((x) => ({ agendas: x.agendas.concat([v]), agendaDraft: '' }));
  }
  removeAgenda(index: number): void {
    this.setState((x) => ({ agendas: x.agendas.filter((_, j) => j !== index) }));
  }

  /** SET-4 — 발표 자료를 세팅 단계에서 올려둔다. 회의를 시작할 때 장표 노드로 펼쳐진다. */
  stageFiles(files: FileList | File[]): void {
    void filesToShots(files, (m) => this.notify(m)).then((shots) => {
      if (!shots.length) return;
      this.setState(
        (x) => ({ deck: x.deck.concat(shots) }),
        () => this.notify(`장표 ${shots.length}장 준비됨`)
      );
    });
  }
  removeDeckSlide(index: number): void {
    this.setState((x) => ({ deck: x.deck.filter((_, j) => j !== index) }));
  }

  /** SET-5 — 참석자와 안건(또는 장표)이 하나 이상 있을 때만 시작할 수 있다 */
  start(): void {
    const s = this.state;
    if (!s.participants.length) return;
    if (!s.agendas.length && !s.deck.length) return;
    let seq = 1;
    const slides: MeetNode[] = s.deck.map((it, i) => ({
      id: 'n' + seq++, parentId: null, kind: 'topic',
      slide: it.src, slideAr: it.ar || 16 / 9, slideNo: i + 1, slideDoc: it.doc,
      summary: '장표 ' + (i + 1), status: 'open', decidedAt: null
    }));
    const topics: MeetNode[] = s.agendas.map((t) => ({
      id: 'n' + seq++, parentId: null, kind: 'topic', summary: t, status: 'open', decidedAt: null
    }));
    const nodes = slides.concat(topics);
    persist.clear();
    this.measured = {}; this.measuredH = {}; this.hist = [];
    this.setState(
      {
        screen: 'meeting', nodes, seq, currentId: nodes[0].id,
        title: s.title.trim() || '제목 없는 회의',
        startedAt: Date.now(), elapsed: 0, pan: { x: 24, y: 12 }, zoom: 1,
        wrap: {}, wrapIds: null, saved: null, labels: [], collapsed: {}, expanded: {},
        // 로그인돼 있으면 이 회의에 클라우드 문서 id를 붙여 시작한다
        meetingId: s.account ? cloud.newMeetingId() : null,
        sync: 'idle'
      },
      () => { this.ensureVisible(nodes[0].id); this.focusCanvas(); void this.syncNow(); }
    );
  }

  resumeSaved(): void {
    const v = this.state.saved;
    if (!v) return;
    this.measured = {}; this.measuredH = {}; this.hist = [];
    this.setState({
      screen: v.screen === 'setup' ? 'meeting' : v.screen,
      title: v.title, participants: v.participants, partSeq: v.partSeq, agendas: v.agendas,
      nodes: v.nodes, labels: v.labels, seq: v.seq, labelSeq: v.labelSeq,
      startedAt: v.startedAt, elapsed: v.elapsed, collapsed: v.collapsed,
      wrap: v.wrap, wrapIds: v.wrapIds, wrapOrig: v.wrapOrig,
      currentId: v.nodes[0]?.id ?? null, saved: null, pan: { x: 24, y: 12 }, zoom: 1,
      // 로컬 기록이 어느 클라우드 회의에 속했는지 알면 그 문서로 이어서 쓴다
      meetingId: v.meetingId ?? (this.state.account ? cloud.newMeetingId() : null)
    }, () => this.notify('저장된 회의를 이어서 엽니다'));
  }
  discardSaved(): void { persist.clear(); this.setState({ saved: null }); }

  // ─────────────────────────────────────── 클라우드 (Firestore · 선택 기능)

  cloudEnabled(): boolean { return isCloudConfigured(); }

  async signInCloud(): Promise<void> {
    const a = await signIn();
    if (!a) { this.notify('로그인하지 못했습니다'); return; }
    this.setState({ account: a }, () => void this.refreshCloudList());
  }

  async signOutCloud(): Promise<void> {
    await signOutAccount();
    this.setState({ account: null, cloudList: [], meetingId: null, sync: 'idle' });
  }

  async refreshCloudList(): Promise<void> {
    const uid = this.state.account?.uid;
    if (!uid) return;
    this.setState({ cloudBusy: true });
    const rows = await cloud.listMeetings(uid);
    this.setState({ cloudList: rows, cloudBusy: false });
  }

  /** 지난 회의를 클라우드에서 열어 그대로 이어 쓴다 */
  async openCloudMeeting(id: string): Promise<void> {
    this.setState({ cloudBusy: true });
    const v = await cloud.loadMeeting(id);
    this.setState({ cloudBusy: false });
    if (!v) { this.notify('회의를 불러오지 못했습니다'); return; }
    this.measured = {}; this.measuredH = {}; this.hist = [];
    this.setState(
      {
        screen: v.screen === 'setup' ? 'meeting' : v.screen,
        title: v.title, participants: v.participants, partSeq: v.partSeq, agendas: v.agendas,
        nodes: v.nodes, labels: v.labels, seq: v.seq, labelSeq: v.labelSeq,
        startedAt: v.startedAt, elapsed: v.elapsed, collapsed: v.collapsed,
        wrap: v.wrap, wrapIds: v.wrapIds, wrapOrig: v.wrapOrig,
        currentId: v.nodes[0]?.id ?? null, saved: null, meetingId: v.id,
        pan: { x: 24, y: 12 }, zoom: 1, expanded: {}, sync: 'saved', syncAt: v.updatedAt
      },
      () => this.notify(
        v.slidesLocalOnly
          ? '회의를 열었습니다 · 장표 이미지는 올린 기기에만 있습니다'
          : '회의를 열었습니다'
      )
    );
  }

  async deleteCloudMeeting(id: string): Promise<void> {
    const ok = await cloud.deleteMeeting(id);
    if (!ok) { this.notify('삭제하지 못했습니다'); return; }
    this.setState((x) => ({
      cloudList: x.cloudList.filter((m) => m.id !== id),
      meetingId: x.meetingId === id ? null : x.meetingId
    }));
  }

  /** 툴바의 수동 저장 — 자동 동기화를 기다리지 않고 지금 밀어낸다 */
  syncCloudNow(): void { void this.syncNow(); }

  /** 시나리오 A를 그대로 재현한 예시 회의 (PRD §3) */
  loadSample(): void {
    const T = (id: string, parentId: string | null, summary: string, status: Status, decidedAt?: string): MeetNode =>
      ({ id, parentId, kind: 'topic', summary, status, decidedAt: decidedAt ?? null });
    const PID: Record<string, string> = { 김서준: 'p1', 이하늘: 'p2', 박정우: 'p3' };
    const U = (id: string, parentId: string, name: string, rawText: string, at: string): MeetNode =>
      ({ id, parentId, kind: 'utt', speaker: PID[name], summary: '', rawText, at, status: 'open', decidedAt: null });
    const nodes: MeetNode[] = [
      T('n1', null, '신규 온보딩 플로우 확정', 'open'),
      U('u1', 'n1', '김서준', '오늘 첫 안건은 온보딩부터 보죠', '14:02'),
      T('n2', 'n1', '가입 단계 3 → 2단계로 축소', 'decided', '14:12'),
      U('u2', 'n2', '김서준', '단계 줄이면 이탈 줄 것 같은데', '14:06'),
      U('u3', 'n2', '이하늘', '퍼널 보면 2단계에서 40% 빠짐', '14:09'),
      U('u4', 'n2', '박정우', '그럼 두 단계로 가기로 하죠', '14:12'),
      T('n3', 'n2', '이메일 인증 시점', 'open'),
      U('u5', 'n3', '이하늘', '이메일 인증 뒤로 빼면 스팸 가입 늘 수도', '14:15'),
      U('u6', 'n3', '김서준', '인증 전에는 초대 기능 잠그면 됨', '14:18'),
      T('n4', 'n1', '온보딩 튜토리얼 스킵 허용', 'decided', '14:22'),
      U('u7', 'n4', '박정우', '튜토리얼은 스킵 허용하자', '14:21'),
      T('n5', 'n1', '가입 화면 카피 재작성', 'open'),
      U('u8', 'n5', '이하늘', '카피가 너무 기능 설명 같음', '14:25'),
      T('n6', null, '무료 체험 기간 정책', 'hold'),
      U('u9', 'n6', '김서준', '체험 기간도 이번에 정해야 함', '14:28'),
      T('n7', 'n6', '14일 vs 30일, 전환율 데이터 필요', 'hold'),
      U('u10', 'n7', '이하늘', '14일이면 짧다', '14:30'),
      U('u11', 'n7', '박정우', '데이터 없이 바꾸면 근거가 없다', '14:32'),
      T('n8', null, '알림 기본값 정책', 'bait'),
      U('u12', 'n8', '김서준', '푸시 기본 ON은 리뷰에서 까일 수 있음', '14:37')
    ];
    nodes.find((n) => n.id === 'n2')!.outcome = '가입 단계를 2단계로 축소한다';
    nodes.find((n) => n.id === 'n6')!.outcome = '전환율 데이터가 나올 때까지 보류';
    this.measured = {}; this.measuredH = {}; this.hist = [];
    this.setState(
      {
        screen: 'meeting', nodes, seq: 20, currentId: 'n3',
        title: '3분기 온보딩 개편 킥오프',
        participants: [
          { id: 'p1', name: '김서준' }, { id: 'p2', name: '이하늘' }, { id: 'p3', name: '박정우' }
        ],
        partSeq: 4,
        startedAt: Date.now() - 2298 * 1000, elapsed: 2298,
        pan: { x: 24, y: 12 }, zoom: 0.9, wrap: {}, wrapIds: null, drag: null, saved: null,
        labels: [], collapsed: {}, expanded: {},
        meetingId: this.state.account ? cloud.newMeetingId() : null, sync: 'idle'
      },
      () => requestAnimationFrame(() => this.focusOn('n3', false))
    );
  }

  // ─────────────────────────────────────────────────────────── 노드 조작

  select(id: string | null): void {
    this.setState(
      (x) => ({
        currentId: id, focusId: null,
        // 다른 노드를 고르면 열려 있던 발언 추가 팝업은 닫는다
        compose: x.compose && x.compose.parentId === id ? x.compose : null,
        // 캔버스에서 노드를 고르면 항상 그 노드의 상세를 보여준다
        panel: id ? ('node' as const) : x.panel === 'node' ? null : x.panel
      }),
      () => this.ensureVisible(id)
    );
  }
  setHover(id: string | null): void {
    this.setState((x) => (id === null ? (x.hoverId ? { hoverId: null } : null) : { hoverId: id }));
  }
  /** CV-5 — 자식이 있는 노드는 접기 칩으로 하위 트리를 접는다 */
  toggleFold(id: string): void {
    this.setState((x) => ({ collapsed: { ...x.collapsed, [id]: !x.collapsed[id] } }));
  }
  backToRoot(): void {
    const m = this.byId();
    let p = this.state.currentId ? m[this.state.currentId] : undefined;
    if (!p) return;
    while (p.parentId) p = m[p.parentId];
    this.setState({ currentId: p.id, focusId: null, animate: true, pan: { x: 24, y: 12 } });
  }
  setSlideZoom(i: number): void { this.setState({ slideZoom: i }); }
  patchNode(id: string, patch: Partial<MeetNode>): void {
    this.setState((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }
  setStatus(id: string, k: Status): void {
    this.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, status: k, decidedAt: k === 'decided' || k === 'hold' ? this.clock() : null } : n
      )
    }));
  }
  /** 노드 삭제: 자식은 삭제하지 않고 조부모로 올려 붙인다 (기록 유실 방지) */
  deleteNode(id: string): void {
    const n = this.byId()[id];
    if (!n) return;
    this.setState((s) => {
      const nodes = s.nodes
        .filter((x) => x.id !== id)
        .map((x) => (x.parentId === id ? { ...x, parentId: n.parentId } : x));
      return {
        nodes,
        currentId: s.currentId === id ? n.parentId ?? nodes[0]?.id ?? null : s.currentId,
        editId: null
      };
    });
  }
  /** ↑/↓ 로 형제 순서 변경. 트리 순서가 배열 순서라서 딸린 발언이 함께 따라온다(PRD §6) */
  moveSibling(id: string, dir: 1 | -1): void {
    const s = this.state;
    const me = s.nodes.find((n) => n.id === id);
    if (!me) return;
    const sibs = s.nodes.filter((n) => (n.parentId || null) === (me.parentId || null));
    const at = sibs.findIndex((n) => n.id === id);
    const to = at + dir;
    if (to < 0 || to >= sibs.length) {
      this.notify(dir < 0 ? '이미 맨 위입니다' : '이미 맨 아래입니다');
      return;
    }
    const a = s.nodes.indexOf(me), b = s.nodes.indexOf(sibs[to]);
    const nodes = s.nodes.slice();
    nodes[a] = sibs[to];
    nodes[b] = me;
    this.setState({ nodes, currentId: id }, () => this.ensureVisible(id));
  }
  undoLast(): void {
    const prev = this.hist.pop();
    if (!prev) { this.notify('되돌릴 작업이 없습니다'); return; }
    this.restoring = true;
    this.histAt = 0;
    this.setState(
      {
        nodes: prev.nodes, labels: prev.labels,
        editId: null, editZone: null, compose: null, drag: null, dropTarget: null,
        labelEdit: null, notice: '되돌렸습니다'
      },
      () => this.clearNotice()
    );
  }

  /**
   * Shift+Tab — 선택된 노드 우측에 새 논의 주제를 바로 연결한다.
   * 발언 노드에서 곁가지 논의를 띄우고 싶을 때, 상세 패널의 '승격'(기존 노드를 바꿔치기)과 달리
   * 새 노드를 추가해 원래 발언은 그대로 남긴다. 제목은 그 자리에서 바로 입력한다(즉시성).
   */
  addChildTopic(parentId: string): void {
    const id = 'n' + this.state.seq;
    this.setState(
      (s) => ({
        nodes: s.nodes.concat([{
          id, parentId, kind: 'topic' as const,
          summary: '', status: 'open' as Status, decidedAt: null
        }]),
        seq: s.seq + 1,
        currentId: id, focusId: null, compose: null
      }),
      () => {
        this.ensureVisible(id);
        this.startZoneEdit(id, 'raw');
      }
    );
  }

  // ─────────────────────────────────────────────────────────── 발언 입력 (PRD §5.3)

  /** UTT-1 — 팝오버는 트리거(노드 우측 + 버튼) 기준으로 그 자리에 열린다 */
  openCompose(parentId: string): void {
    this.setState(
      (s) => ({
        currentId: parentId, focusId: null,
        compose: {
          parentId,
          speaker: s.compose?.speaker || s.participants[0]?.id || '',
          text: ''
        }
      }),
      () => this.ensureComposeVisible(parentId)
    );
  }

  /**
   * 팝오버는 자식 묶음 아래에 열리므로 형제가 많으면 화면 밖으로 밀려난다.
   * 설계 제1원칙(즉시성) — 기록자가 화면을 찾아 헤매는 순간 기록이 끊긴다.
   * 벗어난 만큼만 캔버스를 밀어 팝오버 전체가 보이게 한다.
   */
  private ensureComposeVisible(parentId: string): void {
    const el = this.cv;
    if (!el) return;
    const boxMap: Record<string, Box> = {};
    this.boxes().forEach((b) => { boxMap[b.id] = b; });
    const p = boxMap[parentId];
    if (!p) return;
    const sibs = this.childrenOf(parentId).map((c) => boxMap[c.id]).filter(Boolean);
    const bottom = sibs.length ? Math.max(...sibs.map((c) => c.top + c.h)) : p.top + p.h;
    // ComposePopover와 같은 위치 규칙 (left/top/폭 320 · 높이 약 300)
    const left = p.left + p.w + 52;
    const top = Math.max(p.top, bottom + 12);
    const W = 320, H = 300, M = 16;
    const z = this.state.zoom, pan = this.state.pan;
    const vw = el.clientWidth, vh = el.clientHeight;
    let dx = 0, dy = 0;
    const r = (left + W) * z + pan.x;
    const b = (top + H) * z + pan.y;
    const l = left * z + pan.x;
    const t = top * z + pan.y;
    if (r > vw - M) dx = vw - M - r;
    if (l + dx < M) dx = M - l;
    if (b > vh - M) dy = vh - M - b;
    if (t + dy < M) dy = M - t;
    if (dx || dy) this.setState({ animate: true, pan: { x: pan.x + dx, y: pan.y + dy } });
  }
  setComposeText(v: string): void {
    this.setState((x) => (x.compose ? { compose: { ...x.compose, text: v } } : null));
  }
  setComposeSpeaker(id: string): void {
    this.setState((x) => (x.compose ? { compose: { ...x.compose, speaker: id } } : null));
  }
  /** UTT-2 — Tab/⇧Tab으로 커서를 입력칸에 둔 채 화자를 순환한다 */
  cycleComposeSpeaker(back: boolean): void {
    this.setState((x) => {
      const c = x.compose;
      if (!c || !x.participants.length) return null;
      const ps = x.participants;
      const i = ps.findIndex((p) => p.id === c.speaker);
      const next = ps[((i < 0 ? 0 : i + (back ? -1 : 1)) + ps.length) % ps.length];
      return { compose: { ...c, speaker: next.id } };
    });
  }
  /** UTT-3 — 확정 후에도 팝오버는 열린 채 비워져 연달아 입력한다 */
  commitCompose(keepOpen: boolean): void {
    const c = this.state.compose;
    if (!c) return;
    const text = c.text.trim();
    if (!text) { if (!keepOpen) this.setState({ compose: null }); return; }
    this.addUtterance(c.parentId, c.speaker, text);
    this.setState({
      compose: keepOpen ? { parentId: c.parentId, speaker: c.speaker, text: '' } : null
    });
  }
  closeCompose(): void { this.setState({ compose: null }); }

  /**
   * UTT-6 — 발언 노드는 원문(구구절절)과 요약(결국 하고 싶은 말) 두 칸을 갖는다.
   * 입력 시에는 원문만 채우고 요약은 비워둔다.
   */
  private addUtterance(parentId: string, speaker: string, text: string): void {
    const id = 'n' + this.state.seq;
    this.setState(
      (s) => ({
        nodes: s.nodes.concat([{
          id, parentId, kind: 'utt' as const, speaker,
          summary: '', rawText: text,
          at: this.clock(), status: 'open' as Status, decidedAt: null
        }]),
        seq: s.seq + 1,
        currentId: id,
        focusId: null
      }),
      () => this.ensureVisible(id)
    );
  }

  // ─────────────────────────────────────────────────────────── 일단 적어두기 (PRD §5.4)

  openQuick(): void { this.setState({ quick: { text: '', speaker: null }, compose: null }); }
  setQuickText(v: string): void {
    this.setState((x) => (x.quick ? { quick: { ...x.quick, text: v } } : null));
  }
  toggleQuickSpeaker(id: string): void {
    this.setState(
      (x) => (x.quick ? { quick: { ...x.quick, speaker: x.quick.speaker === id ? null : id } } : null),
      () => {
        const ta = this.quickEl?.querySelector('textarea');
        ta?.focus({ preventScroll: true });
      }
    );
  }
  cycleQuickSpeaker(back: boolean): void {
    this.setState((x) => {
      const q = x.quick;
      if (!q || !x.participants.length) return null;
      const ps = x.participants;
      const i = ps.findIndex((p) => p.id === q.speaker);
      const next = ps[((i < 0 ? 0 : i + (back ? -1 : 1)) + ps.length) % ps.length];
      return { quick: { ...q, speaker: next.id } };
    });
  }
  /**
   * 화자를 고르면 현재 선택된 노드의 발언으로, 고르지 않으면 미분류 메모
   * 최상위 노드로 저장된다(PRD §5.4).
   */
  commitQuick(keepOpen: boolean): void {
    const q = this.state.quick;
    if (!q) return;
    const text = q.text.trim();
    if (!text) { if (!keepOpen) this.setState({ quick: null }); return; }
    const cur = this.state.currentId ? this.byId()[this.state.currentId] : null;
    if (q.speaker && cur) {
      // 화자를 골랐고 선택된 노드가 있으면 그 노드의 발언으로 붙인다
      this.addUtterance(cur.kind === 'utt' ? cur.parentId ?? cur.id : cur.id, q.speaker, text);
      this.setState({ quick: keepOpen ? { text: '', speaker: q.speaker } : null });
      return;
    }
    const id = 'n' + this.state.seq;
    const at = this.clock();
    this.setState(
      (s) => ({
        nodes: s.nodes.concat([{
          // 미분류 메모는 화자를 골랐어도 summary에만 글을 둔다(sortAsTopic·SidePanel이 그렇게 읽는다).
          // 예전엔 화자가 있으면 rawText에 넣었는데, topic·비dual 노드는 summary만 그려서 카드가 빈 채 보였다.
          id, parentId: null, kind: 'topic' as const, unsorted: true,
          speaker: q.speaker ?? undefined, at,
          summary: text,
          status: 'open' as Status, decidedAt: null
        }]),
        seq: s.seq + 1,
        currentId: id,
        quick: keepOpen ? { text: '', speaker: q.speaker } : null
      }),
      () => this.ensureVisible(id)
    );
  }
  closeQuick(): void { this.setState({ quick: null }); }

  /** 미분류 메모를 안건으로 확정 */
  sortAsTopic(id: string): void {
    this.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, unsorted: false, status: 'open' as Status, summary: n.summary.trim() || n.rawText || '' }
          : n
      )
    }));
  }
  /** 미분류 메모에 화자를 붙여 발언으로 내려보낸다 */
  sortAsUtterance(id: string, speaker: string): void {
    this.setState(
      (s) => {
        const me = s.nodes.find((n) => n.id === id);
        if (!me) return null;
        const host = me.parentId || s.nodes.find((n) => n.id !== id && n.kind !== 'utt' && !n.unsorted)?.id;
        if (!host) return null;
        // 미분류 메모는 summary에만 글이 있다. 발언으로 내릴 때 그 글을 원문 칸으로 옮긴다
        const raw = (me.rawText || '').trim() || me.summary;
        const sum = me.summary.trim() === raw ? '' : me.summary;
        return {
          nodes: s.nodes.map((n) =>
            n.id === id
              ? { ...n, kind: 'utt' as const, unsorted: false, parentId: host, speaker, rawText: raw, summary: sum }
              : n
          )
        };
      },
      () => this.ensureVisible(id)
    );
  }

  /** PRD §5.6 발언 승격 — 승격 후에도 발언자·시각·요약·원문이 모두 유지된다 */
  promote(id: string): void {
    this.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, kind: 'topic' as const, summary: n.summary.trim() || n.rawText || '' } : n
      ),
      currentId: id
    }));
  }

  // ─────────────────────────────────────────────────────────── AI (PRD §8)

  /**
   * 발언 요약 — 원문을 한 문장으로 줄여 요약 칸에 채운다.
   * 입력값은 해당 노드와 하위 발언 텍스트로만 한정한다. 회의 전체를 보내지 않는다.
   * 실패·지연 시 로컬 요약기로 우회하므로 이 호출은 실패하지 않는다.
   */
  summarizeNode(id: string): void {
    const n = this.byId()[id];
    if (!n) return;
    const isUtt = n.kind === 'utt';
    const kids = this.uttsOf(id);
    const src = isUtt
      ? n.rawText || ''
      : kids.length
        ? kids.map((u) => u.rawText || '').join(' ')
        : n.summary;
    if (!src.trim()) return;
    const prev = n.summary || '';
    this.setState({ aiBusy: id });
    void aiSummary(src, isUtt ? undefined : n.summary).then(({ text }) => {
      this.setState((s) => ({
        aiBusy: s.aiBusy === id ? null : s.aiBusy,
        nodes: text === prev ? s.nodes : s.nodes.map((x) => (x.id === id ? { ...x, summary: text } : x)),
        undo: text === prev ? s.undo : { id, prev }
      }));
      clearTimeout(this.undoT);
      this.undoT = window.setTimeout(() => this.setState({ undo: null }), 6000);
    });
  }

  /** 결론 추출 — 결정·보류로 바꿀 때 하위 발언들에서 결론 한 줄을 뽑아 결론 칸에 채운다 */
  fillOutcome(id: string): void {
    const n = this.byId()[id];
    if (!n || n.status !== 'decided' && n.status !== 'hold') return;
    const kids = this.uttsOf(id);
    const src = kids.length
      ? kids.map((u) => u.summary.trim() || u.rawText || '').filter(Boolean)
      : [n.rawText || n.summary];
    if (!src.length) return;
    this.setState({ aiBusy: id });
    void aiOutcome(n.summary, src, n.status).then(({ text }) => {
      this.setState((s) => ({
        aiBusy: s.aiBusy === id ? null : s.aiBusy,
        nodes: s.nodes.map((x) => (x.id === id ? { ...x, outcome: text } : x))
      }));
    });
  }

  undoSummary(): void {
    const u = this.state.undo;
    if (!u) return;
    this.setState((x) => ({
      nodes: x.nodes.map((n) => (n.id === u.id ? { ...n, summary: u.prev } : n)),
      undo: null
    }));
  }

  // ─────────────────────────────────────────────────────────── 노드 안 편집

  /** 노드 텍스트 더블클릭 → 그 자리에서 편집 (PRD §6) */
  startZoneEdit(id: string, zone: 'sum' | 'raw'): void {
    const n = this.byId()[id];
    if (!n) return;
    const z = zonesOf(n);
    const text = zone === 'sum' ? n.summary : z.isUtt || z.dual ? n.rawText || '' : n.summary;
    this.setState({ currentId: id, editId: id, editZone: zone, editText: text });
  }
  setEditText(v: string): void { this.setState({ editText: v }); }
  cancelEdit(): void { this.setState({ editId: null, editZone: null, editText: '' }); }
  commitEdit(): void {
    const id = this.state.editId;
    const v = this.state.editText.trim();
    if (!id) return;
    const zone = this.state.editZone || 'raw';
    this.setState((s) => ({
      // 더블클릭한 영역만 반영. raw 영역은 두 영역 구조일 때만 원문, 아니면 그 노드의 본문
      nodes: v
        ? s.nodes.map((n) => {
            if (n.id !== id) return n;
            if (zone === 'sum') return { ...n, summary: v };
            const z = zonesOf(n);
            return z.isUtt || z.dual ? { ...n, rawText: v } : { ...n, summary: v };
          })
        : s.nodes,
      editId: null, editZone: null, editText: ''
    }));
  }
  /** CV-3 — 요약 존과 원문 존은 각각 독립적으로 펼친다 */
  toggleZone(key: string, nodeId: string): void {
    this.setState(
      (x) => ({ expanded: { ...x.expanded, [key]: !x.expanded[key] } }),
      () => this.ensureVisible(nodeId)
    );
  }

  // ─────────────────────────────────────────────────────────── 캔버스 자유 텍스트 (PRD §6 T)

  addLabel(box: { x: number; y: number; w: number; h: number }): void {
    const id = 'L' + this.state.labelSeq;
    this.setState((st) => ({
      labels: st.labels.concat([{
        id, ...box, text: '', fs: 16, bold: false, underline: false, color: '#1677ff'
      }]),
      labelSeq: st.labelSeq + 1,
      labelEdit: id,
      labelSel: id,
      textMode: false,
      drawRect: null
    }));
  }
  patchLabel(id: string, patch: Partial<CanvasLabel>): void {
    this.setState((s) => ({ labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  removeLabel(id: string): void {
    this.setState((x) => ({
      labels: x.labels.filter((v) => v.id !== id),
      labelEdit: x.labelEdit === id ? null : x.labelEdit,
      labelSel: x.labelSel === id ? null : x.labelSel
    }));
  }
  setLabelEdit(id: string | null): void { this.setState({ labelEdit: id, labelSel: id }); }
  setLabelSel(id: string | null): void { this.setState({ labelSel: id, currentId: null }); }
  /** 빈 텍스트 박스는 닫을 때 사라진다 */
  closeLabel(): void {
    this.setState((s) => ({ labels: s.labels.filter((l) => l.text.trim() || l.src), labelEdit: null }));
  }

  /** 텍스트 박스 이동·리사이즈 시작점 등록 (전역 mousemove가 이어받는다) */
  beginLabelDrag(l: CanvasLabel, e: React.MouseEvent, handle?: string): void {
    this.lb0 = { id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, mx: e.clientX, my: e.clientY, handle };
    this.setState({ labelSel: l.id, currentId: null });
  }
  /** 노드 본체 누름 시작점 등록 (5px 넘게 끌면 옮기기로 전환) */
  beginNodeDrag(id: string, e: React.MouseEvent): void {
    this.nd0 = { id, x: e.clientX, y: e.clientY };
  }

  // ─────────────────────────────────────────────────────────── 장표 (PRD §7)

  addSlides(files: FileList | File[]): void {
    void filesToShots(files, (m) => this.setState({ notice: m })).then((shots) => {
      if (!shots.length) { this.setState({ notice: null }); return; }
      this.pushSlides(shots);
    });
  }
  private pushSlides(shots: Shot[]): void {
    this.setState(
      (s) => {
        // SLD-1 — 파일 여러 개를 연속 업로드해도 장표 번호가 이어진다
        const base = s.nodes.filter((n) => n.slideNo).length;
        const made: MeetNode[] = shots.map((it, k) => ({
          id: 'n' + (s.seq + k), parentId: null, kind: 'topic',
          slide: it.src, slideAr: it.ar || 16 / 9, slideNo: base + k + 1, slideDoc: it.doc,
          summary: '장표 ' + (base + k + 1), status: 'open', decidedAt: null
        }));
        return {
          nodes: s.nodes.concat(made),
          seq: s.seq + made.length,
          currentId: made[0].id,
          panel: 'node' as const
        };
      },
      () => {
        this.ensureVisible(this.state.currentId);
        this.notify(shots.length + '개 장표를 올렸습니다');
      }
    );
  }
  openLightbox(id: string | null): void { this.setState({ lightbox: id }); }

  // ─────────────────────────────────────────────────────────── 패널

  setPanel(v: 'node' | 'tracker' | null): void { this.setState({ panel: v }); }
  toggleTracker(): void {
    this.setState((s) => ({ panel: s.panel === 'tracker' ? null : 'tracker' }));
  }

  // ─────────────────────────────────────────────────── 미결 정리·회의록 (PRD §5.8)

  /** 회의 종료를 누르면 미결 노드를 하나씩 처리하는 화면으로 넘어간다 */
  goWrap(): void {
    const open = this.state.nodes.filter((n) => n.kind !== 'utt' && n.status !== 'decided');
    const orig: Record<string, Status> = {};
    open.forEach((n) => { orig[n.id] = n.status; });
    this.setState({ screen: 'wrap', wrapIds: open.map((n) => n.id), wrapOrig: orig, drag: null });
  }
  backToMeeting(): void { this.setState({ screen: 'meeting' }); }
  setWrap(id: string, choice: WrapChoice): void {
    if (choice !== 'next') this.setStatus(id, choice);
    this.setState((x) => ({ wrap: { ...x.wrap, [id]: choice } }));
  }
  undoWrap(id: string): void {
    const back = this.state.wrapOrig[id];
    if (back) this.setStatus(id, back);
    this.setState((x) => {
      const w = { ...x.wrap };
      delete w[id];
      return { wrap: w };
    });
  }
  /** 회의록이 나온 시점은 확정본이다 — 자동 주기를 기다리지 않고 바로 밀어낸다 */
  finish(): void { this.setState({ screen: 'minutes' }, () => void this.syncNow()); }
  toggleQuotes(id: string): void {
    this.setState((x) => ({ quotes: { ...x.quotes, [id]: !x.quotes[id] } }));
  }

  /** 배포 가능한 텍스트 회의록 (PRD §5.8 — 텍스트 복사) */
  minutesText(): string {
    const s = this.state;
    let out =
      '[회의록] ' + s.title + '\n' +
      this.clock() + ' 기준 · 참석 ' + s.participants.map((p) => this.label(p.id)).join('·') + '\n';
    for (const k of ORDER) {
      const rows = s.nodes.filter((n) => n.kind !== 'utt' && n.status === k);
      if (!rows.length) continue;
      out += '\n■ ' + ST[k].l + '\n';
      for (const n of rows) {
        out += ' • ' + n.summary + (n.decidedAt ? ' (' + n.decidedAt + ')' : '') + '\n';
        const oc = (n.outcome || '').trim();
        if (oc) out += '   → ' + oc + '\n';
      }
    }
    return out;
  }
  copyMinutes(): void {
    const t = this.minutesText();
    void navigator.clipboard?.writeText(t);
    this.setState({ copied: true });
    window.setTimeout(() => this.setState({ copied: false }), 1600);
  }
  newMeeting(): void {
    persist.clear();
    clearTimeout(this.cloudT);
    this.cloudT = undefined;
    this.measured = {}; this.measuredH = {}; this.hist = [];
    // 방금 끝낸 회의는 클라우드에 그대로 남는다 — 로그인 상태와 목록만 이어받는다
    const { account, cloudList } = this.state;
    this.setState(
      { ...initialState(), vw: window.innerWidth, account, cloudList },
      () => { if (account) void this.refreshCloudList(); }
    );
  }

  // ─────────────────────────────────────────────────────────── 캔버스 DOM 연결

  /**
   * 휠은 React 합성 이벤트가 아니라 네이티브 non-passive 리스너로 받는다.
   * 그래야 preventDefault가 통해 브라우저 자체 확대(⌘휠)와 겹치지 않는다(PRD §6).
   */
  setCanvas = (el: HTMLDivElement | null): void => {
    if (this.cv === el) return;
    if (this.cv && this.wheelH) this.cv.removeEventListener('wheel', this.wheelH);
    this.cv = el;
    if (!el) return;
    // 캔버스 자체를 포커스 가능하게 (테두리는 그리지 않는다 — 선택 표시는 노드가 한다)
    el.tabIndex = -1;
    el.style.outline = 'none';
    this.wheelH = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      // PRD §10 — 휠 델타를 정규화한다. 마우스 휠(deltaY 120)과 트랙패드(약 8)를
      // 같이 쓰면 확대가 계단처럼 튄다. 줄/페이지 단위를 픽셀로 환산하고
      // 이벤트당 폭을 24px로 제한해 한 칸 ≈ 5%로 맞춘다.
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
      const px = (v: number) => v * unit;
      if (ev.ctrlKey || ev.metaKey) {
        const d = Math.sign(ev.deltaY) * Math.min(Math.abs(px(ev.deltaY)), 24);
        this.zoomAt(this.state.zoom * Math.exp(-d * 0.002), ev.clientX - r.left, ev.clientY - r.top);
        return;
      }
      const dx = px(ev.shiftKey ? ev.deltaY || ev.deltaX : ev.deltaX);
      const dy = ev.shiftKey ? 0 : px(ev.deltaY);
      this.setState((x) => ({
        animate: false,
        pan: this.clampPan({ x: x.pan.x - dx, y: x.pan.y - dy }, x.zoom)
      }));
    };
    el.addEventListener('wheel', this.wheelH, { passive: false });
  };

  /** 툴바는 좁은 폭에서 두 줄로 접힌다 — 겹치는 레이어는 고정값이 아니라 실측 높이를 따라야 한다 */
  setBarEl = (el: HTMLDivElement | null): void => {
    if (!el || this.barEl === el) return;
    this.barEl = el;
    const sync = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h && h !== this.state.barH) this.setState({ barH: h });
    };
    sync();
    this.barRO?.disconnect();
    this.barRO = new ResizeObserver(sync);
    this.barRO.observe(el);
  };

  /**
   * 캔버스 바닥에서 시작한 mousedown만 팬·선택 해제로 친다.
   * 노드·툴바 위에서 시작한 것은 통과시킨다.
   */
  onCanvasDown = (e: React.MouseEvent): void => {
    const s = this.state;
    if (s.drag) return;
    const onBlank = (e.target as HTMLElement)?.getAttribute?.('data-pan') === '1';
    // T 텍스트 도구: 빈 곳에서 드래그해 텍스트 박스 영역을 직접 그린다
    if (s.textMode && !s.spaceDown && e.button === 0 && onBlank) {
      e.preventDefault();
      this.tb0 = { ...this.toCanvas(e.clientX, e.clientY), moved: false };
      return;
    }
    // CV-6 — 빈 공간을 클릭하면 선택이 해제되고 툴바·팝업·상세 패널이 함께 닫힌다.
    // mousedown이 텍스트칸의 blur보다 먼저 처리되므로, 편집 중이었다면 지우기 전에 먼저 커밋한다.
    if (!s.spaceDown && e.button === 0 && onBlank) {
      if (s.editId) this.commitEdit();
      if (s.currentId || s.compose || s.labelSel) {
        this.setState({ currentId: null, editId: null, focusId: null, compose: null, labelSel: null, panel: s.panel === 'node' ? null : s.panel });
      }
      return;
    }
    // 피그마와 동일: 스페이스를 누른 상태에서만 캔버스 이동 (또는 휠 클릭 드래그)
    if (!s.spaceDown && e.button !== 1) return;
    e.preventDefault();
    this.d0 = { x: e.clientX, y: e.clientY, pan: s.pan };
    this.setState({ panning: true });
  };

  /** 편집창은 항상 내용 전체가 보이는 높이로 자란다 (PRD §6 노드 텍스트 더블클릭) */
  fitEdit = (el: HTMLTextAreaElement | null): void => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 44) + 'px';
  };
  setEditEl = (el: HTMLTextAreaElement | null): void => {
    this.editEl = el;
    if (el) requestAnimationFrame(() => this.fitEdit(el));
  };

  // ─────────────────────────────────────────────────────────── 파생 뷰 데이터

  /** 미결 = 결정됨이 아닌 주제 노드. 트래커와 종료 화면이 함께 쓴다(PRD §5.7·§5.8) */
  openTopics(): MeetNode[] {
    return this.state.nodes.filter((n) => n.kind !== 'utt' && n.status !== 'decided');
  }
  topics(): MeetNode[] {
    return this.state.nodes.filter((n) => n.kind !== 'utt');
  }

  /** 노드 카드의 요약/원문 존 표시 정보 — 카드와 상세 패널이 같은 규칙을 쓴다 */
  zoneInfo(n: MeetNode) {
    const m = this.metrics();
    const z = zonesOf(n);
    const sumKey = n.id + ':sum';
    const rawKey = n.id + ':raw';
    return {
      ...z,
      sumKey,
      rawKey,
      sumLines: Math.max(1, lineCount(n.summary, ZONE.sum, false, sumKey, m)),
      rawLines: Math.max(1, lineCount(z.rawSrc, z.rawZ, false, rawKey, m)),
      sumEditLines: Math.max(2, lineCount(n.summary, ZONE.sum, true, sumKey, m)),
      rawEditLines: Math.max(3, lineCount(z.rawSrc, z.rawZ, true, rawKey, m))
    };
  }

  elapsedLabel(): string { return mmss(this.state.elapsed); }
  hasOutcomeFor(n: MeetNode): boolean { return hasOutcome(n); }

  render(): React.ReactNode {
    const s = this.state;
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          minWidth: 860,
          display: 'flex',
          flexDirection: 'column',
          background: '#f5f5f5',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {s.screen === 'setup' && <SetupScreen app={this} s={s} />}
        {s.screen === 'meeting' && <MeetingScreen app={this} s={s} />}
        {s.screen === 'wrap' && <WrapScreen app={this} s={s} />}
        {s.screen === 'minutes' && <MinutesScreen app={this} s={s} />}
      </div>
    );
  }
}
