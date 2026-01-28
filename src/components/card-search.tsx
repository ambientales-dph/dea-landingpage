'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard, updateTrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, X, AlertTriangle, FileText, Edit, Save } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';


interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
  onClear: () => void;
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u00c0-\u024f]/g, "");
}

export default function CardSearch({ onCardSelect, selectedCard, onClear }: CardSearchProps) {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getProjectInfo = useCallback((name: string): { code: string | null; nameWithoutCode: string } => {
    const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
    const match = name.match(projectRegex);
    if (match && match[1]) {
        return {
            code: match[1],
            nameWithoutCode: name.replace(projectRegex, '').trim()
        };
    }
    return { code: null, nameWithoutCode: name };
  }, []);

  useEffect(() => {
    async function fetchAllCards() {
      try {
        const fetchedCards = await getAllCardsFromAllBoards();
        const projectCards = fetchedCards.filter(card => getProjectInfo(card.name).code !== null);
        setAllCards(projectCards);
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
  }, [toast, getProjectInfo]);

  useEffect(() => {
    if (selectedCard) {
      setQuery(selectedCard.name);
    } else {
      setQuery('');
    }
  }, [selectedCard]);

  const trelloColorToTw = (color: string | null | undefined): string => {
    if (!color) return "bg-primary text-primary-foreground hover:bg-primary/90 aria-selected:bg-primary/90";
    switch (color) {
        case 'green': return 'bg-[rgb(75,206,151)] text-white hover:bg-[rgba(75,206,151,0.9)] aria-selected:bg-[rgba(75,206,151,0.9)]';
        case 'yellow': return 'bg-[rgb(238,209,43)] text-black hover:bg-[rgba(238,209,43,0.9)] aria-selected:bg-[rgba(238,209,43,0.9)]';
        case 'red': return 'bg-[rgb(248,113,104)] text-white hover:bg-[rgba(248,113,104,0.9)] aria-selected:bg-[rgba(248,113,104,0.9)]';
        case 'orange': return 'bg-orange-500 text-white hover:bg-orange-600 aria-selected:bg-orange-600';
        case 'purple': return 'bg-purple-600 text-white hover:bg-purple-700 aria-selected:bg-purple-700';
        case 'blue': return 'bg-[rgb(102,157,241)] text-white hover:bg-[rgba(102,157,241,0.9)] aria-selected:bg-[rgba(102,157,241,0.9)]';
        case 'sky': return 'bg-sky-400 text-black hover:bg-sky-500 aria-selected:bg-sky-500';
        case 'lime': return 'bg-lime-400 text-black hover:bg-lime-500 aria-selected:bg-lime-500';
        case 'pink': return 'bg-pink-500 text-white hover:bg-pink-600 aria-selected:bg-pink-600';
        case 'black': return 'bg-gray-800 text-white hover:bg-gray-900 aria-selected:bg-gray-900';
        default: return "bg-primary text-primary-foreground hover:bg-primary/90 aria-selected:bg-primary/90";
    }
  };

  const trelloColorToStyle = (color: string | null | undefined): React.CSSProperties => {
    if (!color) return { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' };
    switch (color) {
        case 'green': return { backgroundColor: 'rgb(75,206,151)', color: 'white' };
        case 'yellow': return { backgroundColor: 'rgb(238,209,43)', color: 'black' };
        case 'red': return { backgroundColor: 'rgb(248,113,104)', color: 'white' };
        case 'orange': return { backgroundColor: '#F97316', color: 'white' };
        case 'purple': return { backgroundColor: '#8B5CF6', color: 'white' };
        case 'blue': return { backgroundColor: 'rgb(102,157,241)', color: 'white' };
        case 'sky': return { backgroundColor: '#38BDF8', color: 'black' };
        case 'lime': return { backgroundColor: '#A3E635', color: 'black' };
        case 'pink': return { backgroundColor: '#EC4899', color: 'white' };
        case 'black': return { backgroundColor: '#374151', color: 'white' };
        default: return { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' };
    }
  };

  const trelloLabelColorToStyle = (color: string | null): React.CSSProperties => {
    if (!color) return { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };
    
    const colorMap: Record<string, { bg: string, text: string }> = {
        'green': { bg: '#61bd4f', text: 'white' },
        'yellow': { bg: '#f2d600', text: 'black' },
        'orange': { bg: '#ff9f1a', text: 'black' },
        'red': { bg: '#eb5a46', text: 'white' },
        'purple': { bg: '#c377e0', text: 'white' },
        'blue': { bg: '#0079bf', text: 'white' },
        'sky': { bg: '#00c2e0', text: 'black' },
        'lime': { bg: '#51e898', text: 'black' },
        'pink': { bg: '#ff78cb', text: 'black' },
        'black': { bg: '#344563', text: 'white' },
        'green_light': { bg: '#b6e0a9', text: 'black' },
        'yellow_light': { bg: '#f5e9a4', text: 'black' },
        'orange_light': { bg: '#ffd6a8', text: 'black' },
        'red_light': { bg: '#f8c2bB', text: 'black' },
        'purple_light': { bg: '#e2b8f0', text: 'black' },
        'blue_light': { bg: '#a3c9e3', text: 'black' },
        'sky_light': { bg: '#a3e1eb', text: 'black' },
        'lime_light': { bg: '#a5f0c6', text: 'black' },
        'pink_light': { bg: '#ffd6ec', text: 'black' },
        'black_light': { bg: '#a5adba', text: 'black' },
    };

    const style = colorMap[color];
    if (style) {
        return { backgroundColor: style.bg, color: style.text };
    }

    return { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };
  };

  const filteredCards = useMemo(() => {
    if (selectedCard && query === selectedCard.name) return [];
    
    if (!query && isOpen) {
      return allCards.map(card => ({ ...card, matchType: 'description' as const }));
    }
    if (query) {
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
        onClear();
      }
      if (!isOpen) {
          setIsOpen(true);
      }
    }
  }

  const handleFocus = () => {
    if (!isOpen && !(selectedCard && query === selectedCard.name)) {
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
    const nameColWidth = doc.internal.pageSize.width - (2 * margin);
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
    
            const formattedName = `${code.replace(/[()]/g, '')} - ${nameWithoutCode}`;
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

  const handleEditClick = () => {
    if (selectedCard) {
        setEditedName(selectedCard.name);
        setEditedDesc(selectedCard.desc);
        setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
      setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;

    setIsSaving(true);
    try {
        const { id, boardName } = selectedCard;
        const updatedCardData = await updateTrelloCard({ cardId: id, name: editedName, desc: editedDesc });

        const fullyUpdatedCard = { ...selectedCard, ...updatedCardData, boardName };

        setAllCards(prev => prev.map(c => c.id === id ? fullyUpdatedCard : c));
        onCardSelect(fullyUpdatedCard);
        
        toast({
            title: '¡Éxito!',
            description: 'La tarjeta se actualizó correctamente en Trello.',
        });
        setIsEditing(false);
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al actualizar',
            description: error instanceof Error ? error.message : 'No se pudo guardar la tarjeta.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <div className="flex h-full w-full flex-col justify-between">
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
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-primary-foreground hover:bg-primary/20" 
                        disabled={!selectedCard}
                        onClick={() => setIsSummaryOpen(true)}
                    >
                        <FileText className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                    <p>Ver resumen del proyecto</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      </div>
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={handleFocus}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder='Buscá por palabra clave o por código de proyecto...'
              className="w-full min-h-24 bg-primary-foreground text-foreground pr-10 text-xs"
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
                        card.matchType === 'name' ? trelloColorToTw(card.cover?.color) : ""
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
      {selectedCard && (
        <Dialog open={isSummaryOpen} onOpenChange={(isOpen) => {
            if (!isOpen) setIsEditing(false);
            setIsSummaryOpen(isOpen);
        }}>
            <DialogContent className="p-0 max-w-md">
                <DialogHeader
                    style={trelloColorToStyle(selectedCard.cover?.color)}
                    className="p-6 rounded-t-lg relative"
                >
                    {isEditing ? (
                        <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="text-base font-semibold bg-transparent text-inherit border-white/30 placeholder-white/70 focus:bg-black/10 h-auto p-1"
                            disabled={isSaving}
                        />
                    ) : (
                      <DialogTitle className="text-sm font-semibold mr-10">{selectedCard.name}</DialogTitle>
                    )}
                    
                    {!isEditing && (
                        <Button variant="ghost" size="icon" className="absolute top-4 right-12 text-current h-8 w-8 hover:bg-white/20" onClick={handleEditClick}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    )}
                    
                    {selectedCard.labels && selectedCard.labels.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {selectedCard.labels.map(label => (
                                <Badge
                                    key={label.id}
                                    style={trelloLabelColorToStyle(label.color)}
                                    className="border-transparent"
                                >
                                    {label.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </DialogHeader>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                     {isEditing ? (
                        <Textarea
                            value={editedDesc}
                            onChange={(e) => setEditedDesc(e.target.value)}
                            className="text-xs min-h-[200px] max-h-[40vh]"
                            disabled={isSaving}
                        />
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedCard.desc ? (
                          selectedCard.desc.split(/\*\*(.*?)\*\*/g).map((part, index) =>
                            index % 2 === 1 ? (
                              <strong key={index}>{part}</strong>
                            ) : (
                              <span key={index}>{part}</span>
                            )
                          )
                        ) : (
                          'Esta tarjeta no tiene descripción.'
                        )}
                      </p>
                    )}
                </div>
                 {isEditing && (
                    <DialogFooter className="px-6 pb-6">
                        <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>Cancelar</Button>
                        <Button onClick={handleSaveEdit} disabled={isSaving}>
                            {isSaving ? <Save className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
