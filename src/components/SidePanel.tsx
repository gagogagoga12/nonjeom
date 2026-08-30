import React from 'react';
import { Badge, Button, Progress, Tag } from 'antd';
import { ORDER, ST } from '../constants';
import { pathOf, slideBoxH } from '../lib/layout';
import { personLabel } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';
import type { Status } from '../types';

/**
 * 우측 패널. 두 기능은 별개이며 탭으로 묶지 않는다(PRD §5.7).
 * - 노드 상세: 노드를 클릭하면 열리고, 선택이 풀리면 함께 닫힌다(§5.5).
 * - 미결 트래커: 툴바의 전용 버튼으로 여닫는다.
 */
export default function SidePanel({ app, s }: { app: App; s: AppState }): React.ReactElement | null {
  const cur = s.currentId ? app.byId()[s.currentId] : null;
  const open = s.panel === 'tracker' || (s.panel === 'node' && !!cur);
  if (!open) return null;

  return (
    <>
      {/* 좁은 창에서는 패널이 캔버스 위를 덮는다 — 스크림은 툴바 실측 높이 아래에서 시작한다 */}
      <div
        className="nj-panel-scrim"
        onClick={() => app.setPanel(null)}
        style={{ position: 'absolute', inset: `${s.barH}px 0 0 0`, background: 'rgba(0,0,0,.18)', zIndex: 65 }}
      />
      <div
        className="nj-panel"
        style={{
          flex: 'none', width: 320, background: '#fff', borderLeft: '1px solid #f0f0f0',
          display: 'flex', flexDirection: 'column', minHeight: 0,
          animation: 'nj-panel-in .2s cubic-bezier(.23,1,.32,1)'
        }}
      >
        <div
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 12px 16px',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
            {s.panel === 'tracker' ? '미결 트래커' : '노드 상세'}
          </div>
          <div
            onClick={() => app.setPanel(null)}
            style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 14, color: 'rgba(0,0,0,.45)', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </div>
        </div>
        {s.panel === 'tracker' ? <Tracker app={app} s={s} /> : cur ? <NodeDetail app={app} s={s} /> : null}
      </div>
    </>
  );
}

/** PRD §5.7 미결 트래커 — 상태별로 묶어 보여주고, 행을 클릭하면 캔버스가 그 노드로 이동한다 */
function Tracker({ app, s }: { app: App; s: AppState }): React.ReactElement {
  const topics = app.topics();
  const open = app.openTopics();
  const pct = topics.length ? Math.round(((topics.length - open.length) / topics.length) * 100) : 0;
  const groups = ORDER.map((k) => {
    const st = ST[k];
    const items = topics.filter((n) => n.status === k);
    return { k, st, items };
  }).filter((g) => g.items.length);

  return (
    <>
      <div style={{ padding: '14px 16px 13px', flex: 'none', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)' }}>
          남은 미결 <b style={{ color: '#ff4d4f' }}>{open.length}</b> / {topics.length}
        </div>
        <div style={{ marginTop: 9 }}>
          <Progress percent={pct} showInfo={false} size="small" />
        </div>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 8 }}>
          {open.length ? '결정됨이 아닌 항목만 처리하면 회의가 끝납니다.' : '미결이 없습니다.'}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '6px 0 16px' }}>
        {groups.map((g) => (
          <div key={g.k} style={{ padding: '9px 16px 10px' }}>
            <div style={{ paddingBottom: 8 }}>
              <Tag color={g.st.tone}>
                {g.st.l} {g.items.length}
              </Tag>
            </div>
            {g.items.map((n) => {
              const on = s.focusId === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => app.focusOn(n.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', marginBottom: 4,
                    borderRadius: 8, background: on ? g.st.bg : '#fff',
                    border: `1px solid ${on ? g.st.c : 'rgba(0,0,0,.09)'}`, cursor: 'pointer',
                    transition: 'background .18s,border-color .18s'
                  }}
                >
                  <div style={{ width: 3, height: 17, borderRadius: 2, background: g.st.c, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                    >
                      {n.summary}
                    </div>
                    <div
                      style={{
                        fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                    >
                      {pathOf(s.nodes, n.id).slice(0, -1).join(' › ') || '최상위 안건'}
                    </div>
                  </div>
                  <div style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)' }}>
                    {on ? '보는 중' : '↗'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {!groups.length && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
            아직 주제가 없습니다.
          </div>
        )}
      </div>
    </>
  );
}

/** 노드 상세 — 요약 칸과 원문 칸을 함께 노출하고 둘 다 수정 가능하다(PRD §5.5) */
function NodeDetail({ app, s }: { app: App; s: AppState }): React.ReactElement | null {
  const cur = s.currentId ? app.byId()[s.currentId] : null;
  if (!cur) return null;
  const isUtt = cur.kind === 'utt';
  // 원문이 있는 노드(발언·승격된 발언)는 요약과 원문을 항상 둘 다 편집한다
  const curTwo = !!(cur.rawText || '').trim();
  const st = ST[cur.status] ?? ST.open;
  const showOutcome = app.hasOutcomeFor(cur);
  const utts = app.uttsOf(cur.id);
  const kids = s.nodes.filter((n) => n.parentId === cur.id).length;

  const label = (t: string) => (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', letterSpacing: '.08em' }}>{t}</div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            padding: '2px 7px', borderRadius: 4,
            background: isUtt ? '#f0f0f0' : '#1677ff',
            color: isUtt ? 'rgba(0,0,0,.65)' : '#fff',
            fontSize: 12, fontWeight: 600, letterSpacing: '.04em'
          }}
        >
          {isUtt ? '발언' : '논의 주제'}
        </div>
        <div
          style={{
            flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}
        >
          {isUtt
            ? personLabel(s.participants, cur.speaker) + ' · ' + (cur.at ?? '')
            : (pathOf(s.nodes, cur.id).slice(0, -1).join(' › ') || '최상위 안건') +
              (cur.decidedAt ? ' · ' + cur.decidedAt : '')}
        </div>
        {kids > 0 && (
          <div
            onClick={() => app.toggleFold(cur.id)}
            style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.65)', cursor: 'pointer' }}
          >
            {s.collapsed[cur.id] ? `가지 펼치기 (${kids})` : '가지 접기'}
          </div>
        )}
      </div>

      {/* SLD-5 — 상세 패널의 큰 미리보기, 누르면 전체 화면 라이트박스 */}
      {cur.slide && (
        <div
          onClick={() => app.openLightbox(cur.id)}
          style={{
            position: 'relative', width: '100%', height: Math.min(200, slideBoxH(cur, 1)),
            borderRadius: 6, border: '1px solid #f0f0f0',
            background: `#fafafa center/contain no-repeat url("${cur.slide}")`, cursor: 'zoom-in'
          }}
        >
          <div
            style={{
              position: 'absolute', right: 8, bottom: 8, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: 12, fontWeight: 600
            }}
          >
            크게 보기
          </div>
        </div>
      )}

      {/* 요약 칸 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          {label(cur.unsorted ? '적어둔 내용' : curTwo ? '요약: 결국 하고 싶은 말' : '주제 제목')}
          <div
            onClick={() => app.summarizeNode(cur.id)}
            style={{
              marginLeft: 'auto', padding: '4px 9px', borderRadius: 6, background: '#1677ff', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {s.aiBusy === cur.id ? 'AI 요약 중…' : 'AI 요약'}
          </div>
        </div>
        <textarea
          value={cur.summary}
          onChange={(e) => app.patchNode(cur.id, { summary: e.target.value })}
          placeholder={curTwo ? 'AI 요약을 누르거나 직접 한 문장으로 적어주세요' : '논의 주제 한 줄'}
          style={{
            width: '100%', height: curTwo ? 86 : 62, resize: 'none', border: '1px solid #d9d9d9',
            borderRadius: 6, padding: 10, fontSize: 14, fontWeight: 600, lineHeight: 1.45,
            color: 'rgba(0,0,0,.88)', background: '#fff'
          }}
        />
      </div>

      {/* 발언 원문 칸 */}
      {curTwo && (
        <div>
          <div style={{ paddingBottom: 8 }}>{label('발언 원문')}</div>
          <textarea
            value={cur.rawText ?? ''}
            onChange={(e) => app.patchNode(cur.id, { rawText: e.target.value })}
            placeholder="들은 대로 구구절절 적어두는 칸"
            style={{
              width: '100%',
              // 아래에 추가 정보가 없는 발언 노드에서는 입력칸이 넉넉히 늘어난다
              height: utts.length ? 150 : 212,
              resize: 'none', border: '1px solid #d9d9d9', borderRadius: 6, padding: 10,
              fontSize: 12, lineHeight: 1.6, color: 'rgba(0,0,0,.65)', background: '#fff'
            }}
          />
        </div>
      )}

      {/* 미분류 메모 정리 (PRD §5.4) */}
      {cur.unsorted && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 8,
            background: '#fffbe6', border: '1px solid #ffe58f'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#d48806' }}>미분류 메모, 정리하세요</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
            {cur.speaker ? personLabel(s.participants, cur.speaker) + ' · ' : ''}
            {cur.at} 에 적어둔 메모
          </div>
          <div
            onClick={() => app.sortAsTopic(cur.id)}
            style={{
              padding: 8, borderRadius: 6, background: '#1677ff', color: '#fff', fontSize: 12,
              fontWeight: 600, textAlign: 'center', cursor: 'pointer'
            }}
          >
            안건으로 확정
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#d48806' }}>발언으로 →</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {s.participants.map((p) => (
              <div
                key={p.id}
                onClick={() => app.sortAsUtterance(cur.id, p.id)}
                style={{
                  padding: '4px 9px', borderRadius: 6, background: '#fff', border: '1px solid #d9d9d9',
                  fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)', cursor: 'pointer'
                }}
              >
                {personLabel(s.participants, p.id)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRD §5.6 승격 */}
      {isUtt && (
        <div
          onClick={() => app.promote(cur.id)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 9, borderRadius: 6,
            background: '#1677ff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          ↑ 논의 주제로 올리기
        </div>
      )}

      {/* PRD §5.5 상태는 캔버스가 아니라 이 패널에서 고른다 */}
      {!isUtt && (
        <div>
          <div style={{ paddingBottom: 8 }}>{label('상태')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {ORDER.map((k) => {
              const p = ST[k];
              const on = cur.status === k;
              return (
                <div
                  key={k}
                  onClick={() => app.setStatus(cur.id, k as Status)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '7px 4px', borderRadius: 6,
                    background: on ? p.bg : '#fff',
                    border: `1px solid ${on ? p.c : 'rgba(0,0,0,.14)'}`,
                    color: on ? p.c : 'rgba(0,0,0,.65)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background .1s,border-color .1s'
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.c }} />
                  {p.l}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 결정·보류로 바꾼 안건은 결론 칸이 열린다 */}
      {showOutcome && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 8,
            background: st.bg, border: `1px solid ${st.c}44`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: st.c, letterSpacing: '.06em' }}>
              {cur.status === 'hold' ? '보류 사유' : '결정 사항'}
            </div>
            <div
              onClick={() => app.fillOutcome(cur.id)}
              style={{
                flex: 'none', padding: '4px 9px', borderRadius: 6, background: st.c, color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {s.aiBusy === cur.id ? '정리 중…' : 'AI로 정리'}
            </div>
          </div>
          <textarea
            value={cur.outcome ?? ''}
            onChange={(e) => app.patchNode(cur.id, { outcome: e.target.value })}
            placeholder={
              cur.status === 'hold' ? '무엇이 막혀 보류했는지 한두 줄로' : '무엇을 어떻게 하기로 했는지 한두 줄로'
            }
            style={{
              width: '100%', height: 76, resize: 'none', border: `1px solid ${st.c}44`, borderRadius: 8,
              padding: '9px 10px', background: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.6,
              color: 'rgba(0,0,0,.88)'
            }}
          />
          <div style={{ fontSize: 12, color: st.c, opacity: 0.7 }}>
            노드 카드 아래 띠에 그대로 표시되고 회의록에 함께 나갑니다
          </div>
        </div>
      )}

      {/* 이 주제에 달린 발언 */}
      {!isUtt && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 'none', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {label('이 주제에 달린 발언')}
            <Badge count={utts.length} showZero color="#1677ff" />
          </div>
          {utts.map((u) => (
            <div
              key={u.id}
              onClick={() => app.focusOn(u.id, false)}
              style={{
                border: '1px solid #f0f0f0', borderRadius: 6, padding: '9px 11px', marginBottom: 6,
                background: '#fafafa', cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
                  {personLabel(s.participants, u.speaker)}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{u.at}</div>
                <div
                  onClick={(e) => { e.stopPropagation(); app.promote(u.id); }}
                  style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#1677ff', cursor: 'pointer' }}
                >
                  ↑ 주제로
                </div>
              </div>
              {u.summary.trim() && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)', paddingTop: 5, lineHeight: 1.5 }}>
                  {u.summary}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)', paddingTop: 4, lineHeight: 1.6 }}>{u.rawText}</div>
            </div>
          ))}
          {!utts.length && (
            <div
              style={{
                border: '1px dashed rgba(0,0,0,.16)', borderRadius: 6, padding: 16, textAlign: 'center',
                fontSize: 12, color: 'rgba(0,0,0,.45)'
              }}
            >
              노드 우측 <b>+</b> 버튼으로 발언을 붙이세요
            </div>
          )}
          <Button style={{ marginTop: 4 }} onClick={() => app.openCompose(cur.id)}>
            발언 추가
          </Button>
        </div>
      )}
    </div>
  );
}
