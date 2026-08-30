import React from 'react';
import { LABEL_COLORS, LABEL_SIZES } from '../constants';
import type App from '../App';
import type { AppState } from '../App';

/**
 * 캔버스 자유 텍스트·이미지 (PRD §6 — T 텍스트 도구, ⌘V 이미지).
 * 트리에 속하지 않으므로 레이아웃에 영향을 주지 않는다(PRD §4 부가 엔티티).
 */
export default function CanvasLabels({ app, s }: { app: App; s: AppState }): React.ReactElement {
  return (
    <>
      {s.labels.map((l) => {
        const editing = s.labelEdit === l.id;
        const sel = s.labelSel === l.id;
        const handles = sel || editing
          ? [
              { k: 'nw', css: { left: -4, top: -4, cursor: 'nwse-resize' } },
              { k: 'ne', css: { right: -4, top: -4, cursor: 'nesw-resize' } },
              { k: 'sw', css: { left: -4, bottom: -4, cursor: 'nesw-resize' } },
              { k: 'se', css: { right: -4, bottom: -4, cursor: 'nwse-resize' } }
            ]
          : [];
        return (
          <div
            key={l.id}
            onMouseDown={(e) => {
              if (e.button !== 0 || editing) return;
              e.stopPropagation();
              app.beginLabelDrag(l, e);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!l.src) app.setLabelEdit(l.id);
            }}
            style={{
              position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h, zIndex: 15,
              border: editing ? '1.5px solid #1677ff' : sel ? '1px solid rgba(0,0,0,.35)' : '1px solid transparent',
              borderRadius: 4, cursor: editing ? 'text' : 'move'
            }}
          >
            {/* 서식 툴바 */}
            {sel && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', left: 0, top: -36, display: 'flex', alignItems: 'center', gap: 4,
                  padding: 4, borderRadius: 8, background: 'rgba(0,0,0,.85)', whiteSpace: 'nowrap', zIndex: 3
                }}
              >
                {!l.src && (
                  <>
                    {LABEL_SIZES.map((v) => (
                      <div
                        key={v}
                        onClick={(e) => { e.stopPropagation(); app.patchLabel(l.id, { fs: v }); }}
                        style={{
                          minWidth: 20, padding: '3px 4px', borderRadius: 4,
                          background: l.fs === v ? 'rgba(255,255,255,.22)' : 'transparent',
                          color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer'
                        }}
                      >
                        {v}
                      </div>
                    ))}
                    <div
                      onClick={(e) => { e.stopPropagation(); app.patchLabel(l.id, { bold: !l.bold }); }}
                      style={{
                        width: 21, padding: '3px 0', borderRadius: 4,
                        background: l.bold ? 'rgba(255,255,255,.22)' : 'transparent',
                        color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer'
                      }}
                    >
                      B
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); app.patchLabel(l.id, { underline: !l.underline }); }}
                      style={{
                        width: 21, padding: '3px 0', borderRadius: 4,
                        background: l.underline ? 'rgba(255,255,255,.22)' : 'transparent',
                        color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'underline',
                        textAlign: 'center', cursor: 'pointer'
                      }}
                    >
                      U
                    </div>
                    {LABEL_COLORS.map((c) => (
                      <div
                        key={c}
                        onClick={(e) => { e.stopPropagation(); app.patchLabel(l.id, { color: c }); }}
                        style={{
                          width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer',
                          boxShadow: l.color === c ? '0 0 0 2px #fff' : '0 0 0 1px rgba(255,255,255,.35)'
                        }}
                      />
                    ))}
                  </>
                )}
                <div
                  onClick={(e) => { e.stopPropagation(); app.removeLabel(l.id); }}
                  style={{ padding: '3px 6px', borderRadius: 4, color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  삭제
                </div>
              </div>
            )}

            {l.src ? (
              <div
                style={{
                  width: '100%', height: '100%',
                  background: `center/contain no-repeat url("${l.src}")`
                }}
              />
            ) : editing ? (
              <textarea
                value={l.text}
                onChange={(e) => app.patchLabel(l.id, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                    e.preventDefault();
                    app.closeLabel();
                  }
                }}
                onBlur={() => app.closeLabel()}
                autoFocus
                placeholder="텍스트 입력"
                style={{
                  display: 'block', width: '100%', height: '100%', boxSizing: 'border-box', resize: 'none',
                  border: 0, outline: 0, borderRadius: 4, padding: '5px 7px', background: '#fff',
                  fontSize: l.fs, fontWeight: l.bold ? 800 : 500, color: l.color,
                  lineHeight: `${Math.round(l.fs * 1.45)}px`, letterSpacing: '-.015em'
                }}
              />
            ) : (
              <div
                style={{
                  padding: '5px 7px', fontSize: l.fs, fontWeight: l.bold ? 800 : 500,
                  textDecoration: l.underline ? 'underline' : 'none', color: l.color,
                  lineHeight: `${Math.round(l.fs * 1.45)}px`, letterSpacing: '-.015em',
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'
                }}
              >
                {l.text}
              </div>
            )}

            {handles.map((h) => (
              <div
                key={h.k}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  e.preventDefault();
                  app.beginLabelDrag(l, e, h.k);
                }}
                style={{
                  position: 'absolute', width: 8, height: 8, borderRadius: 2, background: '#fff',
                  border: '1px solid #1677ff', ...h.css
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
