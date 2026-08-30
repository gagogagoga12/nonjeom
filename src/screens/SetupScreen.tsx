import React from 'react';
import { Button, Input, Progress } from 'antd';
import type App from '../App';
import type { AppState } from '../App';
import { dateLabel, isComposing } from '../lib/text';

/**
 * PRD §5.1 회의 세팅.
 * SET-1 제목 · SET-2 참석자 · SET-3 안건 · SET-4 발표 자료 · SET-5 시작 조건.
 */
export default function SetupScreen({ app, s }: { app: App; s: AppState }): React.ReactElement {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const startDisabled = !((s.agendas.length || s.deck.length) && s.participants.length);
  const startTitle = !s.participants.length
    ? '참석자를 1명 이상 추가하세요'
    : !s.agendas.length && !s.deck.length
      ? '안건을 입력하거나 발표 자료를 올리세요'
      : '회의를 시작합니다';

  const label = (t: string) => (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', letterSpacing: '.08em' }}>{t}</div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#001529' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '0 24px', color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.08em' }}>논점</div>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.2)' }} />
        <div style={{ flex: 'none', fontSize: 12, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap' }}>
          새 회의 세팅
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button size="small" onClick={() => app.loadSample()}>
            샘플 회의 불러오기
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', overflow: 'auto', padding: '0 24px 32px' }}>
        <div style={{ width: '100%', maxWidth: 1080, display: 'flex', gap: 22, alignItems: 'flex-start' }}>
          <div
            style={{
              flex: 1, minWidth: 0, background: '#fff', border: '1px solid #f0f0f0',
              borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', gap: 24
            }}
          >
            {/* 이전 회의 이어하기 — PRD §9 데이터 유실 */}
            {s.saved && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 8, background: '#e6f4ff', border: '1px solid #91caff'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
                    저장된 회의가 있습니다 — {s.saved.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 2 }}>
                    주제·발언 {s.saved.nodes.length}개 · {dateLabel(s.saved.savedAt)}
                  </div>
                </div>
                <Button type="primary" size="small" onClick={() => app.resumeSaved()}>이어하기</Button>
                <Button size="small" type="text" onClick={() => app.discardSaved()}>버리기</Button>
              </div>
            )}

            {/* SET-1 회의 제목 */}
            <div>
              <div style={{ paddingBottom: 9 }}>{label('회의 제목')}</div>
              <Input
                size="large"
                value={s.title}
                onChange={(e) => app.setTitle(e.target.value)}
                placeholder="예: 3분기 온보딩 개편 킥오프"
              />
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 8 }}>{dateLabel(Date.now())}</div>
            </div>

            {/* SET-2 참석자 — 이름이 같아도 서로 다른 참석자로 저장한다 */}
            <div>
              <div style={{ paddingBottom: 10 }}>{label('참석자')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {s.participants.map((p, i) => {
                  const dup = s.participants.filter((q) => q.name === p.name).length > 1;
                  const shown = dup
                    ? p.name + ' ' + (s.participants.filter((q) => q.name === p.name).findIndex((q) => q.id === p.id) + 1)
                    : p.name;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px',
                        borderRadius: 6, background: '#fff', border: '1px solid rgba(0,0,0,.16)',
                        fontSize: 14, color: '#1677ff', whiteSpace: 'nowrap'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{shown}</span>
                      <span
                        onClick={() => app.removeParticipant(p.id)}
                        title={`${shown} 삭제`}
                        style={{ fontSize: 14, lineHeight: 1, color: 'rgba(0,0,0,.45)', cursor: 'pointer' }}
                      >
                        ×
                      </span>
                      <span hidden>{i}</span>
                    </div>
                  );
                })}
                <div style={{ width: 168 }}>
                  <Input
                    size="large"
                    value={s.partDraft}
                    onChange={(e) => app.setPartDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // PRD UTT-5 — 한글 조합 중 Enter는 확정용이므로 무시한다
                      if (e.key !== 'Enter' || isComposing(e)) return;
                      e.preventDefault();
                      app.addParticipant(s.partDraft);
                    }}
                    placeholder="+ 이름 입력 후 Enter"
                  />
                </div>
              </div>
            </div>

            {/* SET-4 발표 자료 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 10 }}>
                {label('발표 자료')}
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                  {s.deck.length
                    ? `장표 ${s.deck.length}장 · 회의를 시작하면 각각 노드가 됩니다`
                    : 'PDF를 올리면 장표마다 노드가 만들어집니다'}
                </div>
                <label
                  style={{
                    marginLeft: 'auto', flex: 'none', whiteSpace: 'nowrap', height: 24, padding: '0 11px',
                    display: 'flex', alignItems: 'center', borderRadius: 6, border: '1px solid #d9d9d9',
                    background: '#fff', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)', cursor: 'pointer'
                  }}
                >
                  ＋ PDF · 이미지 올리기
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) app.stageFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {s.deck.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {s.deck.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'relative', width: 132, height: 78, borderRadius: 6,
                        border: '1px solid #f0f0f0', background: `#fafafa center/contain no-repeat url("${d.src}")`
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute', left: 5, top: 5, padding: '0 5px', borderRadius: 4,
                          background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: 12, fontWeight: 600
                        }}
                      >
                        {i + 1}
                      </div>
                      <div
                        onClick={() => app.removeDeckSlide(i)}
                        style={{
                          position: 'absolute', right: 4, top: 4, width: 18, height: 18, borderRadius: '50%',
                          background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                      >
                        ×
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    border: '1px dashed rgba(0,0,0,.24)', borderRadius: 6, padding: 16,
                    textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,.45)'
                  }}
                >
                  아직 올린 자료가 없습니다 · 자료 없이 안건만으로도 시작할 수 있습니다
                </div>
              )}
            </div>

            {/* SET-3 오늘 안건 — 각 안건은 최상위 노드가 된다 */}
            <div>
              <div style={{ paddingBottom: 10 }}>{label('오늘 안건')}</div>
              {s.agendas.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 6,
                    borderRadius: 6, border: '1px solid #f0f0f0', background: '#fafafa'
                  }}
                >
                  <div
                    style={{
                      width: 25, height: 25, borderRadius: 6, background: '#1677ff', color: '#fff',
                      fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flex: 'none'
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{t}</div>
                  <div
                    onClick={() => app.removeAgenda(i)}
                    style={{ flex: 'none', fontSize: 14, color: 'rgba(0,0,0,.45)', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ×
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                  borderRadius: 6, border: '1px dashed rgba(0,0,0,.18)'
                }}
              >
                <div
                  style={{
                    width: 25, height: 25, borderRadius: 6, border: '1px dashed rgba(0,0,0,.28)',
                    color: 'rgba(0,0,0,.45)', fontSize: 14, fontWeight: 600, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flex: 'none'
                  }}
                >
                  +
                </div>
                <input
                  value={s.agendaDraft}
                  onChange={(e) => app.setAgendaDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || isComposing(e)) return;
                    e.preventDefault();
                    app.addAgenda(s.agendaDraft);
                  }}
                  placeholder="안건 입력 후 Enter · 회의 중에도 추가할 수 있습니다"
                  style={{ flex: 1, minWidth: 0, border: 'none', fontSize: 14, background: 'transparent' }}
                />
              </div>
            </div>

            {/* SET-5 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <Button type="primary" size="large" disabled={startDisabled} title={startTitle} onClick={() => app.start()}>
                회의 시작
              </Button>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{startTitle}</div>
              <div style={{ marginLeft: 'auto', width: 140 }}>
                <Progress
                  percent={(s.participants.length ? 50 : 0) + (s.agendas.length || s.deck.length ? 50 : 0)}
                  showInfo={false}
                  size="small"
                />
              </div>
            </div>
          </div>

          {/* 입력 동선 안내 — PRD §5.3 "가장 중요한 동선" */}
          <div style={{ flex: 'none', width: 300, padding: '4px 0 0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', paddingBottom: 14 }}>
              입력은 이렇게 흘러갑니다
            </div>
            {[
              { t: '노드 옆 + 버튼으로 바로 입력', d: '캔버스를 벗어나지 않습니다. Tab으로 발언자를 바꾸고 ⌘⏎로 추가.' },
              { t: '발언도 노드로 붙습니다', d: '논의거리가 되는 발언은 [↑ 논의 주제로]를 눌러 주제로 승격.' },
              { t: '상태는 우측 패널에서', d: '논의·보류·떡밥·결정. 결정·보류는 결론까지 함께 적습니다.' },
              { t: 'AI 요약은 나중에, 원할 때만', d: '노드 위 [AI 요약] 버튼. 마음에 안 들면 되돌리기.' },
              { t: '캔버스 조작은 피그마와 동일', d: 'Space+드래그 이동 · ⌘휠 확대 · F 일단 적어두기 · T 텍스트 · ⌘Z 되돌리기.' }
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 14 }}>
                <div
                  style={{
                    width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,.12)', color: '#fff',
                    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flex: 'none'
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{p.t}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', paddingTop: 3, lineHeight: 1.6 }}>{p.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
