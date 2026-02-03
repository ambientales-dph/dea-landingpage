'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { getAllCardsFromAllBoards, TrelloCard, updateTrelloCard, getCardActivity, TrelloAction, addCommentToCard, TrelloAttachment, getBoardLabels, TrelloLabel, addLabelToCard, removeLabelFromCard, getCardById } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, X, AlertTriangle, FileText, Edit, Save, ChevronDown, Send, File as FileIcon, Image as ImageIcon, Cloud, Link as LinkIcon, Plus, RefreshCw, Palette, Folder, ArrowDownUp } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
  return str.normalize("NFD").replace(/[\u00c0-\u024f]/g, "");
}

const renderDescription = (desc: string) => {
    // Regular expression to find Markdown links and bold text
    const regex = /\[([^\][]*?)\]\((.*?)\)|\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    const parts = [];

    let match;
    while ((match = regex.exec(desc)) !== null) {
        // Push the text before the match
        if (match.index > lastIndex) {
            parts.push(desc.substring(lastIndex, match.index));
        }

        // Match 1 & 2 are for links: [text](url)
        if (match[1] !== undefined && match[2] !== undefined) {
            const linkText = match[1];
            const urlAndTitle = match[2].trim();
            const urlMatch = urlAndTitle.match(/^\S+/);
            if (!urlMatch) continue;
            const linkUrl = urlMatch[0];

            let displayLabel = linkText;
            let IconComponent = LinkIcon;
            
            // Heuristic for the user's specific case where link text is a URL
            if (displayLabel.startsWith('http')) {
                if (linkUrl.includes('drive.google.com')) {
                    displayLabel = 'Abrir en Drive';
                    IconComponent = Cloud;
                } else {
                    displayLabel = 'Abrir enlace';
                }
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
        // Match 3 is for bold text: **text**
        } else if (match[3] !== undefined) {
            parts.push(<strong key={match.index}>{match[3]}</strong>);
        }

        lastIndex = regex.lastIndex;
    }

    // Push the remaining text after the last match
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
  const [isLoading, setIsLoading] = useState(true);
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
        const { id, boardName, boardId } = selectedCard;
        const updatedCardData = await updateTrelloCard({ cardId: id, name: editedName, desc: editedDesc });

        const fullyUpdatedCard = { ...selectedCard, ...updatedCardData, boardName, boardId };

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
    // Now we only receive comments, so we can simplify this.
    if (action.type === 'commentCard' && action.data.text) {
      return <p className="mt-1 bg-muted p-3 rounded-md whitespace-pre-wrap border">{action.data.text}</p>;
    }
    return null;
  };
  
  const getAttachmentIcon = (attachment: TrelloAttachment): { component: JSX.Element; typeOrder: number } => {
    const name = attachment.name.toLowerCase();
    
    // Heuristics for Folders (e.g., from Drive)
    if (attachment.url.includes('drive.google.com/drive/folders/')) {
        return { component: <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 1 };
    }

    // Images
    if (/\.(jpe?g|png|gif|webp|svg|bmp|tiff)$/i.test(name)) {
        return { component: <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 2 };
    }
    
    // PDFs
    if (/\.pdf$/i.test(name)) {
        return { component: <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 3 };
    }

    // Word Documents
    if (/\.docx?$/i.test(name)) {
        return { component: <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 3 };
    }

    // Excel Spreadsheets
     if (/\.xlsx?$/i.test(name)) {
        return { component: <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 3 };
    }
    
    // Generic Links
    if (/^(http|https):\/\/[^ "]+$/.test(attachment.name)) {
        return { component: <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />, typeOrder: 4 };
    }

    // Default to a generic file
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
            onSummaryOpenChange(isOpen);
        }}>
            <DialogContent className="p-0 max-w-2xl">
                <DialogHeader
                    style={trelloColorToStyle(selectedCard.cover?.color)}
                    className="p-6 rounded-t-lg relative"
                >
                    {isEditing ? (
                        <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="text-base font-semibold bg-transparent text-inherit border-white/30 placeholder-white/70 focus:bg-black/10 h-auto p-1 mr-28"
                            disabled={isSaving}
                        />
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
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {selectedCard.desc ? renderDescription(selectedCard.desc) : 'Esta tarjeta no tiene descripción.'}
                          </p>
                        )}
                    </div>
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
                                    {sortedAttachments.map(attachment => (
                                        <div key={attachment.id} className="group/item flex items-center justify-between rounded-md hover:bg-muted py-0.5 px-1">
                                            <a
                                                href={attachment.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-grow items-center gap-2 overflow-hidden"
                                            >
                                                {getAttachmentIcon(attachment).component}
                                                <span className="text-xs text-foreground truncate" title={attachment.name}>
                                                    {attachment.name}
                                                </span>
                                            </a>
                                        </div>
                                    ))}
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
