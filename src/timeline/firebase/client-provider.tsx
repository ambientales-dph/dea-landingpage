'use client';

import { useState, useEffect, useMemo } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './index';

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

type FirebaseInstances = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebase, setFirebase] = useState<FirebaseInstances | null>(null);

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebase(instances);
  }, []);

  if (!firebase) {
    // You can show a loading skeleton here if you want
    return null;
  }

  return <FirebaseProvider {...firebase}>{children}</FirebaseProvider>;
}
