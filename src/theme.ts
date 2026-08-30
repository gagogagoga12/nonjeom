import type { ThemeConfig } from 'antd';

// PRD §9 디자인 시스템 — Ant Design 기본 라이트 테마.
// 타입 래더 12/14/16/20 · 4px 그리드 · 컨트롤 높이 32(24·40)
// 반경 6(컨트롤) · 8(서피스) · 4(태그). 색은 시드 팔레트에서만 가져온다.
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    fontFamily:
      'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeHeading3: 20,
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    // PRD §9 모션 — 상태 변화 0.1s · 컴포넌트 내부 0.2s
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s'
  }
};
