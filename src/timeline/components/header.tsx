
'use client';

import { Input } from './ui/input';
import { Search, List, ExternalLink, Home, GanttChartSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSetRange: (range: '1D' | '1M' | '1Y' | 'All') => void;
  onToggleView: () => void;
  view: 'timeline' | 'summary';
  onGoHome: () => void;
  trelloCardUrl: string | null;
  isProjectLoaded: boolean;
  onSelectTrainingProject?: () => void;
}

export function Header({ 
  searchTerm, 
  setSearchTerm, 
  onSetRange, 
  onToggleView, 
  view, 
  onGoHome, 
  trelloCardUrl, 
  isProjectLoaded,
  onSelectTrainingProject
}: HeaderProps) {
  
  // Clases para los botones claros (gris zinc-200)
  const iconButtonClasses = "h-8 w-8 border-none bg-zinc-200 text-zinc-800 hover:bg-zinc-300 hover:text-zinc-900 shadow-sm transition-all duration-200";
  
  // Clases para los botones de texto claros
  const textButtonClasses = "h-8 px-3 text-[10px] font-bold uppercase tracking-wider border-none bg-zinc-200 text-zinc-800 hover:bg-zinc-300 hover:text-zinc-900 shadow-sm transition-all duration-200 disabled:opacity-30";

  return (
    <header className="flex h-16 items-center border-b border-white/10 bg-[#2d3748] px-4 md:px-6 w-full shrink-0 gap-4 no-print">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 z-10" />
          <Input
            type="search"
            placeholder={isProjectLoaded ? "Buscar archivos, categorías o etiquetas..." : "Cargá un proyecto para poder buscar"}
            className="pl-9 w-full md:w-3/4 lg:w-1/2 h-8 text-xs bg-zinc-200 border-none text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-primary/50 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!isProjectLoaded}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={onGoHome} className={iconButtonClasses}>
                            <Home className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Volver al inicio</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={onToggleView} disabled={!isProjectLoaded} className={cn(iconButtonClasses, "disabled:opacity-30")}>
                            {view === 'timeline' ? <List className="h-4 w-4" /> : <GanttChartSquare className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{view === 'timeline' ? 'Ver resumen en tabla' : 'Ver línea de tiempo'}</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <a
                           href={trelloCardUrl ?? undefined}
                           target="_blank"
                           rel="noopener noreferrer"
                           aria-disabled={!trelloCardUrl}
                           tabIndex={!trelloCardUrl ? -1 : undefined}
                           className={!trelloCardUrl ? 'pointer-events-none' : ''}
                        >
                            <Button size="icon" variant="ghost" disabled={!trelloCardUrl} className={cn(iconButtonClasses, "disabled:opacity-30")}>
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </a>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Abrir tarjeta en Trello</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          <Separator orientation="vertical" className="h-8 mx-1 bg-white/10" />
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1D')} disabled={!isProjectLoaded} className={textButtonClasses}>Hoy</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1M')} disabled={!isProjectLoaded} className={textButtonClasses}>1M</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1Y')} disabled={!isProjectLoaded} className={textButtonClasses}>1A</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('All')} disabled={!isProjectLoaded} className={textButtonClasses}>Todo</Button>
          
          <div className="w-10 h-10 ml-2" />
      </div>
    </header>
  );
}
