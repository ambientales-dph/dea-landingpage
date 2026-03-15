'use client';

import { useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para escuchar en tiempo real la colección 'notificaciones_obras'.
 * Dispara una notificación visual cuando la IA vincula un nuevo correo.
 */
export function useMailNotifications() {
    const db = useFirestore();
    const { toast } = useToast();
    const isFirstRun = useRef(true);
    const lastProcessedTime = useRef(Date.now());

    useEffect(() => {
        if (!db) return;

        // Solo escuchamos notificaciones creadas DESDE que se cargó la app para evitar spam de viejas
        const q = query(
            collection(db, 'notificaciones_obras'),
            where('fecha_recepcion', '>', Timestamp.fromMillis(lastProcessedTime.current)),
            orderBy('fecha_recepcion', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isFirstRun.current) {
                isFirstRun.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    
                    console.log('🔔 NUEVA NOTIFICACIÓN DE OBRA:', data);
                    
                    // Disparamos la notificación visual
                    toast({
                        title: '📬 Nuevo correo detectado',
                        description: `Vínculo: ${data.obra_relacionada}. Asunto: ${data.mailSubject || 'Sin asunto'}`,
                        duration: 8000,
                    });

                    // También un console.log como placeholder/debug
                    console.log(`IA RADAR: Se vinculó un mail a la obra ${data.obra_relacionada}. Resumen: ${data.resumen_ia}`);
                }
            });
        });

        return () => unsubscribe();
    }, [db, toast]);
}
