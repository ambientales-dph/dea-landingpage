'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    errorEmitter.on('permission-error', (error: any) => {
      console.error('Firebase Permission Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error de permisos en base de datos',
        description: 'No tenés permisos para realizar esta acción o ver estos datos.',
      });
      
      // In development, we want to see the full error in the console for debugging
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    });
  }, [toast]);

  return null;
}