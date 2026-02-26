'use client';

import { useUser as useFirebaseUser } from '../provider';

export function useUser() {
  return useFirebaseUser();
}
