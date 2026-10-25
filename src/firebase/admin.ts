import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { PORTAL_SERVICE_ACCOUNT } from './portal-credentials';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-1428739321-e57bb';
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-1428739321-e57bb.firebasestorage.app';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  try {
    adminApp = initializeApp({
      credential: cert(PORTAL_SERVICE_ACCOUNT as any),
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
    return adminApp;
  } catch (e: any) {
    console.error('[Firebase Admin] Error inicializando con credenciales de servicio:', e);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (app) {
    adminDb = getFirestore(app);
  }
  return adminDb;
}

export function getAdminStorage(): Storage | null {
  if (adminStorage) return adminStorage;
  const app = getAdminApp();
  if (app) {
    adminStorage = getStorage(app);
  }
  return adminStorage;
}
