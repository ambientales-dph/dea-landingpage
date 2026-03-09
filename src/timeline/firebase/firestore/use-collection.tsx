'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const useCollection = <T extends DocumentData>(query: Query<T> | null) => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (query === null) {
      setData([]);
      setLoading(false);
      return;
    }
    
    // Set loading to true only if it's a new query.
    // This prevents the loading spinner on every minor update.
    setLoading(true);
    setError(null);
    
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore Error (useCollection):", err);
        const permissionError = new FirestorePermissionError({
          path: (query as any)._query?.path?.segments.join('/') || 'unknown path',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
};
