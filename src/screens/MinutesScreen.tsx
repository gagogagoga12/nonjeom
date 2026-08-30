import React from 'react';
import { Tag } from 'antd';
import { ORDER, ST } from '../constants';
import { pathOf } from '../lib/layout';
import { dateLabel, hhmm, personLabel } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';

/**
 * PRD §5.8 회의록.
 * 제목·시각·참석자·주제 수·발언 수, 상태별 집계, 상태별 항목(경로·결정 시각·
 * 원본 발언 펼쳐보기)이 담긴다. 텍스트 복사와 새 회의 시작을 제공한다.
 */
export default function MinutesScreen({ app, s }: { app: App; s: AppState }): React.ReactElement {
  const topics = app.topics();
  const uttCount = s.nodes.length - topics.length;

  const groups = ORDER.map((k) => {
    const st = ST[k];
    const rows = topics.filter((n) => n.status === k);
    return {
      k,
      st,
      label: k === 'open' ? '논의중 (다음 회의 이월)' : k === 'bait' ? '떡밥 (나중에)' : st.l,
      rows
    };
  }).filter((g) => g.rows.length);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          minHeight: 54, flex: 'none', display: 'flex', alignItems: 'center', gap: 13,
          padding: '0 20px', background: '#001529', color: '#fff'
        }}
      >
        <div
          onClick={() => app.backToMeeting()}
          style={{
            flex: 'none', whiteSpace: 'nowrap', padding: '6px 11px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,.22)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          ← 회의로
        </div>
        <div style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600 }}>회의록</div>
        <div
          style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 12, color: 'rgba(255,255,255,.5)'
          }}
        >
          자동 생성 · 방금 정리됨
        </div>
        <div style={{ flex: 'none', display: 'flex', gap: 7 }}>
          <div
            onClick={() => app.copyMinutes()}
            style={{
              whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,.22)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {s.copied ? '복사됨' : '텍스트 복사'}
          </div>
          <div
            onClick={() => app.newMeeting()}
            style={{
              whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 6, background: '#fff',
              color: 'rgba(0,0,0,.88)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            새 회의
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1, minHeight: 0, overflow: 'auto', background: '#f5f5f5', padding: '26px 24px 40px',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start'
        }}
      >
        <div
          style={{
            flex: 'none', width: '100%', maxWidth: 880, background: '#fff',
            border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, padding: '34px 38px 40px'
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0,0,0,.88)', letterSpacing: '-.03em', lineHeight: 1.35 }}>
            {s.title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)', padding: '10px 0 22px' }}>
            {dateLabel(s.startedAt)} {hhmm(s.startedAt)}–{app.clock()} · 참석{' '}
            {s.participants.map((p) => personLabel(s.participants, p.id)).join('·')} · 주제 {topics.length} · 발언 {uttCount}
          </div>

          {/* 상태별 집계 */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,.1)' }}>
            {ORDER.map((k) => (
              <div
                key={k}
                style={{
                  flex: 1, border: '1px solid rgba(0,0,0,.1)', borderRadius: 6, padding: '12px 13px',
                  background: '#fafafa', marginBottom: 18
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: ST[k].c, letterSpacing: '-.02em' }}>
                  {topics.filter((n) => n.status === k).length}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <Tag color={ST[k].tone}>{ST[k].l}</Tag>
                </div>
              </div>
            ))}
          </div>

          {groups.map((g) => (
            <div key={g.k} style={{ padding: '22px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 13 }}>
                <div style={{ width: 11, height: 11, borderRadius: 2, background: g.st.c }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,.88)', letterSpacing: '-.02em' }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: g.st.c }}>{g.rows.length}</div>
              </div>

              {g.rows.map((n) => {
                const utts = app.uttsOf(n.id);
                const open = !!s.quotes[n.id];
                const oc = (n.outcome || '').trim();
                return (
                  <div key={n.id} style={{ borderLeft: `2px solid ${g.st.c}`, paddingLeft: 15, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)', lineHeight: 1.5 }}>
                      {n.summary}
                    </div>
                    {oc && (
                      <div
                        style={{
                          marginTop: 6, padding: '7px 10px', borderRadius: 6, background: g.st.bg,
                          fontSize: 12, fontWeight: 600, color: g.st.c, lineHeight: 1.6
                        }}
                      >
                        {n.status === 'hold' ? '보류 사유' : '결정 사항'} — {oc}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 6 }}>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                        {(pathOf(s.nodes, n.id).slice(0, -1).join(' › ') || '최상위 안건')}
                        {n.decidedAt ? ' · ' + n.decidedAt : ''}
                        {s.wrap[n.id] === 'next' ? ' · 다음 회의로 이월' : ''}
                      </div>
                      {utts.length > 0 && (
                        <div
                          onClick={() => app.toggleQuotes(n.id)}
                          style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.65)', cursor: 'pointer' }}
                        >
                          {open ? '원본 발언 접기' : `원본 발언 ${utts.length}건 보기`}
                        </div>
                      )}
                    </div>
                    {open && (
                      <div
                        style={{
                          marginTop: 10, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6,
                          padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 7
                        }}
                      >
                        {utts.map((u) => (
                          <div key={u.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
                                {personLabel(s.participants, u.speaker)}
                              </span>
                              <span style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{u.at}</span>
                            </div>
                            {u.summary.trim() && (
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)', paddingTop: 3 }}>
                                {u.summary}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)', paddingTop: 2, lineHeight: 1.6 }}>
                              {u.rawText || u.summary}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {!s.nodes.length && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: 'rgba(0,0,0,.45)' }}>
              기록된 내용이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
