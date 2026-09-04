import type { CanvasLabel, MeetNode, Status, WrapChoice } from './types';

/**
 * 화면 컴포넌트가 호출하는 동작 모음. App이 이 인터페이스를 구현한다.
 * (App ↔ 화면 사이의 순환 import를 막고, 화면이 무엇을 할 수 있는지 한곳에 모은다)
 */
export interface AppApi {
  // ─ 세팅 (PRD §5.1)
  setTitle(v: string): void;
  setPartDraft(v: string): void;
  addParticipant(name: string): void;
  removeParticipant(id: string): void;
  setAgendaDraft(v: string): void;
  addAgenda(title: string): void;
  removeAgenda(index: number): void;
  stageFiles(files: FileList | File[]): void;
  removeDeckSlide(index: number): void;
  start(): void;
  loadSample(): void;
  resumeSaved(): void;
  discardSaved(): void;

  // ─ 클라우드 (Firestore · 선택 기능). 설정이나 로그인이 없으면 앱은 로컬 전용으로 돈다.
  cloudEnabled(): boolean;
  signInCloud(): Promise<void>;
  signOutCloud(): Promise<void>;
  refreshCloudList(): Promise<void>;
  openCloudMeeting(id: string): Promise<void>;
  deleteCloudMeeting(id: string): Promise<void>;
  syncCloudNow(): void;

  // ─ 캔버스 (PRD §5.2·§6)
  select(id: string | null): void;
  setHover(id: string | null): void;
  toggleFold(id: string): void;
  focusOn(id: string, markFocus?: boolean): void;
  backToRoot(): void;
  zoomAt(next: number, px?: number, py?: number): void;
  setSlideZoom(i: number): void;
  addSlides(files: FileList | File[]): void;
  deleteNode(id: string): void;
  moveSibling(id: string, dir: 1 | -1): void;
  undoLast(): void;
  notify(msg: string): void;

  // ─ 발언 입력 (PRD §5.3) — 한 팝오버 안에 화자별 칸(entries)을 여러 개 쌓았다가 한 번에 나눈다
  openCompose(parentId: string): void;
  setComposeText(i: number, v: string): void;
  setComposeSpeaker(i: number, id: string): void;
  cycleComposeSpeaker(i: number, back: boolean): void;
  addComposeEntry(): void;
  removeComposeEntry(i: number): void;
  splitCompose(): void;
  closeCompose(): void;

  // ─ 일단 적어두기 (PRD §5.4)
  openQuick(): void;
  setQuickText(v: string): void;
  toggleQuickSpeaker(id: string): void;
  cycleQuickSpeaker(back: boolean): void;
  commitQuick(keepOpen: boolean): void;
  closeQuick(): void;
  sortAsTopic(id: string): void;
  sortAsUtterance(id: string, speaker: string): void;

  // ─ 상태·결론 (PRD §5.5)
  setStatus(id: string, k: Status): void;
  patchNode(id: string, patch: Partial<MeetNode>): void;
  promote(id: string): void;
  summarizeNode(id: string): void;
  fillOutcome(id: string): void;
  undoSummary(): void;

  // ─ 노드 안에서 바로 고치기
  startZoneEdit(id: string, zone: 'sum' | 'raw'): void;
  setEditText(v: string): void;
  commitEdit(): void;
  cancelEdit(): void;
  toggleZone(key: string, nodeId: string): void;

  // ─ 자유 텍스트·이미지 (PRD §6 T 도구)
  addLabel(box: Pick<CanvasLabel, 'x' | 'y' | 'w' | 'h'>): void;
  patchLabel(id: string, patch: Partial<CanvasLabel>): void;
  removeLabel(id: string): void;
  setLabelEdit(id: string | null): void;
  setLabelSel(id: string | null): void;
  closeLabel(): void;

  // ─ 패널·라이트박스
  setPanel(v: 'node' | 'tracker' | null): void;
  toggleTracker(): void;
  openLightbox(id: string | null): void;

  // ─ 미결 정리와 회의록 (PRD §5.8)
  goWrap(): void;
  backToMeeting(): void;
  setWrap(id: string, choice: WrapChoice): void;
  undoWrap(id: string): void;
  finish(): void;
  toggleQuotes(id: string): void;
  copyMinutes(): void;
  newMeeting(): void;
}
