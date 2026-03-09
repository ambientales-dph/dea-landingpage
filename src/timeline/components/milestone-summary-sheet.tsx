'use client';

import * as React from 'react';
import { type Milestone } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';

interface MilestoneSummaryTableProps {
  milestones: Milestone[];
  projectName?: string | null;
}

export function MilestoneSummaryTable({ milestones, projectName }: MilestoneSummaryTableProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 printable-area">
      <Card className="max-w-5xl mx-auto bg-white shadow-xl text-black">
        <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className="font-headline text-xl font-bold text-black truncate" title={projectName || ''}>
                {projectName || 'Resumen de Hitos'}
            </CardTitle>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={handlePrint} size="icon" variant="outline" className="no-print text-black border-zinc-400 hover:bg-zinc-100">
                            <Printer className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Imprimir o Guardar como PDF</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader className="border-b border-zinc-200">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="w-[40%] text-black font-semibold px-6 py-3">Nombre del Hito</TableHead>
                <TableHead className="w-[15%] text-black font-semibold px-6 py-3">Fecha</TableHead>
                <TableHead className="w-[20%] text-black font-semibold px-6 py-3">Categoría</TableHead>
                <TableHead className="w-[25%] text-black font-semibold px-6 py-3">Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length > 0 ? (
                milestones.map((milestone) => (
                  <TableRow key={milestone.id} className="border-b-0">
                    <TableCell className="py-2 px-6 font-medium">
                      <div className="flex items-center gap-2">
                        {milestone.isImportant && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-400 shrink-0" />
                        )}
                        <span>{milestone.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-6">
                      {format(parseISO(milestone.occurredAt), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="py-2 px-6">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: milestone.category.color }}
                            />
                            <span>{milestone.category.name}</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-2 px-6">
                      <div className="flex flex-wrap gap-1">
                        {milestone.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal bg-zinc-200 text-black hover:bg-zinc-300">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                    No hay hitos para mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
