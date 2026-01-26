'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
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

  const filteredCards = useMemo(() => {
    if (!query && isOpen) {
      return allCards;
    }
    if (query && (!selectedCard || query !== selectedCard.name)) {
      const lowercasedQuery = query.toLowerCase();
      return allCards.filter(card => 
        card.name.toLowerCase().includes(lowercasedQuery) ||
        (card.desc && card.desc.toLowerCase().includes(lowercasedQuery))
      );
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

  const handleDownloadPdf = (boardNameToFilter?: string) => {
    const doc = new jsPDF();
    doc.setFontSize(10);
    doc.setFont('EncodeSans');

    let cardsToProcess: TrelloCard[];
    let title: string;

    const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
    const isSearching = query.trim() && filteredCards.length > 0;

    if (boardNameToFilter) {
      const baseCards = isSearching ? filteredCards : allCards;
      cardsToProcess = baseCards.filter(card => 
        card.boardName === boardNameToFilter && projectRegex.test(card.name)
      );
      title = `Proyectos del tablero: ${boardNameToFilter}`;
      if (isSearching) {
        title += ` (filtrado por "${query}")`;
      }
    } else {
      const baseCards = isSearching ? filteredCards : allCards;
      cardsToProcess = baseCards.filter(card => projectRegex.test(card.name));
      if (isSearching) {
        title = `Resultados de la búsqueda para: "${query}"`;
      } else {
        title = 'Lista de todos los proyectos';
      }
    }

    const getProjectInfo = (name: string): { code: string | null; nameWithoutCode: string } => {
        const match = name.match(projectRegex);
        if (match && match[1]) {
            return {
                code: match[1],
                nameWithoutCode: name.replace(projectRegex, '').trim()
            };
        }
        return { code: null, nameWithoutCode: name };
    };

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

    doc.text(title, 10, 10);
  
    const lineHeight = 7;
    const margin = 10;
    const nameColX = margin;
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

        doc.setFont('EncodeSans', 'bold');
        doc.text(boardName, nameColX, y);
        y += lineHeight;
        doc.setFont('EncodeSans', 'normal');
        
        for (const card of groupedByBoard[boardName]) {
            const { code, nameWithoutCode } = getProjectInfo(card.name);
            
            if (!code) continue; 
    
            const formattedName = `${code} - ${nameWithoutCode}`;
            const nameLines = doc.splitTextToSize(formattedName, nameColWidth);
            const requiredHeight = nameLines.length * lineHeight;

            if (checkPageBreak(requiredHeight + lineHeight)) {
                doc.setFont('EncodeSans', 'bold');
                doc.text(boardName + " (cont.)", nameColX, y);
                y += lineHeight;
                doc.setFont('EncodeSans', 'normal');
            }
            
            doc.text(nameLines, nameColX, y);
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
                      className="cursor-pointer text-xs"
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
    </div>
  );
}
