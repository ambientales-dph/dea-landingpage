'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, X, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
  onClear: () => void;
}

export default function CardSearch({ onCardSelect, selectedCard, onClear }: CardSearchProps) {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchAllCards() {
      try {
        const fetchedCards = await getAllCardsFromAllBoards();
        setAllCards(fetchedCards);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar las tarjetas',
          description: error instanceof Error ? error.message : 'Hubo un error desconocido.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllCards();
  }, [toast]);

  useEffect(() => {
    if (selectedCard) {
      setQuery(selectedCard.name);
    }
  }, [selectedCard]);

  const trelloColorToTw = (color: string | null | undefined): string => {
    if (!color) return "bg-primary text-primary-foreground hover:bg-primary/90 aria-selected:bg-primary/90";
    switch (color) {
        case 'green': return 'bg-emerald-400 text-black hover:bg-emerald-500 aria-selected:bg-emerald-500';
        case 'yellow': return 'bg-yellow-400 text-black hover:bg-yellow-500 aria-selected:bg-yellow-500';
        case 'red': return 'bg-red-400 text-black hover:bg-red-500 aria-selected:bg-red-500';
        case 'orange': return 'bg-orange-500 text-white hover:bg-orange-600 aria-selected:bg-orange-600';
        case 'purple': return 'bg-purple-600 text-white hover:bg-purple-700 aria-selected:bg-purple-700';
        case 'blue': return 'bg-blue-400 text-black hover:bg-blue-500 aria-selected:bg-blue-500';
        case 'sky': return 'bg-sky-400 text-black hover:bg-sky-500 aria-selected:bg-sky-500';
        case 'lime': return 'bg-lime-400 text-black hover:bg-lime-500 aria-selected:bg-lime-500';
        case 'pink': return 'bg-pink-500 text-white hover:bg-pink-600 aria-selected:bg-pink-600';
        case 'black': return 'bg-gray-800 text-white hover:bg-gray-900 aria-selected:bg-gray-900';
        default: return "bg-primary text-primary-foreground hover:bg-primary/90 aria-selected:bg-primary/90";
    }
  };

  const removeAccents = (str: string): string => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const filteredCards = useMemo(() => {
    if (!query && isOpen) {
      return allCards.map(card => ({ ...card, matchType: 'description' as const }));
    }
    if (query && (!selectedCard || query !== selectedCard.name)) {
      const normalizedQuery = removeAccents(query.toLowerCase());
      const keywords = normalizedQuery.split(' ').filter(kw => kw.trim() !== '');

      if (keywords.length === 0) {
        return isOpen ? allCards.map(card => ({ ...card, matchType: 'description' as const })) : [];
      }
      
      return allCards
        .map(card => {
          const cardNameLower = removeAccents(card.name.toLowerCase());
          const cardDescLower = removeAccents(card.desc ? card.desc.toLowerCase() : '');

          const nameMatch = keywords.some(keyword => cardNameLower.includes(keyword));
          if (nameMatch) {
            return { ...card, matchType: 'name' as const };
          }

          const descMatch = keywords.some(keyword => cardDescLower.includes(keyword));
          if (descMatch) {
            return { ...card, matchType: 'description' as const };
          }

          return null;
        })
        .filter((c): c is TrelloCard & { matchType: 'name' | 'description' } => c !== null);
    }
    return [];
  }, [query, allCards, selectedCard, isOpen]);
  
  const handleSelect = (card: TrelloCard) => {
    onCardSelect(card);
    setQuery(card.name);
    setIsOpen(false);
  };
  
  const handleInputChange = async (inputValue: string) => {
    setQuery(inputValue);
    
    const exactMatch = allCards.find(c => c.name.toLowerCase() === inputValue.toLowerCase());
    if (exactMatch) {
      if (selectedCard?.id !== exactMatch.id) {
        onCardSelect(exactMatch);
      }
      setIsOpen(false);
    } else {
      if (selectedCard) {
        onCardSelect(null);
      }
      if (!isOpen) {
          setIsOpen(true);
      }
    }
  }

  const handleFocus = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    onClear();
  };

  const boardNames = useMemo(() => {
    if (allCards.length === 0) return [];
    const names = allCards.map(card => card.boardName);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [allCards]);

  const getProjectInfo = (name: string): { code: string | null; nameWithoutCode: string } => {
    const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
    const match = name.match(projectRegex);
    if (match && match[1]) {
        return {
            code: match[1],
            nameWithoutCode: name.replace(projectRegex, '').trim()
        };
    }
    return { code: null, nameWithoutCode: name };
  };

  const handleDownloadDuplicatesPdf = () => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);

    const title = 'Lista de Proyectos Duplicados';
    doc.text(title, 10, 10);

    const cardsByCode: Record<string, TrelloCard[]> = {};

    // Group cards by project code, excluding the template
    for (const card of allCards) {
      if (card.name.includes('(XXX000)')) continue;

      const { code } = getProjectInfo(card.name);
      if (code) {
        if (!cardsByCode[code]) {
          cardsByCode[code] = [];
        }
        cardsByCode[code].push(card);
      }
    }

    // Filter for groups with more than one card (duplicates) and sort by code
    const duplicates = Object.entries(cardsByCode)
      .filter(([, cards]) => cards.length > 1)
      .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

    if (duplicates.length === 0) {
      toast({
        title: 'No se encontraron duplicados',
        description: 'Todos los códigos de proyecto son únicos.',
      });
      return;
    }

    const lineHeight = 7;
    const margin = 10;
    const nameColX = margin;
    const boardColX = 120;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            return true;
        }
        return false;
    }
    
    let isFirstDuplicate = true;
    for (const [code, cards] of duplicates) {
        const headerHeight = isFirstDuplicate ? lineHeight : lineHeight * 2;
        if (checkPageBreak(headerHeight)) {
            isFirstDuplicate = true;
        }

        if (!isFirstDuplicate) {
            y += lineHeight;
        }

        doc.setFont('Helvetica', 'bold');
        doc.text(`Código duplicado: ${code}`, nameColX, y);
        y += lineHeight;
        doc.setFont('Helvetica', 'normal');

        // Sort cards within the duplicate group by board name for consistent ordering
        cards.sort((a, b) => a.boardName.localeCompare(b.boardName));
        
        for (const card of cards) {
            const { code: cardCode, nameWithoutCode } = getProjectInfo(card.name);
            const formattedName = cardCode ? `${cardCode} - ${nameWithoutCode}` : nameWithoutCode;
            
            const nameLines = doc.splitTextToSize(formattedName, boardColX - nameColX - 2);
            const boardLines = doc.splitTextToSize(card.boardName, doc.internal.pageSize.width - boardColX - margin);
            const requiredHeight = Math.max(nameLines.length, boardLines.length) * lineHeight;

            if (checkPageBreak(requiredHeight + 2)) {
                doc.setFont('Helvetica', 'bold');
                doc.text(`Código duplicado: ${code} (cont.)`, nameColX, y);
                y += lineHeight;
                doc.setFont('Helvetica', 'normal');
            }

            doc.text(nameLines, nameColX, y);
            doc.text(boardLines, boardColX, y);
            y += requiredHeight;
        }
        isFirstDuplicate = false;
    }
  
    doc.save('trello-proyectos-duplicados.pdf');
  };

  const handleDownloadPdf = (boardNameToFilter?: string) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');

    let cardsToProcess: TrelloCard[];
    let title: string;

    const isSearching = query.trim() && filteredCards.length > 0;
    
    if (boardNameToFilter) {
      const baseCards = isSearching ? filteredCards : allCards;
      cardsToProcess = baseCards.filter(card => 
        card.boardName === boardNameToFilter && 
        getProjectInfo(card.name).code &&
        !card.name.includes('(XXX000)')
      );
      title = `Proyectos del tablero: ${boardNameToFilter}`;
      if (isSearching) {
        title += ` (filtrado por "${query}")`;
      }
    } else {
      const baseCards = isSearching ? filteredCards : allCards;
      cardsToProcess = baseCards.filter(card => 
        getProjectInfo(card.name).code &&
        !card.name.includes('(XXX000)')
      );
      if (isSearching) {
        title = `Resultados de la búsqueda para: "${query}"`;
      } else {
        title = 'Lista de todos los proyectos';
      }
    }

    const groupedByBoard: Record<string, TrelloCard[]> = cardsToProcess.reduce((acc, card) => {
        const boardName = card.boardName || 'Sin tablero';
        if (!acc[boardName]) {
            acc[boardName] = [];
        }
        acc[boardName].push(card);
        return acc;
    }, {} as Record<string, TrelloCard[]>);

    const sortedBoardNames = Object.keys(groupedByBoard).sort((a, b) => a.localeCompare(b));

    for (const boardName of sortedBoardNames) {
        groupedByBoard[boardName].sort((a, b) => {
            const codeA = getProjectInfo(a.name).code;
            const codeB = getProjectInfo(b.name).code;
            if (codeA && codeB) {
                return codeA.localeCompare(codeB);
            }
            return codeA ? -1 : 1;
        });
    }

    doc.setFontSize(10);
    doc.text(title, 10, 10);
  
    const lineHeight = 7;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;
    const nameColWidth = doc.internal.pageSize.width - (2 * margin);
    let y = 20;

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            return true;
        }
        return false;
    }

    let isFirstBoard = true;
    for (const boardName of sortedBoardNames) {
        if (groupedByBoard[boardName].length === 0) continue;

        const boardHeaderHeight = isFirstBoard ? lineHeight : lineHeight * 2;
        if (checkPageBreak(boardHeaderHeight)) {
            isFirstBoard = true;
        }

        if (!isFirstBoard) {
            y += lineHeight;
        }
        
        const nameColX = margin;
        doc.setFont('Helvetica', 'bold');
        doc.text(boardName, nameColX, y);
        y += lineHeight;
        doc.setFont('Helvetica', 'normal');
        
        for (const card of groupedByBoard[boardName]) {
            const { code, nameWithoutCode } = getProjectInfo(card.name);
            
            if (!code) continue; 
    
            const formattedName = `${code} - ${nameWithoutCode}`;
            const nameLines = doc.splitTextToSize(formattedName, nameColWidth);
            const requiredHeight = nameLines.length * lineHeight;

            if (checkPageBreak(requiredHeight + lineHeight)) {
                doc.setFont('Helvetica', 'bold');
                doc.text(boardName + " (cont.)", margin, y);
                y += lineHeight;
                doc.setFont('Helvetica', 'normal');
            }
            
            doc.text(nameLines, margin, y);
            y += requiredHeight;
        }
        isFirstBoard = false;
    }
  
    doc.save('trello-proyectos.pdf');
  };
  
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={handleFocus}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder='Buscá por palabra clave o por código de proyecto...'
              className="w-full bg-primary-foreground text-foreground pr-10 text-xs"
              disabled={isLoading}
            />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command>
              <CommandList>
                {filteredCards.length === 0 && query.length > 0 && !isOpen && (
                  <CommandEmpty>No encontramos resultados.</CommandEmpty>
                )}
                <CommandGroup>
                  {filteredCards.map((card) => (
                    <CommandItem
                      key={card.id}
                      value={card.name}
                      onSelect={() => handleSelect(card)}
                      className={cn(
                        "cursor-pointer text-xs",
                        card.matchType === 'name' && trelloColorToTw(card.cover?.color)
                      )}
                    >
                      {card.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {query && (
          <Button variant="ghost" size="icon" onClick={handleClear} className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/20" disabled={isLoading}>
                    <Download className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p>Descargá la lista de proyectos.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent>
              <DropdownMenuLabel>Descargar Proyectos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleDownloadPdf()}>
                {query.trim() && filteredCards.length > 0 ? 'Resultados de la búsqueda' : 'Todos los proyectos'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Por tablero</DropdownMenuLabel>
              {boardNames.map((name) => (
                <DropdownMenuItem key={name} onSelect={() => handleDownloadPdf(name)}>
                    {name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-primary-foreground hover:bg-primary/20" 
                  disabled={isLoading}
                  onClick={handleDownloadDuplicatesPdf}
                >
                  <AlertTriangle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p>Descargá la lista de proyectos duplicados.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      </div>
    </div>
  );
}
