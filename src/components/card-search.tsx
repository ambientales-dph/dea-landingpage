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
import { X, FileText, Edit, ChevronDown, Send, Link as LinkIcon, Plus, RefreshCw, Palette, ArrowDownUp, Folder, Printer, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
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
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';

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
    if (!color) return { backgroundColor: '#fff', color: '#172b4d' };
    const found = trelloCoverColors.find(c => c.name === color);
    const hex = found?.hex || '#ccc';
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
  const { user } = useUser();
  const db = useFirestore();
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

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeAttachments: true,
    includeComments: true,
    format: 'pdf' as 'pdf' | 'jpg'
  });
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSummaryOpen) {
      const cleanup = () => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      };
      cleanup();
      const timer = setTimeout(cleanup, 300);
      return () => clearTimeout(timer);
    }
  }, [isSummaryOpen]);

  const logPortalActivity = useCallback(async (actionType: string, detail: string) => {
    if (user && db && selectedCard) {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      const realName = authorizedUser?.name || user.displayName || 'Usuario';

      const activityData: any = {
        userId: user.uid,
        userName: realName,
        userEmail: user.email,
        userPhoto: user.photoURL || '',
        actionType: actionType,
        projectName: selectedCard.name,
        detail: detail,
        cardId: selectedCard.id,
        timestamp: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, 'app_activities'), activityData);
      } catch (error) {
         const permissionError = new FirestorePermissionError({
            path: 'app_activities',
            operation: 'create',
            requestResourceData: activityData,
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    }
  }, [user, db, selectedCard]);

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
    );
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
        await logPortalActivity('update_project', `Editó título/descripción`);
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
      await logPortalActivity('update_cover', `Cambió el color de portada a ${color || 'ninguno'}`);
      fetchCardData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al cambiar color' });
    }
  };

  const handleToggleLabel = async (labelId: string, isCurrentlyOn: boolean) => {
    if (!selectedCard) return;
    try {
      const labelName = boardLabels.find(l => l.id === labelId)?.name || 'Etiqueta';
      if (isCurrentlyOn) {
        await removeLabelFromCard({ cardId: selectedCard.id, labelId });
        await logPortalActivity('update_labels', `Quitó la etiqueta "${labelName}"`);
      } else {
        await addLabelToCard({ cardId: selectedCard.id, labelId });
        await logPortalActivity('update_labels', `Añadió la etiqueta "${labelName}"`);
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
      await logPortalActivity('add_comment', `Comentó: ${newComment.substring(0, 30)}${newComment.length > 30 ? '...' : ''}`);
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

  const isDriveFolder = (url: string) => {
    return url.includes('drive.google.com') && url.includes('/folders/');
  };

  const handleExport = async () => {
    if (!selectedCard) return;
    setIsExporting(true);
    
    try {
        const fileName = `DEA-Ficha-${selectedCard.name.replace(/[/\\?%*:|"<>]/g, '-')}`;
        
        if (exportOptions.format === 'jpg') {
            if (cardRef.current) {
                const dataUrl = await toJpeg(cardRef.current, { 
                  quality: 0.95, 
                  backgroundColor: '#ffffff',
                  pixelRatio: 2,
                  fontEmbedCSS: '', 
                  filter: (node: any) => {
                    const classList = node.classList;
                    if (classList && classList.contains('no-export')) return false;
                    if (classList && classList.contains('export-attachments') && !exportOptions.includeAttachments) return false;
                    if (classList && classList.contains('export-comments') && !exportOptions.includeComments) return false;
                    return true;
                  }
                });
                const link = document.createElement('a');
                link.download = `${fileName}.jpg`;
                link.href = dataUrl;
                link.click();
            }
        } else {
            // Generate professional PDF using jsPDF
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15;
            let y = 20;

            // Cover Header
            const coverColor = trelloCoverColors.find(c => c.name === selectedCard.cover?.color)?.hex || '#3182ce';
            doc.setFillColor(coverColor);
            doc.rect(margin, y, pageWidth - (margin * 2), 15, 'F');
            
            // Title in Header
            const isLight = ['yellow', 'lime', 'sky'].includes(selectedCard.cover?.color || '');
            doc.setTextColor(isLight ? '#172b4d' : '#ffffff');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(selectedCard.name, margin + 5, y + 10);
            y += 25;

            // Labels
            doc.setTextColor('#333333');
            doc.setFontSize(8);
            if (selectedCard.labels.length > 0) {
                doc.text('ETIQUETAS:', margin, y);
                y += 5;
                let lx = margin;
                selectedCard.labels.forEach(label => {
                    const labelColor = label.color ? trelloCoverColors.find(c => c.name === label.color)?.hex || '#ccc' : '#ccc';
                    doc.setFillColor(labelColor);
                    const labelWidth = doc.getTextWidth(label.name) + 4;
                    if (lx + labelWidth > pageWidth - margin) { lx = margin; y += 6; }
                    doc.rect(lx, y - 4, labelWidth, 5, 'F');
                    doc.setTextColor('#ffffff');
                    doc.text(label.name, lx + 2, y - 0.5);
                    lx += labelWidth + 2;
                });
                y += 10;
            }

            // Description
            doc.setTextColor('#000000');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('DESCRIPCIÓN:', margin, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const descLines = doc.splitTextToSize(selectedCard.desc || 'Sin descripción', pageWidth - (margin * 2));
            doc.text(descLines, margin, y);
            y += (descLines.length * 5) + 10;

            // Attachments
            if (exportOptions.includeAttachments && selectedCard.attachments.length > 0) {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`ADJUNTOS (${selectedCard.attachments.length}):`, margin, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                selectedCard.attachments.forEach(att => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.text(`• ${att.name}`, margin + 2, y);
                    y += 5;
                    doc.setTextColor('#3182ce');
                    doc.text(att.url, margin + 5, y);
                    doc.setTextColor('#000000');
                    y += 6;
                });
                y += 5;
            }

            // Comments
            if (exportOptions.includeComments && activity.length > 0) {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text('HISTORIAL DE COMENTARIOS:', margin, y);
                y += 7;
                activity.forEach(action => {
                    if (y > 260) { doc.addPage(); y = 20; }
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    const dateStr = format(new Date(action.date), 'dd/MM/yyyy HH:mm', { locale: es });
                    doc.text(`${action.memberCreator.fullName} - ${dateStr}`, margin, y);
                    y += 4;
                    doc.setFont('helvetica', 'normal');
                    const commentLines = doc.splitTextToSize(action.data.text || '', pageWidth - (margin * 2) - 5);
                    doc.text(commentLines, margin + 2, y);
                    y += (commentLines.length * 4) + 6;
                });
            }

            // Footer
            const pageCount = doc.internal.pages.length - 1;
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor('#999999');
                doc.text(`Generado por Portal DEA - ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`, margin, 285);
            }

            doc.save(`${fileName}.pdf`);
        }

        await logPortalActivity('export_card', `Exportó ficha técnica como ${exportOptions.format.toUpperCase()}`);
        toast({ title: '¡Exportación exitosa!', description: `Se ha descargado la ficha de "${selectedCard.name}".` });
        setIsExportDialogOpen(false);
    } catch (error) {
        console.error('Export error:', error);
        toast({ variant: 'destructive', title: 'Error al exportar', description: 'No se pudo generar el archivo.' });
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col justify-end">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={() => { fetchAllCards(); if (query && (!selectedCard || query !== selectedCard.name)) setIsOpen(true); }}
              onChange={(e) => { 
                setQuery(e.target.value); 
                if (e.target.value.length > 0 && (!selectedCard || e.target.value !== selectedCard.name)) setIsOpen(true);
                else setIsOpen(false);
              }}
              placeholder={isLoading ? 'Cargando tarjetas...' : 'Buscá por palabra clave o código...'}
              className="w-full min-h-20 bg-white text-foreground pr-10 text-xs border-2 focus-visible:ring-primary shadow-sm"
              autoComplete="off"
            />
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-[--radix-popover-trigger-width] border-0 shadow-2xl bg-white" 
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command className="bg-white">
              <CommandList className="max-h-[300px] bg-white p-2">
                {filteredCards.length === 0 && query.length > 0 && (!selectedCard || query !== selectedCard.name) && (
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
                <div ref={cardRef} className="bg-white">
                    <DialogHeader 
                        style={{
                            backgroundColor: trelloCoverColors.find(c => c.name === selectedCard.cover?.color)?.hex || 'hsl(var(--primary))',
                            color: ['yellow', 'lime', 'sky'].includes(selectedCard.cover?.color || '') ? '#172b4d' : 'white'
                        }} 
                        className="p-6 rounded-t-lg text-left sm:text-left flex flex-col gap-4"
                    >
                        <div className="flex items-start justify-between gap-4">
                            {isEditing ? (
                                <Input 
                                    value={editedName} 
                                    onChange={(e) => setEditedName(e.target.value)} 
                                    className="text-base font-semibold bg-white/10 text-inherit border-white/30 h-auto p-2 w-full" 
                                />
                            ) : (
                              <DialogTitle className="text-sm font-semibold pr-8 flex items-center gap-2 leading-tight">
                                <span>{selectedCard.name}</span>
                                <a href={selectedCard.url} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 no-export flex-shrink-0"><LinkIcon className="h-4 w-4" /></a>
                              </DialogTitle>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                            <div className="flex flex-wrap gap-2">
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

                            {!isEditing && (
                              <div className="flex items-center gap-1 no-export">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={() => setIsExportDialogOpen(true)} title="Exportar Ficha"><Printer className="h-4 w-4" /></Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20"><Palette className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="grid grid-cols-5 gap-1 p-2">
                                    {trelloCoverColors.map(c => (
                                      <Button key={c.name} variant="ghost" className="h-6 w-6 rounded-full p-0" style={{ backgroundColor: c.hex }} onClick={() => handleColorChange(c.name)} />
                                    ))}
                                    <Button variant="ghost" className="h-6 w-6 rounded-full border p-0" onClick={() => handleColorChange(null)}><X className="h-3 w-3" /></Button>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={handleEditClick} title="Editar Ficha"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={fetchCardData} disabled={isRefreshing} title="Actualizar Datos"><RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /></Button>
                              </div>
                            )}
                        </div>
                    </DialogHeader>

                    <ScrollArea className="max-h-[70vh]">
                        <div className="p-6">
                            <h3 className="font-semibold text-sm mb-2">Descripción</h3>
                            {isEditing ? <Textarea value={editedDesc} onChange={(e) => setEditedDesc(e.target.value)} className="text-xs min-h-[200px]" /> : <div className="text-xs text-muted-foreground whitespace-pre-wrap">{renderDescription(selectedCard.desc)}</div>}
                        </div>

                        {selectedCard.attachments?.length > 0 && !isEditing && (
                          <div className="p-6 pt-0 export-attachments">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-sm">Adjuntos ({selectedCard.attachments.length})</h3>
                              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 no-export" onClick={() => setAttachmentSort(s => s === 'name' ? 'type' : 'name')}>
                                <ArrowDownUp className="h-3 w-3" />
                                {attachmentSort === 'name' ? 'Nombre' : 'Tipo'}
                              </Button>
                            </div>
                            <div className="space-y-1">
                              {sortedAttachments.map(att => (
                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-xs group">
                                  {isDriveFolder(att.url) ? (
                                    <Folder className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span className="flex-1 truncate">{att.name}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isEditing && (
                            <div className="p-6 pt-0 export-comments">
                                <div className="flex gap-2 mb-4 no-export">
                                    <Textarea placeholder="Comentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isCommenting} className="text-xs min-h-[60px]" />
                                    <Button onClick={handlePostComment} disabled={!newComment.trim() || isCommenting} size="icon"><Send className="h-4 w-4" /></Button>
                                </div>
                                <Collapsible defaultOpen={true}>
                                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground no-export">Historial <ChevronDown className="h-3 w-3" /></CollapsibleTrigger>
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
                </div>

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

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Configurar Exportación
                </DialogTitle>
                <DialogDescription>
                    Seleccioná qué información querés incluir en el documento final.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="inc-attachments" 
                            checked={exportOptions.includeAttachments}
                            onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeAttachments: !!checked }))}
                        />
                        <Label htmlFor="inc-attachments" className="text-sm font-medium leading-none cursor-pointer">
                            Incluir lista de enlaces adjuntos
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="inc-comments" 
                            checked={exportOptions.includeComments}
                            onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeComments: !!checked }))}
                        />
                        <Label htmlFor="inc-comments" className="text-sm font-medium leading-none cursor-pointer">
                            Incluir historial de comentarios
                        </Label>
                    </div>
                </div>

                <Separator />

                <div className="space-y-3">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Formato de Salida</Label>
                    <RadioGroup 
                        value={exportOptions.format} 
                        onValueChange={(val: any) => setExportOptions(prev => ({ ...prev, format: val }))}
                        className="flex gap-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="pdf" id="f-pdf" />
                            <Label htmlFor="f-pdf" className="cursor-pointer">PDF Documento</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="jpg" id="f-jpg" />
                            <Label htmlFor="f-jpg" className="cursor-pointer">JPG Imagen</Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} disabled={isExporting}>Cancelar</Button>
                <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isExporting ? 'Generando...' : 'Descargar Ficha'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
