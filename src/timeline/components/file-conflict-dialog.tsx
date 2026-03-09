
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
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { AlertCircle, Copy, RefreshCw, XCircle } from 'lucide-react';

export type ConflictStrategy = 'overwrite' | 'rename' | 'omit';

interface FileConflict {
    name: string;
    existingId: string;
}

interface FileConflictDialogProps {
  isOpen: boolean;
  conflicts: FileConflict[];
  onResolve: (resolutions: Record<string, ConflictStrategy>) => void;
  onCancel: () => void;
}

export function FileConflictDialog({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}: FileConflictDialogProps) {
  const [resolutions, setResolutions] = React.useState<Record<string, ConflictStrategy>>({});

  React.useEffect(() => {
    if (isOpen) {
        // Por defecto, todos a renombrar
        const initial: Record<string, ConflictStrategy> = {};
        conflicts.forEach(c => initial[c.name] = 'rename');
        setResolutions(initial);
    }
  }, [isOpen, conflicts]);

  const handleApplyToAll = (strategy: ConflictStrategy) => {
    const updated = { ...resolutions };
    conflicts.forEach(c => updated[c.name] = strategy);
    setResolutions(updated);
  };

  const handleResolve = () => {
    onResolve(resolutions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-100 text-black">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            Archivos duplicados detectados
          </DialogTitle>
          <DialogDescription className="text-zinc-700">
            Los siguientes archivos ya existen en Google Drive. Seleccioná qué acción realizar para cada uno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
            <Button variant="outline" size="xs" className="h-7 text-[10px]" onClick={() => handleApplyToAll('rename')}>
                Renombrar todos
            </Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px]" onClick={() => handleApplyToAll('overwrite')}>
                Sobrescribir todos
            </Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px] text-destructive hover:text-destructive" onClick={() => handleApplyToAll('omit')}>
                Omitir todos
            </Button>
        </div>

        <ScrollArea className="max-h-[300px] pr-3 border rounded-md p-2 bg-white">
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div key={conflict.name} className="space-y-2 pb-2 border-b last:border-0">
                <p className="text-xs font-semibold truncate" title={conflict.name}>{conflict.name}</p>
                <RadioGroup 
                    value={resolutions[conflict.name]} 
                    onValueChange={(val) => setResolutions(prev => ({ ...prev, [conflict.name]: val as ConflictStrategy }))}
                    className="flex flex-row gap-4"
                >
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="rename" id={`rename-${conflict.name}`} className="h-3 w-3" />
                    <Label htmlFor={`rename-${conflict.name}`} className="text-[10px] cursor-pointer flex items-center gap-1">
                        <Copy className="h-3 w-3" /> Renombrar
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="overwrite" id={`overwrite-${conflict.name}`} className="h-3 w-3" />
                    <Label htmlFor={`overwrite-${conflict.name}`} className="text-[10px] cursor-pointer flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Sobrescribir
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="omit" id={`omit-${conflict.name}`} className="h-3 w-3" />
                    <Label htmlFor={`omit-${conflict.name}`} className="text-[10px] cursor-pointer flex items-center gap-1 text-destructive">
                        <XCircle className="h-3 w-3" /> Omitir
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleResolve}>
            Confirmar y subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
