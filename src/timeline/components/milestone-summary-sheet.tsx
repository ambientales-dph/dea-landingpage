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
import { Printer, Star, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MilestoneSummaryTableProps {
  milestones: Milestone[];
  projectName?: string | null;
}

export function MilestoneSummaryTable({ milestones, projectName }: MilestoneSummaryTableProps) {
  return (
    <div className="p-4 md:p-8 w-full printable-content relative">
      <Card className="max-w-5xl mx-auto bg-white shadow-xl text-black border-zinc-200 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Reporte Consolidado</span>
                <CardTitle className="font-headline text-lg font-bold text-black truncate" title={projectName || ''}>
                    {projectName || 'Resumen de Hitos'}
                </CardTitle>
            </div>
            
            <button 
                type="button"
                onClick={() => typeof window !== 'undefined' && window.print()}
                className="no-print relative z-[100] flex items-center justify-center h-9 w-9 rounded-md border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors shadow-sm cursor-pointer"
                title="Imprimir o Guardar como PDF"
            >
                <Printer className="h-4 w-4" />
            </button>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="h-8 text-[9px] uppercase font-bold px-3 text-black">Hito / Evento</TableHead>
                <TableHead className="h-8 text-[9px] uppercase font-bold px-3 text-black w-[120px]">Fecha</TableHead>
                <TableHead className="h-8 text-[9px] uppercase font-bold px-3 text-black">Categoría</TableHead>
                <TableHead className="h-8 text-[9px] uppercase font-bold px-3 text-black">Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length > 0 ? (
                milestones.map((milestone, index) => {
                  const hasFiles = milestone.associatedFiles && milestone.associatedFiles.length > 0;
                  return (
                    <TableRow 
                      key={milestone.id} 
                      className={cn(
                        "transition-colors border-b border-muted/20",
                        index % 2 === 0 ? "bg-[#cceeff]/40" : "bg-muted/10"
                      )}
                    >
                      <TableCell className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {milestone.isImportant && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-400 shrink-0" />
                          )}
                          <span className="text-[10px] font-bold text-black leading-tight">
                            {milestone.name}
                          </span>
                          {hasFiles && (
                            <Paperclip className="h-3 w-3 text-primary/60 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <span className="text-[10px] font-mono text-zinc-500">
                          {format(parseISO(milestone.occurredAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                              <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: milestone.category.color }}
                              />
                              <span className="text-[10px] font-medium text-zinc-700 whitespace-nowrap">{milestone.category.name}</span>
                          </div>
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(milestone.tags || []).map((tag) => (
                            <Badge 
                              key={tag} 
                              variant="outline" 
                              className="h-4 px-1 text-[8px] font-bold uppercase tracking-tighter bg-white/50 border-zinc-200 text-zinc-500"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-[10px] text-zinc-400 italic">
                    No se registran hitos en este proyecto.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="mt-4 text-center no-print">
        <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
          © 2026 Departamento de Estudios Ambientales • Sistema DEA TL
        </p>
      </div>
    </div>
  );
}
