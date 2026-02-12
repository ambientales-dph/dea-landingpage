
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
import type { TrelloAttachment } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, X, AlertTriangle, FileText, Edit, Save, ChevronDown, Send, File as FileIcon, Image as ImageIcon, Cloud, Link as LinkIcon, Plus, RefreshCw, Palette, Folder, ArrowDownUp, GripVertical, Settings } from 'lucide-react';
import jsPDF from 'jspdf';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
  onClear: () => void;
  isSummaryOpen: boolean;
  onSummaryOpenChange: (isOpen: boolean) => void;
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u00c0-\u024f]/g, "");
}

const renderDescription = (desc: string) => {
    const parts: (string | JSX.Element)[] = [];
    if (!desc) return parts;

    const regex = /\[([^\][]*?)\]\((.*?)\)|\*\*(.*?)\*\*|(\S+\.(?:jpg|jpeg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)\S*)/gi;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(desc)) !== null) {
        if (match.index > lastIndex) {
            parts.push(desc.substring(lastIndex, match.index));
        }

        const [fullMatch, linkText, linkUrlRaw, boldText, standaloneUrl] = match;

        if (linkText !== undefined && linkUrlRaw !== undefined) {
            // Markdown-style link: [text](url)
            const urlAndTitle = linkUrlRaw.trim();
            const urlMatch = urlAndTitle.match(/^\S+/);
            if (!urlMatch) continue;
            const linkUrl = urlMatch[0];

            let displayLabel = linkText || linkUrl;
            let IconComponent: React.ElementType = LinkIcon;

            if (linkUrl.includes('drive.google.com')) {
                displayLabel = linkText || 'Abrir en Drive';
                IconComponent = Cloud;
            } else if (!linkText) {
                displayLabel = 'Abrir enlace';
            }

            parts.push(
                <a 
                    href={linkUrl} 
                    key={match.index} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-offset-background transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span>{displayLabel}</span>
                </a>
            );
        } else if (boldText !== undefined) {
            // Bold text: **text**
            parts.push(<strong key={match.index}>{boldText}</strong>);
        } else if (standaloneUrl !== undefined) {
            // Standalone URL that looks like a file
             parts.push(
                <a 
                    href={standaloneUrl} 
                    key={match.index} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-offset-background transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <FileIcon className="h-3.5 w-3.5" />
                    <span>{standaloneUrl.split('/').pop()}</span>
                </a>
            );
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < desc.length) {
        parts.push(desc.substring(lastIndex));
    }

    return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
};

const trelloCoverColors = [
    { name: 'green', hex: 'rgb(75,206,151)', label: 'Verde' },
    { name: 'yellow', hex: 'rgb(238,209,43)', label: 'Amarillo' },
    { name: 'red', hex: 'rgb(248,113,104)', label: 'Rojo' },
    { name: 'orange', hex: '#F97316', label: 'Naranja' },
    { name: 'purple', hex: '#8B5CF6', label: 'Púrpura' },
    { name: 'blue', hex: 'rgb(102,157,241)', label: 'Azul' },
    { name: 'sky', hex: '#38BDF8', label: 'Cielo' },
    { name: 'lime', hex: '#A3E635', label: 'Lima' },
    { name: 'pink', hex: '#EC4899', label: 'Rosa' },
    { name: 'black', hex: '#374151', label: 'Negro' },
];

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
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
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
  const prevIsSummaryOpen = useRef(isSummaryOpen);

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

  const fetchAllCards = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
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
  }, [isLoading, toast, getProjectInfo]);

  useEffect(() => {
    if (selectedCard) {
      setQuery(selectedCard.name);
    } else {
      setQuery('');
    }
  }, [selectedCard]);

  const fetchCardData = useCallback(async () => {
    if (!selectedCard) return;

    setIsRefreshing(true);
    setIsActivityLoading(true);
    setIsLabelsLoading(true);

    try {
        const [refreshedCard, cardActivity, labels] = await Promise.all([
            getCardById(selectedCard.id),
            getCardActivity(selectedCard.id),
            getBoardLabels(selectedCard.boardId)
        ]);
        
        onCardSelect(refreshedCard);
        setAllCards(prev => prev.map(c => c.id === refreshedCard.id ? refreshedCard : c));
        setActivity(cardActivity);
        setBoardLabels(labels);

    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al cargar datos',
            description: error instanceof Error ? error.message : 'No se pudo cargar la información de la tarjeta.',
        });
    } finally {
        setIsRefreshing(false);
        setIsActivityLoading(false);
        setIsLabelsLoading(false);
    }
  }, [selectedCard, toast, onCardSelect]);

  useEffect(() => {
    if (isSummaryOpen && !prevIsSummaryOpen.current) {
        fetchCardData();
    }
    prevIsSummaryOpen.current = isSummaryOpen;
  }, [isSummaryOpen, fetchCardData]);

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
    if (!query) return [];

    const normalizedQuery = removeAccents(query.toLowerCase());
    const keywords = normalizedQuery.split(' ').filter(kw => kw.trim() !== '');

    if (keywords.length === 0) {
      return [];
    }
    
    return allCards
      .map(card => {
        const cardNameLower = removeAccents(card.name.toLowerCase());
        const cardDescLower = removeAccents(card.desc ? card.desc.toLowerCase() : '');

        const nameMatch = keywords.every(keyword => cardNameLower.includes(keyword));
        if (nameMatch) {
          return { ...card, matchType: 'name' as const };
        }

        const descMatch = keywords.every(keyword => cardDescLower.includes(keyword));
        if (descMatch) {
          return { ...card, matchType: 'description' as const };
        }

        return null;
      })
      .filter((c): c is TrelloCard & { matchType: 'name' | 'description' } => c !== null);
  }, [query, allCards, selectedCard]);
  
  const handleSelect = (card: TrelloCard) => {
    onCardSelect(card);
    setQuery(card.name);
    setIsOpen(false);
  };
  
  const handleInputChange = (inputValue: string) => {
    setQuery(inputValue);
    
    const exactMatch = allCards.find(c => c.name.toLowerCase() === inputValue.toLowerCase());
    if (exactMatch) {
      if (selectedCard?.id !== exactMatch.id) {
        onCardSelect(exactMatch);
      }
      setIsOpen(false);
    } else {
      if (selectedCard && !inputValue) {
         onCardSelect(null);
      } else if (selectedCard && inputValue !== selectedCard.name) {
         onCardSelect(null);
      }
      if (!isOpen && inputValue) {
          setIsOpen(true);
      }
    }
  }

  const handleFocus = () => {
    fetchAllCards();
    if (!isOpen && query && !(selectedCard && query === selectedCard.name)) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    onClear();
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
            toast({
                variant: "destructive",
                title: "Error al cargar tableros",
                description: "No se pudieron obtener los tableros de Trello.",
            });
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
          
          if (!lists.some(l => l.id === editedListId)) {
            setEditedListId(lists[0]?.id || '');
          }
        } catch (error) {
           toast({
                variant: "destructive",
                title: "Error al cargar listas",
                description: "No se pudieron obtener las listas del tablero seleccionado.",
            });
            setBoardLists([]);
        } finally {
            setIsListsLoading(false);
        }
      };
      fetchLists();
    }
  }, [isEditing, editedBoardId, toast]);

  const handleCancelEdit = () => {
      setIsEditing(false);
      setBoardLists([]);
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;

    setIsSaving(true);
    try {
        const hasMoved = editedBoardId !== selectedCard.boardId || editedListId !== selectedCard.idList;
        
        await updateTrelloCard({
          cardId: selectedCard.id,
          name: editedName,
          desc: editedDesc,
          idBoard: editedBoardId,
          idList: editedListId,
        });

        toast({
            title: '¡Éxito!',
            description: hasMoved ? 'La tarjeta se movió y actualizó correctamente.' : 'La tarjeta se actualizó correctamente en Trello.',
        });
        
        setIsEditing(false);
        setBoardLists([]);

        if (hasMoved) {
           setAllCards(prev => prev.filter(c => c.id !== selectedCard.id));
           onCardSelect(null);
           onSummaryOpenChange(false);
        } else {
            const refreshedCard = await getCardById(selectedCard.id);
            onCardSelect(refreshedCard);
            setAllCards(prev => prev.map(c => c.id === selectedCard.id ? refreshedCard : c));
        }
        
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
  
  const handleCoverColorChange = async (color: string | null) => {
    if (!selectedCard) return;

    const originalCover = selectedCard.cover;
    const newCover = { color };

    const updatedCard = { ...selectedCard, cover: newCover };
    onCardSelect(updatedCard); // Optimistic update

    try {
        await updateTrelloCard({ cardId: selectedCard.id, cover: newCover });
        setAllCards(prev => prev.map(c => c.id === selectedCard.id ? updatedCard : c));
    } catch (error) {
        onCardSelect({ ...selectedCard, cover: originalCover }); // Revert on error
        setAllCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, cover: originalCover } : c));
        
        toast({
            variant: 'destructive',
            title: 'Error al cambiar el color',
            description: error instanceof Error ? error.message : 'No se pudo actualizar la portada.',
        });
    }
  };

  const handleLabelToggle = async (label: TrelloLabel, checked: boolean) => {
    if (!selectedCard) return;

    const originalLabels = selectedCard.labels;
    let updatedLabels: TrelloLabel[];

    if (checked) {
        updatedLabels = [...originalLabels, label];
    } else {
        updatedLabels = originalLabels.filter(l => l.id !== label.id);
    }
    const updatedCard = { ...selectedCard, labels: updatedLabels };
    onCardSelect(updatedCard);

    try {
        if (checked) {
            await addLabelToCard({ cardId: selectedCard.id, labelId: label.id });
        } else {
            await removeLabelFromCard({ cardId: selectedCard.id, labelId: label.id });
        }
        
        setAllCards(prev => prev.map(c => c.id === selectedCard.id ? updatedCard : c));

    } catch (error) {
        onCardSelect({ ...selectedCard, labels: originalLabels });
        setAllCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, labels: originalLabels } : c));
        
        toast({
            variant: 'destructive',
            title: 'Error al actualizar etiquetas',
            description: error instanceof Error ? error.message : 'No se pudo modificar la etiqueta.',
        });
    }
  };

  const handlePostComment = async () => {
    if (!selectedCard || !newComment.trim()) return;

    setIsCommenting(true);
    try {
      await addCommentToCard({ cardId: selectedCard.id, text: newComment });
      setNewComment('');
      toast({
        title: '¡Éxito!',
        description: 'Tu comentario se ha añadido a la tarjeta.',
      });
      await fetchCardData(); // Re-fetch data to show the new comment
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al comentar',
        description: error instanceof Error ? error.message : 'No se pudo añadir tu comentario.',
      });
    } finally {
      setIsCommenting(false);
    }
  };

  const renderActivity = (action: TrelloAction) => {
    if (action.type === 'commentCard' && action.data.text) {
      return <p className="mt-1 bg-muted p-3 rounded-md whitespace-pre-wrap border">{action.data.text}</p>;
    }
    return null;
  };
  
  const getAttachmentIcon = (attachment: TrelloAttachment): { component: JSX.Element; typeOrder: number } => {
    const name = attachment.name.toLowerCase();
    
    if (attachment.url.includes('drive.google.com/drive/folders/')) {
        return { component: <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 1 };
    }

    if (/\.(jpe?g|png|gif|webp|svg|bmp|tiff)$/i.test(name)) {
        return { component: <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 2 };
    }
    
    if (/\.pdf$/i.test(name)) {
        return { component: <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 3 };
    }

    if (/\.docx?$/i.test(name) || /\.xlsx?$/i.test(name)) {
        return { component: <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 3 };
    }
    
    if (/^(http|https):\/\/[^ "]+$/.test(attachment.name)) {
        return { component: <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 4 };
    }

    return { component: <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 5 };
  };

  const sortedAttachments = useMemo(() => {
    if (!selectedCard?.attachments) return [];
    
    const attachmentsWithInfo = selectedCard.attachments.map(att => ({
        ...att,
        typeOrder: getAttachmentIcon(att).typeOrder,
    }));
    
    if (attachmentSort === 'name') {
        return attachmentsWithInfo.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    }
    
    if (attachmentSort === 'type') {
        return attachmentsWithInfo.sort((a, b) => {
            if (a.typeOrder !== b.typeOrder) {
                return a.typeOrder - b.typeOrder;
            }
            return a.name.localeCompare(b.name, 'es', { numeric: true });
        });
    }

    return attachmentsWithInfo;
  }, [selectedCard?.attachments, attachmentSort]);


  return (
    <div className="flex h-full w-full flex-col justify-end">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={handleFocus}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscá por palabra clave o por código de proyecto...'}
              className="w-full min-h-20 bg-primary-foreground text-foreground pr-10 text-xs"
              autoComplete="off"
            />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command>
              <CommandList>
                {filteredCards.length === 0 && query.length > 0 ? (
                  <CommandEmpty>No encontramos resultados.</CommandEmpty>
                ) : null}
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
            onSummaryOpenChange(isOpen);
        }}>
            <DialogContent className="p-0 max-w-2xl">
                <DialogHeader
                    style={trelloColorToStyle(selectedCard.cover?.color)}
                    className="p-6 rounded-t-lg relative"
                >
                    {isEditing ? (
                        <>
                            <DialogTitle className="sr-only">{editedName}</DialogTitle>
                            <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="text-base font-semibold bg-transparent text-inherit border-white/30 placeholder-white/70 focus:bg-black/10 h-auto p-1 mr-28"
                                disabled={isSaving}
                            />
                        </>
                    ) : (
                      <DialogTitle className="text-sm font-semibold mr-36 flex items-center gap-2">
                        <span>{selectedCard.name}</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a href={selectedCard.url} target="_blank" rel="noopener noreferrer" className="text-current opacity-70 hover:opacity-100 transition-opacity">
                                        <LinkIcon className="h-4 w-4" />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Abrir tarjeta en Trello</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </DialogTitle>
                    )}
                    
                    {!isEditing && (
                        <DialogDescription className="text-xs text-white/80 pt-1 text-left">
                            En el tablero: <strong>{selectedCard.boardName}</strong>
                        </DialogDescription>
                    )}
                    
                    {!isEditing && (
                        <>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="absolute top-4 right-28 text-current h-8 w-8 hover:bg-white/20">
                                                <Palette className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Cambiar portada</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {trelloCoverColors.map(color => (
                                                <DropdownMenuItem key={color.name} onSelect={() => handleCoverColorChange(color.name)}>
                                                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color.hex }} />
                                                    <span>{color.label}</span>
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => handleCoverColorChange(null)}>
                                                <X className="mr-2 h-4 w-4" />
                                                <span>Quitar portada</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom"><p>Cambiar color de portada</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="absolute top-4 right-20 text-current h-8 w-8 hover:bg-white/20" onClick={handleEditClick}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom"><p>Editar</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="absolute top-4 right-12 text-current h-8 w-8 hover:bg-white/20" onClick={fetchCardData} disabled={isRefreshing}>
                                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom"><p>Actualizar desde Trello</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                    )}
                    
                    <div className="flex items-start gap-2 pt-2">
                        <div className="flex flex-grow flex-wrap gap-2">
                            {selectedCard.labels.map(label => (
                                <Badge
                                    key={label.id}
                                    style={trelloLabelColorToStyle(label.color)}
                                    className="border-transparent"
                                >
                                    {label.name || <span className="italic">Etiqueta sin nombre</span>}
                                </Badge>
                            ))}
                        </div>
                        {!isEditing && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-current hover:bg-white/20">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Etiquetas disponibles</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {isLabelsLoading ? (
                                        <DropdownMenuItem disabled>Cargando etiquetas...</DropdownMenuItem>
                                    ) : boardLabels.length > 0 ? (
                                        boardLabels.map(boardLabel => {
                                            const isChecked = selectedCard.labels.some(cardLabel => cardLabel.id === boardLabel.id);
                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={boardLabel.id}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => handleLabelToggle(boardLabel, !!checked)}
                                                    onSelect={(e) => e.preventDefault()}
                                                >
                                                    <div
                                                        className="mr-2 h-4 w-4 rounded-sm"
                                                        style={{ backgroundColor: trelloLabelColorToStyle(boardLabel.color).backgroundColor }}
                                                    />
                                                    <span>{boardLabel.name || <span className="italic">Etiqueta sin nombre</span>}</span>
                                                </DropdownMenuCheckboxItem>
                                            )
                                        })
                                    ) : (
                                        <DropdownMenuItem disabled>No hay etiquetas en este tablero.</DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <div className="p-6">
                        <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                         {isEditing ? (
                            <Textarea
                                value={editedDesc}
                                onChange={(e) => setEditedDesc(e.target.value)}
                                className="text-xs min-h-[200px]"
                                disabled={isSaving}
                            />
                        ) : (
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap space-y-2">
                            {selectedCard.desc ? renderDescription(selectedCard.desc) : 'Esta tarjeta no tiene descripción.'}
                          </div>
                        )}
                    </div>
                    
                    {isEditing && (
                        <>
                            <Separator className="mx-6 w-auto" />
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="board-select" className="text-sm font-medium mb-2 block">Tablero</Label>
                                    <Select
                                        value={editedBoardId}
                                        onValueChange={setEditedBoardId}
                                        disabled={isBoardsLoading || isSaving}
                                    >
                                        <SelectTrigger id="board-select">
                                            <SelectValue placeholder="Seleccioná un tablero..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isBoardsLoading ? <SelectItem value="loading" disabled>Cargando...</SelectItem> :
                                                allBoards.map(board => (
                                                    <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="list-select" className="text-sm font-medium mb-2 block">Lista</Label>
                                    <Select
                                        value={editedListId}
                                        onValueChange={setEditedListId}
                                        disabled={isListsLoading || isSaving || !editedBoardId}
                                    >
                                        <SelectTrigger id="list-select">
                                            <SelectValue placeholder="Seleccioná una lista..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isListsLoading ? <SelectItem value="loading" disabled>Cargando...</SelectItem> :
                                                boardLists.map(list => (
                                                    <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {selectedCard.attachments && selectedCard.attachments.length > 0 && !isEditing && (
                      <>
                        <Separator className="mx-6 w-auto" />
                        <div className="p-6">
                            <Collapsible defaultOpen>
                                <div className="flex items-center justify-between">
                                    <CollapsibleTrigger className="group flex flex-grow items-center justify-start gap-2 text-sm font-medium">
                                        <span className="font-semibold text-foreground">Adjuntos</span>
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <ArrowDownUp className="h-4 w-4" />
                                          <span className="sr-only">Ordenar adjuntos</span>
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                                        <DropdownMenuRadioGroup value={attachmentSort} onValueChange={(value) => setAttachmentSort(value as 'name' | 'type')}>
                                          <DropdownMenuRadioItem value="name">Nombre</DropdownMenuRadioItem>
                                          <DropdownMenuRadioItem value="type">Tipo</DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CollapsibleContent className="mt-4 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    <div className="space-y-1">
                                        {sortedAttachments.map(attachment => (
                                            <div key={attachment.id} className="group/item flex items-center justify-between rounded-md hover:bg-muted py-0.5">
                                                <a
                                                    href={attachment.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex flex-grow items-center gap-2 overflow-hidden p-1"
                                                >
                                                    {getAttachmentIcon(attachment).component}
                                                    <span className="text-xs text-foreground truncate" title={attachment.name}>
                                                        {attachment.name}
                                                    </span>
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                      </>
                    )}
                    {!isEditing && (
                      <>
                        <div className="p-6 pt-0">
                          <div className="flex items-start gap-2 mb-4">
                            <Textarea
                              placeholder="Escribí un comentario..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              disabled={isCommenting}
                              className="text-xs flex-1"
                              rows={2}
                            />
                            <Button
                              onClick={handlePostComment}
                              disabled={!newComment.trim() || isCommenting}
                              size="icon"
                              className="shrink-0"
                            >
                              {isCommenting ? <Save className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              <span className="sr-only">Enviar comentario</span>
                            </Button>
                          </div>

                          <Collapsible className="group">
                            <CollapsibleTrigger className="flex w-full items-center justify-start gap-2 text-sm font-medium text-muted-foreground">
                              <span>Historial</span>
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-4 space-y-6 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                              {isActivityLoading ? (
                                  <div className="space-y-4">
                                      <div className="flex items-start space-x-3">
                                          <Skeleton className="h-8 w-8 rounded-full" />
                                          <div className="space-y-2">
                                              <Skeleton className="h-4 w-48" />
                                              <Skeleton className="h-4 w-32" />
                                          </div>
                                      </div>
                                      <div className="flex items-start space-x-3">
                                          <Skeleton className="h-8 w-8 rounded-full" />
                                          <div className="space-y-2">
                                              <Skeleton className="h-4 w-40" />
                                              <Skeleton className="h-4 w-24" />
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="space-y-6">
                                      {activity.map(action => (
                                          <div key={action.id} className="flex items-start space-x-3">
                                              <Avatar className="h-8 w-8">
                                                {action.memberCreator ? (
                                                  <>
                                                    <AvatarImage src={action.memberCreator.avatarUrl ? `${action.memberCreator.avatarUrl}/50.png` : undefined} alt={action.memberCreator.fullName} />
                                                    <AvatarFallback>{action.memberCreator.fullName.charAt(0)}</AvatarFallback>
                                                  </>
                                                ) : (
                                                  <AvatarFallback>T</AvatarFallback>
                                                )}
                                              </Avatar>
                                              <div className="flex-1 text-xs">
                                                  <div className="flex items-baseline gap-2">
                                                      <span className="font-semibold">{action.memberCreator ? action.memberCreator.fullName : 'Trello'}</span>
                                                      <span className="text-muted-foreground text-[10px]">{formatDistanceToNow(new Date(action.date), { addSuffix: true, locale: es })}</span>
                                                  </div>
                                                  {renderActivity(action)}
                                              </div>
                                          </div>
                                      ))}
                                      {activity.length === 0 && !isActivityLoading && (
                                          <p className="text-xs text-muted-foreground">No hay comentarios en esta tarjeta.</p>
                                      )}
                                  </div>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </>
                    )}
                </div>
                 {isEditing && (
                    <DialogFooter className="border-t px-6 py-4">
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

    

    

    