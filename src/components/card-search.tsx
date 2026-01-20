
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';

interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
}

export default function CardSearch({ onCardSelect, selectedCard }: CardSearchProps) {
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
    } else {
      setQuery('');
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

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(10);
    doc.text('Lista de Proyectos', 10, 10);
  
    const projectRegex = /\([A-Z]{3}\d{3}\)$/;
    const projectCards = allCards.filter(card => projectRegex.test(card.name));
    const cardNames = projectCards.map(card => card.name);
    
    const lineHeight = 7;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;
  
    cardNames.forEach(name => {
      // Split text into lines that fit the page width
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
    <div className="flex w-full items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Textarea
            ref={inputRef}
            value={query}
            onFocus={handleFocus}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscar una tarjeta...'}
            className="w-full bg-primary-foreground text-foreground"
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
      <Button variant="ghost" size="icon" onClick={handleDownloadPdf} className="text-primary-foreground hover:bg-primary/80" disabled={isLoading}>
        <Download className="h-5 w-5" />
      </Button>
    </div>
  );
}
