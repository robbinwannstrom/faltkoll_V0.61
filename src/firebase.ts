import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with the dedicated database ID and safe proxy/undefined handling
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db: Firestore = firestoreInstance;

// Firestore Quota Circuit Breaker
// Automatically engages when Firestore returns 8 RESOURCE_EXHAUSTED (free tier daily write limit reached)
let firestoreQuotaExceededUntil = 0;

export function markFirestoreQuotaExceeded(durationMinutes = 240) {
  firestoreQuotaExceededUntil = Date.now() + durationMinutes * 60 * 1000;
  try {
    sessionStorage.setItem('firestore_quota_exceeded_until', String(firestoreQuotaExceededUntil));
    localStorage.setItem('firestore_quota_exceeded_date', new Date().toISOString().slice(0, 10));
  } catch {}
}

export function isFirestoreQuotaExceeded(): boolean {
  if (firestoreQuotaExceededUntil && Date.now() < firestoreQuotaExceededUntil) {
    return true;
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const savedDate = localStorage.getItem('firestore_quota_exceeded_date');
    if (savedDate === today) {
      return true;
    }
    const stored = sessionStorage.getItem('firestore_quota_exceeded_until');
    if (stored) {
      const until = parseInt(stored, 10);
      if (until && Date.now() < until) {
        firestoreQuotaExceededUntil = until;
        return true;
      }
    }
  } catch {}
  return false;
}

export function canWriteToFirestore(): boolean {
  return !isFirestoreQuotaExceeded();
}

// Clear any stale local flags so Firestore is ready for real-time reads & writes
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('firestore_quota_exceeded_date');
    const stored = sessionStorage.getItem('firestore_quota_exceeded_until');
    if (stored && parseInt(stored, 10) < Date.now()) {
      sessionStorage.removeItem('firestore_quota_exceeded_until');
    }
  } catch {}
}

// Validate connection to Firestore lazily in background (safe for offline fieldwork)
async function testConnection() {
  if (!canWriteToFirestore()) return;
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline mode active.');
    }
  }
}

if (typeof window !== 'undefined') {
  // Defer non-critical connection check until after initial UI has mounted
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      testConnection().catch(() => {});
    });
  } else {
    setTimeout(() => {
      testConnection().catch(() => {});
    }, 2500);
  }
}

export default db;
