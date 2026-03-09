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
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, Plus, Trash2 } from 'lucide-react';
import { processTableMilestones, type MilestoneExtractionOutput } from '@/ai/flows/process-milestones-flow';
import type { Category, Milestone } from '@/types';
import { Badge } from './ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface AIAssistantDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: Category[];
  onConfirm: (milestones: MilestoneExtractionOutput) => void;
}

export function AIAssistantDialog({ isOpen, onOpenChange, categories, onConfirm }: AIAssistantDialogProps) {
  const [inputData, setInputData] = React.useState('');
  const [proposedMilestones, setProposedMilestones] = React.useState<MilestoneExtractionOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleProcess = async () => {
    if (!inputData.trim()) return;
    setIsLoading(true);
    try {
      const result = await processTableMilestones({
        textData: inputData,
        categories: categories.map(c => ({ id: c.id, name: c.name })),
      });
      setProposedMilestones(result);
    } catch (error) {
      console.error("AI processing error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setProposedMilestones(null);
    setInputData('');
  };

  const handleConfirm = () => {
    if (proposedMilestones) {
      onConfirm(proposedMilestones);
      onOpenChange(false);
      handleReset();
    }
  };

  const removeProposed = (index: number) => {
    if (proposedMilestones) {
        setProposedMilestones(proposedMilestones.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-zinc-100 text-black">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente de IA - Importación Masiva
          </DialogTitle>
          <DialogDescription className="text-zinc-700">
            Pegá una tabla de Excel, CSV o texto con hitos. La IA identificará los nombres, fechas y categorías automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {!proposedMilestones ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Pegá aquí tus datos (ej: 15/05/2023 - Inicio de obra - Se instaló el obrador...)"
                className="min-h-[250px] bg-white text-black border-zinc-300 font-sans text-sm"
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
              />
              <Button 
                onClick={handleProcess} 
                className="w-full" 
                disabled={isLoading || !inputData.trim()}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isLoading ? 'Analizando datos...' : 'Procesar con IA'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-headline">Hitos Identificados ({proposedMilestones.length})</h3>
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
                    Reiniciar
                </Button>
              </div>
              <ScrollArea className="h-[400px] pr-4 border rounded-md bg-white p-2">
                <div className="space-y-3">
                  {proposedMilestones.map((ms, index) => {
                    const category = categories.find(c => c.id === ms.categoryId);
                    return (
                      <div key={index} className="p-3 border rounded-lg bg-zinc-50 relative group">
                        <button 
                            onClick={() => removeProposed(index)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ borderColor: category?.color, color: category?.color }}>
                            {category?.name || 'Sin Categoría'}
                          </Badge>
                          <span className="text-[10px] font-medium text-zinc-500">
                            {format(parseISO(ms.occurredAt), "dd/MM/yyyy", { locale: es })}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold truncate pr-6">{ms.name}</h4>
                        <p className="text-xs text-zinc-600 line-clamp-2 mt-1">{ms.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ms.tags.map(tag => (
                            <span key={tag} className="text-[9px] bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-700">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-xs">
                    Revisá los hitos antes de confirmar. Se crearán automáticamente en el proyecto actual.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {proposedMilestones && (
            <Button onClick={handleConfirm} className="bg-primary hover:bg-primary/90">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar y Crear Hitos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
