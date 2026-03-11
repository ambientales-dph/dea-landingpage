'use client';

import * as React from 'react';
import { Logo } from './logo';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import { Plus, Search, Loader2, X, Pencil, Trash2, Info, Users, Mail, MessageCircle, ChevronDown } from 'lucide-react';
import type { Category } from '@/timeline/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ColorPicker } from './color-picker';
import { getMemberBoards, getBoardLists, getCardsInList, searchTrelloCards } from '@/timeline/services/trello';
import type { TrelloBoard, TrelloListBasic, TrelloCardBasic } from '@/timeline/services/trello';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from './ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WHITELIST, type AuthorizedUser } from '@/lib/auth-data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  categories: Category[];
  onCategoryColorChange: (categoryId: string, color: string) => void;
  onCategoryAdd: (name: string) => void;
  onCategoryUpdate: (categoryId: string, name: string) => void;
  onCategoryDelete: (categoryId: string) => void;
  onCardSelect: (card: TrelloCardBasic | null) => void;
  selectedCard: TrelloCardBasic | null;
  onGoHome: () => void;
  cardFromUrl?: TrelloCardBasic | null;
  selectedBoard: string;
  onBoardSelect: (id: string) => void;
  selectedList: string;
  onListSelect: (id: string) => void;
  cardSearchTerm: string;
  onCardSearchChange: (term: string) => void;
}

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
};

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

export function Sidebar({ 
    categories, 
    onCategoryColorChange, 
    onCategoryAdd, 
    onCategoryUpdate,
    onCategoryDelete,
    onCardSelect, 
    selectedCard, 
    onGoHome,
    cardFromUrl,
    selectedBoard,
    onBoardSelect,
    selectedList,
    onListSelect,
    cardSearchTerm,
    onCardSearchChange,
}: SidebarProps) {
  const [openPopoverId, setOpenPopoverId] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState('');
  const [categoryToDelete, setCategoryToDelete] = React.useState<Category | null>(null);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  const [boards, setBoards] = React.useState<TrelloBoard[]>([]);
  const [lists, setLists] = React.useState<TrelloListBasic[]>([]);
  const [cards, setCards] = React.useState<TrelloCardBasic[]>([]);
  const [filteredCards, setFilteredCards] = React.useState<TrelloCardBasic[]>([]);
  
  const [isTrelloAvailable, setIsTrelloAvailable] = React.useState<boolean | null>(null);
  const [isLoadingBoards, setIsLoadingBoards] = React.useState(false);
  const [isLoadingLists, setIsLoadingLists] = React.useState(false);
  const [isLoadingCards, setIsLoadingCards] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);

  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  React.useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingBoards(true);
      try {
        const { boards: memberBoards, isConfigured } = await getMemberBoards();
        setIsTrelloAvailable(isConfigured);
        if (isConfigured) {
          setBoards(memberBoards);
        }
      } catch (error) {
        console.error("Failed to fetch boards or check Trello config", error);
        setIsTrelloAvailable(false);
      } finally {
        setIsLoadingBoards(false);
      }
    };
    fetchInitialData();
  }, []);

  React.useEffect(() => {
    if (cardFromUrl) {
      const card = cardFromUrl as TrelloCardBasic & { idBoard: string; idList: string };
      onBoardSelect(card.idBoard);
      onCardSearchChange(card.name);
    }
  }, [cardFromUrl, onBoardSelect, onCardSearchChange]);

  React.useEffect(() => {
    if (!selectedBoard) {
      setLists([]);
      onListSelect('');
      return;
    }

    const fetchLists = async () => {
      setIsLoadingLists(true);
      setLists([]);
      try {
        const boardLists = await getBoardLists(selectedBoard);
        setLists(boardLists);
        if (cardFromUrl && (cardFromUrl as any).idBoard === selectedBoard) {
            onListSelect((cardFromUrl as any).idList);
        }
      } catch (error) {
        console.error(`Failed to fetch lists for board ${selectedBoard}`, error);
      } finally {
        setIsLoadingLists(false);
      }
    };
    fetchLists();
  }, [selectedBoard, cardFromUrl, onListSelect]);

  React.useEffect(() => {
    if (!selectedList) {
        setCards([]);
        setFilteredCards([]);
        return;
    }
    
    const fetchCards = async () => {
        setIsLoadingCards(true);
        try {
            const listCards = await getCardsInList(selectedList);
            setCards(listCards);
            setFilteredCards(listCards);
             if (cardFromUrl && (cardFromUrl as any).idList === selectedList) {
                onCardSelect(cardFromUrl);
            }
        } catch (error) {
            console.error(`Failed to fetch cards for list ${selectedList}`, error);
            setCards([]);
            setFilteredCards([]);
        } finally {
            setIsLoadingCards(false);
        }
    };
    fetchCards();
  }, [selectedList, cardFromUrl, onCardSelect]);
  
  React.useEffect(() => {
    if (!cardSearchTerm) {
      setFilteredCards(cards);
      return;
    }
    const normalizedFilter = normalizeText(cardSearchTerm);
    const filtered = cards.filter(card => {
      const normalizedName = normalizeText(card.name);
      const normalizedDesc = normalizeText(card.desc);

      return normalizedName.includes(normalizedFilter) || normalizedDesc.includes(normalizedFilter);
    });
    setFilteredCards(filtered);
  }, [cardSearchTerm, cards]);

  const handleColorSelect = (categoryId: string, color: string) => {
    onCategoryColorChange(categoryId, color);
    setOpenPopoverId(null);
  };

  const handleAddCategoryConfirm = () => {
    if (newCategoryName.trim()) {
      onCategoryAdd(newCategoryName.trim());
      setNewCategoryName('');
      setIsAdding(false);
    }
  };

  const handleAddCategoryCancel = () => {
    setIsAdding(false);
    setNewCategoryName('');
  };
  
  const handleEditStart = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleEditCancel = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleEditConfirm = () => {
    if (editingCategoryId && editingCategoryName.trim()) {
      onCategoryUpdate(editingCategoryId, editingCategoryName.trim());
    }
    handleEditCancel();
  };

  const handleDeleteConfirm = () => {
    if (categoryToDelete) {
      onCategoryDelete(categoryToDelete.id);
      setCategoryToDelete(null);
    }
  };
  
  React.useEffect(() => {
    if (editingCategoryId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCategoryId]);

  const handleCardClick = (card: TrelloCardBasic) => {
    onCardSelect(card);
  }

  const handleGlobalSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !cardSearchTerm.trim() || isSearching) {
        return;
    }

    e.preventDefault();
    onCardSelect(null);
    setIsSearching(true);

    try {
        const results = await searchTrelloCards(cardSearchTerm.trim());

        if (results.length === 1) {
            const card = results[0] as TrelloCardBasic & { idBoard: string, idList: string };
            
            onBoardSelect(card.idBoard);

            setIsLoadingLists(true);
            const boardLists = await getBoardLists(card.idBoard);
            setLists(boardLists);
            setIsLoadingLists(false);
            
            onListSelect(card.idList);

            setIsLoadingCards(true);
            const listCards = await getCardsInList(card.idList);
            setCards(listCards);
            setFilteredCards(listCards);
            setIsLoadingCards(false);

            onCardSelect(card);
        } else {
            onBoardSelect('');
            onListSelect('');
            setCards(results);
            setFilteredCards(results);
        }
    } catch (error) {
        console.error("Global card search failed", error);
    } finally {
        setIsSearching(false);
    }
};

const handleClearSearch = () => {
  onCardSearchChange('');
  setCards([]);
  setFilteredCards([]);
  onBoardSelect('');
  onListSelect('');
};

const cardListTitle = (!selectedBoard && !selectedList && cardSearchTerm) ? `Resultados (${filteredCards.length})` : `Tarjetas (${filteredCards.length})`;

const nominatedParticipants = React.useMemo(() => {
    if (!selectedCard?.desc) return [];
    const desc = selectedCard.desc.toLowerCase();
    return WHITELIST.filter(person => {
        if (!person.name) return false;
        return desc.includes(person.name.toLowerCase());
    });
}, [selectedCard?.desc]);

const handleWhatsAppClick = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
};

const handleEmailClick = (email: string) => {
    window.location.href = `mailto:${email}`;
};

  return (
    <aside className="hidden md:flex flex-col w-72 bg-[#2d3748] h-full no-print">
      <div className="h-16 flex items-center border-b border-white/10 shrink-0">
        <Logo />
      </div>
      <div className="flex-1 p-3 flex flex-col gap-4 min-h-0">
        
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1">
                Proyectos Trello
            </p>
            {isTrelloAvailable === false ? (
                 <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="pt-4 text-xs text-amber-200/80 flex items-start gap-3">
                        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-200">Integración no configurada</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Buscar proyecto..."
                            className="pl-9 pr-9 h-9 text-xs bg-[#1a202c] border-white/10 text-white placeholder:text-zinc-600"
                            value={cardSearchTerm}
                            onChange={(e) => onCardSearchChange(e.target.value)}
                            onKeyDown={handleGlobalSearch}
                            disabled={isTrelloAvailable === null}
                        />
                        {isSearching ? (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-500" />
                        ) : cardSearchTerm && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-zinc-500 hover:bg-white/10"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {selectedCard && (
                        <div className="pt-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-full h-8 justify-between text-[10px] uppercase font-bold text-zinc-400 hover:bg-white/5 hover:text-white border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-3 w-3" />
                                            <span>Equipo del Proyecto</span>
                                            {nominatedParticipants.length > 0 && (
                                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary-foreground text-[9px]">{nominatedParticipants.length}</span>
                                            )}
                                        </div>
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[264px] bg-[#2d3748] border-white/10 shadow-2xl p-0 overflow-hidden">
                                    <DropdownMenuLabel className="text-[9px] text-zinc-400 uppercase tracking-widest px-3 py-2 bg-white/5">Nominados DEA</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/5 m-0" />
                                    <ScrollArea className="h-[200px] w-full">
                                        {nominatedParticipants.length > 0 ? (
                                            nominatedParticipants.map((person, idx) => (
                                                <div key={idx} className="flex items-center justify-between px-3 py-0.5 hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0 h-7">
                                                    <span className="text-[11px] text-white font-medium truncate flex-1 pr-2">{person.name}</span>
                                                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        {person.email && person.email.includes('@') && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-5 w-5 text-zinc-400 hover:text-primary hover:bg-primary/10"
                                                                onClick={() => handleEmailClick(person.email)}
                                                                title={`Enviar mail a ${person.name}`}
                                                            >
                                                                <Mail className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                        {person.phone && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-5 w-5 text-zinc-400 hover:text-green-500 hover:bg-green-500/10"
                                                                onClick={() => handleWhatsAppClick(person.phone!)}
                                                                title={`WhatsApp a ${person.name}`}
                                                            >
                                                                <WhatsAppIcon className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-4 text-center">
                                                <p className="text-[10px] text-zinc-500 italic">No se detectaron nominados en la ficha técnica.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            )}
          </div>
          
          {(selectedList || isSearching || (!selectedBoard && cardSearchTerm)) && (
              <div className="flex-1 flex flex-col min-h-0 border border-white/10 rounded-md bg-[#1a202c]">
                  <div className="p-2 border-b border-white/10 shrink-0">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {cardListTitle}
                      </p>
                  </div>
                  <ScrollArea className="flex-1">
                      <div className="p-1 space-y-1">
                      {isLoadingCards || isSearching ? (
                          <div className="p-2 space-y-2">
                          <Skeleton className="h-6 w-full bg-white/5" />
                          <Skeleton className="h-6 w-full bg-white/5" />
                          </div>
                      ) : filteredCards.length > 0 ? (
                          filteredCards.map(card => (
                              <button
                                  key={card.id}
                                  onClick={() => handleCardClick(card)}
                                  className={cn(
                                      "w-full text-left text-xs p-2 rounded-md transition-colors",
                                      selectedCard?.id === card.id 
                                        ? "bg-primary text-white font-bold" 
                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                  )}
                              >
                                  {card.name}
                              </button>
                          ))
                      ) : (
                          <p className="p-4 text-xs text-zinc-600 text-center italic">
                              No hay tarjetas.
                          </p>
                      )}
                      </div>
                  </ScrollArea>
              </div>
          )}
        
        <div className="mt-auto shrink-0 border-t border-white/10 pt-2">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="categories" className="border-b-0">
                    <div className="flex items-center justify-between pr-2 pl-1">
                        <AccordionTrigger className="flex-1 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:no-underline">
                            Categorías
                        </AccordionTrigger>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={() => setIsAdding(true)} disabled={isAdding}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <AccordionContent className="pt-1 pb-0">
                        <ScrollArea className="h-48">
                            <div className="pr-3 space-y-1">
                                {isAdding && (
                                    <div className="p-2 mb-2 space-y-2 border border-white/10 rounded-md bg-white/5">
                                        <Input
                                        placeholder="Nueva categoría..."
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategoryConfirm() }}
                                        autoFocus
                                        className="h-8 text-xs bg-[#1a202c] border-white/10 text-white"
                                        />
                                        <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 text-zinc-400" onClick={handleAddCategoryCancel}>Cerrar</Button>
                                        <Button size="sm" onClick={handleAddCategoryConfirm} disabled={!newCategoryName.trim()} className="h-7">Añadir</Button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {sortedCategories.map((category) => (
                                        <div key={category.id} className="group relative flex items-center w-full justify-start rounded-md text-xs font-medium h-8 px-3 hover:bg-white/5 transition-colors">
                                            <Popover border-none open={openPopoverId === category.id} onOpenChange={(isOpen) => setOpenPopoverId(isOpen ? category.id : null)}>
                                                <PopoverTrigger asChild>
                                                    <button
                                                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-125 focus:outline-none ring-offset-[#2d3748] focus:ring-2 focus:ring-primary"
                                                    style={{ backgroundColor: category.color }}
                                                    disabled={!!editingCategoryId}
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 bg-[#2d3748] border-white/10" align="start">
                                                    <ColorPicker onColorSelect={(color) => handleColorSelect(category.id, color)} />
                                                </PopoverContent>
                                            </Popover>
                                            {editingCategoryId === category.id ? (
                                            <Input
                                                ref={editInputRef}
                                                value={editingCategoryName}
                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                onBlur={handleEditConfirm}
                                                onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditConfirm();
                                                if (e.key === 'Escape') handleEditCancel();
                                                }}
                                                className="h-6 ml-3 text-xs bg-[#1a202c] border-white/10 text-white"
                                            />
                                            ) : (
                                            <>
                                                <span className="ml-3 text-zinc-400 truncate group-hover:text-white" title={category.name}>{category.name}</span>
                                                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={() => handleEditStart(category)} disabled={!!editingCategoryId}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-destructive" onClick={() => setCategoryToDelete(category)} disabled={!!editingCategoryId}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                                </div>
                                            </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </div>
      <div className="p-4 border-t border-white/10 shrink-0">
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center">&copy; 2024 DEA TL</p>
      </div>

       <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent className="bg-[#2d3748] border-white/10 text-white">
        <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar categoría?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
            Se eliminará <span className="font-semibold text-white">{categoryToDelete?.name}</span>. 
            Esta acción no se puede deshacer.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5" onClick={() => setCategoryToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
            onClick={handleDeleteConfirm}
            className={cn(buttonVariants({ variant: "destructive" }))}
            >
            Borrar
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
