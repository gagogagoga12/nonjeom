import { localSummarize } from './summarize';

/**
 * AI 요약 클라이언트 (PRD §8).
 *
 * - 서버(server/index.ts)가 떠 있으면 Claude로 요약한다.
 * - 서버가 없거나 실패·지연하면 로컬 규칙 요약기로 즉시 우회한다.
 *   AI는 보조 기능이므로 서비스가 멈추면 안 된다.
 * - 입력값은 해당 노드와 하위 발언 텍스트로만 한정한다.
 *   회의 전체를 통째로 보내지 않는다.
 */

const TIMEOUT_MS = 12000;

/** 서버 가용 여부. null이면 아직 확인 전. */
let available: boolean | null = null;

export function aiAvailable(): boolean | null {
  return available;
}

export async function probeAi(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/health', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error('unhealthy');
    const body = (await res.json()) as { ready?: boolean };
    available = !!body.ready;
  } catch {
    available = false;
  }
  return available;
}

export interface AiResult {
  text: string;
  /** 실제로 Claude가 답했는지, 로컬 요약기로 우회했는지 */
  source: 'claude' | 'local';
}

async function callAi(kind: 'summary' | 'outcome', payload: Record<string, unknown>): Promise<string | null> {
  if (available === false) return null;
  try {
    const res = await fetch('/api/ai/' + kind, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string };
    const text = (body.text || '').trim();
    if (!text) return null;
    available = true;
    return text;
  } catch {
    return null;
  }
}

/** 발언 요약 — 원문을 한 문장으로 줄여 요약 칸에 채운다. */
export async function aiSummary(raw: string, context?: string): Promise<AiResult> {
  const text = await callAi('summary', { raw, context });
  return text ? { text, source: 'claude' } : { text: localSummarize(raw), source: 'local' };
}

/** 결론 추출 — 결정·보류로 바꿀 때 하위 발언들에서 결론 한 줄을 뽑는다. */
export async function aiOutcome(
  topic: string,
  utterances: string[],
  status: 'decided' | 'hold'
): Promise<AiResult> {
  const text = await callAi('outcome', { topic, utterances, status });
  if (text) return { text, source: 'claude' };
  const src = utterances.slice(-3).join(' ') || topic;
  const body = localSummarize(src);
  return {
    text: status === 'hold' ? body + ' (이번 회의에서 결론 못 냄)' : body,
    source: 'local'
  };
}
