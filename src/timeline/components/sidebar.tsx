'use client';

import * as React from 'react';
import { Logo } from './logo';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import { Plus, Search, Loader2, X, Pencil, Trash2, Info } from 'lucide-react';
import type { Category } from '@/timeline/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ColorPicker } from './color-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
};

const cardListTitle = (!selectedBoard && !selectedList && cardSearchTerm) ? `Resultados (${filteredCards.length})` : `Tarjetas (${filteredCards.length})`;


  return (
    <aside className="hidden md:flex flex-col w-72 border-r bg-card h-full no-print">
      <div className="h-16 flex items-center border-b shrink-0">
        <Logo />
      </div>
      <div className="flex-1 p-3 flex flex-col gap-4 min-h-0">
        
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">
                Proyectos Trello
            </p>
            {isTrelloAvailable === false ? (
                 <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="pt-4 text-xs text-amber-200/80 flex items-start gap-3">
                        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-200">Integración con Trello no configurada</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Select onValueChange={onBoardSelect} value={selectedBoard} disabled={isLoadingBoards || isTrelloAvailable === null}>
                    <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder={
                            isTrelloAvailable === null ? "Verificando Trello..." :
                            isLoadingBoards ? "Cargando tableros..." : "Seleccionar tablero"
                        } />
                    </SelectTrigger>
                    <SelectContent>
                        {boards.map(board => (
                        <SelectItem key={board.id} value={board.id} className="text-xs">{board.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>

                    <Select 
                      onValueChange={(value) => { onListSelect(value); onCardSelect(null); }} 
                      value={selectedList} 
                      disabled={!selectedBoard || isLoadingLists}
                    >
                    <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder={isLoadingLists ? "Cargando listas..." : "Seleccionar lista"} />
                    </SelectTrigger>
                    <SelectContent>
                        {lists.map(list => (
                        <SelectItem key={list.id} value={list.id} className="text-xs">{list.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar tarjeta y presionar Enter..."
                            className="pl-9 pr-9 h-8 text-xs"
                            value={cardSearchTerm}
                            onChange={(e) => onCardSearchChange(e.target.value)}
                            onKeyDown={handleGlobalSearch}
                            disabled={isTrelloAvailable === null}
                        />
                        {isSearching ? (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        ) : cardSearchTerm && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:bg-accent"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </>
            )}
          </div>
          
          {(selectedList || isSearching || (!selectedBoard && cardSearchTerm)) && (
              <div className="flex-1 flex flex-col min-h-0 border rounded-md">
                  <div className="p-2 border-b shrink-0">
                      <p className="text-xs font-semibold text-muted-foreground">
                          {cardListTitle}
                      </p>
                  </div>
                  <ScrollArea className="flex-1">
                      <div className="p-1 space-y-1">
                      {isLoadingCards || isSearching ? (
                          <div className="p-2 space-y-2">
                          <Skeleton className="h-6 w-full" />
                          <Skeleton className="h-6 w-full" />
                          <Skeleton className="h-6 w-5/6" />
                          </div>
                      ) : filteredCards.length > 0 ? (
                          filteredCards.map(card => (
                              <button
                                  key={card.id}
                                  onClick={() => handleCardClick(card)}
                                  className={cn(
                                      "w-full text-left text-xs p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-card-foreground",
                                      selectedCard?.id === card.id && "bg-primary text-primary-foreground hover:bg-primary/90"
                                  )}
                              >
                                  {card.name}
                              </button>
                          ))
                      ) : (
                          <p className="p-4 text-xs text-muted-foreground text-center">
                              No se encontraron tarjetas.
                          </p>
                      )}
                      </div>
                  </ScrollArea>
              </div>
          )}
        
        <div className="mt-auto shrink-0 border-t pt-2">
            <Accordion type="single" collapsible className="w-full" defaultValue="categories">
                <AccordionItem value="categories" className="border-b-0">
                    <div className="flex items-center justify-between pr-2 pl-1">
                        <AccordionTrigger className="flex-1 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:no-underline">
                            Categorías
                        </AccordionTrigger>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setIsAdding(true)} disabled={isAdding}>
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Añadir Categoría</span>
                        </Button>
                    </div>
                    <AccordionContent className="pt-1 pb-0">
                        <ScrollArea className="h-48">
                            <div className="pr-3 space-y-1">
                                {isAdding && (
                                    <div className="p-2 mb-2 space-y-2 border rounded-md bg-secondary/30">
                                        <Input
                                        placeholder="Nombre de la categoría"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategoryConfirm() }}
                                        autoFocus
                                        className="h-8 text-xs"
                                        />
                                        <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7" onClick={handleAddCategoryCancel}>Cancelar</Button>
                                        <Button size="sm" onClick={handleAddCategoryConfirm} disabled={!newCategoryName.trim()} className="h-7">Añadir</Button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {categories.map((category) => (
                                        <div key={category.id} className="group relative flex items-center w-full justify-start rounded-md text-xs font-medium h-8 px-3 hover:bg-accent">
                                            <Popover border-none open={openPopoverId === category.id} onOpenChange={(isOpen) => setOpenPopoverId(isOpen ? category.id : null)}>
                                                <PopoverTrigger asChild>
                                                    <button
                                                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-125 focus:outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    style={{ backgroundColor: category.color }}
                                                    aria-label={`Cambiar color de la categoría ${category.name}`}
                                                    disabled={!!editingCategoryId}
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
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
                                                className="h-6 ml-3 text-xs"
                                            />
                                            ) : (
                                            <>
                                                <span className="ml-3 text-muted-foreground truncate" title={category.name}>{category.name}</span>
                                                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditStart(category)} disabled={!!editingCategoryId}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10 text-destructive" onClick={() => setCategoryToDelete(category)} disabled={!!editingCategoryId}>
                                                    <Trash2 className="h-3.5 w-3.5" />
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
      <div className="p-4 border-t shrink-0">
        <p className="text-xs text-muted-foreground">&copy; 2024 DEA TL</p>
      </div>

       <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará la categoría <span className="font-semibold text-foreground">{categoryToDelete?.name}</span>. 
            No podrás eliminarla si está en uso por algún hito.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
            onClick={handleDeleteConfirm}
            className={cn(buttonVariants({ variant: "destructive" }))}
            >
            Eliminar
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
