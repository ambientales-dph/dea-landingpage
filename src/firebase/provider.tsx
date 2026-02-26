'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

interface FirebaseContextType {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({
  children,
  app,
  auth,
  db,
}: {
  children: React.ReactNode;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <FirebaseContext.Provider value={{ app, auth, db, user, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase debe usarse dentro de un FirebaseProvider');
  }
  return context;
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().db;
export const useUser = () => {
  const { user, loading } = useFirebase();
  return { user, loading };
};
