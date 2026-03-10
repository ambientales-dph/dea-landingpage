'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { verifyTrelloConnection } from '@/services/trello';

export default function TrelloConnectionToast() {
  const { toast } = useToast();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Se realiza la verificación silenciosa para asegurar que el token es válido
        // pero se elimina el toast de éxito para no interrumpir la navegación del usuario.
        await verifyTrelloConnection();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error en la conexión con Trello',
          description: error instanceof Error ? error.message : 'Hubo un error desconocido.',
        });
      }
    };

    checkConnection();
  }, [toast]);

  return null;
}
