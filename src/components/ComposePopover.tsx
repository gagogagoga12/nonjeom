import React from 'react';
import { isComposing, personLabel } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';
import type { Box } from '../types';

/**
 * PRD §5.3 발언 입력 — 가장 중요한 동선.
 * 화자마다 팝오버를 새로 여는 대신, 한 팝오버 안에 화자별 칸(entries)을 이어 쌓다가
 * splitCompose로 한 번에 각각 노드로 나눈다 — 여러 사람이 빠르게 말할 때를 위한 것.
 *
 * UTT-1 화자 칩 행 + 입력칸, 입력칸에 자동 포커스.
 * UTT-2 Tab/⇧Tab으로 커서를 그 칸에 둔 채 그 칸의 화자만 순환.
 * ⌘/Ctrl+⏎ 지금 칸은 그대로 두고 같은 화자로 새 칸 추가. ⌘/Ctrl+⇧+⏎ 노드로 나누기.
 * UTT-4 다른 노드를 클릭하거나 빈 공간을 누르면 자동으로 닫힌다(App.onGlobalDown).
 * UTT-5 IME 조합 중에는 확정 키가 동작하지 않는다.
 */
export default function ComposePopover({
  app, s, boxMap
}: { app: App; s: AppState; boxMap: Record<string, Box> }): React.ReactElement | null {
  const c = s.compose;
  if (!c) return null;
  const p = boxMap[c.parentId];
  if (!p) return null;

  // 접기 칩·형제 노드와 위치가 겹치지 않도록 자식 묶음 아래로 내려 연다(UTT-4)
  const sibs = s.nodes.filter((n) => n.parentId === p.id).map((n) => boxMap[n.id]).filter(Boolean);
  const bottom = sibs.length ? Math.max(...sibs.map((cb) => cb.top + cb.h)) : p.top + p.h;
  const left = p.left + p.w + 52;
  const top = Math.max(p.top, bottom + 12);
  const parentTitle = app.byId()[c.parentId]?.summary ?? '';
  const rowsToMake = c.entries.filter((e) => e.text.trim()).length;

  const onEntryKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { app.closeCompose(); return; }
    if (e.key === 'Tab') { e.preventDefault(); app.cycleComposeSpeaker(i, e.shiftKey); return; }
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || isComposing(e)) return;
    e.preventDefault();
    if (e.shiftKey) app.splitCompose();
    else app.addComposeEntry();
  };

  return (
    <div
      ref={(el) => { app.composeEl = el; }}
      data-keep-focus="1"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left, top, width: 400, zIndex: 60,
        background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 14,
        animation: 'nj-pop-in .2s cubic-bezier(.23,1,.32,1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', letterSpacing: '.06em' }}>발언 추가</div>
        <div
          style={{
            flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}
        >
          {parentTitle}
        </div>
        <div
          onClick={() => app.closeCompose()}
          style={{ flex: 'none', fontSize: 14, color: 'rgba(0,0,0,.45)', cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
        {c.entries.map((entry, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #f0f0f0', borderRadius: 8, padding: 10,
              background: '#fafafa'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
              {s.participants.map((p2) => {
                const on = entry.speaker === p2.id;
                return (
                  <div
                    key={p2.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => app.setComposeSpeaker(i, p2.id)}
                    style={{
                      padding: '4px 9px', borderRadius: 6,
                      background: on ? '#1677ff' : '#fff',
                      border: `1px solid ${on ? '#1677ff' : 'rgba(0,0,0,.16)'}`,
                      color: on ? '#fff' : 'rgba(0,0,0,.65)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'background .14s cubic-bezier(.23,1,.32,1)'
                    }}
                  >
                    {personLabel(s.participants, p2.id)}
                  </div>
                );
              })}
              {c.entries.length > 1 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => app.removeComposeEntry(i)}
                  title="이 칸 지우기"
                  style={{
                    marginLeft: 'auto', flex: 'none', fontSize: 13, color: 'rgba(0,0,0,.35)',
                    cursor: 'pointer', lineHeight: 1, padding: '2px 4px'
                  }}
                >
                  ×
                </div>
              )}
            </div>
            <textarea
              value={entry.text}
              onChange={(e) => app.setComposeText(i, e.target.value)}
              onKeyDown={onEntryKeyDown(i)}
              autoFocus={i === c.entries.length - 1}
              placeholder={
                i === 0
                  ? '들리는 대로 갈겨쓰기 · Tab 발언자 변경, ⌘⏎ 다음 화자 칸 추가'
                  : '이 화자가 한 말'
              }
              style={{
                width: '100%', height: 88, resize: 'none', border: '1px solid #d9d9d9', borderRadius: 6,
                padding: '9px 10px', fontSize: 14, lineHeight: 1.6, color: 'rgba(0,0,0,.88)', background: '#fff'
              }}
            />
          </div>
        ))}
      </div>

      <div
        onClick={() => app.addComposeEntry()}
        style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(0,0,0,.18)',
          textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', cursor: 'pointer'
        }}
      >
        + 다른 화자 칸 추가 (⌘⏎)
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <div
          onClick={() => app.splitCompose()}
          style={{
            flex: 'none', whiteSpace: 'nowrap', padding: '8px 14px', borderRadius: 8,
            background: rowsToMake ? '#1677ff' : 'rgba(0,0,0,.12)',
            color: rowsToMake ? '#fff' : 'rgba(0,0,0,.45)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          ⌘⇧⏎ 노드로 나누기{rowsToMake ? ` · ${rowsToMake}개` : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
          칸마다 화자를 따로 골라 적고, 다 되면 한 번에 나눕니다
        </div>
      </div>
    </div>
  );
}
