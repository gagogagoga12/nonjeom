import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, getAuth, onAuthStateChanged,
  setPersistence, signInWithPopup, signOut, type Auth, type User
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase 지연 초기화.
 *
 * 설정이 없으면 앱은 **로컬 전용 모드**로 온전히 동작한다(PRD §9 — 로컬 우선 저장).
 * Firestore는 그 위에 얹는 동기화 계층이지, 없으면 못 쓰는 필수 의존이 아니다.
 * AI와 같은 원칙이다: 붙어 있으면 쓰고, 없으면 조용히 비켜난다.
 *
 * 웹 앱의 Firebase 설정값은 비밀이 아니다(클라이언트 번들에 그대로 실린다).
 * 실제 접근 제어는 firestore.rules가 한다 — ownerId == request.auth.uid.
 */

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/** 설정이 다 들어와 있어야 클라우드 기능을 켠다. 하나라도 비면 로컬 전용. */
export function isCloudConfigured(): boolean {
  return !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

let app: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;

function ensureApp(): FirebaseApp | null {
  if (!isCloudConfigured()) return null;
  if (!app) app = initializeApp(cfg as Required<typeof cfg>);
  return app;
}

export function auth(): Auth | null {
  const a = ensureApp();
  if (!a) return null;
  if (!authRef) authRef = getAuth(a);
  return authRef;
}

export function db(): Firestore | null {
  const a = ensureApp();
  if (!a) return null;
  if (!dbRef) dbRef = getFirestore(a);
  return dbRef;
}

export interface Account {
  uid: string;
  name: string;
  email: string;
  photo: string;
}

function toAccount(u: User): Account {
  return {
    uid: u.uid,
    name: u.displayName || u.email || '사용자',
    email: u.email || '',
    photo: u.photoURL || ''
  };
}

/**
 * 로그인 상태 구독. 설정이 없으면 즉시 null을 흘리고 아무것도 하지 않는다.
 * 반환값은 구독 해제 함수.
 */
export function watchAccount(cb: (a: Account | null) => void): () => void {
  const a = auth();
  if (!a) { cb(null); return () => {}; }
  return onAuthStateChanged(a, (u) => cb(u ? toAccount(u) : null));
}

/** 구글 로그인. 팝업이 막히거나 사용자가 닫으면 null을 돌려주고 조용히 넘어간다. */
export async function signIn(): Promise<Account | null> {
  const a = auth();
  if (!a) return null;
  try {
    // 새로고침해도 로그인이 유지돼야 회의 중 기록이 끊기지 않는다
    await setPersistence(a, browserLocalPersistence);
    const res = await signInWithPopup(a, new GoogleAuthProvider());
    return toAccount(res.user);
  } catch {
    return null;
  }
}

export async function signOutAccount(): Promise<void> {
  const a = auth();
  if (a) await signOut(a);
}
