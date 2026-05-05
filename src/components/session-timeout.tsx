'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth, useUser } from '@/firebase';
import { cerrarSesion } from '@/services/auth-service';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente que monitorea la actividad del usuario y cierra la sesión
 * automáticamente tras 15 minutos de inactividad.
 */
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export function SessionTimeout() {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    if (!user) return;
    
    try {
      await cerrarSesion(auth);
      toast({
        title: 'Sesión expirada',
        description: 'Se ha cerrado la sesión por inactividad (15 minutos) para proteger tu cuenta.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error al cerrar sesión por inactividad:', error);
    }
  }, [auth, user, toast]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (user) {
      timeoutRef.current = setTimeout(handleLogout, TIMEOUT_MS);
    }
  }, [user, handleLogout]);

  useEffect(() => {
    // Si no hay usuario, no monitoreamos nada
    if (!user) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Lista de eventos que se consideran "actividad"
    const events = [
      'mousedown', 
      'mousemove', 
      'keypress', 
      'scroll', 
      'touchstart',
      'click'
    ];
    
    // Iniciar el timer al detectar al usuario logueado
    resetTimer();

    const handleUserActivity = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user, resetTimer]);

  return null;
}
