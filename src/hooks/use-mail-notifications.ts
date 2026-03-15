
'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para escuchar en tiempo real la colección 'notificaciones_obras'.
 * Dispara una notificación visual cuando la IA vincula un nuevo correo.
 */
export function useMailNotifications() {
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const isFirstRun = useRef(true);
    const lastProcessedTime = useRef(Date.now());

    useEffect(() => {
        // Solo escuchamos si el usuario está autenticado para evitar errores de permisos
        if (!db || !user) return;

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
                    
                    toast({
                        title: '📬 Nuevo correo detectado',
                        description: `Vínculo: ${data.obra_relacionada}. Asunto: ${data.mailSubject || 'Sin asunto'}`,
                        duration: 8000,
                    });
                }
            });
        }, (error) => {
            console.warn('Error en snapshot de notificaciones (posiblemente sesión expirada):', error.message);
        });

        return () => unsubscribe();
    }, [db, user, toast]);
}
