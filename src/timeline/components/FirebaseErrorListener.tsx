"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from "@/hooks/use-toast";

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error("Firestore Permission Error caught by listener:", error.toJSON());

      // Instead of throwing, which is for dev overlay, we show a user-friendly toast.
      // This provides a better UX than crashing the app or showing a big error screen.
      toast({
        variant: "destructive",
        title: "Error de Permisos en Firestore",
        description: `No tienes permiso para realizar esta acción. Revisa las reglas de seguridad de tu base de datos. Operación: ${error.context.operation} en la ruta: ${error.context.path}.`,
        duration: 10000,
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  // This component does not render anything
  return null;
}
