'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { 
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
import { X, FileText, Edit, ChevronDown, Send, Link as LinkIcon, Plus, RefreshCw, Palette, ArrowDownUp, Folder, Printer, Mail, Loader2, CheckCircle2, ChevronLeft, Download, ExternalLink, HardDrive, History, AlertTriangle } from 'lucide-react';
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
import {
  Dialog as DialogUI,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import React from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST, AuthorizedUser } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import jsPDF from 'jspdf';
import { getDriveResourceName, extractIdFromUrl, listFolderContents, getTimelineFolderForProject, getProjectFolderIdInTL } from '@/services/google-drive';
import { sendProjectEmail } from '@/app/actions/email-actions';
import { useProject } from '@/providers/project-provider';
import ReorganizationAssistant from './reorganization-assistant';

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

const isDriveFolder = (url: string) => url.includes('drive.google.com') && (url.includes('/folders/') || (url.includes('id=') && !url.includes('/file/')));
const isDriveFile = (url: string) => (url.includes('drive.google.com') || url.includes('docs.google.com')) && (url.includes('/file/d/') || url.includes('/open?id=') || url.includes('/document/d/'));

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

const QuickEmailDialog = ({ isOpen, onOpenChange, recipient, userEmail }: { isOpen: boolean, onOpenChange: (open: boolean) => void, recipient: AuthorizedUser, userEmail: string | null }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen) {
            const cleanup = () => {
                document.body.style.pointerEvents = '';
                document.body.style.overflow = '';
            };
            cleanup();
            const timer = setTimeout(cleanup, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setSubject('');
            setBody('');
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!userEmail) return;
        setIsSending(true);

        try {
            const result = await sendProjectEmail({
                to: recipient.email,
                subject: subject || '(Sin asunto) - Portal DEA',
                body: body,
                replyTo: userEmail
            });

            if (result.success) {
                toast({ title: 'Correo enviado', description: `Se ha enviado tu consulta a ${recipient.name}.` });
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Error al enviar', description: result.error });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de red', description: 'No se pudo contactar con el servidor de correo.' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <DialogUI open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Mail className="h-5 w-5 text-primary" />
                        Enviar consulta a {recipient.name}
                    </DialogTitle>
                    <DialogDescription className="text-[10px]">
                        Tu mensaje será enviado desde ambientales.dph@gmail.com. Las respuestas llegarán directamente a <strong>{userEmail}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Asunto</Label>
                        <Input 
                            placeholder="Escribí el asunto aquí..." 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)}
                            className="text-xs"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mensaje</Label>
                        <Textarea 
                            placeholder="Escribí tu mensaje aquí..." 
                            value={body} 
                            onChange={(e) => setBody(e.target.value)}
                            className="min-h-[150px] text-xs"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSending}>Cancelar</Button>
                    <Button size="sm" onClick={handleSend} disabled={(!subject.trim() && !body.trim()) || isSending} className="gap-2">
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isSending ? 'Enviando...' : 'Enviar Mail'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </DialogUI>
    );
};

const ParticipantBadge = ({ participant, userEmail }: { participant: AuthorizedUser, userEmail: string | null }) => {
    const [isEmailOpen, setIsEmailOpen] = useState(false);

    const handleWhatsAppClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!participant.phone) return;
        const cleanPhone = participant.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const hasEmail = !!participant.email && participant.email.includes('@');
    const hasPhone = !!participant.phone;

    return (
        <>
            <span 
                className="inline-flex items-center gap-1 cursor-default rounded-md bg-white px-1.5 py-0.5 transition-all duration-200 hover:bg-muted/50 group select-none border border-muted/60 shadow-sm"
            >
                <strong className="break-words text-foreground font-bold">
                    {participant.name}
                </strong>
                {(hasEmail || hasPhone) && (
                    <div className="flex items-center gap-0.5 shrink-0 ml-1 border-l pl-1 border-muted-foreground/20">
                        {hasEmail && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 p-0.5 text-muted-foreground/60 hover:bg-primary/20 hover:text-primary transition-colors"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setTimeout(() => setIsEmailOpen(true), 100);
                                }}
                                title={`Enviar mail a ${participant.name}`}
                            >
                                <Mail className="h-full w-full" />
                            </Button>
                        )}
                        {hasPhone && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 p-0.5 text-muted-foreground/60 hover:bg-green-500/20 hover:text-green-600 transition-colors"
                                onClick={handleWhatsAppClick}
                                title={`Enviar WhatsApp a ${participant.name}`}
                            >
                                <WhatsAppIcon className="h-full w-full" />
                            </Button>
                        )}
                    </div>
                )}
            </span>
            {hasEmail && (
                <QuickEmailDialog 
                    isOpen={isEmailOpen} 
                    onOpenChange={setIsEmailOpen} 
                    recipient={participant} 
                    userEmail={userEmail} 
                />
            )}
        </>
    );
};

export default function CardSearch({ onCardSelect, selectedCard, onClear, isSummaryOpen, onSummaryOpenChange }: CardSearchProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { allCards, isLoadingCards } = useProject();
  const [query, setQuery] = useState('');
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
  const [driveNames, setDriveNames] = useState<Record<string, { name: string, isFolder: boolean }>>({});

  const [tlFolderId, setTlFolderId] = useState<string | null>(null);
  const [inspectionPath, setInspectionPath] = useState<{ id: string, name: string }[]>([]);
  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeAttachments: true,
    includeComments: true
  });
  const [isExporting, setIsExporting] = useState(false);

  // Estados para el asistente de reorganización
  const [looseFiles, setLooseFiles] = useState<any[]>([]);
  const [isReorgAssistantOpen, setIsReorgAssistantOpen] = useState(false);
  const recentlyMovedIds = useRef<Set<string>>(new Set());

  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredCards = useMemo(() => {
    const normalizedQuery = removeAccents(query.toLowerCase().trim());
    if (!normalizedQuery) return [];

    return allCards.filter((card) => {
      const normalizedName = removeAccents(card.name.toLowerCase());
      const codeMatch = card.name.match(/\(([A-Z]{2,4}\d{3})\)$/);
      const code = codeMatch ? codeMatch[1].toLowerCase() : '';
      
      return normalizedName.includes(normalizedQuery) || code.includes(normalizedQuery);
    });
  }, [allCards, query]);

  const handleSelect = (card: TrelloCard) => {
    setQuery(card.name);
    onCardSelect(card);
    setIsOpen(false);
    onSummaryOpenChange(true);
  };

  const handleEditClick = () => {
    setEditedName(selectedCard?.name || '');
    setEditedDesc(selectedCard?.desc || '');
    setEditedBoardId(selectedCard?.boardId || '');
    setEditedListId(selectedCard?.idList || '');
    setIsEditing(true);
  };

  const handleColorChange = async (color: string | null) => {
    if (!selectedCard) return;
    try {
      const updated = await updateTrelloCard({ cardId: selectedCard.id, cover: { color } });
      onCardSelect(updated);
      toast({ title: 'Portada actualizada' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al cambiar color' });
    }
  };

  const handleToggleLabel = async (labelId: string, isRemoving: boolean) => {
    if (!selectedCard) return;
    try {
      if (isRemoving) {
        await removeLabelFromCard({ cardId: selectedCard.id, labelId });
      } else {
        await addLabelToCard({ cardId: selectedCard.id, labelId });
      }
      fetchCardData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error con las etiquetas' });
    }
  };

  const handlePostComment = async () => {
    if (!selectedCard || !newComment.trim()) return;
    setIsCommenting(true);
    try {
      await addCommentToCard({ cardId: selectedCard.id, text: newComment });
      setNewComment('');
      fetchCardData();
      toast({ title: 'Comentario enviado' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al comentar' });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;
    setIsSaving(true);
    try {
      const updated = await updateTrelloCard({ 
        cardId: selectedCard.id, 
        name: editedName, 
        desc: editedDesc,
        idBoard: editedBoardId,
        idList: editedListId
      });
      onCardSelect(updated);
      setIsEditing(false);
      toast({ title: 'Cambios guardados' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!selectedCard) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(selectedCard.name, 20, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Tablero: ${selectedCard.boardName}`, 20, 30);
      
      doc.setFontSize(12);
      doc.text('Descripción:', 20, 45);
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(selectedCard.desc || 'Sin descripción', 170);
      doc.text(splitDesc, 20, 55);
      
      let y = 55 + (splitDesc.length * 5) + 10;

      if (exportOptions.includeAttachments && selectedCard.attachments?.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.text('Archivos Adjuntos:', 20, y);
        doc.setFont('helvetica', 'normal');
        y += 7;
        selectedCard.attachments.forEach(att => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(`- ${att.name}: ${att.url}`, 20, y);
          y += 5;
        });
        y += 5;
      }

      if (exportOptions.includeComments && activity.length > 0) {
        const comments = activity.filter(a => a.type === 'commentCard');
        if (comments.length > 0) {
          if (y > 250) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'bold');
          doc.text('Comentarios:', 20, y);
          doc.setFont('helvetica', 'normal');
          y += 7;
          comments.forEach(c => {
            if (y > 270) { doc.addPage(); y = 20; }
            const date = format(new Date(c.date), 'dd/MM/yyyy HH:mm');
            const text = `${c.memberCreator.fullName} (${date}): ${c.data.text}`;
            const splitText = doc.splitTextToSize(text, 170);
            doc.text(splitText, 20, y);
            y += (splitText.length * 5) + 2;
          });
        }
      }

      doc.save(`Ficha-${selectedCard.name}.pdf`);
      setIsExportDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al exportar PDF' });
    } finally {
      setIsExporting(false);
    }
  };

  const commentsOnly = useMemo(() => activity.filter(a => a.type === 'commentCard'), [activity]);

  useEffect(() => {
    if (isEditing) {
      const loadBoards = async () => {
        setIsBoardsLoading(true);
        try {
          const b = await getTrelloBoards();
          setAllBoards(b);
        } finally {
          setIsBoardsLoading(false);
        }
      };
      loadBoards();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && editedBoardId) {
      const loadLists = async () => {
        setIsListsLoading(true);
        try {
          const l = await getListsOnBoard(editedBoardId);
          setBoardLists(l);
        } finally {
          setIsListsLoading(false);
        }
      };
      loadLists();
    }
  }, [isEditing, editedBoardId]);

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

  useEffect(() => {
    setInspectionPath([]);
    setFolderContents([]);
    setNextPageToken(null);
    setIsInspecting(false);
    setTlFolderId(null);
    setLooseFiles([]);
    recentlyMovedIds.current.clear();
  }, [selectedCard?.id, isSummaryOpen]);

  const isCurrentlyInTL = useMemo(() => {
    if (inspectionPath.length === 0) return false;
    return inspectionPath[0].name === 'Línea de Tiempo';
  }, [inspectionPath]);

  useEffect(() => {
    const fetchContents = async () => {
      if (inspectionPath.length === 0) {
        setIsInspecting(false);
        setFolderContents([]);
        setNextPageToken(null);
        return;
      }

      setIsInspecting(true);
      const currentFolder = inspectionPath[inspectionPath.length - 1];
      try {
        const result = await listFolderContents(currentFolder.id);
        setFolderContents(result.files);
        setNextPageToken(result.nextPageToken);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error al leer carpeta', description: 'No se pudieron cargar los archivos.' });
        setInspectionPath(prev => prev.slice(0, -1));
      } finally {
        setIsInspecting(false);
      }
    };

    fetchContents();
  }, [inspectionPath, toast]);

  const handleLoadMore = async () => {
    if (!nextPageToken || isInspecting || isLoadingMore) return;
    
    setIsLoadingMore(true);
    const currentFolder = inspectionPath[inspectionPath.length - 1];
    try {
      const result = await listFolderContents(currentFolder.id, nextPageToken);
      setFolderContents(prev => [...prev, ...result.files]);
      setNextPageToken(result.nextPageToken);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al cargar más', description: 'No se pudieron traer más archivos.' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleEnterFolder = async (id: string, name: string) => {
    setInspectionPath(prev => [...prev, { id, name }]);
  };

  const handlePopFolder = () => {
    setInspectionPath(prev => prev.slice(0, -1));
  };

  const handleAttachmentClick = async (att: any) => {
    const isTL = att.name === 'Línea de Tiempo';
    const id = await extractIdFromUrl(att.url);
    
    if (isTL && tlFolderId) {
        handleEnterFolder(tlFolderId, 'Línea de Tiempo');
    } else if (isDriveFolder(att.url) && id) {
        handleEnterFolder(id, att.name);
    }
  };

  const handleDriveFileClick = (file: any) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleEnterFolder(file.id, file.name);
    } else if (!isCurrentlyInTL) {
      window.open(file.webViewLink, '_blank');
    }
  };

  const handleDownloadFile = async (file: any) => {
    let downloadUrl = file.webContentLink;
    
    if (!downloadUrl) {
        const id = file.id || await extractIdFromUrl(file.url);
        if (id) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        }
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      toast({ variant: 'destructive', title: 'Descarga no disponible', description: 'No se pudo generar el enlace.' });
    }
  };

  useEffect(() => {
    if (selectedCard?.desc) {
      const regex = /https?:\/\/drive\.google\.com\/\S+/gi;
      const matches = selectedCard.desc.match(regex);
      if (matches) {
        matches.forEach(async (url) => {
          if (!driveNames[url]) {
            const result = await getDriveResourceName(url);
            if (result) {
              setDriveNames(prev => ({ ...prev, [url]: result }));
            }
          }
        });
      }
    }
  }, [selectedCard?.desc, driveNames]);

  const renderDescription = (desc: string) => {
    const parts: (string | JSX.Element)[] = [];
    if (!desc) return parts;
    
    const regex = /\[([^\][]*?)\]\((.*?)\)|\*\*(.*?)\*\*|(https?:\/\/drive\.google\.com\/\S+)|(\S+\.(?:jpg|jpeg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)\S*)/gi;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(desc)) !== null) {
        if (match.index > lastIndex) parts.push(desc.substring(lastIndex, match.index));
        
        const [fullMatch, linkText, linkUrlRaw, boldText, standaloneDriveUrl, standaloneUrl] = match;
        
        if (linkText !== undefined && linkUrlRaw !== undefined) {
            const urlMatch = linkUrlRaw.trim().match(/^\S+/);
            if (!urlMatch) continue;
            const linkUrl = urlMatch[0];
            const isDrive = isDriveFolder(linkUrl) || isDriveFile(linkUrl);
            const driveData = driveNames[linkUrl];
            const DriveIcon = (driveData?.isFolder ?? isDriveFolder(linkUrl)) ? Folder : FileText;
            
            parts.push(
                <a href={linkUrl} key={match.index} target="_blank" rel="noopener noreferrer" className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors mb-1 max-w-full overflow-hidden shrink-0 min-w-0 break-words whitespace-normal",
                    isDrive ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}>
                    {isDrive ? <DriveIcon className="h-3.5 w-3.5 shrink-0" /> : <LinkIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="flex-1 min-w-0 break-words whitespace-normal">{linkText || driveData?.name || (isDrive ? (isDriveFolder(linkUrl) ? 'Carpeta Drive' : 'Archivo Drive') : 'Abrir')}</span>
                </a>
            );
        } else if (boldText !== undefined) {
            const possibleNames = boldText.split(';').map(n => n.trim());
            const detectedParts: (string | JSX.Element)[] = [];
            
            possibleNames.forEach((name, idx) => {
                const participant = WHITELIST.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
                if (participant) {
                    detectedParts.push(
                        <ParticipantBadge 
                            key={`${match.index}-${idx}`} 
                            participant={participant} 
                            userEmail={user?.email || null} 
                        />
                    );
                } else {
                    detectedParts.push(<strong key={`${match.index}-${idx}`} className="break-words font-bold">{name}</strong>);
                }
                
                if (idx < possibleNames.length - 1) {
                    detectedParts.push("; ");
                }
            });

            parts.push(<React.Fragment key={match.index}>{detectedParts}</React.Fragment>);
        } else if (standaloneDriveUrl !== undefined) {
            const driveData = driveNames[standaloneDriveUrl];
            const isFolder = driveData?.isFolder ?? isDriveFolder(standaloneDriveUrl);
            const DriveIcon = isFolder ? Folder : FileText;
            const label = driveData?.name || (isFolder ? 'Carpeta Drive' : 'Archivo Drive');
            
            parts.push(
                <a href={standaloneDriveUrl} key={match.index} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 mb-1 max-w-full overflow-hidden shrink-0 min-w-0 break-words whitespace-normal">
                    <DriveIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 break-words whitespace-normal">{label}</span>
                </a>
            );
        } else if (standaloneUrl !== undefined) {
             parts.push(<a href={standaloneUrl} key={match.index} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 mb-1 max-w-full overflow-hidden shrink-0 min-w-0 break-words whitespace-normal"><span className="flex-1 min-w-0 break-words whitespace-normal">{standaloneUrl.split('/').pop()}</span></a>);
        }
        lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < desc.length) parts.push(desc.substring(lastIndex));
    return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
  };

  const fetchCardData = useCallback(async () => {
    if (!selectedCard) return;
    setIsRefreshing(true);
    setIsActivityLoading(true);
    try {
        const codeMatch = selectedCard.name.match(/\b([A-Z]{2,4}\d{3})\b/i);
        const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

        const [refreshedCard, cardActivity, labels, tlId, tlProjectRootId] = await Promise.all([
            getCardById(selectedCard.id),
            getCardActivity(selectedCard.id),
            getBoardLabels(selectedCard.boardId),
            projectCode ? getTimelineFolderForProject(projectCode, selectedCard.name) : Promise.resolve(null),
            projectCode ? getProjectFolderIdInTL(projectCode, selectedCard.name) : Promise.resolve(null)
        ]);
        
        onCardSelect(refreshedCard);
        setActivity(cardActivity);
        setBoardLabels(labels || []);
        setTlFolderId(tlId);

        // --- Búsqueda Exhaustiva de Archivos Sueltos (Multiraíz) ---
        let allLooseFiles: any[] = [];
        
        // 1. Escanear Carpeta de Trabajo (Todas las carpetas vinculadas a Trello)
        const workFolderAtts = refreshedCard.attachments?.filter(a => isDriveFolder(a.url)) || [];
        for (const att of workFolderAtts) {
            const rootId = await extractIdFromUrl(att.url);
            if (rootId) {
                const contents = await listFolderContents(rootId);
                const loose = contents.files
                    .filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && !recentlyMovedIds.current.has(f.id))
                    .map(f => ({ ...f, parentId: rootId }));
                allLooseFiles = [...allLooseFiles, ...loose];
            }
        }

        // 2. Escanear Raíz de Proyecto en TL
        if (tlProjectRootId) {
            const tlContents = await listFolderContents(tlProjectRootId);
            const tlLoose = tlContents.files
                .filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && !recentlyMovedIds.current.has(f.id))
                .map(f => ({ ...f, parentId: tlProjectRootId }));
            allLooseFiles = [...allLooseFiles, ...tlLoose];
        }

        // Deduplicar por ID de Drive
        const uniqueLoose = Array.from(new Map(allLooseFiles.map(f => [f.id, f])).values());
        setLooseFiles(uniqueLoose);

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

  const sortedAttachments = useMemo(() => {
    const attachments = selectedCard?.attachments || [];
    
    const filtered = attachments.filter(att => {
        const isFolder = isDriveFolder(att.url);
        const isDrive = isDriveFile(att.url) || att.url.includes('drive.google.com');
        
        if (isFolder) return true;
        if (isDrive) return false; 
        
        return true;
    });

    const result = [...filtered];

    if (tlFolderId) {
        result.push({
            id: 'tl-virtual-folder',
            name: 'Línea de Tiempo',
            url: `https://drive.google.com/drive/folders/${tlFolderId}`,
            previews: []
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCard, tlFolderId]);

  return (
    <div className="flex w-full flex-col">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={inputRef}
              value={query}
              onFocus={() => { if (query && (!selectedCard || query !== selectedCard.name)) setIsOpen(true); }}
              onChange={(e) => { 
                setQuery(e.target.value); 
                if (e.target.value.length > 0 && (!selectedCard || e.target.value !== selectedCard.name)) setIsOpen(true);
                else setIsOpen(false);
              }}
              placeholder={isLoadingCards ? 'Cargando tarjetas...' : 'Buscá por palabra clave o código...'}
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
        {query && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setQuery('');
              onClear();
            }} 
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {selectedCard && (
        <DialogUI open={isSummaryOpen} onOpenChange={(open) => { if (!open) setIsEditing(false); onSummaryOpenChange(open); }}>
            <DialogContent className="p-0 max-w-2xl w-[95vw] md:w-full overflow-hidden border-0 bg-white h-[90vh] max-h-[90vh] flex flex-col gap-0 box-border shadow-2xl">
                <div className="bg-white flex flex-col h-full overflow-hidden flex-1 min-h-0 w-full max-w-full box-border">
                    <DialogHeader 
                        style={{
                            backgroundColor: trelloCoverColors.find(c => c.name === selectedCard.cover?.color)?.hex || 'hsl(var(--primary))',
                            color: ['yellow', 'lime', 'sky'].includes(selectedCard.cover?.color || '') ? '#172b4d' : 'white'
                        }} 
                        className="p-6 rounded-t-lg text-left sm:text-left flex flex-col gap-3 shrink-0 overflow-hidden box-border"
                    >
                        <div className="flex flex-col w-full pr-8 box-border min-w-0">
                            {isEditing ? (
                                <Input 
                                    value={editedName} 
                                    onChange={(e) => setEditedName(e.target.value)} 
                                    className="text-base font-semibold bg-white/10 text-inherit border-white/30 h-auto p-2 w-full" 
                                />
                            ) : (
                              <DialogTitle className="text-sm md:text-base font-bold whitespace-normal break-words leading-tight w-full flex items-start gap-2 min-w-0">
                                <span className="flex-1 min-w-0 max-w-full overflow-hidden break-words whitespace-normal">{selectedCard.name}</span>
                                <a href={selectedCard.url} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 shrink-0"><LinkIcon className="h-4 w-4" /></a>
                              </DialogTitle>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full max-w-full overflow-hidden box-border">
                            <div className="flex flex-wrap gap-1.5 max-w-full overflow-hidden box-border">
                                {(selectedCard.labels || []).map(label => (
                                    <Badge key={label.id} className="text-[10px] group cursor-default h-5 px-2 break-words whitespace-normal max-w-full" style={{ backgroundColor: label.color ? trelloCoverColors.find(c => c.name === label.color)?.hex || '#ccc' : '#ccc', color: 'white' }}>
                                      {label.name}
                                      {isEditing && <X className="ml-1 h-2 w-2 cursor-pointer hover:text-red-200 shrink-0" onClick={() => handleToggleLabel(label.id, true)} />}
                                    </Badge>
                                ))}
                                {isEditing && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 rounded-full bg-white/20 shrink-0"><Plus className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent className="max-h-48 overflow-y-auto">
                                      {(boardLabels || []).map(l => (
                                        <DropdownMenuCheckboxItem key={l.id} checked={(selectedCard.labels || []).some(sl => sl.id === l.id)} onCheckedChange={() => handleToggleLabel(l.id, (selectedCard.labels || []).some(sl => sl.id === l.id))}>
                                          <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: trelloCoverColors.find(c => l.color === c.name)?.hex || '#ccc' }} />{l.name}</div>
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                            </div>

                            {!isEditing && (
                              <div className="flex flex-wrap items-center gap-2 justify-start w-full mt-1 shrink-0 box-border">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20 shrink-0" onClick={() => setIsExportDialogOpen(true)} title="Exportar Ficha"><Printer className="h-4 w-4" /></Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20 shrink-0"><Palette className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="grid grid-cols-5 gap-1 p-2">
                                    {trelloCoverColors.map(c => (
                                      <Button key={c.name} variant="ghost" className="h-6 w-6 rounded-full p-0" style={{ backgroundColor: c.hex }} onClick={() => handleColorChange(c.name)} />
                                    ))}
                                    <Button variant="ghost" className="h-6 w-6 rounded-full border p-0" onClick={() => handleColorChange(null)}><X className="h-3 w-3" /></Button>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20 shrink-0" onClick={handleEditClick} title="Editar Ficha"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20 shrink-0" onClick={fetchCardData} disabled={isRefreshing} title="Actualizar Datos"><RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /></Button>
                              </div>
                            )}
                        </div>
                    </DialogHeader>

                    {looseFiles.length > 0 && (
                        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-800 text-[10px] font-bold uppercase tracking-tight">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>{`Se detectaron ${looseFiles.length} ${looseFiles.length === 1 ? 'archivo antiguo fuera' : 'archivos antiguos fuera'} de estructura`}</span>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={() => setIsReorgAssistantOpen(true)}
                            >
                                Reorganizar ahora
                            </Button>
                        </div>
                    )}

                    <ScrollArea className="flex-1 overflow-y-auto w-full max-w-full box-border">
                        <div className="p-6 w-full max-w-full overflow-hidden box-border min-w-0">
                            <h3 className="font-semibold text-sm mb-2 text-primary uppercase text-[10px] tracking-wider text-left">Descripción</h3>
                            {isEditing ? <Textarea value={editedDesc} onChange={(e) => setEditedDesc(e.target.value)} className="text-xs min-h-[200px]" /> : <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words min-w-0 w-full max-w-full overflow-hidden leading-relaxed text-left">{renderDescription(selectedCard.desc)}</div>}
                        </div>

                        {sortedAttachments.length > 0 && !isEditing && (
                          <div className="p-6 pt-0 w-full max-w-full overflow-hidden box-border min-w-0">
                            <Collapsible defaultOpen={true} className="w-full max-w-full overflow-hidden min-w-0 box-border">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  {inspectionPath.length > 0 && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePopFolder} title="Volver">
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <CollapsibleTrigger className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-primary hover:text-primary/80">
                                    {inspectionPath.length > 0 ? (
                                      <span className="flex items-center gap-1">
                                        {isCurrentlyInTL ? <History className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                                        {inspectionPath[inspectionPath.length - 1].name}
                                      </span>
                                    ) : (
                                      `Portales de Archivos (${sortedAttachments.length})`
                                    )}
                                    <ChevronDown className="h-3 w-3" />
                                  </CollapsibleTrigger>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => setAttachmentSort(s => s === 'name' ? 'type' : 'name')}>
                                  <ArrowDownUp className="h-3 w-3" />
                                  {attachmentSort === 'name' ? 'Nombre' : 'Tipo'}
                                </Button>
                              </div>
                              <CollapsibleContent className="space-y-1 w-full max-w-full overflow-hidden flex flex-col min-w-0 box-border border rounded-md p-2 bg-muted/5">
                                {isInspecting ? (
                                  <div className="flex items-center justify-center p-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  </div>
                                ) : (
                                  <>
                                    {inspectionPath.length === 0 ? (
                                      sortedAttachments.map(att => (
                                        <button 
                                          key={att.id}
                                          onClick={() => handleAttachmentClick(att)}
                                          className="flex items-start gap-2 p-2 rounded-md hover:bg-muted text-xs group w-full max-w-full overflow-hidden min-w-0 box-border break-words whitespace-normal text-left transition-colors"
                                        >
                                          {att.name === 'Línea de Tiempo' ? <History className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> : <Folder className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />}
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <span className="font-bold min-w-0 break-words whitespace-normal">{att.name}</span>
                                            {att.name === 'Línea de Tiempo' && <span className="text-[8px] text-zinc-500 uppercase">Documentación Final • Solo Descarga</span>}
                                          </div>
                                        </button>
                                      ))
                                    ) : (
                                      <>
                                        {folderContents.length === 0 ? (
                                          <div className="p-4 text-center text-[10px] text-muted-foreground italic">Carpeta vacía</div>
                                        ) : (
                                          folderContents.map(file => (
                                            <ContextMenu key={file.id}>
                                              <div className="flex items-center group w-full pr-2">
                                                <ContextMenuTrigger asChild>
                                                  <button 
                                                    onClick={() => handleDriveFileClick(file)}
                                                    className={cn(
                                                      "flex items-start gap-2 p-2 rounded-md text-xs flex-1 min-w-0 box-border break-words whitespace-normal text-left transition-colors",
                                                      isCurrentlyInTL && file.mimeType !== 'application/vnd.google-apps.folder' ? "cursor-default opacity-80" : "hover:bg-muted"
                                                    )}
                                                  >
                                                    {file.mimeType === 'application/vnd.google-apps.folder' ? (
                                                      <Folder className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                                    ) : (
                                                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                                    )}
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                      <span className="flex-1 min-w-0 break-words whitespace-normal">{file.name}</span>
                                                      {isCurrentlyInTL && file.mimeType !== 'application/vnd.google-apps.folder' && (
                                                          <span className="text-[8px] font-bold text-primary uppercase">Archivo de Hito • Solo Descarga</span>
                                                      )}
                                                    </div>
                                                  </button>
                                                </ContextMenuTrigger>
                                                {file.mimeType !== 'application/vnd.google-apps.folder' && (
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                                                    title="Descargar archivo"
                                                  >
                                                    <Download className="h-3.5 w-3.5" />
                                                  </Button>
                                                )}
                                              </div>
                                              <ContextMenuContent className="w-48">
                                                {file.mimeType === 'application/vnd.google-apps.folder' ? (
                                                  <>
                                                    {!isCurrentlyInTL && (
                                                        <ContextMenuItem onClick={() => window.open(file.webViewLink, '_blank')}>
                                                            <ExternalLink className="mr-2 h-4 w-4" /> Abrir en la Web
                                                        </ContextMenuItem>
                                                    )}
                                                    <ContextMenuItem disabled className="text-zinc-400">
                                                        <Folder className="mr-2 h-4 w-4" /> Navegar carpeta
                                                    </ContextMenuItem>
                                                  </>
                                                ) : (
                                                  <>
                                                    {!isCurrentlyInTL && (
                                                      <ContextMenuItem onClick={() => window.open(file.webViewLink, '_blank')}>
                                                        <ExternalLink className="mr-2 h-4 w-4" /> Abrir en Drive
                                                      </ContextMenuItem>
                                                    )}
                                                    <ContextMenuItem onClick={() => handleDownloadFile(file)}>
                                                      <Download className="mr-2 h-4 w-4" /> Descargar Archivo
                                                    </ContextMenuItem>
                                                  </>
                                                )}
                                              </ContextMenuContent>
                                            </ContextMenu>
                                          ))
                                        )}
                                        {nextPageToken && (
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="w-full text-[10px] mt-2 h-8 hover:bg-primary/5 text-primary font-bold gap-2"
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                          >
                                            {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                                            MOSTRAR MÁS ARCHIVOS
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        )}

                        {!isEditing && (
                            <div className="p-6 pt-0 space-y-4 w-full max-w-full overflow-hidden box-border min-w-0">
                                <Separator className="mb-4" />
                                <div className="flex gap-2 items-start w-full max-w-full overflow-hidden box-border min-w-0">
                                    <Textarea placeholder="Comentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isCommenting} className="text-xs min-h-[60px] flex-1 min-w-0 max-w-full box-border break-words whitespace-normal" />
                                    <Button onClick={handlePostComment} disabled={!newComment.trim() || isCommenting} size="icon" className="shrink-0 h-10 w-10"><Send className="h-4 w-4" /></Button>
                                </div>
                                <Collapsible defaultOpen={true} className="w-full max-w-full overflow-hidden min-w-0 box-border">
                                    <CollapsibleTrigger className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-primary hover:text-primary/80 mb-4">COMENTARIOS <ChevronDown className="h-3 w-3" /></CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-4 pb-4 w-full max-w-full overflow-hidden min-w-0 box-border">
                                        {commentsOnly.length > 0 ? commentsOnly.map(action => (
                                            <div key={action.id} className="flex gap-3 text-xs w-full max-w-full min-w-0 overflow-hidden box-border">
                                                <Avatar className="h-6 w-6 shrink-0 border"><AvatarFallback className="text-[10px]">{action.memberCreator?.fullName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                                                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                      <span className="font-semibold truncate max-w-[120px]">{action.memberCreator?.fullName || 'Usuario'}</span>
                                                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(action.date), { locale: es, addSuffix: true })}</span>
                                                    </div>
                                                    <div className="bg-muted p-2 rounded-md border whitespace-pre-wrap break-words text-xs leading-relaxed max-w-full overflow-hidden box-border min-w-0 text-left">
                                                      {action.data.text}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                          <div className="text-center py-4 text-xs text-muted-foreground italic">No hay comentarios aún.</div>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {isEditing && (
                    <DialogFooter className="border-t p-4 gap-2 bg-white shrink-0 box-border w-full max-w-full">
                        <div className="flex-1 flex gap-2 min-w-0 overflow-hidden">
                          <div className="flex flex-col gap-1 flex-1 min-w-0 text-left">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground truncate">Tablero</label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full text-xs justify-between overflow-hidden"><span className="truncate">{allBoards.find(b => b.id === editedBoardId)?.name || 'Cargando...'}</span> <ChevronDown className="h-3 w-3 shrink-0" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-48 overflow-y-auto">
                                {allBoards.map(b => <DropdownMenuItem key={b.id} onSelect={() => setEditedBoardId(b.id)} className="text-xs">{b.name}</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0 text-left">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground truncate">Lista</label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full text-xs justify-between overflow-hidden" disabled={isListsLoading}>{isListsLoading ? '...' : <span className="truncate">{boardLists.find(l => l.id === editedListId)?.name || 'Seleccioná'}</span>} <ChevronDown className="h-3 w-3 shrink-0" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-48 overflow-y-auto">
                                {boardLists.map(l => <DropdownMenuItem key={l.id} onSelect={() => setEditedListId(l.id)} className="text-xs">{l.name}</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-end gap-2 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-xs">Cancelar</Button>
                          <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="text-xs">{isSaving ? '...' : 'Guardar'}</Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </DialogUI>
      )}
      
      <DialogUI open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md shadow-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-primary" />
                    Exportar Ficha a PDF
                </DialogTitle>
                <DialogDescription>Seleccioná qué información querés incluir en el documento PDF.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="inc-attachments" 
                            checked={exportOptions.includeAttachments}
                            onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeAttachments: !!checked }))}
                        />
                        <Label htmlFor="inc-attachments" className="text-sm font-medium leading-none cursor-pointer">Incluir lista de enlaces adjuntos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="inc-comments" 
                            checked={exportOptions.includeComments}
                            onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeComments: !!checked }))}
                        />
                        <Label htmlFor="inc-comments" className="text-sm font-medium leading-none cursor-pointer">Incluir historial de comentarios</Label>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setIsExportDialogOpen(false)} disabled={isExporting}>Cancelar</Button>
                <Button size="sm" onClick={handleExport} disabled={isExporting} className="gap-2">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isExporting ? 'Generando...' : 'Descargar PDF'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </DialogUI>

      {selectedCard && (
          <ReorganizationAssistant 
            isOpen={isReorgAssistantOpen}
            onOpenChange={setIsReorgAssistantOpen}
            looseFiles={looseFiles}
            projectId={selectedCard.id}
            projectName={selectedCard.name}
            onReorganized={(movedIds) => {
                // Actualización instantánea del estado local para quitar archivos procesados
                movedIds.forEach(id => recentlyMovedIds.current.add(id));
                setLooseFiles(prev => prev.filter(f => !movedIds.includes(f.id)));
                setIsReorgAssistantOpen(false);
                // Refetch de seguridad después de un delay mayor para dar tiempo a Drive de asentar los cambios (consistencia eventual)
                setTimeout(() => {
                    fetchCardData();
                    // Limpiar memoria de movidos después de un tiempo prudencial
                    setTimeout(() => recentlyMovedIds.current.clear(), 10000);
                }, 4000);
            }}
          />
      )}
    </div>
  );
}
