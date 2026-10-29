"use client";

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const databusFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_DDB || "AIzaSyDvb1qLm_raKBHZhLWnfzl55cdbvq55f7E",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DDB || "studio-7793356696-41de0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID_DDB || "studio-7793356696-41de0",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DDB || "studio-7793356696-41de0.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DDB || "305117569173",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_DDB || "1:305117569173:web:cbe28de7469b026b657b9c",
};

let databusApp: FirebaseApp | null = null;
let databusDb: Firestore | null = null;

/**
 * Retorna la instancia de Firestore conectada a DEA Data Bus (studio-7793356696-41de0).
 * Permite a la campana de notificaciones de Portal DEA escuchar eventos y reportes
 * de campo en tiempo real.
 */
export function getDatabusFirestore(): Firestore | null {
  if (typeof window === 'undefined') return null;
  if (!databusDb) {
    const appName = 'databus-portal-client';
    databusApp = getApps().find(app => app.name === appName) || initializeApp(databusFirebaseConfig, appName);
    databusDb = getFirestore(databusApp);
  }
  return databusDb;
}
