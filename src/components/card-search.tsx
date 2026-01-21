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
          description: error instanceof Error ? error.message : 'Ocurrió un error desconocido.',
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

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(10);
  
    let cardsToDownload: TrelloCard[];
    let title: string;
  
    if (query.trim() && filteredCards.length > 0) {
      cardsToDownload = filteredCards;
      title = `Resultados de búsqueda para: "${query}"`;
    } else {
      const projectRegex = /\([A-Z]{3}\d{3}\)$/;
      cardsToDownload = allCards.filter(card => projectRegex.test(card.name));
      title = 'Lista de Proyectos';
    }
  
    doc.text(title, 10, 10);
  
    const cardNames = cardsToDownload.map(card => card.name);
    
    const lineHeight = 7;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;
  
    cardNames.forEach(name => {
      const lines = doc.splitTextToSize(name, doc.internal.pageSize.width - margin * 2);
      
      lines.forEach((line: string) => {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
    });
  
    doc.save('trello-proyectos.pdf');
  };
  
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={handleFocus}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscá por palabra clave o por código de proyecto...'}
              className="w-full bg-primary-foreground text-foreground pr-10"
              disabled={isLoading}
            />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command>
              <CommandList>
                {filteredCards.length === 0 && query.length > 0 && !isOpen && (
                  <CommandEmpty>No se encontraron resultados.</CommandEmpty>
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
          <Button variant="ghost" size="icon" onClick={handleClear} className="absolute top-1/2 right-1 -translate-y-1/2 text-primary-foreground hover:bg-primary/80 h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleDownloadPdf} className="text-primary-foreground bg-transparent hover:bg-primary/20" disabled={isLoading}>
              <Download className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            <p>Descargá la lista de proyectos completa del tablero o el resultado de la búsqueda actual.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
