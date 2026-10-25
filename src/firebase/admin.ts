import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

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

  // 1. Intentar archivo JSON local (desarrollo local)
  const keyFileName = 'studio-1428739321-e57bb-firebase-adminsdk-fbsvc-d9c6c381f2.json';
  const keyPath = path.resolve(process.cwd(), keyFileName);

  if (fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
      return adminApp;
    } catch (e) {
      console.error('[Firebase Admin] Error cargando credenciales locales:', e);
    }
  }

  // 2. Intentar variables de entorno (App Hosting / Producción)
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId: PROJECT_ID,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
      return adminApp;
    } catch (e) {
      console.warn('[Firebase Admin] Error inicializando con variables de entorno:', e);
    }
  }

  // 3. Fallback a Application Default Credentials (ADC nativo de Cloud Run / App Hosting)
  try {
    adminApp = initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
    return adminApp;
  } catch (e) {
    console.error('[Firebase Admin] Error inicializando con ADC:', e);
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
