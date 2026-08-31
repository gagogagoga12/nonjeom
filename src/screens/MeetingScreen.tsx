import React from 'react';
import { Badge, Button } from 'antd';
import { SLIDE_ZOOM_LABELS } from '../constants';
import { canReparent } from '../lib/layout';
import type App from '../App';
import type { AppState } from '../App';
import type { Box } from '../types';
import NodeCard from '../components/NodeCard';
import ComposePopover from '../components/ComposePopover';
import QuickNote from '../components/QuickNote';
import SidePanel from '../components/SidePanel';
import CanvasLabels from '../components/CanvasLabels';

/** 현재 노드 외 흐림 정도 — 기획안 §3 '현재 위치 하이라이트' */
const DIM_PCT = 45;

/**
 * PRD §5.2 캔버스 — 서비스의 본체.
 * 왼쪽에서 오른쪽으로 뻗는 트리. 위치는 자동 계산이며 사용자가 좌표를 만지는 개념은 없다.
 */
export default function MeetingScreen({ app, s }: { app: App; s: AppState }): React.ReactElement {
  const boxes = app.boxes();
  const boxMap: Record<string, Box> = {};
  boxes.forEach((b) => { boxMap[b.id] = b; });
  const byId = app.byId();
  const dim = 1 - (DIM_PCT / 100) * 0.78;
  const cur = s.currentId ? byId[s.currentId] : null;
  const openCount = app.openTopics().length;
  const hasSlides = s.nodes.some((n) => n.slide);
  const dt = s.dropTarget;

  // 트리 연결선 — 부모 오른쪽 변에서 자식 왼쪽 변으로 잇는 베지어
  const edges: { d: string; stroke: string; w: number; op: number; dash: string }[] = [];
  for (const n of s.nodes) {
    if (!n.parentId) continue;
    const a = boxMap[n.parentId];
    const b = boxMap[n.id];
    if (!a || !b) continue;
    const x1 = a.left + a.w, y1 = a.top + a.h / 2;
    const x2 = b.left, y2 = b.top + b.h / 2;
    const hot = n.id === s.currentId || n.parentId === s.currentId;
    edges.push({
      d: `M${x1},${y1}C${x1 + 46},${y1} ${x2 - 46},${y2} ${x2},${y2}`,
      stroke: hot ? '#1677ff' : '#d9d9d9',
      w: hot ? 2.2 : 1.4,
      op: hot ? 1 : 0.85,
      dash: 'none'
    });
  }

  // 드래그 중에는 대상 노드에서 커서까지 점선을 그려 어디에 연결될지 미리 보여준다(PRD §6)
  const linkDots: { cx: number; cy: number }[] = [];
  const dtBox = dt && dt.id ? boxMap[dt.id] : null;
  if (s.drag && dtBox && app.cv) {
    const r = app.cv.getBoundingClientRect();
    // 커서가 아니라 끌고 있는 카드의 왼쪽 변에서 선이 끝나야 카드에 가리지 않는다
    const GHOST_LEFT = 130, GAP = 10;
    const px = (s.drag.x - GHOST_LEFT - GAP - r.left - s.pan.x) / s.zoom;
    const py = (s.drag.y - r.top - s.pan.y) / s.zoom;
    const x1 = dtBox.left + dtBox.w, y1 = dtBox.top + dtBox.h / 2;
    const c1 = x1 + Math.max(28, (px - x1) * 0.45);
    const c2 = px - Math.max(28, (px - x1) * 0.45);
    edges.push({
      d: `M${x1},${y1}C${c1},${y1} ${c2},${py} ${px},${py}`,
      stroke: '#1677ff', w: 2.6, op: 1, dash: '8 6'
    });
    linkDots.push({ cx: x1, cy: y1 }, { cx: px, cy: py });
  }

  const ghostHint = !dt
    ? '노드 위나 빈 곳으로 가져가세요'
    : dt.mode === 'self'
      ? '원래 자리 · 놓으면 취소'
      : dt.mode === 'root'
        ? '↥ 최상위 안건으로 빼내기'
        : canReparent(s.nodes, s.drag!.id, dt.id)
          ? '↳ 이 노드 아래로 옮기기'
          : '여기로는 옮길 수 없습니다';

  const shortcutHint = s.textMode
    ? '빈 곳을 클릭해 텍스트를 쓰세요 · Esc 취소'
    : s.spaceDown
      ? '드래그로 캔버스 이동'
      : 'F 적어두기 · T 텍스트 · ↑↓ 순서 · Del 삭제 · ⌘Z 되돌리기 · Space+드래그 이동 · ⌘휠 확대';

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div
        style={{
          height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 13,
          padding: '0 20px', background: '#001529', color: '#fff'
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.08em' }}>논점</div>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.2)' }} />
        <div
          style={{
            flex: 'none', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280
          }}
        >
          {s.title}
        </div>
        <div
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
            color: 'rgba(255,255,255,.55)'
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a' }} />
          경과 {app.elapsedLabel()}
        </div>
        <div style={{ flex: 1 }} />

        {/* 클라우드 동기화 표시 — 로그인했을 때만. 로컬 저장은 늘 돌고 있다. */}
        {app.cloudEnabled() && (
          <div
            onClick={() => { if (s.account) app.syncCloudNow(); }}
            title={
              s.account
                ? s.sync === 'error'
                  ? '클라우드 저장 실패 · 눌러서 다시 시도 (기록은 이 기기에 남아 있습니다)'
                  : '눌러서 지금 저장'
                : '로그인하지 않아 이 기기에만 저장됩니다'
            }
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 6, border: '1px solid rgba(255,255,255,.18)', fontSize: 12,
              color: 'rgba(255,255,255,.65)', cursor: s.account ? 'pointer' : 'default', whiteSpace: 'nowrap'
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%', flex: 'none',
                background: !s.account
                  ? 'rgba(255,255,255,.35)'
                  : s.sync === 'error'
                    ? '#ff4d4f'
                    : s.sync === 'saving'
                      ? '#faad14'
                      : '#52c41a'
              }}
            />
            {!s.account
              ? '이 기기에만 저장'
              : s.sync === 'saving'
                ? '저장 중…'
                : s.sync === 'error'
                  ? '저장 실패 · 다시 시도'
                  : '클라우드 저장됨'}
          </div>
        )}

        <Button size="small" onClick={() => app.goWrap()}>
          회의 종료 · 회의록 생성
        </Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* 툴바 — 좁은 폭에서 두 줄로 접힌다(PRD §10). 버튼은 flex:none·nowrap. */}
          <div
            ref={app.setBarEl}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              padding: '9px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0'
            }}
          >
            <Button size="small" disabled={!cur} onClick={() => app.backToRoot()}>
              ↑ 원래 안건으로
            </Button>
            <div style={{ width: 1, height: 16, background: '#e8e8e8', flex: 'none' }} />
            <Button size="small" onClick={() => app.openQuick()}>
              F 일단 적어두기
            </Button>
            <Button
              size="small"
              type={s.textMode ? 'primary' : 'default'}
              onClick={() => app.setState((x) => ({ textMode: !x.textMode, currentId: null }))}
            >
              T 텍스트
            </Button>
            <label
              title="PDF를 올리면 페이지마다 장표 노드가 만들어집니다. 이미지도 됩니다"
              style={{
                flex: 'none', height: 24, padding: '0 11px', whiteSpace: 'nowrap', display: 'flex',
                alignItems: 'center', borderRadius: 6, background: '#fff', border: '1px solid #d9d9d9',
                color: 'rgba(0,0,0,.88)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              장표 올리기 (PDF)
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) app.addSlides(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>

            {/* SLD-4 장표 크기 4단계 */}
            {hasSlides && (
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>장표 크기</span>
                <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 6, background: '#f0f0f0' }}>
                  {SLIDE_ZOOM_LABELS.map((l, i) => (
                    <div
                      key={l}
                      onClick={() => app.setSlideZoom(i)}
                      style={{
                        padding: '3px 9px', borderRadius: 4,
                        background: s.slideZoom === i ? '#fff' : 'transparent',
                        color: s.slideZoom === i ? '#1677ff' : 'rgba(0,0,0,.65)',
                        boxShadow: s.slideZoom === i ? '0 2px 0 rgba(0,0,0,.02)' : 'none',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 8 }} />

            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button size="small" onClick={() => app.zoomAt(s.zoom - 0.1)}>−</Button>
              <div style={{ minWidth: 46, textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,.65)' }}>
                {Math.round(s.zoom * 100)}%
              </div>
              <Button size="small" onClick={() => app.zoomAt(s.zoom + 0.1)}>＋</Button>
            </div>

            {/* PRD §5.7 — 트래커는 상시 노출하지 않고 전용 버튼으로 여닫는다 (미결 수 배지 포함) */}
            <div
              onClick={() => app.toggleTracker()}
              style={{
                flex: 'none', height: 26, padding: '0 11px', whiteSpace: 'nowrap', display: 'flex',
                alignItems: 'center', gap: 7, borderRadius: 6,
                background: s.panel === 'tracker' ? '#1677ff' : '#fff',
                border: `1px solid ${s.panel === 'tracker' ? '#1677ff' : '#d9d9d9'}`,
                color: s.panel === 'tracker' ? '#fff' : 'rgba(0,0,0,.88)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background .16s,border-color .16s'
              }}
            >
              미결 트래커
              {openCount > 0 && <Badge count={openCount} />}
            </div>
          </div>

          {/* 캔버스 */}
          <div
            ref={app.setCanvas}
            data-pan="1"
            onMouseDown={app.onCanvasDown}
            style={{
              overscrollBehavior: 'none', touchAction: 'none', position: 'relative', flex: 1,
              minHeight: 0, overflow: 'hidden',
              cursor: s.textMode ? 'text' : s.panning ? 'grabbing' : s.spaceDown ? 'grab' : s.drag ? 'grabbing' : 'default',
              background: s.drag ? '#eeeeea' : '#f4f4f1',
              transition: 'background .2s'
            }}
          >
            <div
              data-pan="1"
              style={{
                position: 'absolute', left: 0, top: 0, transformOrigin: '0 0',
                transform: `translate(${Math.round(s.pan.x)}px,${Math.round(s.pan.y)}px) scale(${s.zoom})`,
                transition: s.animate ? 'transform .42s cubic-bezier(.22,.75,.2,1)' : 'none'
              }}
            >
              <svg
                width={6000}
                height={4000}
                style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: s.drag ? 50 : 0 }}
              >
                {edges.map((e, i) => (
                  <path
                    key={i}
                    d={e.d}
                    fill="none"
                    stroke={e.stroke}
                    strokeWidth={e.w}
                    opacity={e.op}
                    strokeDasharray={e.dash}
                    strokeLinecap="round"
                  />
                ))}
                {linkDots.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r={5} fill="#1677ff" />
                ))}
              </svg>

              {boxes.map((b) => {
                const n = byId[b.id];
                return n ? <NodeCard key={b.id} app={app} s={s} n={n} b={b} dim={dim} /> : null;
              })}

              <CanvasLabels app={app} s={s} />

              {/* T 도구로 그리는 중인 영역 */}
              {s.drawRect && (
                <div
                  style={{
                    position: 'absolute', left: s.drawRect.x, top: s.drawRect.y,
                    width: s.drawRect.w, height: s.drawRect.h,
                    border: '1px dashed #1677ff', background: 'rgba(22,119,255,.06)', pointerEvents: 'none'
                  }}
                />
              )}

              <ComposePopover app={app} s={s} boxMap={boxMap} />
            </div>

            {/* 빈 캔버스 안내 */}
            {!s.nodes.length && (
              <div
                style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none'
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,.45)' }}>노드가 없습니다</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>F를 눌러 먼저 적어두거나, 회의를 다시 세팅하세요</div>
              </div>
            )}

            {/* 빈 곳 놓기 안내 */}
            {dt && (dt.mode === 'root' || dt.mode === 'self') && (
              <div
                style={{
                  position: 'absolute', left: 16, top: 14, padding: '7px 12px', borderRadius: 4,
                  background: 'rgba(0,0,0,.85)', color: '#fff', fontSize: 12, fontWeight: 600, pointerEvents: 'none'
                }}
              >
                {dt.mode === 'self' ? '원래 자리 · 놓으면 취소됩니다' : '빈 곳에 놓으면 최상위 안건으로 떼어냅니다'}
              </div>
            )}

            <QuickNote app={app} s={s} />

            {/* 토스트 */}
            {s.notice && (
              <div
                style={{
                  position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 58,
                  padding: '8px 14px', borderRadius: 4, background: 'rgba(0,0,0,.85)', color: '#fff',
                  fontSize: 12, fontWeight: 600, boxShadow: '0 12px 30px rgba(0,0,0,.24)',
                  animation: 'nj-toast-in .2s cubic-bezier(.23,1,.32,1)', pointerEvents: 'none'
                }}
              >
                {s.notice}
              </div>
            )}

            {/* AI 요약 되돌리기 (PRD §8) */}
            {s.undo && (
              <div
                style={{
                  position: 'absolute', left: '50%', bottom: 58, transform: 'translateX(-50%)', zIndex: 59,
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 14px', borderRadius: 8,
                  background: 'rgba(0,0,0,.85)', color: '#fff'
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>AI 요약을 채웠습니다</div>
                <div
                  onClick={() => app.undoSummary()}
                  style={{
                    padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,.16)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  되돌리기
                </div>
              </div>
            )}

            {/* 단축키 안내 — 노드를 만지는 동안에는 노드 UI를 가리지 않도록 숨긴다 */}
            {!(s.panel || s.hoverId || s.currentId || s.drag) && (
              <div
                style={{
                  position: 'absolute', right: 14, bottom: 13, padding: '6px 11px', borderRadius: 4,
                  background: 'rgba(0,0,0,.85)', color: 'rgba(255,255,255,.86)', fontSize: 12,
                  fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap'
                }}
              >
                {shortcutHint}
              </div>
            )}

            {/* T 도구 안내 */}
            {s.textMode && (
              <div
                style={{
                  position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 57,
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(0,0,0,.85)', color: '#fff', pointerEvents: 'none'
                }}
              >
                <div style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,.16)', fontSize: 12, fontWeight: 600 }}>
                  T
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>텍스트 도구 · 빈 곳을 클릭하거나 드래그하세요</div>
              </div>
            )}

            {/* SLD-5 라이트박스 — 클릭·Esc로 닫는다 */}
            {s.lightbox && byId[s.lightbox]?.slide && (
              <div
                onClick={() => app.openLightbox(null)}
                style={{
                  position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.82)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 14, padding: 28, cursor: 'zoom-out', animation: 'nj-toast-in .2s'
                }}
              >
                <div
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
                    borderRadius: 8, background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: 14, fontWeight: 600
                  }}
                >
                  장표 {byId[s.lightbox].slideNo} · {byId[s.lightbox].summary}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,.65)' }}>
                    클릭하거나 Esc로 닫기
                  </span>
                </div>
                <div
                  style={{
                    flex: 1, minHeight: 0, width: '100%',
                    background: `center/contain no-repeat url("${byId[s.lightbox].slide}")`
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <SidePanel app={app} s={s} />
      </div>

      {/* 드래그 고스트 — 커서를 따라다니는 미니 카드 */}
      {s.drag && (
        <div
          style={{
            position: 'fixed', left: s.drag.x - 130, top: s.drag.y - 26, width: 262, zIndex: 120,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: '#fff', border: '1px solid #1677ff', borderRadius: 8, padding: '10px 12px',
              boxShadow: '0 18px 40px rgba(0,0,0,.28)', fontSize: 12, fontWeight: 600,
              color: 'rgba(0,0,0,.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {s.drag.text}
          </div>
          <div
            style={{
              marginTop: 6, display: 'inline-flex', padding: '4px 9px', borderRadius: 6,
              background:
                dt && dt.mode !== 'self' &&
                (dt.mode === 'root' ? canReparent(s.nodes, s.drag.id, null) : canReparent(s.nodes, s.drag.id, dt.id))
                  ? '#1677ff'
                  : 'rgba(0,0,0,.45)',
              color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
            }}
          >
            {ghostHint}
          </div>
        </div>
      )}
    </div>
  );
}
