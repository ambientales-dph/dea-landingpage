'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth, useUser } from '@/firebase';
import { cerrarSesion } from '@/services/auth-service';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Componente que monitorea la actividad del usuario.
 * CONFIGURACIÓN DE PRUEBA:
 * - 30 segundos de inactividad -> Muestra advertencia.
 * - 1 minuto de cuenta regresiva en advertencia.
 */
const INACTIVITY_LIMIT_MS = 30 * 1000; // 30 segundos para pruebas (antes 14 min)
const WARNING_DURATION_S = 60; // 60 segundos de cuenta regresiva

export function SessionTimeout() {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WARNING_DURATION_S);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogout = useCallback(async () => {
    if (!user) return;
    
    // Limpiar todo antes de salir
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    try {
      await cerrarSesion(auth);
      setShowWarning(false);
      toast({
        title: 'Sesión expirada',
        description: 'Se ha cerrado la sesión por inactividad para proteger tu cuenta.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error al cerrar sesión por inactividad:', error);
    }
  }, [auth, user, toast]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setTimeLeft(WARNING_DURATION_S);
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const resetTimer = useCallback(() => {
    // Si la advertencia ya está visible, no reiniciamos por movimiento de mouse/teclas
    if (showWarning) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (user) {
      timeoutRef.current = setTimeout(startWarningCountdown, INACTIVITY_LIMIT_MS);
    }
  }, [user, startWarningCountdown, showWarning]);

  const handleKeepAlive = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowWarning(false);
    setTimeLeft(WARNING_DURATION_S);
    
    // Forzamos un reinicio manual del timer principal
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(startWarningCountdown, INACTIVITY_LIMIT_MS);
    
    toast({
      title: 'Sesión renovada',
      description: 'Tu actividad ha sido confirmada.',
    });
  };

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setShowWarning(false);
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    resetTimer();

    const handleUserActivity = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user, resetTimer]);

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="bg-white text-black border-zinc-200 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold font-headline text-primary">
            <Timer className="h-6 w-6 animate-pulse" />
            ¿Sigues ahí?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-zinc-600 py-2">
              Tu sesión está a punto de expirar por inactividad. 
              Por razones de seguridad, te desconectaremos automáticamente en:
              <div className="mt-4 flex items-center justify-center">
                <span className={cn(
                  "text-5xl font-black font-mono transition-colors duration-300",
                  timeLeft <= 10 ? "text-red-500 scale-110" : "text-zinc-800"
                )}>
                  0:{timeLeft.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogAction 
            onClick={handleKeepAlive}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold"
          >
            Seguir conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
