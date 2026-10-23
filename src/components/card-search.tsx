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
import { X, FileText, Pencil, ChevronDown, Send, Link as LinkIcon, Plus, RefreshCw, ArrowDownUp, Folder, Printer, Mail, Loader2, CheckCircle2, ChevronLeft, Download, ExternalLink, History, AlertTriangle, BookText, Settings, Crosshair, UploadCloud, FolderPlus, Copy, Check } from 'lucide-react';
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST, AuthorizedUser } from '@/lib/auth-data';
import jsPDF from 'jspdf';
import { getDriveResourceName, extractIdFromUrl, listFolderContents, getTimelineFolderForProject, getProjectFolderIdInTL, moveFile, createSubfolder, createMilestoneFolder } from '@/services/google-drive';
import { sendProjectEmail } from '@/app/actions/email-actions';
import { updateProject } from '@/app/actions/project-actions';
import { useProject } from '@/providers/project-provider';
import ReorganizationAssistant from './reorganization-assistant';
import { EQUIPO_DEA, EQUIPO_SIG, EQUIPO_DRON } from '@/lib/equipo';
import { MUNICIPIOS } from '@/lib/municipios';
import { PROYECTISTAS } from '@/lib/proyectistas';
import { FINANCIAMIENTO } from '@/lib/financiamiento';
import { CUENCAS } from '@/lib/cuencas';
import LocationPicker from './location-picker';
import UploadWorkingFilesDialog, { type PreparedUploadFile } from './upload-working-files-dialog';

const ESTADOS_PROYECTO = [
    "Sin iniciar",
    "Iniciado",
    "Neutralizado",
    "Terminado",
    "Con DIA",
    "Rescindido",
    "En seguimiento"
];

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

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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

const isDriveFolder = (url: string) => url && url.includes('drive.google.com') && (url.includes('/folders/') || (url.includes('id=') && !url.includes('/file/')));
const isAnyDriveResource = (url: string) => url && url.includes('drive.google.com');

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

    useEffect(() => { if (!isOpen) { const cleanup = () => { document.body.style.pointerEvents = ''; document.body.style.overflow = ''; }; cleanup(); const timer = setTimeout(cleanup, 300); return () => clearTimeout(timer); } }, [isOpen]);
    useEffect(() => { if (isOpen) { setSubject(''); setBody(''); } }, [isOpen]);

    const handleSend = async () => {
        if (!userEmail) return;
        setIsSending(true);
        try {
            const result = await sendProjectEmail({ to: recipient.email, subject: subject || '(Sin asunto) - Portal DEA', body: body, replyTo: userEmail });
            if (result.success) { toast({ title: 'Correo enviado', description: `Se ha enviado tu consulta a ${recipient.name}.` }); onOpenChange(false); }
            else { toast({ variant: 'destructive', title: 'Error al enviar', description: result.error }); }
        } catch (error) { toast({ variant: 'destructive', title: 'Error de red', description: 'No se pudo contactar con el servidor de correo.' }); }
        finally { setIsSending(false); }
    };

    return (
        <DialogUI open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md shadow-2xl bg-white text-black">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold"><Mail className="h-5 w-5 text-primary" />Enviar consulta a {recipient.name}</DialogTitle>
                    <DialogDescription className="text-[10px]">Tu mensaje será enviado desde ambientales.dph@gmail.com. Las respuestas llegarán directamente a <strong>{userEmail}</strong>.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-zinc-500">Asunto</Label><Input placeholder="Asunto..." value={subject} onChange={(e) => setSubject(e.target.value)} className="text-xs bg-white text-black" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-zinc-500">Mensaje</Label><Textarea placeholder="Mensaje..." value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[150px] text-xs bg-white text-black" /></div>
                </div>
                <DialogFooter><Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSending}>Cancelar</Button><Button size="sm" onClick={handleSend} disabled={(!subject.trim() && !body.trim()) || isSending}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar Mail'}</Button></DialogFooter>
            </DialogContent>
        </DialogUI>
    );
};

const ParticipantBadge = ({ participant, userEmail }: { participant: AuthorizedUser, userEmail: string | null }) => {
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const handleWhatsAppClick = (e: React.MouseEvent) => { e.stopPropagation(); if (!participant.phone) return; window.open(`https://wa.me/${participant.phone.replace(/\D/g, '')}`, '_blank'); };
    const hasEmail = !!participant.email && participant.email.includes('@');
    const hasPhone = !!participant.phone;

    return (
        <>
            <span className="inline-flex items-center gap-1 cursor-default rounded-md bg-white px-1.5 py-0.5 transition-all duration-200 hover:bg-muted/50 group select-none border border-muted/60 shadow-sm">
                <strong className="break-words text-foreground font-bold">{participant.name}</strong>
                {(hasEmail || hasPhone) && (
                    <div className="flex items-center gap-0.5 shrink-0 ml-1 border-l pl-1 border-muted-foreground/20">
                        {hasEmail && <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/60 hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setTimeout(() => setIsEmailOpen(true), 100); }}><Mail className="h-full w-full" /></Button>}
                        {hasPhone && <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/60 hover:text-green-600 transition-colors" onClick={handleWhatsAppClick}><WhatsAppIcon className="h-full w-full" /></Button>}
                    </div>
                )}
            </span>
            {hasEmail && <QuickEmailDialog isOpen={isEmailOpen} onOpenChange={setIsEmailOpen} recipient={participant} userEmail={userEmail} />}
        </>
    );
};

interface CardSearchProps {
  onCardSelect: (card: TrelloCard | null) => void;
  selectedCard: TrelloCard | null;
  onClear: () => void;
  isSummaryOpen: boolean;
  onSummaryOpenChange: (open: boolean) => void;
}

export default function CardSearch({ onCardSelect, selectedCard, onClear, isSummaryOpen, onSummaryOpenChange }: CardSearchProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { allCards, isLoadingCards, refreshCards } = useProject();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRawEditing, setIsRawEditing] = useState(false);
  const [rawDescription, setRawDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [activity, setActivity] = useState<TrelloAction[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [boardLabels, setBoardLabels] = useState<TrelloLabel[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados Edición Estructurada
  const [editEstado, setEditEstado] = useState('Sin iniciar');
  const [editPartidos, setEditPartidos] = useState<string[]>([]);
  const [editReferencia, setEditReferencia] = useState('');
  const [editExtension, setEditExtension] = useState('');
  const [editPoblacion, setEditPoblacion] = useState('');
  const [editPresupuesto, setEditPresupuesto] = useState('');
  const [editFinanciamiento, setEditFinanciamiento] = useState<string[]>([]);
  const [editEquipo, setEditEquipo] = useState<string[]>([]);
  const [editSig, setEditSig] = useState<string[]>([]);
  const [editDron, setEditDron] = useState<string[]>([]);
  const [editSeguimiento, setEditSeguimiento] = useState('');
  const [editProyectistas, setEditProyectistas] = useState<string[]>([]);
  const [editExpediente, setEditExpediente] = useState('');
  const [editProvidencia, setEditProvidencia] = useState('');
  const [editResolucion, setEditResolucion] = useState('');
  const [editFechaDia, setEditFechaDia] = useState('');
  const [editContratista, setEditContratista] = useState('');
  const [editRespAmbiental, setEditRespAmbiental] = useState('');
  const [editOtroDrive, setEditOtroDrive] = useState('');
  const [editDriveProyectista, setEditDriveProyectista] = useState('');
  const [editCoordinadas, setEditCoordinadas] = useState('');
  const [wordDocToDownload, setWordDocToDownload] = useState<{ id: string; name: string; webContentLink?: string; webViewLink?: string } | null>(null);

  const isWordDocument = (fileName: string, mimeType?: string) => {
    const isDocExt = /\.(docx?)$/i.test(fileName || '');
    const isDocMime = mimeType === 'application/msword' || 
                      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return isDocExt || isDocMime;
  };
  
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  const [tlFolderId, setTlFolderId] = useState<string | null>(null);
  const [inspectionPath, setInspectionPath] = useState<{ id: string, name: string }[]>([]);
  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [looseFiles, setLooseFiles] = useState<any[]>([]);
  const [isReorgAssistantOpen, setIsReorgAssistantOpen] = useState(false);
  const recentlyMovedIds = useRef<Set<string>>(new Set());

  // Estados para subida de archivos y carpetas de trabajo
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<PreparedUploadFile[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Recorre recursivamente entradas de archivos y carpetas soltadas
  const extractFilesFromDataTransfer = async (dataTransfer: DataTransfer): Promise<PreparedUploadFile[]> => {
    const items = dataTransfer.items;
    const result: PreparedUploadFile[] = [];

    async function traverseEntry(entry: any, path: string = ''): Promise<void> {
      if (entry.isFile) {
        return new Promise<void>((resolve) => {
          entry.file((file: File) => {
            result.push({ file, relativePath: path ? `${path}/${file.name}` : file.name });
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntriesChunk = async (): Promise<any[]> => {
          const all: any[] = [];
          let finished = false;
          while (!finished) {
            const chunk: any[] = await new Promise((res) => {
              dirReader.readEntries(res, () => res([]));
            });
            if (chunk.length === 0) finished = true;
            else all.push(...chunk);
          }
          return all;
        };
        const entries = await readEntriesChunk();
        const nextPath = path ? `${path}/${entry.name}` : entry.name;
        for (const child of entries) {
          await traverseEntry(child, nextPath);
        }
      }
    }

    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      const entries: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      for (const entry of entries) {
        await traverseEntry(entry);
      }
    } else {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        const rel = (file as any).webkitRelativePath || file.name;
        result.push({ file, relativePath: rel });
      }
    }

    return result;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isTL = inspectionPath[0]?.name === 'Línea de Tiempo';
    if (!isTL && inspectionPath.length > 0) {
      setIsDraggingFiles(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);

    const isTL = inspectionPath[0]?.name === 'Línea de Tiempo';
    if (isTL) {
      toast({
        variant: 'destructive',
        title: 'Acción no permitida en Línea de Tiempo',
        description: 'La carpeta de Línea de Tiempo es de solo descarga institucional. Para incorporar documentación final a un hito, acceda al módulo Línea de Tiempo.',
      });
      return;
    }

    if (inspectionPath.length === 0) return;

    try {
      const extracted = await extractFilesFromDataTransfer(e.dataTransfer);
      if (extracted.length > 0) {
        setPendingUploadFiles(extracted);
        setIsUploadDialogOpen(true);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al procesar archivos', description: err.message });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const list: PreparedUploadFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        list.push({ file, relativePath: file.name });
      }
      setPendingUploadFiles(list);
      setIsUploadDialogOpen(true);
      e.target.value = '';
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const list: PreparedUploadFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const rel = file.webkitRelativePath || file.name;
        list.push({ file, relativePath: rel });
      }
      setPendingUploadFiles(list);
      setIsUploadDialogOpen(true);
      e.target.value = '';
    }
  };

  // Estados para creación de nueva carpeta dentro de la inspección
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);

  const handleCreateSubfolder = async () => {
    if (!newSubfolderName.trim()) {
      toast({ variant: 'destructive', title: 'Ingrese un nombre para la carpeta' });
      return;
    }
    const current = inspectionPath[inspectionPath.length - 1];
    if (!current) return;

    setIsCreatingSubfolder(true);
    try {
      await createSubfolder(current.id, newSubfolderName.trim());
      toast({ title: `Carpeta "${newSubfolderName.trim()}" creada con éxito` });
      setNewSubfolderName('');
      setIsCreateFolderOpen(false);
      // Recargar lista de archivos de la carpeta actual
      const res = await listFolderContents(current.id);
      setFolderContents(res.files);
      setNextPageToken(res.nextPageToken);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al crear carpeta', description: err.message });
    } finally {
      setIsCreatingSubfolder(false);
    }
  };

  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const logActivity = useCallback(async (actionType: string, detail: string) => {
    if (user && db && selectedCard) {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      const realName = authorizedUser?.name || user.displayName || 'Usuario';

      const activityData = {
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
        console.error("Error logging activity:", error);
      }
    }
  }, [user, db, selectedCard]);

  useEffect(() => { 
    if (!selectedCard) setQuery(''); 
  }, [selectedCard]);

  const filteredCards = useMemo(() => {
    const q = removeAccents(query.toLowerCase().trim());
    if (!q) return [];
    return allCards.filter(c => removeAccents(c.name.toLowerCase()).includes(q) || (c.name.match(/\(([^)]+)\)$/)?.[1] || '').toLowerCase().includes(q));
  }, [allCards, query]);

  const handleSelect = (card: TrelloCard) => { 
    onCardSelect(null); 
    setActivity([]); 
    setLooseFiles([]); 
    setFolderContents([]); 
    setInspectionPath([]); 
    setTimeout(() => { 
      setQuery(''); 
      onCardSelect(card); 
      setIsOpen(false); 
    }, 50); 
  };

  const extractField = (desc: string, field: string) => {
    if (!desc) return '';
    const lines = desc.split('\n');
    const fL = field.toLowerCase().trim();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().toLowerCase().startsWith(fL + ':')) {
        let val = line.trim().substring(field.length + 1).trim().replace(/^\*\*|\*\*$/g, '').trim();
        if (!val && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.startsWith('·') && !nextLine.startsWith('-')) {
            val = nextLine.replace(/^\*\*|\*\*$/g, '').trim();
          }
        }
        const mdMatch = val.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
        if (mdMatch) return mdMatch[1];
        return val;
      }
    }
    return '';
  };

  const handleEditClick = () => {
    if (!selectedCard) return;
    const d = selectedCard.desc || '';
    setEditedName(selectedCard.name.replace(/\s*\([^)]+\)$/, '').trim());
    setEditEstado(extractField(d, '·ESTADO') || 'Sin iniciar');
    setEditPartidos(extractField(d, '·PARTIDO').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditReferencia(extractField(d, '·REFERENCIA GEOGRÁFICA'));
    setEditExtension(extractField(d, '·EXTENSIÓN (Ha o Km)'));
    setEditPoblacion(extractField(d, '·POBLACIÓN BENEFICIADA'));
    setEditPresupuesto(extractField(d, '·PRESUPUESTO'));
    setEditFinanciamiento(extractField(d, '·FINANCIAMIENTO').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditEquipo(extractField(d, '·Diagnóstico ambiental-socioeconómico').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditSig(extractField(d, '·Información SIG-imágenes').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditDron(extractField(d, '·Información LIDAR/vuelos Dron').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditSeguimiento(extractField(d, '·Seguimiento de obra'));
    setEditProyectistas(extractField(d, '·Proyectista').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setEditExpediente(extractField(d, '·EXPEDIENTE'));
    setEditProvidencia(extractField(d, '·PROVIDENCIA'));
    setEditResolucion(extractField(d, '·RESOLUCIÓN'));
    setEditFechaDia(extractField(d, '·FECHA DIA'));
    setEditContratista(extractField(d, '·CONTRATISRA'));
    setEditRespAmbiental(extractField(d, '·RESPONSABLE AMBIENTAL'));
    setEditOtroDrive(extractField(d, '·Otro Drive de trabajo'));
    setEditDriveProyectista(extractField(d, '·Drive del proyectista'));
    setEditCoordinadas(extractField(d, '·COORDINADAS'));
    setIsEditing(true);
  };

  const handleRawEditClick = () => { if (selectedCard) { setRawDescription(selectedCard.desc || ''); setIsRawEditing(true); } };

  const handleSaveRawEdit = async () => {
    if (!selectedCard) return;
    setIsSaving(true);
    try {
        await updateTrelloCard({ cardId: selectedCard.id, desc: rawDescription });
        await logActivity('update_project', `Realizó edición RAW de la ficha técnica`);
        const updated = await getCardById(selectedCard.id);
        onCardSelect(updated);
        setIsRawEditing(false);
        refreshCards();
        toast({ title: 'Descripción actualizada' });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error al guardar RAW', description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;
    setIsSaving(true);
    try {
        const cuencaCodeMatch = selectedCard.name.match(/\(([A-Z]{2,4})\d{3}\)$/);
        const cuenca = cuencaCodeMatch ? CUENCAS.find(c => c.code === cuencaCodeMatch[1]) : null;
        const formData = new FormData();
        formData.append('cardId', selectedCard.id);
        formData.append('nombre', editedName);
        formData.append('cuenca', cuenca?.id || '');
        formData.append('estado', editEstado);
        formData.append('partido', editPartidos.join(', '));
        formData.append('referencia', editReferencia);
        formData.append('extension', editExtension);
        formData.append('poblacion', editPoblacion);
        formData.append('presupuesto', editPresupuesto);
        formData.append('financiamiento', editFinanciamiento.join(', '));
        formData.append('diagnostico', editEquipo.join('; '));
        formData.append('sig', editSig.join('; '));
        formData.append('dron', editDron.join('; '));
        formData.append('seguimiento', editSeguimiento);
        formData.append('proyectista', editProyectistas.join('; '));
        formData.append('expediente', editExpediente);
        formData.append('providencia', editProvidencia);
        formData.append('resolucion', editResolucion);
        formData.append('fechaDia', editFechaDia);
        formData.append('contratista', editContratista);
        formData.append('respAmbiental', editRespAmbiental);
        formData.append('otroDrive', editOtroDrive);
        formData.append('driveProyectista', editDriveProyectista);
        formData.append('coordinadas', editCoordinadas);

        const result = await updateProject({ success: false }, formData);
        if (result.success) {
            const updated = await getCardById(selectedCard.id);
            onCardSelect(updated);
            
            if (result.isStatusChange) {
                await logActivity('status_change', `Cambió el estado a "${result.newStatus}"`);
            } else {
                await logActivity('update_project', `Actualizó la ficha técnica`);
            }

            setIsEditing(false);
            refreshCards();
            toast({ title: 'Ficha actualizada' });
        } else toast({ variant: 'destructive', title: 'Error', description: result.message });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error inesperado', description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handlePrintCard = () => {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(selectedCard?.name || '', 20, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(selectedCard?.desc || '', 170);
      doc.text(splitDesc, 20, 35);
      doc.save(`Ficha-${selectedCard?.name || 'obra'}.pdf`);
  };

  const handlePostComment = async () => {
    if (!selectedCard || !newComment.trim()) return;
    setIsCommenting(true);
    try { 
        await addCommentToCard({ cardId: selectedCard.id, text: newComment }); 
        await logActivity('add_comment', `Añadió un comentario en la ficha técnica`);
        setNewComment(''); fetchCardData(); toast({ title: 'Comentario enviado' }); 
    }
    catch (e) { toast({ variant: 'destructive', title: 'Error al comentar' }); }
    finally { setIsCommenting(false); }
  };

  const fetchCardData = useCallback(async () => {
    if (!selectedCard) return;
    setIsRefreshing(true);
    setIsActivityLoading(true);
    try {
        const codeMatch = selectedCard.name.match(/\b([A-Z]{2,4}\d{3})\b/i);
        const pCode = codeMatch ? codeMatch[0].toUpperCase() : null;
        const [refCard, cAct, labels, tlId, tlProjRootId] = await Promise.all([
            getCardById(selectedCard.id), getCardActivity(selectedCard.id), getBoardLabels(selectedCard.boardId),
            pCode ? getTimelineFolderForProject(pCode, selectedCard.name) : Promise.resolve(null),
            pCode ? getProjectFolderIdInTL(pCode, selectedCard.name) : Promise.resolve(null)
        ]);
        onCardSelect(refCard); setActivity(cAct); setBoardLabels(labels || []); setTlFolderId(tlId);
        let allLoose: any[] = [];
        const workAtts = refCard.attachments?.filter(a => isDriveFolder(a.url)) || [];
        for (const att of workAtts) {
            const rId = await extractIdFromUrl(att.url);
            if (rId) { const cont = await listFolderContents(rId); const loose = cont.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && !recentlyMovedIds.current.has(f.id)).map(f => ({ ...f, parentId: rId })); allLoose = [...allLoose, ...loose]; }
        }
        if (tlProjRootId) { const tlCont = await listFolderContents(tlProjRootId); const tlLoose = tlCont.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && !recentlyMovedIds.current.has(f.id)).map(f => ({ ...f, parentId: tlProjRootId })); allLoose = [...allLoose, ...tlLoose]; }
        setLooseFiles(Array.from(new Map(allLoose.map(f => [f.id, f])).values()));
    } catch (error) { console.error(error); }
    finally { setIsRefreshing(false); setIsActivityLoading(false); }
  }, [selectedCard?.id, onCardSelect]);

  useEffect(() => { if (isSummaryOpen && selectedCard) fetchCardData(); }, [isSummaryOpen, selectedCard?.id, fetchCardData]);

  const sortedAttachments = useMemo(() => {
    const res = (selectedCard?.attachments || []).filter(a => isDriveFolder(a.url));
    if (tlFolderId) res.push({ id: 'tl-virtual-folder', name: 'Línea de Tiempo', url: `https://drive.google.com/drive/folders/${tlFolderId}`, previews: [] } as any);
    const ext = (selectedCard?.attachments || []).filter(a => !isAnyDriveResource(a.url));
    if (ext.length > 0) res.push({ id: 'virtual-external', name: 'Enlaces Externos', url: '#', previews: [] } as any);
    return res.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCard, tlFolderId]);

  const getUrlAlias = (url: string, textBefore: string, defaultText?: string): string => {
    if (defaultText && !/^https?:\/\//i.test(defaultText.trim())) {
      return defaultText;
    }
    const fieldMatches = Array.from(
      textBefore.matchAll(/(?:^|\n)\s*[·\-*]?\s*(?!https?:)([A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s/()\-]+):(?!\/\/)/gi)
    );
    if (fieldMatches.length > 0) {
      const lastField = fieldMatches[fieldMatches.length - 1][1].toLowerCase().trim();
      if (lastField.includes('proyectista')) {
        return 'Carpeta del Proyectista';
      }
      if (lastField.includes('otro drive') || (lastField.includes('drive') && lastField.includes('trabajo'))) {
        return 'Carpeta de Trabajo';
      }
    }
    return url;
  };

  const CopyUrlButton = ({ url }: { url: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Enlace copiado al portapapeles' });
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center p-0.5 ml-1 rounded hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-700 transition-colors align-middle"
        title="Copiar enlace al portapapeles"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    );
  };

  const renderDescription = (desc: string) => {
    const parts: (string | JSX.Element)[] = [];
    if (!desc) return parts;
    const regex = /\[([^\][]*?)\]\((.*?)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s*]+)/gi;
    let lastIndex = 0; let match;
    while ((match = regex.exec(desc)) !== null) {
        if (match.index > lastIndex) parts.push(desc.substring(lastIndex, match.index));
        const [full, linkT, linkU, boldT, rawUrl] = match;
        if (linkT && linkU) {
            const isD = isDriveFolder(linkU);
            const textBefore = desc.substring(0, match.index);
            const displayText = getUrlAlias(linkU, textBefore, linkT);
            const isAlias = displayText === 'Carpeta del Proyectista' || displayText === 'Carpeta de Trabajo';
            parts.push(
              <span key={`link-${match.index}`} className="inline-flex items-center">
                <a 
                  href={linkU} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium my-0.5 transition-colors", isD ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:text-foreground")}
                  title={`Abrir ${linkU}`}
                >
                  {isD ? <Folder className="h-3.5 w-3.5 text-amber-500" /> : <LinkIcon className="h-3 w-3" />} {displayText}
                </a>
                {isAlias && <CopyUrlButton url={linkU} />}
              </span>
            );
        } else if (boldT) {
            const trimmedBold = boldT.trim();
            if (/^https?:\/\//i.test(trimmedBold)) {
                const isD = isDriveFolder(trimmedBold);
                const textBefore = desc.substring(0, match.index);
                const displayText = getUrlAlias(trimmedBold, textBefore);
                const isAlias = displayText === 'Carpeta del Proyectista' || displayText === 'Carpeta de Trabajo';
                parts.push(
                  <span key={`bold-${match.index}`} className="inline-flex items-center">
                    <a
                      href={trimmedBold}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary/80 break-all transition-colors cursor-pointer"
                      title={`Abrir ${trimmedBold}`}
                    >
                      {isD ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500 inline" /> : <ExternalLink className="h-3 w-3 shrink-0 inline" />}
                      <span>{displayText}</span>
                    </a>
                    {isAlias && <CopyUrlButton url={trimmedBold} />}
                  </span>
                );
            } else {
                const names = boldT.split(';').map(n => n.trim());
                names.forEach((name, idx) => {
                    if (/^https?:\/\//i.test(name)) {
                        const isD = isDriveFolder(name);
                        const textBefore = desc.substring(0, match.index);
                        const displayText = getUrlAlias(name, textBefore);
                        const isAlias = displayText === 'Carpeta del Proyectista' || displayText === 'Carpeta de Trabajo';
                        parts.push(
                          <span key={`bold-name-${match.index}-${idx}`} className="inline-flex items-center">
                            <a
                              href={name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary/80 break-all transition-colors cursor-pointer"
                              title={`Abrir ${name}`}
                            >
                              {isD ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500 inline" /> : <ExternalLink className="h-3 w-3 shrink-0 inline" />}
                              <span>{displayText}</span>
                            </a>
                            {isAlias && <CopyUrlButton url={name} />}
                          </span>
                        );
                    } else {
                        const part = WHITELIST.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
                        if (part) parts.push(<ParticipantBadge key={`${match.index}-${idx}`} participant={part} userEmail={user?.email || null} />);
                        else parts.push(<strong key={`${match.index}-${idx}`}>{name}</strong>);
                    }
                    if (idx < names.length - 1) parts.push("; ");
                });
            }
        } else if (rawUrl) {
            let cleanUrl = rawUrl.replace(/[.,);]+$/, '');
            let trailing = rawUrl.slice(cleanUrl.length);
            const isD = isDriveFolder(cleanUrl);
            const textBefore = desc.substring(0, match.index);
            const displayText = getUrlAlias(cleanUrl, textBefore);
            const isAlias = displayText === 'Carpeta del Proyectista' || displayText === 'Carpeta de Trabajo';
            parts.push(
              <span key={`raw-${match.index}`} className="inline-flex items-center">
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary/80 break-all transition-colors cursor-pointer"
                  title={`Abrir ${cleanUrl}`}
                >
                  {isD ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500 inline" /> : <ExternalLink className="h-3 w-3 shrink-0 inline" />}
                  <span>{displayText}</span>
                </a>
                {isAlias && <CopyUrlButton url={cleanUrl} />}
              </span>
            );
            if (trailing) parts.push(trailing);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < desc.length) parts.push(desc.substring(lastIndex));
    return parts;
  };

  useEffect(() => {
    const loadContent = async () => {
        if (inspectionPath.length === 0) {
            setFolderContents([]);
            setNextPageToken(null);
            return;
        }
        setIsInspecting(true);
        try {
            const current = inspectionPath[inspectionPath.length - 1];
            if (current.id === 'virtual-external') {
                const ext = (selectedCard?.attachments || []).filter(a => !isAnyDriveResource(a.url));
                setFolderContents(ext.map(a => ({ id: a.id, name: a.name, webViewLink: a.url, mimeType: 'external-link' })));
                setNextPageToken(null);
            } else {
                const res = await listFolderContents(current.id);
                setFolderContents(res.files);
                setNextPageToken(res.nextPageToken);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsInspecting(false);
        }
    };
    loadContent();
  }, [inspectionPath, selectedCard]);

  const handleLocationSelect = (lon: number, lat: number, zoom: number) => {
    setEditCoordinadas(`[${lon.toFixed(6)}, ${lat.toFixed(6)}, ${zoom}]`);
  };

  const initialLocation = useMemo(() => {
    if (editCoordinadas) {
      const match = editCoordinadas.match(/\[(.*?),(.*?),(.*?)\]/);
      if (match) {
        return {
          lon: parseFloat(match[1]),
          lat: parseFloat(match[2]),
          zoom: parseFloat(match[3]),
        };
      }
    }
    return undefined;
  }, [editCoordinadas]);

  return (
    <div className="flex w-full flex-col">
      <div className="relative w-full">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Textarea ref={inputRef} value={query} onFocus={() => { if (query && (!selectedCard || query !== selectedCard.name)) setIsOpen(true); }} onChange={(e) => { setQuery(e.target.value); if (e.target.value.length > 0 && (!selectedCard || e.target.value !== selectedCard.name)) setIsOpen(true); else setIsOpen(false); }} placeholder={isLoadingCards ? 'Cargando tarjetas...' : 'Buscá un proyecto por palabra clave, código, nominado...'} className="w-full min-h-20 bg-white text-foreground pr-10 text-xs border-2 focus-visible:ring-primary shadow-sm" autoComplete="off" />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-0 shadow-2xl bg-white" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command className="bg-white">
              <CommandList className="max-h-[300px] p-2">
                {filteredCards.length === 0 && query.length > 0 && (!selectedCard || query !== selectedCard.name) && <CommandEmpty className="text-muted-foreground py-4 text-center text-xs">No hay resultados.</CommandEmpty>}
                <CommandGroup>{filteredCards.map(c => <CommandItem key={c.id} onSelect={() => handleSelect(c)} className="cursor-pointer text-[11px] mb-1 p-2 rounded-md transition-all" style={trelloColorToStyle(c.cover?.color)}><span className="whitespace-normal leading-tight">{c.name}</span></CommandItem>)}</CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {query && <Button variant="ghost" size="icon" onClick={onClear} className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground h-8 w-8"><X className="h-5 w-5" /></Button>}
      </div>

      {selectedCard && (
        <DialogUI open={isSummaryOpen} onOpenChange={(open) => { if (!open) { setIsEditing(false); setIsRawEditing(false); } onSummaryOpenChange(open); }}>
            <DialogContent className="p-0 max-w-2xl w-[95vw] md:w-full border-0 bg-white h-[85vh] flex flex-col gap-0 shadow-2xl fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:rounded-xl overflow-hidden text-black">
                {(isRefreshing || isActivityLoading) && <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
                
                <DialogHeader style={{ backgroundColor: trelloCoverColors.find(c => c.name === selectedCard.cover?.color)?.hex || '#4d95ca', color: ['yellow', 'lime', 'sky'].includes(selectedCard.cover?.color || '') ? '#172b4d' : 'white' }} className="p-5 shrink-0 relative">
                    <div className="flex flex-col gap-3 pr-12">
                        {isEditing ? <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-base font-semibold bg-white/10 text-inherit border-white/30 h-auto p-2" /> : <DialogTitle className="text-sm md:text-base font-bold">{selectedCard.name}</DialogTitle>}
                        <div className="flex flex-wrap gap-1.5">{(selectedCard.labels || []).map(l => <Badge key={l.id} className="text-[9px] h-5" style={{ backgroundColor: l.color ? trelloCoverColors.find(c => c.name === l.color)?.hex || '#ccc' : '#ccc', color: 'white' }}>{l.name}</Badge>)}</div>
                        {!isEditing && !isRawEditing && (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={handlePrintCard} title="Imprimir"><Printer className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={handleEditClick} title="Editar"><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={fetchCardData} disabled={isRefreshing} title="Sincronizar"><RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /></Button>
                                <a href={selectedCard.url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" title="Ver en Trello"><ExternalLink className="h-4 w-4" /></Button>
                                </a>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={handleRawEditClick} title="Edición RAW"><Settings className="h-4 w-4" /></Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {looseFiles.length > 0 && <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between"><div className="flex items-center gap-2 text-amber-800 text-[10px] font-bold uppercase"><AlertTriangle className="h-3.5 w-3.5" /><span>{looseFiles.length} archivos antiguos fuera de estructura</span></div><Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setIsReorgAssistantOpen(true)}>Reorganizar</Button></div>}

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        {isRawEditing ? (
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-zinc-500">Edición de Texto Puro</Label>
                                <Textarea value={rawDescription} onChange={(e) => setRawDescription(e.target.value)} className="min-h-[400px] text-xs font-mono bg-zinc-50 text-black" />
                                <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">Cuidado: el borrado de prefijos (·) puede afectar el motor de campos estructurados.</p>
                            </div>
                        ) : isEditing ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Estado</Label><Select value={editEstado} onValueChange={setEditEstado}><SelectTrigger className="h-8 text-xs bg-white text-black"><SelectValue /></SelectTrigger><SelectContent>{ESTADOS_PROYECTO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Partido/s</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editPartidos.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{MUNICIPIOS.map(m => <DropdownMenuCheckboxItem key={m} checked={editPartidos.includes(m)} onCheckedChange={c => setEditPartidos(curr => c ? [...curr, m] : curr.filter(x => x !== m))} onSelect={e => e.preventDefault()}>{m}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Referencia Geográfica</Label>
                                      <div className="flex gap-2">
                                        <Input value={editReferencia} onChange={(e) => setEditReferencia(e.target.value)} className="h-8 text-xs bg-white text-black" />
                                        <Button 
                                          type="button" 
                                          variant="outline" 
                                          size="icon" 
                                          className={cn("h-8 w-8 shrink-0", editCoordinadas && "bg-primary/10 border-primary text-primary")}
                                          onClick={() => setIsLocationPickerOpen(true)}
                                        >
                                          <Crosshair className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                      {editCoordinadas && <p className="text-[9px] text-primary font-bold italic">Vista guardada: {editCoordinadas}</p>}
                                    </div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Extensión (Ha o Km)</Label><Input value={editExtension} onChange={(e) => setEditExtension(e.target.value)} className="h-8 text-xs bg-white text-black" placeholder="Ha o Km" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Población</Label><Input value={editPoblacion} onChange={(e) => setEditPoblacion(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Presupuesto</Label><Input value={editPresupuesto} onChange={(e) => setEditPresupuesto(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Financiamiento</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editFinanciamiento.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{FINANCIAMIENTO.map(f => <DropdownMenuCheckboxItem key={f} checked={editFinanciamiento.includes(f)} onCheckedChange={c => setEditFinanciamiento(curr => c ? [...curr, f] : curr.filter(x => x !== f))} onSelect={e => e.preventDefault()}>{f}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label className="text-[10px] font-bold text-primary">DEA</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editEquipo.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{EQUIPO_DEA.map(p => <DropdownMenuCheckboxItem key={p} checked={editEquipo.includes(p)} onCheckedChange={c => setEditEquipo(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-bold text-primary">SIG</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editSig.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{EQUIPO_SIG.map(p => <DropdownMenuCheckboxItem key={p} checked={editSig.includes(p)} onCheckedChange={c => setEditSig(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-bold text-primary">Dron</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editDron.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{EQUIPO_DRON.map(p => <DropdownMenuCheckboxItem key={p} checked={editDron.includes(p)} onCheckedChange={c => setEditDron(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-bold text-primary">Seguimiento</Label><Input value={editSeguimiento} onChange={(e) => setEditSeguimiento(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="col-span-2 space-y-1"><Label className="text-[10px] font-bold text-primary">Proyectista/s</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{editProyectistas.length} sel. <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-48 overflow-y-auto">{PROYECTISTAS.map(p => <DropdownMenuCheckboxItem key={p} checked={editProyectistas.includes(p)} onCheckedChange={c => setEditProyectistas(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Expediente</Label><Input value={editExpediente} onChange={(e) => setEditExpediente(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Providencia</Label><Input value={editProvidencia} onChange={(e) => setEditProvidencia(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Resolución</Label><Input value={editResolucion} onChange={(e) => setEditResolucion(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha DIA</Label><Input value={editFechaDia} onChange={(e) => setEditFechaDia(e.target.value)} className="h-8 text-xs bg-white text-black" placeholder="DD/MM/AAAA" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Contratista</Label><Input value={editContratista} onChange={(e) => setEditContratista(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Resp. Ambiental</Label><Input value={editRespAmbiental} onChange={(e) => setEditRespAmbiental(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="col-span-3 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Otro Drive Trabajo</Label><Input value={editOtroDrive} onChange={(e) => setEditOtroDrive(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                    <div className="col-span-3 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Drive Proyectista</Label><Input value={editDriveProyectista} onChange={(e) => setEditDriveProyectista(e.target.value)} className="h-8 text-xs bg-white text-black" /></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Descripción Técnica</h3>
                                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{renderDescription(selectedCard.desc)}</div>
                                
                                {sortedAttachments.length > 0 && (
                                    <div className="mt-8 space-y-4">
                                        <Separator />
                                        <div className="flex items-center gap-2 h-7">
                                            {inspectionPath.length > 0 ? (
                                                <>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 bg-zinc-100 hover:bg-zinc-200 transition-colors" 
                                                        onClick={() => setInspectionPath(prev => prev.slice(0, -1))}
                                                    >
                                                        <ChevronLeft className="h-4 w-4 text-primary" />
                                                    </Button>
                                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary truncate flex-1">
                                                        {inspectionPath[inspectionPath.length - 1].name}
                                                    </h3>
                                                    {inspectionPath[0]?.name !== 'Línea de Tiempo' && inspectionPath[inspectionPath.length - 1].id !== 'virtual-external' && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Button 
                                                                size="icon" 
                                                                variant="outline" 
                                                                className="h-7 w-7 border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-black shrink-0"
                                                                onClick={() => { setNewSubfolderName(''); setIsCreateFolderOpen(true); }}
                                                                title="Crear nueva carpeta"
                                                            >
                                                                <FolderPlus className="h-3.5 w-3.5 text-amber-600" />
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="outline" 
                                                                        className="h-7 w-7 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                                                                        title="Subir archivos o carpetas"
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="text-xs cursor-pointer">
                                                                        <FileText className="h-4 w-4 mr-2 text-zinc-500" />
                                                                        Subir archivo(s)...
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => folderInputRef.current?.click()} className="text-xs cursor-pointer">
                                                                        <Folder className="h-4 w-4 mr-2 text-amber-500" />
                                                                        Subir carpeta...
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => { setNewSubfolderName(''); setIsCreateFolderOpen(true); }} className="text-xs cursor-pointer">
                                                                        <FolderPlus className="h-4 w-4 mr-2 text-amber-600" />
                                                                        Crear nueva carpeta...
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                                    PORTALES DE ARCHIVOS ({sortedAttachments.length})
                                                </h3>
                                            )}
                                        </div>

                                        {/* Aclaración institucional según el portal de archivos inspeccionado */}
                                        {inspectionPath.length > 0 && inspectionPath[0]?.name === 'Línea de Tiempo' ? (
                                            <div className="flex items-start gap-2 p-2 bg-blue-50/80 border border-blue-200/90 rounded-md text-[11px] text-blue-900 leading-tight">
                                                <History className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                                                <span>
                                                    <strong>Línea de Tiempo (Solo Descarga):</strong> Repositorio institucional de documentación final. Para incorporar entregables finales a un hito, acceda al módulo <strong>Línea de Tiempo</strong>.
                                                </span>
                                            </div>
                                        ) : inspectionPath.length > 0 && inspectionPath[inspectionPath.length - 1].id !== 'virtual-external' ? (
                                            <div className="flex items-start gap-2 p-2 bg-amber-50/80 border border-amber-200/90 rounded-md text-[11px] text-amber-900 leading-tight">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                                                <span>
                                                    <strong>Solo archivos de trabajo:</strong> Arrastre archivos o carpetas aquí para subirlos a esta carpeta. Para documentación final entregable, utilice la <strong>Línea de Tiempo</strong>.
                                                </span>
                                            </div>
                                        ) : null}

                                        <div 
                                            className={cn(
                                                "relative transition-all duration-200 rounded-lg min-h-[100px]",
                                                inspectionPath.length > 0 && inspectionPath[0]?.name !== 'Línea de Tiempo' && inspectionPath[inspectionPath.length - 1].id !== 'virtual-external' && "border-2 border-dashed",
                                                inspectionPath.length > 0 && inspectionPath[0]?.name !== 'Línea de Tiempo' && (isDraggingFiles ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-transparent hover:border-zinc-200"),
                                                isInspecting && "pointer-events-none"
                                            )}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            {/* Overlay visual al arrastrar archivos */}
                                            {isDraggingFiles && inspectionPath.length > 0 && inspectionPath[0]?.name !== 'Línea de Tiempo' && (
                                                <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center gap-2 backdrop-blur-[1px] p-4 text-center pointer-events-none">
                                                    <UploadCloud className="h-8 w-8 text-primary animate-bounce" />
                                                    <p className="text-xs font-semibold text-primary">Soltá los archivos o carpetas de trabajo aquí</p>
                                                    <p className="text-[10px] text-muted-foreground">Destino: {inspectionPath[inspectionPath.length - 1].name}</p>
                                                </div>
                                            )}

                                            {/* Inputs ocultos para subida por clic */}
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                multiple 
                                                className="hidden" 
                                                onChange={handleFileInputChange} 
                                            />
                                            <input 
                                                type="file" 
                                                ref={folderInputRef} 
                                                // @ts-ignore
                                                webkitdirectory="" 
                                                // @ts-ignore
                                                directory="" 
                                                multiple 
                                                className="hidden" 
                                                onChange={handleFolderInputChange} 
                                            />

                                            {isInspecting ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                                                <div className="space-y-0.5">
                                                    {inspectionPath.length === 0 ? sortedAttachments.map(att => {
                                                        const isTL = att.name === 'Línea de Tiempo';
                                                        const isExt = att.id === 'virtual-external';
                                                        const extCount = (selectedCard?.attachments || []).filter(a => !isAnyDriveResource(a.url)).length;
                                                        
                                                        return (
                                                            <ContextMenu key={att.id}>
                                                                <ContextMenuTrigger asChild>
                                                                    <button onClick={async () => { 
                                                                        const id = await extractIdFromUrl(att.url);
                                                                        if (id || isExt) setInspectionPath(prev => [...prev, { id: id || 'virtual-external', name: att.name }]);
                                                                    }} className="flex items-center gap-2.5 py-1.5 px-3 bg-white border border-transparent rounded-lg hover:bg-zinc-100 transition-all w-full text-left group">
                                                                        {isTL ? <History className="h-4 w-4 text-primary" /> : isExt ? <LinkIcon className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-amber-600" />}
                                                                        <div className="flex-1 flex flex-col gap-0 overflow-hidden">
                                                                            <span className="text-xs font-bold truncate text-black">{att.name}</span>
                                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                                                                {isTL ? 'DOCUMENTACIÓN FINAL • SOLO DESCARGA' : isExt ? `BIBLIOGRAFÍA Y RECURSOS • ${extCount} ENLACES` : ''}
                                                                            </span>
                                                                        </div>
                                                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-300 -rotate-90" />
                                                                    </button>
                                                                </ContextMenuTrigger>
                                                                <ContextMenuContent>
                                                                    {!isTL && <ContextMenuItem onSelect={() => window.open(att.url, '_blank')}>Abrir en Drive</ContextMenuItem>}
                                                                </ContextMenuContent>
                                                            </ContextMenu>
                                                        );
                                                    }) : folderContents.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center p-6 text-center gap-2 border border-dashed rounded-lg bg-zinc-50/50">
                                                            <Folder className="h-8 w-8 text-zinc-300" />
                                                            <p className="text-xs font-medium text-zinc-600">Carpeta vacía</p>
                                                            {inspectionPath[0]?.name !== 'Línea de Tiempo' && inspectionPath[inspectionPath.length - 1].id !== 'virtual-external' ? (
                                                                <p className="text-[11px] text-muted-foreground max-w-xs">
                                                                    Arrastrá archivos o carpetas aquí, o utilizá el botón <strong>Subir</strong>. Solo archivos de trabajo.
                                                                </p>
                                                            ) : (
                                                                <p className="text-[11px] text-muted-foreground max-w-xs">
                                                                    No hay archivos registrados en esta carpeta.
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : folderContents.map(f => {
                                                        const isTL = inspectionPath[0]?.name === 'Línea de Tiempo';
                                                        const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                                                        const isWord = !isFolder && isWordDocument(f.name, f.mimeType);
                                                        const canOpenInDrive = !isTL;
                                                        const hasDownload = !isFolder && (f.webContentLink || f.id);
                                                        const showMenu = canOpenInDrive || hasDownload;

                                                        const handleItemClick = () => {
                                                            if (isFolder) {
                                                                setInspectionPath(p => [...p, { id: f.id, name: f.name }]);
                                                            } else if (isWord) {
                                                                setWordDocToDownload(f);
                                                            } else if (canOpenInDrive) {
                                                                window.open(f.webViewLink, '_blank');
                                                            }
                                                        };

                                                        const itemContent = (
                                                            <div className="flex items-center justify-between p-1.5 bg-white rounded border border-transparent transition-all cursor-pointer hover:bg-zinc-100" onClick={handleItemClick}>
                                                                <div className="flex items-center gap-2 truncate flex-1">
                                                                    {isFolder ? (
                                                                        <Folder className="h-3.5 w-3.5 text-primary" />
                                                                    ) : isWord ? (
                                                                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                                                                    ) : (
                                                                        <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                                                    )}
                                                                    <span className={cn("text-[11px] truncate", isWord && "font-medium text-zinc-800")}>{f.name}</span>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    {hasDownload && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-7 w-7 text-zinc-500 hover:text-black" 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                const dUrl = f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`;
                                                                                window.open(dUrl, '_blank'); 
                                                                            }}
                                                                            title="Descargar archivo"
                                                                        >
                                                                            <Download className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    {canOpenInDrive && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-7 w-7 text-zinc-500 hover:text-black" 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                if (isWord) {
                                                                                    setWordDocToDownload(f);
                                                                                } else {
                                                                                    window.open(f.webViewLink, '_blank'); 
                                                                                }
                                                                            }}
                                                                            title={isWord ? "Documento de Word (requiere descarga)" : "Abrir en Drive"}
                                                                        >
                                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );

                                                        if (!showMenu) return <div key={f.id}>{itemContent}</div>;

                                                        return (
                                                            <ContextMenu key={f.id}>
                                                                <ContextMenuTrigger asChild>
                                                                    {itemContent}
                                                                </ContextMenuTrigger>
                                                                <ContextMenuContent>
                                                                    {canOpenInDrive && (
                                                                        <ContextMenuItem onSelect={() => {
                                                                            if (isWord) {
                                                                                setWordDocToDownload(f);
                                                                            } else {
                                                                                window.open(f.webViewLink, '_blank');
                                                                            }
                                                                        }}>
                                                                            {isWord ? "Descargar para editar (Word)" : "Abrir en Drive"}
                                                                        </ContextMenuItem>
                                                                    )}
                                                                    {hasDownload && (
                                                                        <ContextMenuItem onSelect={() => {
                                                                            const dUrl = f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`;
                                                                            window.open(dUrl, '_blank');
                                                                        }}>
                                                                            Descargar
                                                                        </ContextMenuItem>
                                                                    )}
                                                                </ContextMenuContent>
                                                            </ContextMenu>
                                                        );
                                                    })}
                                                    {nextPageToken && <Button variant="ghost" size="sm" className="w-full text-[9px]" onClick={async () => { setIsLoadingMore(true); try { const r = await listFolderContents(inspectionPath[inspectionPath.length-1].id, nextPageToken); setFolderContents(p => [...p, ...r.files]); setNextPageToken(r.nextPageToken); } finally { setIsLoadingMore(false); } }}>{isLoadingMore ? 'Cargando...' : 'Ver más'}</Button>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!isEditing && !isRawEditing && (
                        <div className="px-6 pb-6 space-y-4">
                            <Separator />
                            <div className="flex gap-2"><Textarea placeholder="Comentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isCommenting} className="text-xs h-16 flex-1 text-black" /><Button onClick={handlePostComment} disabled={!newComment.trim() || isCommenting} size="icon" className="h-16 w-12"><Send className="h-4 w-4" /></Button></div>
                            <div className="space-y-4">{activity.filter(a => a.type === 'commentCard').map(a => (<div key={a.id} className="flex gap-3 text-xs"><Avatar className="h-6 w-6 border"><AvatarFallback className="text-[10px]">{a.memberCreator?.fullName?.charAt(0)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-semibold">{a.memberCreator?.fullName}</span><span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(a.date), { locale: es, addSuffix: true })}</span></div><div className="bg-muted p-2 rounded-md whitespace-pre-wrap">{a.data.text}</div></div></div>))}</div>
                        </div>
                    )}
                </ScrollArea>

                {(isEditing || isRawEditing) && (
                    <DialogFooter className="border-t p-4 gap-2 bg-white shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setIsRawEditing(false); }}>Cancelar</Button>
                        <Button size="sm" onClick={isRawEditing ? handleSaveRawEdit : handleSaveEdit} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</Button>
                    </DialogFooter>
                )}

                {selectedCard && inspectionPath.length > 0 && (
                  <UploadWorkingFilesDialog
                    isOpen={isUploadDialogOpen}
                    onOpenChange={setIsUploadDialogOpen}
                    selectedCard={selectedCard}
                    currentFolder={inspectionPath[inspectionPath.length - 1]}
                    files={pendingUploadFiles}
                    onUploadSuccess={() => {
                      const current = inspectionPath[inspectionPath.length - 1];
                      if (current && current.id !== 'virtual-external') {
                        listFolderContents(current.id)
                          .then((res) => {
                            setFolderContents(res.files);
                            setNextPageToken(res.nextPageToken);
                          })
                          .catch(console.error);
                      }
                      fetchCardData();
                    }}
                  />
                )}

                <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                    <DialogContent className="max-w-sm p-5">
                        <DialogHeader>
                            <div className="flex items-center gap-2 text-amber-600">
                                <FolderPlus className="h-5 w-5" />
                                <DialogTitle className="text-sm font-bold">Crear Nueva Carpeta</DialogTitle>
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Se creará dentro de: <strong className="text-foreground">{inspectionPath[inspectionPath.length - 1]?.name}</strong>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                            <Label className="text-xs font-semibold">Nombre de la carpeta</Label>
                            <Input 
                                value={newSubfolderName} 
                                onChange={(e) => setNewSubfolderName(e.target.value)} 
                                placeholder="Ej: Planos 2026" 
                                className="h-9 text-xs" 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateSubfolder();
                                    }
                                }}
                                disabled={isCreatingSubfolder}
                                autoFocus
                            />
                        </div>
                        <DialogFooter className="pt-2 gap-2 flex items-center justify-end">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs h-8" 
                                onClick={() => setIsCreateFolderOpen(false)}
                                disabled={isCreatingSubfolder}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                size="sm" 
                                className="text-xs h-8 gap-1.5" 
                                onClick={handleCreateSubfolder}
                                disabled={isCreatingSubfolder || !newSubfolderName.trim()}
                            >
                                {isCreatingSubfolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                                Crear Carpeta
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <LocationPicker 
                  isOpen={isLocationPickerOpen}
                  onOpenChange={setIsLocationPickerOpen}
                  onSelect={handleLocationSelect}
                  initialLon={initialLocation?.lon}
                  initialLat={initialLocation?.lat}
                  initialZoom={initialLocation?.zoom}
                />
            </DialogContent>
        </DialogUI>
      )}

      {/* Modal sobrio para advertencia de documentos Word (.doc / .docx) */}
      <Dialog open={!!wordDocToDownload} onOpenChange={(open) => !open && setWordDocToDownload(null)}>
        <DialogContent className="w-[92vw] max-w-md p-6 bg-white border border-zinc-200 shadow-2xl rounded-xl overflow-hidden box-border">
          <DialogHeader className="space-y-3 text-left w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-3 w-full min-w-0">
              <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <DialogTitle className="text-base font-bold text-zinc-900 leading-tight">
                  Documento de Word
                </DialogTitle>
                <p 
                  className="text-[11px] text-zinc-500 truncate font-mono mt-0.5 block w-full max-w-full" 
                  title={wordDocToDownload?.name}
                >
                  {wordDocToDownload?.name}
                </p>
              </div>
            </div>
            <DialogDescription className="text-xs text-zinc-600 leading-relaxed pt-1 text-left w-full break-words">
              Para preservar el formato, estilos y tablas originales de este archivo, no se debe abrir en Google Docs ya que altera su estructura.
              <br /><br />
              Te recomendamos <strong>descargarlo</strong> para trabajar y editarlo directamente con <strong>Microsoft Word</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-4 border-t border-zinc-100 sm:space-x-0 w-full mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9 px-4 text-zinc-700 hover:bg-zinc-100"
              onClick={() => setWordDocToDownload(null)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-9 px-4 bg-primary hover:bg-primary/90 text-white font-medium flex items-center gap-1.5"
              onClick={() => {
                if (wordDocToDownload) {
                  const downloadUrl = wordDocToDownload.webContentLink || `https://drive.google.com/uc?export=download&id=${wordDocToDownload.id}`;
                  window.open(downloadUrl, '_blank');
                }
                setWordDocToDownload(null);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCard && <ReorganizationAssistant isOpen={isReorgAssistantOpen} onOpenChange={setIsReorgAssistantOpen} looseFiles={looseFiles} projectId={selectedCard.id} projectName={selectedCard.name} onReorganized={(moved) => { moved.forEach(id => recentlyMovedIds.current.add(id)); setLooseFiles(p => p.filter(f => !moved.includes(f.id))); setIsReorgAssistantOpen(false); setTimeout(() => fetchCardData(), 4000); }} />}
    </div>
  );
}
