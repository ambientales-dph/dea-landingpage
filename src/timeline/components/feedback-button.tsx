
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
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
      hasMoved.current = true;
    }
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
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
            className="fixed top-3 right-4 h-10 w-10 rounded-md shadow-lg bg-cyan-500 hover:bg-cyan-600 text-white z-[100] cursor-move touch-none select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out, background-color 0.2s ease-in-out, scale 0.2s ease-in-out'
            }}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="sr-only">Enviar Comentarios</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className={isDragging ? "hidden" : ""}>
          <p>Comentarios y Sugerencias</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
