
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Trash2, RotateCcw, AlertTriangle, Clock, Paperclip } from 'lucide-react';
import type { Milestone } from '@/timeline/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TrashDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deletedMilestones: Milestone[];
  onRestore: (milestone: Milestone) => void;
  onPermanentDelete: (milestoneId: string) => void;
  isProcessing: boolean;
}

export function TrashDialog({
  isOpen,
  onOpenChange,
  deletedMilestones,
  onRestore,
  onPermanentDelete,
  isProcessing,
}: TrashDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-zinc-100 text-black p-0 overflow-hidden flex flex-col shadow-2xl">
        <DialogHeader className="p-6 bg-[#2d3748] text-white shrink-0">
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-400" />
            Papelera de Reciclaje
          </DialogTitle>
          <DialogDescription className="text-zinc-300">
            Los hitos eliminados permanecen aquí durante <strong>30 días</strong> como máximo, tras los cuales se borran definitivamente de forma automática para optimizar el sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[400px]">
            {deletedMilestones.length > 0 ? (
              <div className="p-4 space-y-3">
                {deletedMilestones.map((ms) => (
                  <div key={ms.id} className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Eliminado el {ms.deletedAt ? format(ms.deletedAt.toDate(), "dd/MM/yy HH:mm", { locale: es }) : '---'}
                          </span>
                          {ms.associatedFiles.length > 0 && (
                            <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {ms.associatedFiles.length} adjunto(s)
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-zinc-800 truncate">{ms.name}</h4>
                        <p className="text-xs text-zinc-500 line-clamp-2 mt-1 italic">{ms.description || 'Sin descripción'}</p>
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs border-zinc-300 hover:bg-primary hover:text-white hover:border-primary transition-all"
                          onClick={() => onRestore(ms)}
                          disabled={isProcessing}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          Restaurar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-xs text-zinc-400 hover:text-destructive hover:bg-destructive/5 transition-all"
                          onClick={() => onPermanentDelete(ms.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="h-16 w-16 bg-zinc-200 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="h-8 w-8 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-500">La papelera está vacía.</p>
                <p className="text-xs text-zinc-400 mt-1">No hay hitos eliminados recientemente para este proyecto.</p>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="p-4 bg-zinc-200 border-t border-zinc-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Los archivos de Drive no se borran hasta vaciar la papelera</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-zinc-400 text-zinc-700">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
