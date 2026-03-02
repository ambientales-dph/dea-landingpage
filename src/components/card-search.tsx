
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { 
    getAllCardsFromAllBoards, 
    TrelloCard, 
    updateTrelloCard, 
    getCardActivity, 
    TrelloAction, 
    getBoardLabels, 
    TrelloLabel, 
    addLabelToCard, 
    removeLabelFromCard, 
    getCardById, 
    getTrelloBoards,
    getListsOnBoard,
    TrelloBoard,
    addCommentToCard
} from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X, FileText, Edit, ChevronDown, Send, Link as LinkIcon, Plus, RefreshCw, Palette, ArrowDownUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import React from 'react';

interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
  onClear: () => void;
  isSummaryOpen: boolean;
  onSummaryOpenChange: (isOpen: boolean) => void;
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const trelloCoverColors = [
    { name: 'green', hex: '#4bce97', label: 'Verde' },
    { name: 'yellow', hex: '#eed12b', label: 'Amarillo' },
    { name: 'red', hex: '#f87168', label: 'Rojo' },
    { name: 'orange', hex: '#ff9f1a', label: 'Naranja' },
    { name: 'purple', hex: '#9f8fef', label: 'Púrpura' },
    { name: 'blue', hex: '#579dff', label: 'Azul' },
    { name: 'sky', hex: '#6cc3e0', label: 'Cielo' },
    { name: 'lime', hex: '#94c748', label: 'Lima' },
    { name: 'pink', hex: '#e774bb', label: 'Rosa' },
    { name: 'black', hex: '#44546f', label: 'Negro' },
];

const trelloColorToStyle = (color: string | null | undefined): React.CSSProperties => {
    if (!color) return { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };
    const found = trelloCoverColors.find(c => c.name === color);
    const hex = found?.hex || '#ccc';
    // Colores claros que necesitan texto negro
    const isLight = ['yellow', 'lime', 'sky'].includes(color);
    return { 
        backgroundColor: hex, 
        color: isLight ? '#172b4d' : 'white',
        borderColor: 'transparent',
        fontWeight: 'normal'
    };
};

const renderDescription = (desc: string) => {
    const parts: (string | JSX.Element)[] = [];
    if (!desc) return parts;
    const regex = /\[([^\][]*?)\]\((.*?)\)|\*\*(.*?)\*\*|(\S+\.(?:jpg|jpeg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)\S*)/gi;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(desc)) !== null) {
        if (match.index > lastIndex) parts.push(desc.substring(lastIndex, match.index));
        const [fullMatch, linkText, linkUrlRaw, boldText, standaloneUrl] = match;
        if (linkText !== undefined && linkUrlRaw !== undefined) {
            const urlMatch = linkUrlRaw.trim().match(/^\S+/);
            if (!urlMatch) continue;
            const linkUrl = urlMatch[0];
            parts.push(<a href={linkUrl} key={match.index} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"><LinkIcon className="h-3.5 w-3.5" /><span>{linkText || 'Abrir'}</span></a>);
        } else if (boldText !== undefined) {
            parts.push(<strong key={match.index}>{boldText}</strong>);
        } else if (standaloneUrl !== undefined) {
             parts.push(<a href={standaloneUrl} key={match.index} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"><span>{standaloneUrl.split('/').pop()}</span></a>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < desc.length) parts.push(desc.substring(lastIndex));
    return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
};

export default function CardSearch({ onCardSelect, selectedCard, onClear, isSummaryOpen, onSummaryOpenChange }: CardSearchProps) {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [activity, setActivity] = useState<TrelloAction[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [boardLabels, setBoardLabels] = useState<TrelloLabel[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attachmentSort, setAttachmentSort] = useState<'name' | 'type'>('name');
  const [allBoards, setAllBoards] = useState<TrelloBoard[]>([]);
  const [boardLists, setBoardLists] = useState<{ id: string, name: string }[]>([]);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [isListsLoading, setIsListsLoading] = useState(false);
  const [editedBoardId, setEditedBoardId] = useState('');
  const [editedListId, setEditedListId] = useState('');

  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchCardData = useCallback(async () => {
    if (!selectedCard) return;
    setIsRefreshing(true);
    setIsActivityLoading(true);
    try {
        const [refreshedCard, cardActivity, labels] = await Promise.all([
            getCardById(selectedCard.id),
            getCardActivity(selectedCard.id),
            getBoardLabels(selectedCard.boardId)
        ]);
        onCardSelect(refreshedCard);
        setActivity(cardActivity);
        setBoardLabels(labels);
    } catch (error) {
        console.error('Error refreshing card data:', error);
    } finally {
        setIsRefreshing(false);
        setIsActivityLoading(false);
    }
  }, [selectedCard?.id, onCardSelect]);

  useEffect(() => {
    if (isSummaryOpen && selectedCard) {
        fetchCardData();
    }
  }, [isSummaryOpen, selectedCard?.id, fetchCardData]);

  useEffect(() => {
    setQuery(selectedCard?.name || '');
  }, [selectedCard?.id]);

  const fetchAllCards = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const fetchedCards = await getAllCardsFromAllBoards();
      const projectCards = fetchedCards.filter(card => card.name.match(/\(([A-Z]{3}\d{3})\)$/));
      setAllCards(projectCards);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const filteredCards = useMemo(() => {
    if (!query || (selectedCard && query === selectedCard.name)) return [];
    const normalizedQuery = removeAccents(query.toLowerCase());
    return allCards.filter(card => 
      removeAccents(card.name.toLowerCase()).includes(normalizedQuery) || 
      removeAccents(card.desc || '').toLowerCase().includes(normalizedQuery)
    ).slice(0, 10);
  }, [query, allCards, selectedCard?.id]);
  
  const handleSelect = (card: TrelloCard) => {
    onCardSelect(card);
    setQuery(card.name);
    setIsOpen(false);
  };
  
  const handleEditClick = async () => {
    if (selectedCard) {
        setEditedName(selectedCard.name);
        setEditedDesc(selectedCard.desc);
        setEditedBoardId(selectedCard.boardId);
        setEditedListId(selectedCard.idList);
        setIsEditing(true);
        setIsBoardsLoading(true);
        try {
            const boards = await getTrelloBoards();
            setAllBoards(boards);
        } catch (error) {
            console.error(error);
        } finally {
            setIsBoardsLoading(false);
        }
    }
  };

  useEffect(() => {
    if (isEditing && editedBoardId) {
      const fetchLists = async () => {
        setIsListsLoading(true);
        try {
          const lists = await getListsOnBoard(editedBoardId);
          setBoardLists(lists);
          if (!lists.some(l => l.id === editedListId)) setEditedListId(lists[0]?.id || '');
        } catch (error) {
            console.error(error);
        } finally {
            setIsListsLoading(false);
        }
      };
      fetchLists();
    }
  }, [isEditing, editedBoardId]);

  const handleSaveEdit = async () => {
    if (!selectedCard) return;
    setIsSaving(true);
    try {
        await updateTrelloCard({ 
          cardId: selectedCard.id, 
          name: editedName, 
          desc: editedDesc, 
          idBoard: editedBoardId, 
          idList: editedListId 
        });
        toast({ title: '¡Éxito!', description: 'Tarjeta actualizada correctamente.' });
        setIsEditing(false);
        fetchCardData();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al actualizar' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleColorChange = async (color: string | null) => {
    if (!selectedCard) return;
    try {
      await updateTrelloCard({ cardId: selectedCard.id, cover: { color } });
      fetchCardData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al cambiar color' });
    }
  };

  const handleToggleLabel = async (labelId: string, isCurrentlyOn: boolean) => {
    if (!selectedCard) return;
    try {
      if (isCurrentlyOn) {
        await removeLabelFromCard({ cardId: selectedCard.id, labelId });
      } else {
        await addLabelToCard({ cardId: selectedCard.id, labelId });
      }
      fetchCardData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error con etiquetas' });
    }
  };

  const handlePostComment = async () => {
    if (!selectedCard || !newComment.trim()) return;
    setIsCommenting(true);
    try {
      await addCommentToCard({ cardId: selectedCard.id, text: newComment });
      setNewComment('');
      fetchCardData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al comentar' });
    } finally {
      setIsCommenting(false);
    }
  };

  const sortedAttachments = useMemo(() => {
    if (!selectedCard?.attachments) return [];
    return [...selectedCard.attachments].sort((a, b) => {
      if (attachmentSort === 'name') return a.name.localeCompare(b.name);
      const extA = a.url.split('.').pop() || '';
      const extB = b.url.split('.').pop() || '';
      return extA.localeCompare(extB);
    });
  }, [selectedCard?.attachments, attachmentSort]);

  return (
    <div className="flex h-full w-full flex-col justify-end">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={() => { fetchAllCards(); if (query) setIsOpen(true); }}
              onChange={(e) => { 
                setQuery(e.target.value); 
                if (e.target.value.length > 0) setIsOpen(true);
                else setIsOpen(false);
              }}
              placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscá por palabra clave o código...'}
              className="w-full min-h-20 bg-white text-foreground pr-10 text-xs border-2 focus-visible:ring-primary shadow-sm"
              autoComplete="off"
            />
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-[--radix-popover-trigger-width] border-0 shadow-2xl" 
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command className="bg-white">
              <CommandList className="max-h-[300px] bg-white p-2">
                {filteredCards.length === 0 && query.length > 0 && query !== selectedCard?.name && (
                  <CommandEmpty className="text-muted-foreground py-4 text-center text-xs">No hay resultados.</CommandEmpty>
                )}
                <CommandGroup>
                  {filteredCards.map((card) => (
                    <CommandItem 
                      key={card.id} 
                      onSelect={() => handleSelect(card)} 
                      className="cursor-pointer text-[11px] mb-1 p-2 rounded-md transition-all duration-200"
                      style={trelloColorToStyle(card.cover?.color)}
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="whitespace-normal leading-tight font-normal">{card.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {query && <Button variant="ghost" size="icon" onClick={onClear} className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground h-8 w-8"><X className="h-5 w-5" /></Button>}
      </div>

      {selectedCard && (
        <Dialog open={isSummaryOpen} onOpenChange={(open) => { if (!open) setIsEditing(false); onSummaryOpenChange(open); }}>
            <DialogContent className="p-0 max-w-2xl overflow-hidden border-0">
                <DialogHeader 
                    style={{
                        backgroundColor: trelloCoverColors.find(c => c.name === selectedCard.cover?.color)?.hex || 'hsl(var(--primary))',
                        color: ['yellow', 'lime', 'sky'].includes(selectedCard.cover?.color || '') ? '#172b4d' : 'white'
                    }} 
                    className="p-6 relative rounded-t-lg"
                >
                    {isEditing ? (
                        <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-base font-semibold bg-transparent text-inherit border-white/30 h-auto p-1 mr-28" />
                    ) : (
                      <DialogTitle className="text-sm font-semibold mr-36 flex items-center gap-2">
                        <span>{selectedCard.name}</span>
                        <a href={selectedCard.url} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100"><LinkIcon className="h-4 w-4" /></a>
                      </DialogTitle>
                    )}
                    
                    <div className="flex flex-wrap gap-2 pt-2">
                        {selectedCard.labels.map(label => (
                            <Badge key={label.id} className="text-[10px] group cursor-default" style={{ backgroundColor: label.color ? trelloCoverColors.find(c => c.name === label.color)?.hex || '#ccc' : '#ccc', color: 'white' }}>
                              {label.name}
                              {isEditing && <X className="ml-1 h-2 w-2 cursor-pointer hover:text-red-200" onClick={() => handleToggleLabel(label.id, true)} />}
                            </Badge>
                        ))}
                        {isEditing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 rounded-full bg-white/20"><Plus className="h-3 w-3" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-48 overflow-y-auto">
                              {boardLabels.map(l => (
                                <DropdownMenuCheckboxItem key={l.id} checked={selectedCard.labels.some(sl => sl.id === l.id)} onCheckedChange={() => handleToggleLabel(l.id, selectedCard.labels.some(sl => sl.id === l.id))}>
                                  <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: trelloCoverColors.find(c => c.name === l.color)?.hex || '#ccc' }} />{l.name}</div>
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                    </div>

                    <div className="absolute top-4 right-12 flex gap-1">
                        {!isEditing && (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20"><Palette className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="grid grid-cols-5 gap-1 p-2">
                                {trelloCoverColors.map(c => (
                                  <Button key={c.name} variant="ghost" className="h-6 w-6 rounded-full p-0" style={{ backgroundColor: c.hex }} onClick={() => handleColorChange(c.name)} />
                                ))}
                                <Button variant="ghost" className="h-6 w-6 rounded-full border p-0" onClick={() => handleColorChange(null)}><X className="h-3 w-3" /></Button>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={handleEditClick}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={fetchCardData} disabled={isRefreshing}><RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /></Button>
                          </>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <div className="p-6">
                        <h3 className="font-semibold text-sm mb-2">Descripción</h3>
                        {isEditing ? <Textarea value={editedDesc} onChange={(e) => setEditedDesc(e.target.value)} className="text-xs min-h-[200px]" /> : <div className="text-xs text-muted-foreground whitespace-pre-wrap">{renderDescription(selectedCard.desc)}</div>}
                    </div>

                    {selectedCard.attachments?.length > 0 && !isEditing && (
                      <div className="p-6 pt-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-sm">Adjuntos ({selectedCard.attachments.length})</h3>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setAttachmentSort(s => s === 'name' ? 'type' : 'name')}>
                            <ArrowDownUp className="h-3 w-3" />
                            {attachmentSort === 'name' ? 'Nombre' : 'Tipo'}
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {sortedAttachments.map(att => (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-xs group">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="flex-1 truncate">{att.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                        <div className="p-6 pt-0">
                            <div className="flex gap-2 mb-4">
                                <Textarea placeholder="Comentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isCommenting} className="text-xs min-h-[60px]" />
                                <Button onClick={handlePostComment} disabled={!newComment.trim() || isCommenting} size="icon"><Send className="h-4 w-4" /></Button>
                            </div>
                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">Historial <ChevronDown className="h-3 w-3" /></CollapsibleTrigger>
                                <CollapsibleContent className="mt-4 space-y-4">
                                    {activity.map(action => (
                                        <div key={action.id} className="flex gap-3 text-xs">
                                            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{action.memberCreator.fullName.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2"><span className="font-semibold">{action.memberCreator.fullName}</span><span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(action.date), { locale: es, addSuffix: true })}</span></div>
                                                <p className="mt-1 bg-muted p-2 rounded-md border whitespace-pre-wrap">{action.data.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    )}
                </ScrollArea>

                {isEditing && (
                    <DialogFooter className="border-t p-4 gap-2">
                        <div className="flex-1 flex gap-2">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Tablero</label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full text-xs justify-between">{allBoards.find(b => b.id === editedBoardId)?.name || 'Cargando...'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-48 overflow-y-auto">
                                {allBoards.map(b => <DropdownMenuItem key={b.id} onSelect={() => setEditedBoardId(b.id)}>{b.name}</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Lista</label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full text-xs justify-between" disabled={isListsLoading}>{isListsLoading ? 'Cargando...' : (boardLists.find(l => l.id === editedListId)?.name || 'Seleccioná')} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-48 overflow-y-auto">
                                {boardLists.map(l => <DropdownMenuItem key={l.id} onSelect={() => setEditedListId(l.id)}>{l.name}</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
