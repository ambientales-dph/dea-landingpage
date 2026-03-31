'use client';

import * as React from 'react';
import type { Milestone } from '@/timeline/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Printer, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface MilestoneSummaryTableProps {
  milestones: Milestone[];
  projectName?: string | null;
}

export function MilestoneSummaryTable({ milestones, projectName }: MilestoneSummaryTableProps) {
  return (
    <div className="p-4 md:p-8 w-full printable-content relative">
      <Card className="max-w-5xl mx-auto bg-white shadow-xl text-black border-zinc-200">
        <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-zinc-100">
            <CardTitle className="font-headline text-xl font-bold text-black truncate" title={projectName || ''}>
                {projectName || 'Resumen de Hitos'}
            </CardTitle>
            
            {/* Botón estándar HTML para evitar interferencias de librerías de UI */}
            <button 
                type="button"
                onClick={() => typeof window !== 'undefined' && window.print()}
                className="no-print relative z-[100] flex items-center justify-center h-10 w-10 rounded-md border border-zinc-400 bg-white text-black hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer"
                title="Imprimir o Guardar como PDF"
            >
                <Printer className="h-5 w-5" />
            </button>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader className="bg-zinc-50 border-b border-zinc-200">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="w-[40%] text-black font-bold px-6 py-3 uppercase tracking-wider">Nombre del Hito</TableHead>
                <TableHead className="w-[15%] text-black font-bold px-6 py-3 uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="w-[20%] text-black font-bold px-6 py-3 uppercase tracking-wider">Categoría</TableHead>
                <TableHead className="w-[25%] text-black font-bold px-6 py-3 uppercase tracking-wider">Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length > 0 ? (
                milestones.map((milestone) => (
                  <TableRow key={milestone.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="py-3 px-6 font-medium text-black">
                      <div className="flex items-center gap-2">
                        {milestone.isImportant && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-400 shrink-0" />
                        )}
                        <span>{milestone.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-6 text-zinc-600">
                      {format(parseISO(milestone.occurredAt), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="py-3 px-6">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-200"
                                style={{ backgroundColor: milestone.category.color }}
                            />
                            <span className="text-zinc-700">{milestone.category.name}</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-3 px-6">
                      <div className="flex flex-wrap gap-1">
                        {(milestone.tags || []).map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal text-[10px] bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-none">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-zinc-400 italic">
                    No hay hitos registrados para este proyecto.
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
