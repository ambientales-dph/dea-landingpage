'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentReference, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const useDoc = <T extends DocumentData>(ref: DocumentReference<T> | null) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      ref,
      (doc: DocumentSnapshot<T>) => {
        if (doc.exists()) {
          setData({ ...doc.data(), id: doc.id });
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore Error (useDoc):", err);
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
};
