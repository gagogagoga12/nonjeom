import React from 'react';
import { Button, Progress } from 'antd';
import { ST } from '../constants';
import { pathOf } from '../lib/layout';
import type App from '../App';
import type { AppState } from '../App';

/**
 * PRD §5.8 미결 정리.
 * 회의 종료를 누르면 미결 노드를 하나씩 처리하는 화면으로 넘어간다.
 * 각 행에서 결정·보류·떡밥·다음 회의로 중 하나를 고른다(되돌리기 가능).
 * 전부 처리해야 회의록 생성이 활성화된다.
 */
export default function WrapScreen({ app, s }: { app: App; s: AppState }): React.ReactElement {
  const byId = app.byId();
  const set = s.wrapIds?.length ? s.wrapIds.map((id) => byId[id]).filter(Boolean) : app.openTopics();
  const done = set.filter((n) => s.wrap[n.id]).length;
  const pct = set.length ? Math.round((done / set.length) * 100) : 100;
  const allDone = done === set.length;

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
        <div style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600 }}>회의를 끝내기 전에</div>
        <div
          style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 12, color: 'rgba(255,255,255,.55)'
          }}
        >
          미결 노드 {set.length - done}개가 남았습니다
        </div>
        <div style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
          {s.title} · {app.elapsedLabel()}
        </div>
      </div>

      {/* PRD §10 — 중앙 정렬 스크롤 컨테이너에는 align-items:flex-start를 함께 준다.
          justify-content:center만 주면 stretch가 카드를 화면 높이로 늘린다. */}
      <div
        style={{
          flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          overflow: 'auto', background: '#f5f5f5', padding: 24
        }}
      >
        <div style={{ flex: 'none', width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Progress percent={pct} showInfo={false} />
            </div>
            <div style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
              {done} / {set.length} 처리
            </div>
          </div>

          {set.map((n) => {
            const choice = s.wrap[n.id];
            const st = ST[choice && choice !== 'next' ? choice : n.status] ?? ST.open;
            const isDone = !!choice;
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
                  border: `1px solid ${isDone ? 'rgba(0,0,0,.09)' : st.c + '55'}`, borderRadius: 8,
                  padding: '14px 16px', opacity: isDone ? 0.6 : 1,
                  transition: 'opacity .2s cubic-bezier(.23,1,.32,1),border-color .2s cubic-bezier(.23,1,.32,1)'
                }}
              >
                <div style={{ width: 4, height: 36, borderRadius: 2, background: st.c, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)', lineHeight: 1.4 }}>
                    {n.summary}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 4 }}>
                    {(pathOf(s.nodes, n.id).slice(0, -1).join(' › ') || '최상위 안건')} · 발언 {app.uttsOf(n.id).length}
                  </div>
                </div>
                {isDone ? (
                  <div
                    onClick={() => app.undoWrap(n.id)}
                    style={{
                      flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
                      borderRadius: 8, background: st.bg, fontSize: 12, fontWeight: 600, color: st.c, cursor: 'pointer'
                    }}
                  >
                    {choice === 'next' ? '다음 회의로 이월' : ST[choice as keyof typeof ST].l}
                    <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6 }}>되돌리기</span>
                  </div>
                ) : (
                  <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
                    <Button type="primary" onClick={() => app.setWrap(n.id, 'decided')}>결정</Button>
                    <Button onClick={() => app.setWrap(n.id, 'hold')}>보류</Button>
                    <Button onClick={() => app.setWrap(n.id, 'bait')}>떡밥</Button>
                    <Button type="text" onClick={() => app.setWrap(n.id, 'next')}>다음 회의로</Button>
                  </div>
                )}
              </div>
            );
          })}

          {!set.length && (
            <div
              style={{
                background: '#fff', border: '1px dashed rgba(0,0,0,.18)', borderRadius: 8, padding: 30,
                textAlign: 'center', fontSize: 14, color: 'rgba(0,0,0,.45)'
              }}
            >
              미결 노드가 없습니다. 바로 회의록을 생성할 수 있습니다.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '6px 0 8px' }}>
            <div
              onClick={() => { if (allDone) app.finish(); }}
              style={{
                height: 40, padding: '0 24px', borderRadius: 6,
                background: allDone ? '#1677ff' : 'rgba(0,0,0,.14)',
                color: allDone ? '#fff' : 'rgba(0,0,0,.45)',
                fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center',
                cursor: allDone ? 'pointer' : 'not-allowed'
              }}
            >
              회의 종료 · 회의록 생성
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
              {allDone ? '모든 미결이 정리됐습니다. 태그별 회의록을 생성합니다.' : '미결을 모두 처리하면 활성화됩니다.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
