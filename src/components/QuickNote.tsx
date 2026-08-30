import React from 'react';
import { isComposing, personLabel } from '../lib/text';
import type App from '../App';
import type { AppState } from '../App';

/**
 * PRD §5.4 일단 적어두기 (F).
 * 회의가 빠를 때 판단을 유보하고 먼저 적는 창. 캔버스 상단에 열린다.
 * 화자를 고르면 현재 선택된 노드의 발언으로, 고르지 않으면 미분류 메모로 떨어진다.
 * Tab 화자 순환 · ⌘⏎ 저장(창 유지) · Esc 닫기.
 */
export default function QuickNote({ app, s }: { app: App; s: AppState }): React.ReactElement | null {
  const q = s.quick;
  if (!q) return null;
  const canSave = !!q.text.trim();

  return (
    <div
      ref={(el) => { app.quickEl = el; }}
      data-keep-focus="1"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)', width: 520, zIndex: 62,
        background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8,
        boxShadow: '0 16px 40px rgba(0,0,0,.18)', padding: 14,
        animation: 'nj-drop-in .2s cubic-bezier(.23,1,.32,1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
        <div
          style={{
            flex: 'none', padding: '2px 7px', borderRadius: 4, background: '#1677ff', color: '#fff',
            fontSize: 12, fontWeight: 600, letterSpacing: '.04em'
          }}
        >
          F
        </div>
        <div style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>일단 적어두기</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
          {q.speaker
            ? '선택된 노드의 발언으로 저장됩니다'
            : '어디에도 연결하지 않고 캔버스에 그대로 둡니다 · 정리는 나중에'}
        </div>
        <div
          onClick={() => app.closeQuick()}
          style={{ flex: 'none', fontSize: 14, color: 'rgba(0,0,0,.45)', cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </div>
      </div>

      <textarea
        value={q.text}
        onChange={(e) => app.setQuickText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { app.closeQuick(); return; }
          if (e.key === 'Tab') { e.preventDefault(); app.cycleQuickSpeaker(e.shiftKey); return; }
          if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || isComposing(e)) return;
          e.preventDefault();
          app.commitQuick(true);
        }}
        autoFocus
        placeholder="지금 나온 말이든 새 안건이든, 일단 갈겨쓰세요"
        style={{
          width: '100%', height: 118, resize: 'none', border: '1px solid #d9d9d9', borderRadius: 6,
          padding: '11px 12px', fontSize: 14, lineHeight: 1.6, color: 'rgba(0,0,0,.88)'
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: '10px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', letterSpacing: '.06em', marginRight: 2 }}>
          누가 한 말인지 (선택)
        </div>
        {s.participants.map((p) => {
          const on = q.speaker === p.id;
          return (
            <div
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => app.toggleQuickSpeaker(p.id)}
              style={{
                padding: '5px 10px', borderRadius: 6,
                background: on ? '#1677ff' : '#fff',
                border: `1px solid ${on ? '#1677ff' : 'rgba(0,0,0,.16)'}`,
                color: on ? '#fff' : '#1677ff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {personLabel(s.participants, p.id)}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => app.commitQuick(true)}
          style={{
            flex: 'none', whiteSpace: 'nowrap', padding: '9px 15px', borderRadius: 8,
            background: canSave ? '#1677ff' : 'rgba(0,0,0,.12)',
            color: canSave ? '#fff' : 'rgba(0,0,0,.45)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          ⌘⏎ 저장
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
          ⏎ 줄바꿈 · Esc 닫기 · 저장 후에도 열려 있어 연달아 적을 수 있습니다
        </div>
      </div>
    </div>
  );
}
