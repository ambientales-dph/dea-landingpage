'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from './ui/textarea';
import { generateTrelloSummary } from '@/ai/flows/generate-trello-summary';
import { Loader2 } from 'lucide-react';

interface TrelloSummaryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function TrelloSummary({ isOpen, onOpenChange }: TrelloSummaryProps) {
  const [board, setBoard] = React.useState('');
  const [topic, setTopic] = React.useState('Dame un resumen del estado general del tablero.');
  const [summary, setSummary] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const boardId1 = process.env.NEXT_PUBLIC_TRELLO_BOARD_ID_1 || '';
  const boardId2 = process.env.NEXT_PUBLIC_TRELLO_BOARD_ID_2 || '';
  
  const boards = [
      { id: boardId1, name: 'Obras Hidráulicas'},
      { id: boardId2, name: 'Inspecciones Urbanas'}
  ];

  const handleGenerateSummary = async () => {
    if (!board) return;
    setIsLoading(true);
    setSummary('');
    try {
      const selectedBoard = boards.find(b => b.id === board);
      if (!selectedBoard) throw new Error("Tablero no seleccionado");
      
      const result = await generateTrelloSummary({
        boardId: selectedBoard.id,
        boardName: selectedBoard.name,
        topic: topic,
      });
      setSummary(result);
    } catch (error) {
      console.error(error);
      setSummary('Ocurrió un error al generar el resumen. Revisa las credenciales de Trello en el archivo .env y la consola para más detalles.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
        setBoard('');
        setTopic('Dame un resumen del estado general del tablero.');
        setSummary('');
        setIsLoading(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Resumen de Proyecto (Trello)</DialogTitle>
          <DialogDescription>
            Selecciona un tablero y describe qué información necesitas para obtener un resumen generado por IA.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label>1. Selecciona el tablero de Trello</Label>
                <RadioGroup value={board} onValueChange={setBoard}>
                    {boards.filter(b => b.id).map(b => (
                        <div key={b.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={b.id} id={b.id} />
                            <Label htmlFor={b.id} className="font-normal">{b.name}</Label>
                        </div>
                    ))}
                </RadioGroup>
                {!boardId1 && !boardId2 && <p className="text-xs text-destructive">No se encontraron IDs de tableros en las variables de entorno (NEXT_PUBLIC_TRELLO_BOARD_ID_...).</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="topic">2. ¿Qué necesitas saber?</Label>
                <Textarea
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej: ¿Hay alguna tarea bloqueada? ¿Qué tarjetas vencen esta semana?"
                />
            </div>
            <Button onClick={handleGenerateSummary} disabled={!board || isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Generando...' : 'Obtener Resumen'}
            </Button>
            {summary && (
                <div className="mt-4 p-4 border rounded-md bg-secondary/50 max-h-60 overflow-y-auto">
                    <h3 className="font-semibold mb-2">Resumen de IA:</h3>
                    <pre className="text-sm whitespace-pre-wrap font-body">{summary}</pre>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
