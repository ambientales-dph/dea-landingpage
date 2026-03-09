'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FeedbackButtonProps {
    onClick: () => void;
}

export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const hasMoved = React.useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    // Guardamos la posición relativa del cursor respecto al origen actual del botón
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    // Capturamos el puntero para que el arrastre siga funcionando aunque el cursor salga del botón
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    // Si se mueve más de 5 píxeles, consideramos que es un arrastre y no un clic
    if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
      hasMoved.current = true;
    }
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Si no hubo movimiento significativo, disparamos la acción de clic original
    if (!hasMoved.current) {
      onClick();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            size="icon"
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl bg-cyan-500 hover:bg-cyan-600 text-white z-50 cursor-move touch-none select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out, background-color 0.2s ease-in-out, scale 0.2s ease-in-out'
            }}
          >
            <MessageSquare className="h-8 w-8" />
            <span className="sr-only">Enviar Comentarios</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className={isDragging ? "hidden" : ""}>
          <p>Comentarios</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
