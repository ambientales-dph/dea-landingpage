'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para notificaciones simplificadas y directas.
 */
export function useMailNotifications() {
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const isFirstRun = useRef(true);
    const lastProcessedTime = useRef(Date.now());

    useEffect(() => {
        if (!db || !user) return;

        const q = query(
            collection(db, 'notificaciones_obras'),
            where('fecha_recepcion', '>', Timestamp.fromMillis(lastProcessedTime.current)),
            orderBy('fecha_recepcion', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Evitar notificaciones de mensajes viejos al cargar la página
            if (isFirstRun.current) {
                isFirstRun.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    
                    // Notificación simplificada solicitada por el usuario
                    toast({
                        title: '📬 Correo entrante',
                        description: `Hay mail nuevo de ${data.obra_relacionada || 'un proyecto'}.`,
                        duration: 6000,
                    });
                }
            });
        }, (error) => {
            console.warn('Listener de notificaciones en pausa.');
        });

        return () => unsubscribe();
    }, [db, user, toast]);
}
