
'use client';

import { Input } from './ui/input';
import { Search, List, Home, GanttChartSquare, MessageSquare, Trash2 } from 'lucide-react';
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
  onSetRange: (range: '1H' | '1D' | '1M' | '1Y' | 'All') => void;
  onToggleView: () => void;
  view: 'timeline' | 'summary';
  onGoHome: () => void;
  onFeedbackClick: () => void;
  onTrashClick: () => void;
  trelloCardUrl: string | null;
  isProjectLoaded: boolean;
  deletedCount: number;
}

export function Header({ 
  searchTerm, 
  setSearchTerm, 
  onSetRange, 
  onToggleView, 
  view, 
  onGoHome, 
  onFeedbackClick,
  onTrashClick,
  trelloCardUrl, 
  isProjectLoaded,
  deletedCount
}: HeaderProps) {
  
  const iconButtonClasses = "h-8 w-8 border-none bg-zinc-200 text-zinc-800 hover:bg-zinc-300 hover:text-zinc-900 shadow-sm transition-all duration-200";
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
                    <TooltipContent><p>Volver al inicio</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={onToggleView} disabled={!isProjectLoaded} className={cn(iconButtonClasses, "disabled:opacity-30")}>
                            {view === 'timeline' ? <List className="h-4 w-4" /> : <GanttChartSquare className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{view === 'timeline' ? 'Ver resumen en tabla' : 'Ver línea de tiempo'}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={onTrashClick} 
                          disabled={!isProjectLoaded} 
                          className={cn(iconButtonClasses, "relative disabled:opacity-30")}
                        >
                            <Trash2 className="h-4 w-4" />
                            {deletedCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-[#2d3748]">
                                {deletedCount}
                              </span>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Papelera de reciclaje</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
          <Separator orientation="vertical" className="h-8 mx-1 bg-white/10" />
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1D')} disabled={!isProjectLoaded} className={textButtonClasses}>Hoy</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1H')} disabled={!isProjectLoaded} className={textButtonClasses}>1H</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1M')} disabled={!isProjectLoaded} className={textButtonClasses}>1M</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('1Y')} disabled={!isProjectLoaded} className={textButtonClasses}>1A</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetRange('All')} disabled={!isProjectLoaded} className={textButtonClasses}>Todo</Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  onClick={onFeedbackClick} 
                  className="h-10 w-10 ml-2 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg transition-transform active:scale-95"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-white text-black border shadow-lg">
                <p className="font-bold">Consultas y Sugerencias</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      </div>
    </header>
  );
}
