import React from 'react';
import { isComposing, personLabel } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';
import type { Box } from '../types';

/**
 * PRD §5.3 발언 입력 — 가장 중요한 동선.
 * UTT-1 화자 칩 행 + 입력칸, 입력칸에 자동 포커스.
 * UTT-2 Tab/⇧Tab으로 커서를 입력칸에 둔 채 화자 순환.
 * UTT-3 ⏎ 줄바꿈, ⌘/Ctrl+⏎ 확정. 확정 후에도 열린 채 비워진다.
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
  const canAdd = !!c.text.trim();

  return (
    <div
      ref={(el) => { app.composeEl = el; }}
      data-keep-focus="1"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left, top, width: 320, zIndex: 60,
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

      {/* UTT-1 화자 칩 행 — 칩을 직접 클릭해도 커서는 입력칸에 남는다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 10 }}>
        {s.participants.map((p2) => {
          const on = c.speaker === p2.id;
          return (
            <div
              key={p2.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => app.setComposeSpeaker(p2.id)}
              style={{
                padding: '5px 10px', borderRadius: 6,
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
      </div>

      <textarea
        value={c.text}
        onChange={(e) => app.setComposeText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { app.closeCompose(); return; }
          if (e.key === 'Tab') {
            e.preventDefault();
            app.cycleComposeSpeaker(e.shiftKey);
            return;
          }
          // UTT-3·UTT-5 — ⏎ 는 줄바꿈, ⌘/Ctrl+⏎ 가 확정. 조합 중에는 무시.
          if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || isComposing(e)) return;
          e.preventDefault();
          app.commitCompose(true);
        }}
        autoFocus
        placeholder="들리는 대로 갈겨쓰기 · Tab 발언자 변경, ⌘⏎ 추가"
        style={{
          width: '100%', height: 132, resize: 'none', border: '1px solid #d9d9d9', borderRadius: 6,
          padding: '11px 12px', fontSize: 14, lineHeight: 1.6, color: 'rgba(0,0,0,.88)'
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <div
          onClick={() => app.commitCompose(true)}
          style={{
            flex: 'none', whiteSpace: 'nowrap', padding: '8px 14px', borderRadius: 8,
            background: canAdd ? '#1677ff' : 'rgba(0,0,0,.12)',
            color: canAdd ? '#fff' : 'rgba(0,0,0,.45)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          ⌘⏎ 추가
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
          추가 후에도 열려 있어 연달아 입력할 수 있습니다
        </div>
      </div>
    </div>
  );
}
