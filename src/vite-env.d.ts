/// <reference types="vite/client" />

/**
 * Firebase 웹 설정. 비밀이 아니며 클라이언트 번들에 그대로 실린다 —
 * 접근 제어는 firestore.rules가 한다. 비어 있으면 앱은 로컬 전용으로 동작한다.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
