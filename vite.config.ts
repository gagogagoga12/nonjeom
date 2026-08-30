import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AI 요약은 선택 기능이다(PRD §8). 서버(server/index.ts)가 떠 있지 않아도
// 앱은 로컬 요약기로 온전히 동작한다 — 프록시는 붙어 있을 때만 쓰인다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true }
    }
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 }
});
