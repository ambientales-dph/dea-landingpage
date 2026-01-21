
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { verifyTrelloConnection } from '@/services/trello';

export default function TrelloConnectionToast() {
  const { toast } = useToast();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const userName = await verifyTrelloConnection();
        toast({
          title: '¡Conexión con Trello exitosa!',
          description: `Conectado como: ${userName}`,
        });
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
