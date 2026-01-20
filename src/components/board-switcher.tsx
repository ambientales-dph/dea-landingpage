
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export default function CardSearch() {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

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

  const filteredCards = useMemo(() => {
    if (!query) return [];
    return allCards.filter(card => 
      card.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allCards]);

  const handleCardSelect = (cardUrl: string) => {
    if (cardUrl) {
      window.open(cardUrl, '_blank');
      setIsOpen(false);
      setQuery('');
    }
  };
  
  const handleInputChange = (value: string) => {
      setQuery(value);
      if(value.length > 0 && !isOpen) {
          setIsOpen(true);
      } else if (value.length === 0 && isOpen) {
          setIsOpen(false);
      }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscar una tarjeta...'}
          className="w-full bg-primary-foreground text-foreground"
          disabled={isLoading}
        />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
          <Command>
            <CommandList>
              {filteredCards.length === 0 && query.length > 0 && (
                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              )}
              <CommandGroup>
                {filteredCards.map((card) => (
                  <CommandItem
                    key={card.id}
                    value={card.name}
                    onSelect={() => handleCardSelect(card.url)}
                    className="cursor-pointer"
                  >
                    {card.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
      </PopoverContent>
    </Popover>
  );
}
