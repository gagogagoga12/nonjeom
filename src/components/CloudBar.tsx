import React from 'react';
import { Button, Spin } from 'antd';
import type App from '../App';
import type { AppState } from '../App';
import { dateLabel, hhmm } from '../lib/text';

/**
 * 세팅 화면의 클라우드 영역 — 로그인과 지난 회의 목록.
 *
 * Firestore는 **선택 기능**이다. 설정이 없으면 이 영역은 아예 뜨지 않고,
 * 로그인하지 않으면 회의는 이 기기(localStorage)에만 남는다.
 */
export default function CloudBar({ app, s }: { app: App; s: AppState }): React.ReactElement | null {
  if (!app.cloudEnabled()) return null;

  if (!s.account) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)' }}>
            로그인하면 회의가 클라우드에 저장됩니다
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 2 }}>
            로그인하지 않아도 회의는 진행됩니다 — 다만 이 기기에만 남습니다.
          </div>
        </div>
        <Button type="primary" onClick={() => void app.signInCloud()}>
          구글로 로그인
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f'
        }}
      >
        {s.account.photo ? (
          <img
            src={s.account.photo}
            alt=""
            width={24}
            height={24}
            style={{ borderRadius: '50%', flex: 'none' }}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.88)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {s.account.name}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
            새 회의는 자동으로 클라우드에 저장됩니다
          </div>
        </div>
        <Button size="small" type="text" onClick={() => void app.signOutCloud()}>
          로그아웃
        </Button>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,.45)', letterSpacing: '.08em' }}>
            지난 회의
          </div>
          {s.cloudBusy && <Spin size="small" />}
          <Button
            size="small"
            type="text"
            style={{ marginLeft: 'auto' }}
            onClick={() => void app.refreshCloudList()}
          >
            새로고침
          </Button>
        </div>

        {s.cloudList.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflow: 'auto' }}>
            {s.cloudList.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 6, border: '1px solid #f0f0f0', background: '#fff'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.88)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}
                  >
                    {m.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)', paddingTop: 2 }}>
                    {m.startedAt ? `${dateLabel(m.startedAt)} ${hhmm(m.startedAt)}` : '시각 미상'}
                    {' · '}주제 {m.topicCount} · 발언 {m.uttCount}
                    {m.openCount > 0 && (
                      <span style={{ color: '#ff4d4f', fontWeight: 600 }}> · 미결 {m.openCount}</span>
                    )}
                  </div>
                </div>
                <Button size="small" onClick={() => void app.openCloudMeeting(m.id)}>
                  열기
                </Button>
                <Button size="small" type="text" danger onClick={() => void app.deleteCloudMeeting(m.id)}>
                  삭제
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px dashed rgba(0,0,0,.18)', borderRadius: 6, padding: 16,
              textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,.45)'
            }}
          >
            {s.cloudBusy ? '불러오는 중…' : '저장된 회의가 없습니다'}
          </div>
        )}
      </div>
    </div>
  );
}
