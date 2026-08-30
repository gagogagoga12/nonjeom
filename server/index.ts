import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI 요약 서버 (PRD §8).
 *
 * 브라우저에 API 키를 두지 않기 위한 얇은 프록시. 두 가지 일만 한다.
 *  - POST /api/ai/summary : 발언 원문 → 한 문장 요약
 *  - POST /api/ai/outcome : 하위 발언들 → 결론/보류 사유 한 줄
 *
 * AI는 선택적·보조적이다. 이 서버가 없어도 앱은 로컬 요약기로 온전히 동작하며,
 * 실패·지연 시 클라이언트가 즉시 로컬로 우회한다(src/lib/ai.ts).
 * 입력값은 해당 노드와 하위 발언 텍스트로만 한정한다 — 회의 전체를 보내지 않는다.
 */

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MODEL = process.env.AI_MODEL || 'claude-opus-5';
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
// 키가 없으면 클라이언트가 /health에서 ready:false를 보고 아예 호출하지 않는다.
const client = hasKey ? new Anthropic() : null;

/** 회의록 문체 규칙. 모델 호출마다 동일하게 유지해 캐시 프리픽스를 깨지 않는다. */
const SYSTEM = [
  '너는 한국어 회의록 정리 도구다. 회의 기록자가 갈겨쓴 발언을 다듬는다.',
  '규칙:',
  '- 출력은 설명·따옴표·머리기호 없이 결과 문장 하나만 낸다.',
  '- 평서형 개조식으로 쓴다. 예: "~한다", "~하기로 함", "~필요함".',
  '- 46자를 넘기지 않는다.',
  '- 원문에 없는 사실을 지어내지 않는다. 애매하면 원문 표현을 그대로 살린다.',
  '- 발언자 이름을 문장에 넣지 않는다.'
].join('\n');

interface AiOk { text: string }

async function ask(userText: string): Promise<AiOk> {
  const res = await client!.beta.messages.create({
    model: MODEL,
    max_tokens: 300,
    // 한 문장 요약은 가벼운 작업이다 — 낮은 effort로 지연과 비용을 줄인다.
    output_config: { effort: 'low' },
    // 정책 거절 시 서버가 같은 요청을 대체 모델로 다시 돌린다.
    // 회의 발언에는 거의 걸리지 않지만, 걸렸을 때 요약이 조용히 비는 것을 막는다.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // 문체 규칙은 매 호출 동일하다 — 캐시 프리픽스로 둔다.
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userText }]
  });
  // 체인 전체가 거절하면 content를 읽기 전에 stop_reason에서 걸러낸다.
  if (res.stop_reason === 'refusal') return { text: '' };
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return { text: text.split('\n')[0].slice(0, 120) };
}

app.get('/api/ai/health', (_req, res) => {
  res.json({ ready: hasKey, model: hasKey ? MODEL : null });
});

/** 발언 요약 — 원문을 한 문장으로 줄인다 */
app.post('/api/ai/summary', async (req, res) => {
  const raw = String(req.body?.raw ?? '').slice(0, 4000);
  const context = String(req.body?.context ?? '').slice(0, 400);
  if (!client || !raw.trim()) { res.status(400).json({ text: '' }); return; }
  try {
    const prompt =
      (context ? `상위 논의 주제: ${context}\n\n` : '') +
      `다음 발언을 한 문장으로 요약해라.\n\n${raw}`;
    res.json(await ask(prompt));
  } catch (err) {
    // 실패해도 클라이언트가 로컬 요약기로 우회하므로 서비스는 멈추지 않는다.
    console.error('[ai/summary]', err);
    res.status(502).json({ text: '' });
  }
});

/** 결론 추출 — 하위 발언에서 결정 사항 또는 보류 사유 한 줄을 뽑는다 */
app.post('/api/ai/outcome', async (req, res) => {
  const topic = String(req.body?.topic ?? '').slice(0, 400);
  const status = req.body?.status === 'hold' ? 'hold' : 'decided';
  const utterances: string[] = Array.isArray(req.body?.utterances)
    ? req.body.utterances.slice(-12).map((u: unknown) => String(u).slice(0, 600))
    : [];
  if (!client || !utterances.length) { res.status(400).json({ text: '' }); return; }
  try {
    const prompt = [
      `논의 주제: ${topic}`,
      '',
      '발언들:',
      ...utterances.map((u) => '- ' + u),
      '',
      status === 'hold'
        ? '이 주제는 보류됐다. 무엇이 막혀 결론을 못 냈는지 한 줄로 적어라.'
        : '이 주제는 결정됐다. 무엇을 어떻게 하기로 했는지 한 줄로 적어라.'
    ].join('\n');
    res.json(await ask(prompt));
  } catch (err) {
    console.error('[ai/outcome]', err);
    res.status(502).json({ text: '' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`[논점] AI 서버 :${port} — ${hasKey ? `모델 ${MODEL}` : 'ANTHROPIC_API_KEY 없음 (로컬 요약기로 동작)'}`);
});
