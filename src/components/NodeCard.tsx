import React from 'react';
import { ORDER, ST, ZONE } from '../constants';
import { canReparent, slideBoxH, zoneMore } from '../lib/layout';
import { personLabel, shortName } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';
import type { Box, MeetNode } from '../types';

interface Props {
  app: App;
  s: AppState;
  n: MeetNode;
  b: Box;
  /** 현재 노드 외 흐림 정도 — 길 잃음 방지(기획안 §3) */
  dim: number;
}

/**
 * 노드 카드 (PRD §5.2 CV-1 ~ CV-6).
 *
 * PRD §10 함정 대응:
 * - 선택 시 scale을 쓰지 않는다. 레이아웃 박스를 넘어 이웃을 덮는다. 테두리·그림자로만.
 * - 카드 높이는 실측한다(app.cardEls). 내용 영역은 내용 높이대로 둔다.
 * - 툴바가 차지하는 세로 자리는 레이아웃(GAP_V)에 이미 포함돼 있다.
 */
export default function NodeCard({ app, s, n, b, dim }: Props): React.ReactElement {
  const st = ST[n.status] ?? ST.open;
  const z = app.zoneInfo(n);
  const m = app.metrics();

  const isCur = n.id === s.currentId;
  const isHover = s.hoverId === n.id;
  const isFocus = s.focusId === n.id;
  const isUtt = n.kind === 'utt';

  const dragging = !!s.drag;
  const isSelfDrag = dragging && s.drag!.id === n.id;
  const okTarget = !dragging || canReparent(s.nodes, s.drag!.id, n.id);
  const dt = s.dropTarget;
  const isTarget = !!dt && dt.id === n.id && okTarget && !isSelfDrag;

  const kids = s.nodes.filter((x) => x.parentId === n.id).length;
  const folded = !!s.collapsed[n.id];
  // CV-4 — 호버는 글로우만, 툴바는 선택된 노드에만 상시 노출
  const tools = isCur && !dragging;

  const editingSum = s.editId === n.id && s.editZone === 'sum';
  const editingRaw = s.editId === n.id && s.editZone !== 'sum';

  const sumOpen = !!s.expanded[z.sumKey];
  const rawOpen = !!s.expanded[z.rawKey];
  const sumMore = z.dual && zoneMore(n.summary, ZONE.sum, z.sumKey, m);
  const rawMore = zoneMore(z.rawSrc, z.rawZ, z.rawKey, m);

  const color = isUtt ? 'rgba(0,0,0,.45)' : n.unsorted ? '#d48806' : st.c;
  const bg = isTarget ? '#fff' : isUtt ? '#fafafa' : '#fff';
  const fadeTo = isTarget || isCur ? '#fff' : isUtt ? '#fafafa' : '#fff';

  const border = isTarget
    ? '2px solid #1677ff'
    : isFocus
      ? '2px dashed #1677ff'
      : isCur
        ? '2px solid #1677ff'
        : isUtt
          ? `1px dashed rgba(0,0,0,${isHover ? '.42' : '.22'})`
          : `1px solid rgba(0,0,0,${isHover ? '.28' : '.13'})`;

  const shadow = isTarget
    ? '0 14px 34px rgba(0,0,0,.26)'
    : isCur
      ? '0 12px 30px rgba(0,0,0,.2)'
      : isHover && !dragging
        ? '0 0 0 3.5px rgba(0,0,0,.08),0 7px 20px rgba(0,0,0,.14)'
        : '0 1px 2px rgba(0,0,0,.05)';

  const opacity = isSelfDrag
    ? 0.3
    : dragging
      ? isTarget ? 1 : okTarget ? 0.9 : 0.45
      : s.currentId && !isCur ? dim : 1;

  const meta = isUtt
    ? n.at
    : (z.wasUtt ? n.at + ' · ' : '') +
      (app.uttsOf(n.id).length ? '발언 ' + app.uttsOf(n.id).length : '발언 없음');

  const showOutcome = app.hasOutcomeFor(n);
  const outcomeText = (n.outcome || '').trim() || (n.status === 'decided' ? '결정 내용을 적어주세요' : '보류 사유를 적어주세요');

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const editBox = (h: number, fs: number, fw: number) => (
    <textarea
      value={s.editText}
      onChange={(e) => { app.fitEdit(e.target); app.setEditText(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { app.cancelEdit(); return; }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); app.commitEdit(); }
      }}
      onBlur={() => app.commitEdit()}
      ref={app.setEditEl}
      autoFocus
      style={{
        width: '100%', minHeight: h, overflow: 'hidden', resize: 'none',
        border: '1px solid #4096ff', borderRadius: 6, padding: '7px 9px',
        fontSize: fs, fontWeight: fw, color: 'rgba(0,0,0,.88)', lineHeight: 1.5, background: '#fff'
      }}
    />
  );

  /** 잘림 표시(…)와 존별 ▾ 토글 (CV-3) */
  const moreChip = (open: boolean, key: string, lh: number, fs: number, ink: string) => (
    <>
      <div
        style={{
          display: open ? 'none' : 'block', position: 'absolute', right: 0, bottom: 0,
          width: 46, height: lh,
          background: `linear-gradient(to right,rgba(255,255,255,0),${fadeTo} 70%)`
        }}
      />
      <div
        onClick={(e) => { stop(e); app.toggleZone(key, n.id); }}
        style={{
          display: 'flex', position: 'absolute', right: 0, bottom: 0, alignItems: 'center',
          gap: 4, paddingLeft: 5, background: fadeTo, height: lh, cursor: 'pointer'
        }}
      >
        <span style={{ display: open ? 'none' : 'inline', fontSize: fs, color: ink }}>…</span>
        <span
          style={{
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            ...(open
              ? { borderBottom: '5px solid rgba(0,0,0,.45)' }
              : { borderTop: '5px solid rgba(0,0,0,.45)' })
          }}
        />
      </div>
    </>
  );

  return (
    <div
      onMouseEnter={() => app.setHover(n.id)}
      onMouseLeave={() => app.setHover(null)}
      style={{
        position: 'absolute', left: b.left, top: b.top, width: b.w, opacity,
        transformOrigin: '0 50%', transition: 'opacity .22s cubic-bezier(.23,1,.32,1)',
        zIndex: isCur ? 20 : isHover ? 10 : 1
      }}
    >
      {/* 노드 툴바 — 선택된 노드 위에 뜬다. 좌우로 삐져나가지 않게 clampBar가 잡는다 */}
      {tools && (
        <div
          style={{
            position: 'absolute', left: app.clampBar(b, isUtt),
            // 노드가 화면 상단에 붙으면 툴바를 아래로 내린다
            top: b.top * s.zoom + s.pan.y < 48 ? b.h + 7 : -37,
            display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 8,
            background: 'rgba(0,0,0,.85)', boxShadow: '0 0 0 3px #f7f7f5,0 6px 18px rgba(0,0,0,.24)',
            whiteSpace: 'nowrap', zIndex: 5
          }}
        >
          {!isUtt &&
            ORDER.map((k) => {
              const p = ST[k];
              const on = n.status === k;
              return (
                <div
                  key={k}
                  onClick={(e) => { stop(e); app.setStatus(n.id, k); }}
                  title={p.l}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6,
                    background: on ? p.c : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,.62)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#fff' : p.c }} />
                  {p.s}
                </div>
              );
            })}
          {isUtt && (
            <div
              onClick={(e) => { stop(e); app.promote(n.id); }}
              style={{
                padding: '4px 9px', borderRadius: 6, background: 'rgba(255,255,255,.14)',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              ↑ 논의 주제로
            </div>
          )}
          <div
            onClick={(e) => { stop(e); app.summarizeNode(n.id); }}
            style={{
              padding: '4px 9px', borderRadius: 6, background: 'rgba(255,255,255,.14)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {s.aiBusy === n.id ? 'AI 요약 중…' : z.dual ? 'AI 요약 다시' : 'AI 요약'}
          </div>
          <div
            onClick={(e) => { stop(e); app.deleteNode(n.id); }}
            style={{ padding: '4px 8px', borderRadius: 6, color: 'rgba(255,255,255,.62)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            삭제
          </div>
        </div>
      )}

      <div
        onClick={() => app.select(n.id)}
        onMouseDown={(e) => {
          if (e.button !== 0 || s.editId === n.id || s.spaceDown) return;
          e.stopPropagation();
          e.preventDefault();
          app.beginNodeDrag(n.id, e);
        }}
        style={{
          width: '100%', height: b.h, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          background: bg, border, borderRadius: 8, boxShadow: shadow,
          cursor: dragging ? 'grabbing' : 'grab',
          transition: 'border .18s cubic-bezier(.23,1,.32,1),box-shadow .18s cubic-bezier(.23,1,.32,1),background .18s'
        }}
      >
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* CV-2 상태 색 좌측 바 */}
          <div style={{ width: 7, flex: 'none', background: color }} />
          <div
            ref={(el) => { app.cardEls[n.id] = el; }}
            style={{ flex: 1, minWidth: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
          >
            {/* SLD-3 장표 미리보기 — 원본 비율 유지 */}
            {n.slide && (
              <div
                style={{
                  flex: 'none', position: 'relative', height: slideBoxH(n, s.slideZoom),
                  background: '#fafafa', borderBottom: '1px solid #f0f0f0', overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: '100%', height: '100%',
                    background: `center/contain no-repeat url("${n.slide}")`
                  }}
                />
                <div
                  style={{
                    position: 'absolute', left: 8, top: 8, padding: '1px 7px', borderRadius: 4,
                    background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: 12, fontWeight: 600
                  }}
                >
                  장표 {n.slideNo}
                </div>
              </div>
            )}

            {/* 요약 존 */}
            {z.dual && (
              <div style={{ flex: 'none', padding: '13px 15px 12px' }}>
                {editingSum
                  ? editBox(z.sumEditLines * ZONE.sum.lh + 18, 14, 600)
                  : (
                    <div
                      onDoubleClick={(e) => { stop(e); app.startZoneEdit(n.id, 'sum'); }}
                      style={{ position: 'relative', height: z.sumLines * ZONE.sum.lh, overflow: 'hidden', cursor: 'text' }}
                    >
                      <div
                        ref={(el) => { app.textEls[z.sumKey] = el; }}
                        style={{
                          fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)', lineHeight: `${ZONE.sum.lh}px`,
                          letterSpacing: '-.015em', paddingRight: sumMore || rawMore ? 20 : 0,
                          overflowWrap: 'anywhere', wordBreak: 'break-word'
                        }}
                      >
                        {n.summary}
                      </div>
                      {sumMore && moreChip(sumOpen, z.sumKey, ZONE.sum.lh, 14, 'rgba(0,0,0,.88)')}
                    </div>
                  )}
              </div>
            )}
            {z.dual && <div style={{ height: 1, background: 'rgba(0,0,0,.1)' }} />}

            {/* 원문(또는 주제 제목) 존 */}
            <div
              style={{
                flex: 'none', minHeight: 0, padding: z.dual ? '12px 15px 14px' : '13px 15px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7
              }}
            >
              {!editingRaw && (
                <div
                  onDoubleClick={(e) => { stop(e); app.startZoneEdit(n.id, 'raw'); }}
                  style={{ position: 'relative', flex: 'none', height: z.rawLines * z.rawZ.lh, overflow: 'hidden', cursor: 'text' }}
                >
                  <div
                    ref={(el) => { app.textEls[z.rawKey] = el; }}
                    style={{
                      fontSize: z.rawZ.fs, fontWeight: isUtt || z.dual ? 400 : 600,
                      color: z.dual ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.88)',
                      lineHeight: `${z.rawZ.lh}px`, letterSpacing: '-.015em',
                      paddingRight: sumMore || rawMore ? 20 : 0,
                      overflowWrap: 'anywhere', wordBreak: 'break-word'
                    }}
                  >
                    {z.rawSrc}
                  </div>
                  {rawMore && moreChip(rawOpen, z.rawKey, z.rawZ.lh, z.rawZ.fs, z.dual ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.88)')}
                </div>
              )}
              {editingRaw && editBox(z.rawEditLines * z.rawZ.lh + 18, z.rawZ.fs, isUtt || z.dual ? 400 : 600)}

              {/* CV-2 메타 행 — 발언자·시각·발언 수 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                {(isUtt || z.wasUtt) && (
                  <span
                    style={{
                      flex: 'none', padding: '1px 5px', borderRadius: 4, background: '#f0f0f0',
                      color: 'rgba(0,0,0,.65)', fontSize: 12, fontWeight: 600
                    }}
                  >
                    {shortName(personLabel(s.participants, n.speaker))}
                  </span>
                )}
                {!isUtt && (
                  <span style={{ fontWeight: 600, color }}>{n.unsorted ? '미분류' : st.l}</span>
                )}
                <span style={{ color: 'rgba(0,0,0,.45)' }}>{meta}</span>
              </div>
            </div>
          </div>

          {/* CV-5 접기 칩 — 접힌 노드는 자식 수를 표시한다 */}
          {kids > 0 && (
            <div
              onClick={(e) => { stop(e); app.toggleFold(n.id); }}
              style={{
                flex: 'none', alignSelf: 'center', marginRight: 9, padding: '3px 8px', borderRadius: 4,
                background: 'rgba(0,0,0,.07)', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.65)',
                cursor: 'pointer'
              }}
            >
              {folded ? '+' + kids : '접기'}
            </div>
          )}
          <div style={{ width: 4, flex: 'none' }} />
        </div>

        {/* 결론 띠 — 안건 노드에 맵핑된 결정/보류 내용 (PRD §5.5) */}
        {showOutcome && (
          <div
            onClick={(e) => { stop(e); app.setState({ currentId: n.id, panel: 'node' }); }}
            style={{
              display: 'flex', flex: 'none', alignItems: 'flex-start', gap: 7,
              padding: '11px 15px 12px 13px', background: st.bg,
              borderTop: `1px solid ${st.c}2e`, cursor: 'pointer'
            }}
          >
            <span
              style={{
                flex: 'none', padding: '1px 6px', borderRadius: 4, background: st.c, color: '#fff',
                fontSize: 12, fontWeight: 600, letterSpacing: '.04em', lineHeight: '15px'
              }}
            >
              {n.status === 'decided' ? '결정' : '보류'}
            </span>
            <span
              style={{
                flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: st.c, lineHeight: '17px',
                letterSpacing: '-.015em', opacity: (n.outcome || '').trim() ? 1 : 0.5,
                overflowWrap: 'anywhere', wordBreak: 'break-word'
              }}
            >
              {outcomeText}
            </span>
          </div>
        )}
      </div>

      {/* UTT-1 트리거 — 노드 우측 + 버튼. 그 자리에 발언 입력 팝오버가 열린다 */}
      {(isHover || isCur) && !dragging && !(s.compose && s.compose.parentId === n.id) && (
        <div
          onClick={(e) => { stop(e); app.openCompose(n.id); }}
          style={{
            position: 'absolute', left: b.w, top: 0, height: b.h, display: 'flex',
            alignItems: 'center', paddingLeft: 7
          }}
        >
          <div
            className="nj-hover-lift"
            title="발언 추가"
            style={{
              width: 24, height: 24, borderRadius: '50%', background: '#1677ff', color: '#fff',
              fontSize: 16, fontWeight: 600, lineHeight: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,.28)'
            }}
          >
            +
          </div>
        </div>
      )}

      {/* 놓기 대상 안내 */}
      {isTarget && (
        <div
          style={{
            position: 'absolute', left: 0, top: b.h + 7, display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, background: '#1677ff', color: '#fff',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
          }}
        >
          {dragging ? '↳ 이 노드 아래로 옮기기' : '＋ 이 노드에 발언 추가'}
        </div>
      )}
    </div>
  );
}
