import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages는 https://<user>.github.io/<repo>/ 하위 경로로 서빙되므로
 * base를 저장소 이름으로 맞춰야 자산 경로가 깨지지 않는다.
 * 워크플로에서 BASE_PATH를 넘긴다. 로컬 개발에서는 '/'.
 */
const base = process.env.BASE_PATH || '/';

// AI 요약은 선택 기능이다(PRD §8). 서버(server/index.ts)가 떠 있지 않아도
// 앱은 로컬 요약기로 온전히 동작한다 — 프록시는 붙어 있을 때만 쓰인다.
// (GitHub Pages는 정적 호스팅이라 /api가 없다 → 자동으로 로컬 요약기로 우회한다)
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true }
    }
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // firebase·pdf.js·antd는 덩치가 크고 자주 바뀌지 않는다 — 따로 떼어 캐시가 살아남게 한다
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          pdf: ['pdfjs-dist']
        }
      }
    }
  }
});
