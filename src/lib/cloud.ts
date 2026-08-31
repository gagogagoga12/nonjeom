import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, where, type Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { CanvasLabel, MeetNode, Participant, Screen, Status, WrapChoice } from '../types';

/**
 * Firestore 회의 저장소 (PRD §11 "회의 데이터 영속화 범위"에 대한 답).
 *
 * 로컬 우선, 클라우드 동기화. localStorage가 회의 중 진실의 원본이고(§9 데이터 유실),
 * Firestore는 회의 단위 저장·목록·재열람을 담당한다.
 *
 * 접근 제어는 firestore.rules에서 ownerId == request.auth.uid로 건다.
 */

const COL = 'meetings';

/** Firestore 문서 1MB 한계. 장표 이미지(data URI)는 이 한계를 즉시 넘긴다. */
const DOC_LIMIT = 1_000_000;

export interface CloudMeeting {
  id: string;
  ownerId: string;
  title: string;
  screen: Screen;
  participants: Participant[];
  agendas: string[];
  nodes: MeetNode[];
  labels: CanvasLabel[];
  seq: number;
  labelSeq: number;
  partSeq: number;
  startedAt: number;
  elapsed: number;
  collapsed: Record<string, boolean>;
  wrap: Record<string, WrapChoice>;
  wrapIds: string[] | null;
  wrapOrig: Record<string, Status>;
  /** 장표 이미지는 이 기기(localStorage)에만 있다는 표시 */
  slidesLocalOnly: boolean;
  updatedAt: number;
}

/** 목록 화면에 필요한 만큼만 */
export interface MeetingSummary {
  id: string;
  title: string;
  screen: Screen;
  startedAt: number;
  updatedAt: number;
  topicCount: number;
  uttCount: number;
  openCount: number;
}

/**
 * 장표·붙여넣은 이미지의 data URI를 떼어낸다.
 *
 * 한 장이 수백 KB라 Firestore 문서 한계(1MB)를 바로 넘긴다. 노드 자체는 남기고
 * 이미지만 뺀다 — 회의록 구조는 어느 기기에서든 온전히 열리고, 장표 그림만
 * 올린 기기에 남는다. (Firebase Storage 연동은 후속 — README 참조)
 */
function stripHeavy(nodes: MeetNode[], labels: CanvasLabel[]) {
  let stripped = false;
  const outNodes = nodes.map((n) => {
    if (!n.slide) return n;
    stripped = true;
    const { slide: _slide, ...rest } = n;
    return rest as MeetNode;
  });
  const outLabels = labels
    .map((l) => {
      if (!l.src) return l;
      stripped = true;
      const { src: _src, ...rest } = l;
      return rest as CanvasLabel;
    })
    // 이미지가 전부였던 자유 요소는 알맹이가 없으므로 버린다
    .filter((l) => l.text.trim());
  return { nodes: outNodes, labels: outLabels, stripped };
}

/** undefined 필드는 Firestore가 거부한다 — 재귀적으로 걷어낸다 */
function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) out[k] = clean(val);
    }
    return out as T;
  }
  return v;
}

export type SaveResult =
  | { ok: true; slidesLocalOnly: boolean }
  | { ok: false; reason: 'offline' | 'too-large' | 'error' };

export async function saveMeeting(
  ownerId: string,
  id: string,
  data: Omit<CloudMeeting, 'id' | 'ownerId' | 'slidesLocalOnly' | 'updatedAt'>
): Promise<SaveResult> {
  const store = db();
  if (!store) return { ok: false, reason: 'offline' };
  const { nodes, labels, stripped } = stripHeavy(data.nodes, data.labels);
  const payload = clean({
    ...data,
    nodes,
    labels,
    ownerId,
    slidesLocalOnly: stripped,
    // 목록 정렬·표시용 집계. 문서를 통째로 읽지 않고도 목록을 그릴 수 있다.
    topicCount: nodes.filter((n) => n.kind !== 'utt').length,
    uttCount: nodes.filter((n) => n.kind === 'utt').length,
    openCount: nodes.filter((n) => n.kind !== 'utt' && n.status !== 'decided').length
  });
  const size = JSON.stringify(payload).length;
  if (size > DOC_LIMIT) return { ok: false, reason: 'too-large' };
  try {
    await setDoc(doc(store, COL, id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true, slidesLocalOnly: stripped };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function millis(v: unknown): number {
  if (typeof v === 'number') return v;
  const t = v as Timestamp | undefined;
  return t?.toMillis ? t.toMillis() : 0;
}

export async function listMeetings(ownerId: string, max = 20): Promise<MeetingSummary[]> {
  const store = db();
  if (!store) return [];
  try {
    const snap = await getDocs(
      query(collection(store, COL), where('ownerId', '==', ownerId), orderBy('updatedAt', 'desc'), limit(max))
    );
    return snap.docs.map((d) => {
      const v = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        title: (v.title as string) || '제목 없는 회의',
        screen: (v.screen as Screen) || 'meeting',
        startedAt: (v.startedAt as number) || 0,
        updatedAt: millis(v.updatedAt),
        topicCount: (v.topicCount as number) ?? 0,
        uttCount: (v.uttCount as number) ?? 0,
        openCount: (v.openCount as number) ?? 0
      };
    });
  } catch {
    // 색인이 아직 안 만들어졌거나 권한이 없으면 목록만 비운다 — 앱은 계속 돈다
    return [];
  }
}

export async function loadMeeting(id: string): Promise<CloudMeeting | null> {
  const store = db();
  if (!store) return null;
  try {
    const snap = await getDoc(doc(store, COL, id));
    if (!snap.exists()) return null;
    const v = snap.data() as Record<string, unknown>;
    return {
      id: snap.id,
      ownerId: v.ownerId as string,
      title: (v.title as string) || '제목 없는 회의',
      screen: (v.screen as Screen) || 'meeting',
      participants: (v.participants as Participant[]) || [],
      agendas: (v.agendas as string[]) || [],
      nodes: (v.nodes as MeetNode[]) || [],
      labels: (v.labels as CanvasLabel[]) || [],
      seq: (v.seq as number) || 1,
      labelSeq: (v.labelSeq as number) || 1,
      partSeq: (v.partSeq as number) || 1,
      startedAt: (v.startedAt as number) || Date.now(),
      elapsed: (v.elapsed as number) || 0,
      collapsed: (v.collapsed as Record<string, boolean>) || {},
      wrap: (v.wrap as Record<string, WrapChoice>) || {},
      wrapIds: (v.wrapIds as string[] | null) ?? null,
      wrapOrig: (v.wrapOrig as Record<string, Status>) || {},
      slidesLocalOnly: !!v.slidesLocalOnly,
      updatedAt: millis(v.updatedAt)
    };
  } catch {
    return null;
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const store = db();
  if (!store) return false;
  try {
    await deleteDoc(doc(store, COL, id));
    return true;
  } catch {
    return false;
  }
}

/** 회의 문서 id. 브라우저 표준 crypto만 쓴다. */
export function newMeetingId(): string {
  return 'm-' + (crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
}
