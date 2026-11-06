'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS, RECURSOS_PROPIOS, type Recurso, type RecursoPropio } from '@/lib/recursos';
import { Link2, Search, X, Globe, Database, BookText, ChevronDown, ChevronLeft, Pin, Paperclip, Trash2, Folder as FolderIcon, FileText, Library, Plus, Link as LinkIcon, Loader2, UploadCloud, ExternalLink, AlertTriangle, Calendar, Download, FileDown, Info, Pencil, Save, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { searchElsevier, type ElsevierArticle } from '@/services/elsevier';
import { searchSNRD, type SNRDArticle } from '@/services/snrd';
import { searchCrossref, type CrossrefArticle } from '@/services/crossref';
import { searchPlos, type PlosArticle } from '@/services/plos';
import { searchDoaj, type DoajArticle } from '@/services/doaj';
import { searchScielo, type ScieloArticle } from '@/services/scielo';
import { searchOpenAlex, type OpenAlexArticle } from '@/services/openalex';
import { searchEuropePMC, type EuropePMCArticle } from '@/services/europepmc';
import { addAttachmentToTrelloCard, removeAttachmentFromTrelloCard, type TrelloCard } from '@/services/trello';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedCard: TrelloCard | null;
  onCardUpdate: (card: TrelloCard) => void;
}

interface PinnedResource {
  title: string;
  url: string;
  authors?: string | string[];
  publication?: string;
  attachmentId?: string;
  isScientific?: boolean;
}

interface ReferenceFolderFile {
  name: string;
  url: string;
  size: number;
  sizeFormatted?: string;
  format?: string;
  comments?: string;
  driveId?: string;
}

interface ReferenceDocumentItem {
  id: string;
  title: string;
  comments: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedByEmail: string;
  createdAt: string;
  isFolder?: boolean;
  folderDriveUrl?: string;
  folderFiles?: ReferenceFolderFile[];
}

interface MiscellaneousCardItem {
  id: string;
  name: string;
  desc: string;
  url: string;
  boardId: string;
  boardName: string;
  idList: string;
  listName: string;
  closed: boolean;
  attachments: {
    id: string;
    name: string;
    url: string;
    originalTrelloUrl?: string;
    bytes?: number;
    mimeType?: string;
  }[];
  hasReferenceDocs?: boolean;
  createdAt: string;
  dateLastActivity: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatUploadDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function splitFileNameAndExt(fileName: string): { base: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return { base: fileName, ext: '' };
  return {
    base: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot),
  };
}

function stripNumberSuffix(baseName: string): string {
  return baseName.replace(/\s*\(\d+\)$/, '').trim();
}

function getNextEnumeratedFileName(originalFileName: string, existingDocs: ReferenceDocumentItem[]): string {
  const { base, ext } = splitFileNameAndExt(originalFileName);
  const cleanBase = stripNumberSuffix(base);
  const existingNames = new Set(existingDocs.map(d => (d.fileName || '').toLowerCase().trim()));

  let counter = 1;
  while (true) {
    const candidate = `${cleanBase} (${counter})${ext}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const SkeletonLoader = () => (
    <div className="flex flex-col gap-2 px-2 mt-2">
        {[...Array(2)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-2 rounded-md bg-muted/20">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
            </div>
        ))}
    </div>
);

const isScientificUrl = (url: string): boolean => {
  if (!url) return false;
  const scientificDomains = [
    'doi.org',
    'sciencedirect.com',
    'scielo.org',
    'repositoriosdigitales.mincyt.gob.ar',
    'elsevier.com',
    'journals.plos.org',
    'doaj.org',
    'openalex.org',
    'europepmc.org',
  ];
  try {
    const { hostname } = new URL(url);
    return scientificDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
};


export default function ResourceLibrary({ isOpen, onOpenChange, selectedCard, onCardUpdate }: ResourceLibraryProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedResources, setPinnedResources] = useState<PinnedResource[]>([]);
  const [elsevierResults, setElsevierResults] = useState<ElsevierArticle[]>([]);
  const [snrdResults, setSnrdResults] = useState<SNRDArticle[]>([]);
  const [crossrefResults, setCrossrefResults] = useState<CrossrefArticle[]>([]);
  const [plosResults, setPlosResults] = useState<PlosArticle[]>([]);
  const [doajResults, setDoajResults] = useState<DoajArticle[]>([]);
  const [scieloResults, setScieloResults] = useState<ScieloArticle[]>([]);
  const [openAlexResults, setOpenAlexResults] = useState<OpenAlexArticle[]>([]);
  const [europePmcResults, setEuropePmcResults] = useState<EuropePMCArticle[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');

  // Estado para Documentación de Referencia
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDocumentItem[]>([]);
  const [isLoadingRefDocs, setIsLoadingRefDocs] = useState(false);
  const [refSearchQuery, setRefSearchQuery] = useState('');
  const [activeRefFolder, setActiveRefFolder] = useState<ReferenceDocumentItem | null>(null);
  const [refFolderSearchQuery, setRefFolderSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadComments, setUploadComments] = useState('');
  const [isDraggingRefFile, setIsDraggingRefFile] = useState(false);
  const [isUploadingRefDoc, setIsUploadingRefDoc] = useState(false);
  const [uploadRefProgress, setUploadRefProgress] = useState(0);
  const [duplicateCandidate, setDuplicateCandidate] = useState<ReferenceDocumentItem | null>(null);
  const [deletingRefDocId, setDeletingRefDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<ReferenceDocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadCancelledRef = useRef<boolean>(false);

  // Estado para Misceláneas (Tarjetas No-Proyecto de Trello)
  const [miscCards, setMiscCards] = useState<MiscellaneousCardItem[]>([]);
  const [isLoadingMiscCards, setIsLoadingMiscCards] = useState(false);
  const [miscSearchQuery, setMiscSearchQuery] = useState('');

  // Estado para el modal de advertencia y descarga de archivos únicos
  const [downloadWarningTarget, setDownloadWarningTarget] = useState<{
    title: string;
    fileName: string;
    url: string;
    fileSize?: number;
  } | null>(null);

  // Estado para Recursos Internos y su edición
  const [internalResources, setInternalResources] = useState<RecursoPropio[]>(RECURSOS_PROPIOS);
  const [isLoadingInternalResources, setIsLoadingInternalResources] = useState(false);
  const [selectedResourceInfo, setSelectedResourceInfo] = useState<RecursoPropio | null>(null);
  const [isEditingResource, setIsEditingResource] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDriveUrl, setEditDriveUrl] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExecuteDownload = useCallback(async (url: string, fileName: string) => {
    if (!url) {
      toast({
        variant: 'destructive',
        title: 'Enlace no disponible',
        description: 'No se encontró la dirección de descarga del archivo.',
      });
      return;
    }

    toast({
      title: 'Iniciando descarga',
      description: `Descargando "${fileName || 'archivo'}"...`,
    });

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch error ' + res.status);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch {
      // Fallback a navegación directa para enlaces externos o con restricciones CORS
      const a = document.createElement('a');
      a.href = url;
      if (fileName) a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [toast]);

  const fetchReferenceDocs = useCallback(async () => {
    setIsLoadingRefDocs(true);
    try {
      const res = await fetch('/api/reference-docs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setReferenceDocs(data.documents || []);
      }
    } catch (error) {
      console.error('Error cargando Documentación de Referencia:', error);
    } finally {
      setIsLoadingRefDocs(false);
    }
  }, []);

  const fetchMiscCards = useCallback(async () => {
    setIsLoadingMiscCards(true);
    try {
      const res = await fetch('/api/miscellaneous-cards', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMiscCards(data.cards || []);
      }
    } catch (error) {
      console.error('Error cargando Misceláneas:', error);
    } finally {
      setIsLoadingMiscCards(false);
    }
  }, []);

  const fetchInternalResources = useCallback(async () => {
    setIsLoadingInternalResources(true);
    try {
      const res = await fetch('/api/internal-resources', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.resources && Array.isArray(data.resources)) {
          setInternalResources(data.resources);
        }
      }
    } catch (error) {
      console.error('Error cargando Recursos Internos:', error);
    } finally {
      setIsLoadingInternalResources(false);
    }
  }, []);

  const handleSaveResource = useCallback(async () => {
    if (!selectedResourceInfo) return;
    if (!editTitle.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título requerido',
        description: 'El título del recurso no puede quedar vacío.',
      });
      return;
    }

    setIsSavingResource(true);
    try {
      let updated: RecursoPropio;

      if (newVersionFile) {
        const formData = new FormData();
        formData.append('id', selectedResourceInfo.id);
        formData.append('file', newVersionFile);
        formData.append('title', editTitle.trim());
        formData.append('description', editDescription.trim());

        const res = await fetch('/api/internal-resources', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir nueva versión');
        }
        const data = await res.json();
        updated = data.resource;
      } else {
        const payload: Record<string, any> = {
          id: selectedResourceInfo.id,
          title: editTitle.trim(),
          description: editDescription.trim(),
        };
        if (selectedResourceInfo.isFolder) {
          payload.url = editDriveUrl.trim();
        }

        const res = await fetch('/api/internal-resources', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al guardar metadatos');
        }
        const data = await res.json();
        updated = data.resource;
      }

      setInternalResources(prev =>
        prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      setSelectedResourceInfo(prev => (prev ? { ...prev, ...updated } : updated));
      setIsEditingResource(false);
      setNewVersionFile(null);

      toast({
        title: 'Recurso actualizado',
        description: 'Los cambios y metadatos se guardaron correctamente.',
      });
    } catch (err: any) {
      console.error('Error guardando recurso:', err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: err.message || 'No se pudieron guardar los cambios en el recurso.',
      });
    } finally {
      setIsSavingResource(false);
    }
  }, [selectedResourceInfo, editTitle, editDescription, editDriveUrl, newVersionFile, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchReferenceDocs();
      fetchMiscCards();
      fetchInternalResources();
    }
  }, [isOpen, fetchReferenceDocs, fetchMiscCards, fetchInternalResources]);

  const filteredMiscCards = useMemo(() => {
    const combinedQuery = (miscSearchQuery || searchQuery).trim();
    if (!combinedQuery) return miscCards;
    const norm = removeAccents(combinedQuery.toLowerCase());
    return miscCards.filter(card => {
      const n = removeAccents((card.name || '').toLowerCase());
      const d = removeAccents((card.desc || '').toLowerCase());
      const b = removeAccents((card.boardName || '').toLowerCase());
      const l = removeAccents((card.listName || '').toLowerCase());
      const atts = (card.attachments || []).some(a =>
        removeAccents((a.name || '').toLowerCase()).includes(norm)
      );
      return n.includes(norm) || d.includes(norm) || b.includes(norm) || l.includes(norm) || atts;
    });
  }, [miscCards, miscSearchQuery, searchQuery]);

  const filteredReferenceDocs = useMemo(() => {
    const combinedQuery = (refSearchQuery || searchQuery).trim();
    if (!combinedQuery) return referenceDocs;
    const norm = removeAccents(combinedQuery.toLowerCase());
    return referenceDocs.filter(doc => {
      const t = removeAccents((doc.title || '').toLowerCase());
      const f = removeAccents((doc.fileName || '').toLowerCase());
      const c = removeAccents((doc.comments || '').toLowerCase());
      const u = removeAccents((doc.uploadedBy || '').toLowerCase());
      return t.includes(norm) || f.includes(norm) || c.includes(norm) || u.includes(norm);
    });
  }, [referenceDocs, refSearchQuery, searchQuery]);

  const filteredFolderFiles = useMemo(() => {
    if (!activeRefFolder || !activeRefFolder.folderFiles) return [];
    const query = refFolderSearchQuery.trim();
    if (!query) return activeRefFolder.folderFiles;
    const norm = removeAccents(query.toLowerCase());
    return activeRefFolder.folderFiles.filter(f =>
      removeAccents(f.name.toLowerCase()).includes(norm) ||
      removeAccents((f.comments || '').toLowerCase()).includes(norm)
    );
  }, [activeRefFolder, refFolderSearchQuery]);

  const resetUploadModal = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadComments('');
    setIsDraggingRefFile(false);
    setUploadRefProgress(0);
    setDuplicateCandidate(null);
    uploadXhrRef.current = null;
    uploadAbortControllerRef.current = null;
    uploadCancelledRef.current = false;
  };

  const handleDeleteReferenceDoc = async (docItem: ReferenceDocumentItem) => {
    setDeletingRefDocId(docItem.id);
    try {
      const res = await fetch('/api/reference-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: docItem.id,
          storagePath: docItem.storagePath,
        }),
      });
      if (!res.ok) {
        throw new Error('No se pudo eliminar el documento.');
      }
      setReferenceDocs(prev => prev.filter(d => d.id !== docItem.id));
      updateAndStorePinnedResources(prev => prev.filter(p => p.url !== docItem.downloadUrl));
      setDocToDelete(null);
      toast({
        title: 'Documento eliminado',
        description: `Se quitó "${docItem.title || docItem.fileName}" de Documentación de Referencia.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.message || 'Ocurrió un error al eliminar el documento.',
      });
    } finally {
      setDeletingRefDocId(null);
    }
  };

  const handleCancelRefUpload = () => {
    if (isUploadingRefDoc) {
      uploadCancelledRef.current = true;
      if (uploadXhrRef.current) {
        uploadXhrRef.current.abort();
        uploadXhrRef.current = null;
      }
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
        uploadAbortControllerRef.current = null;
      }
      setIsUploadingRefDoc(false);
      setUploadRefProgress(0);
      toast({
        title: 'Subida cancelada',
        description: 'Se interrumpió la carga del documento.',
      });
    } else {
      setIsUploadModalOpen(false);
      resetUploadModal();
    }
  };

  const executeUploadReferenceDocument = async (options?: {
    mode?: 'normal' | 'overwrite' | 'keep-both';
    targetDoc?: ReferenceDocumentItem;
  }) => {
    if (!uploadFile) return;

    const mode = options?.mode || 'normal';
    const targetDoc = options?.targetDoc;

    const finalFileName =
      mode === 'keep-both'
        ? getNextEnumeratedFileName(uploadFile.name, referenceDocs)
        : uploadFile.name;

    const overwriteDocId = mode === 'overwrite' && targetDoc ? targetDoc.id : undefined;
    const previousStoragePath =
      mode === 'overwrite' && targetDoc ? targetDoc.storagePath : undefined;

    setDuplicateCandidate(null);
    uploadCancelledRef.current = false;
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    setIsUploadingRefDoc(true);
    setUploadRefProgress(5);

    try {
      const authorizedUser = user?.email
        ? WHITELIST.find(u => u.email.toLowerCase() === user.email!.toLowerCase())
        : undefined;
      const realName = authorizedUser?.name || user?.displayName || 'Usuario DEA';

      // 1. Solicitar Signed URL para subir directamente a Firebase Storage
      const urlRes = await fetch('/api/reference-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          action: 'get-upload-url',
          fileName: finalFileName,
          mimeType: uploadFile.type || 'application/pdf',
        }),
      });

      if (uploadCancelledRef.current) return;

      let savedDoc: ReferenceDocumentItem | null = null;

      if (urlRes.ok) {
        const { uploadUrl, storagePath } = await urlRes.json();

        const directUploadOk = await new Promise<boolean>((resolve) => {
          const xhr = new XMLHttpRequest();
          uploadXhrRef.current = xhr;
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', uploadFile.type || 'application/pdf');
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && !uploadCancelledRef.current) {
              const pct = Math.min(90, Math.round((event.loaded / event.total) * 85) + 5);
              setUploadRefProgress(pct);
            }
          };
          xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
          xhr.onerror = () => resolve(false);
          xhr.onabort = () => resolve(false);
          xhr.send(uploadFile);
        });

        uploadXhrRef.current = null;
        if (uploadCancelledRef.current) return;

        if (directUploadOk) {
          setUploadRefProgress(95);
          const finalizeRes = await fetch('/api/reference-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
            body: JSON.stringify({
              action: 'finalize-upload',
              storagePath,
              fileName: finalFileName,
              fileSize: uploadFile.size,
              mimeType: uploadFile.type || 'application/pdf',
              title: uploadTitle,
              comments: uploadComments,
              userId: user?.uid || 'portal-user',
              userName: realName,
              userEmail: user?.email || '',
              userPhoto: user?.photoURL || '',
              overwriteDocId,
              previousStoragePath,
            }),
          });

          if (!finalizeRes.ok) {
            throw new Error('Error al registrar el documento en Firestore.');
          }
          const finalizeData = await finalizeRes.json();
          savedDoc = finalizeData.document;
        }
      }

      if (uploadCancelledRef.current) return;

      // Fallback mediante FormData directo al servidor si la subida firmada no pudo completarse
      if (!savedDoc) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('customFileName', finalFileName);
        formData.append('title', uploadTitle);
        formData.append('comments', uploadComments);
        formData.append('userId', user?.uid || 'portal-user');
        formData.append('userName', realName);
        formData.append('userEmail', user?.email || '');
        formData.append('userPhoto', user?.photoURL || '');
        if (overwriteDocId) formData.append('overwriteDocId', overwriteDocId);
        if (previousStoragePath) formData.append('previousStoragePath', previousStoragePath);

        const fallbackRes = await fetch('/api/reference-docs', {
          method: 'POST',
          signal: abortController.signal,
          body: formData,
        });
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir el documento.');
        }
        const fallbackData = await fallbackRes.json();
        savedDoc = fallbackData.document;
      }

      if (uploadCancelledRef.current) return;

      setUploadRefProgress(100);
      if (savedDoc) {
        setReferenceDocs(prev => {
          const withoutReplaced = overwriteDocId
            ? prev.filter(d => d.id !== overwriteDocId)
            : prev;
          return [savedDoc!, ...withoutReplaced];
        });
      } else {
        await fetchReferenceDocs();
      }

      const displayLabel = uploadTitle.trim() || finalFileName;
      toast({
        title: mode === 'overwrite' ? 'Documento actualizado' : 'Documento subido con éxito',
        description:
          mode === 'overwrite'
            ? `Se sobreescribió "${displayLabel}" en Documentación de Referencia.`
            : `Se incorporó "${displayLabel}" en Documentación de Referencia.`,
      });

      setIsUploadModalOpen(false);
      resetUploadModal();
    } catch (error: any) {
      if (uploadCancelledRef.current || error?.name === 'AbortError') {
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Error al subir documento',
        description: error.message || 'No se pudo completar la carga.',
      });
    } finally {
      setIsUploadingRefDoc(false);
      uploadXhrRef.current = null;
      uploadAbortControllerRef.current = null;
    }
  };

  const handleUploadReferenceDocument = async () => {
    if (!uploadFile) {
      toast({
        variant: 'destructive',
        title: 'Archivo requerido',
        description: 'Seleccioná o arrastrá un documento para subir.',
      });
      return;
    }

    // Verificar si ya existe un archivo con el mismo nombre (o mismo nombre base) y mismo tamaño
    const incomingParts = splitFileNameAndExt(uploadFile.name);
    const incomingBase = stripNumberSuffix(incomingParts.base).toLowerCase();
    const incomingExt = incomingParts.ext.toLowerCase();

    const existingDuplicate = referenceDocs.find(doc => {
      if (Number(doc.fileSize) !== Number(uploadFile.size)) return false;
      const docParts = splitFileNameAndExt(doc.fileName || '');
      const docBase = stripNumberSuffix(docParts.base).toLowerCase();
      const docExt = docParts.ext.toLowerCase();
      return (
        (doc.fileName || '').toLowerCase() === uploadFile.name.toLowerCase() ||
        (docBase === incomingBase && docExt === incomingExt)
      );
    });

    if (existingDuplicate) {
      setDuplicateCandidate(existingDuplicate);
      return;
    }

    await executeUploadReferenceDocument({ mode: 'normal' });
  };

  const prevSelectedCardId = useRef<string | null>(null);

  useEffect(() => {
    try {
        const storedPins = localStorage.getItem('pinnedResources');
        if (storedPins) {
            setPinnedResources(JSON.parse(storedPins));
        }
    } catch (error) {
        console.error("Failed to load pins from localStorage", error);
    }
  }, []);

  const updateAndStorePinnedResources = (updater: React.SetStateAction<PinnedResource[]>) => {
      setPinnedResources(prev => {
          const newState = typeof updater === 'function' ? updater(prev) : updater;
          try {
              localStorage.setItem('pinnedResources', JSON.stringify(newState));
          } catch (error) {
              console.error("Failed to save pins to localStorage", error);
          }
          return newState;
      });
  };
  
  const manuallyPinnedResources = pinnedResources;

  const attachedResources = useMemo((): PinnedResource[] => {
    if (!selectedCard?.attachments) {
      return [];
    }
    return selectedCard.attachments
      .filter(att => att.url.startsWith('http'))
      .map((att): PinnedResource => ({
        title: att.name,
        url: att.url,
        attachmentId: att.id,
        isScientific: isScientificUrl(att.url),
      }));
  }, [selectedCard]);

  const scientificAttachmentsFromCard = useMemo((): PinnedResource[] => {
    return attachedResources.filter(r => r.isScientific);
  }, [attachedResources]);


  useEffect(() => {
    if (!isOpen) {
        setElsevierResults([]);
        setSnrdResults([]);
        setCrossrefResults([]);
        setPlosResults([]);
        setDoajResults([]);
        setScieloResults([]);
        setOpenAlexResults([]);
        setEuropePmcResults([]);
        setManualUrl('');
        setManualTitle('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedCard?.id !== prevSelectedCardId.current) {
        prevSelectedCardId.current = selectedCard?.id || null;
    }
  }, [selectedCard, isOpen]);

  const filteredLocalResources = useMemo(() => {
    const allResources = [...RECURSOS].sort((a, b) => a.title.localeCompare(b.title));

    if (!searchQuery) {
      return allResources;
    }

    const normalizedQuery = removeAccents(searchQuery.toLowerCase());
    
    return allResources.filter(resource => 
      removeAccents(resource.title.toLowerCase()).includes(normalizedQuery)
    );
  }, [searchQuery]);

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
        projectName: detail,
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
  
  const handleExternalSearch = async () => {
    if (searchQuery.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Búsqueda demasiado corta',
        description: 'Ingresá al menos 3 caracteres para buscar en plataformas externas.',
      });
      return;
    }
    
    setIsSearchingExternal(true);
    try {
      const results = await Promise.allSettled([
        searchElsevier(searchQuery),
        searchSNRD(searchQuery),
        searchCrossref(searchQuery),
        searchPlos(searchQuery),
        searchDoaj(searchQuery),
        searchScielo(searchQuery),
        searchOpenAlex(searchQuery),
        searchEuropePMC(searchQuery),
      ]);

      setElsevierResults(results[0].status === 'fulfilled' ? results[0].value : []);
      setSnrdResults(results[1].status === 'fulfilled' ? results[1].value : []);
      setCrossrefResults(results[2].status === 'fulfilled' ? results[2].value : []);
      setPlosResults(results[3].status === 'fulfilled' ? results[3].value : []);
      setDoajResults(results[4].status === 'fulfilled' ? results[4].value : []);
      setScieloResults(results[5].status === 'fulfilled' ? results[5].value : []);
      setOpenAlexResults(results[6].status === 'fulfilled' ? results[6].value : []);
      setEuropePmcResults(results[7].status === 'fulfilled' ? results[7].value : []);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error de búsqueda',
        description: 'No se pudo contactar a las plataformas externas.',
      });
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleExternalSearch();
    }
  };
  
  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query === '') {
        setElsevierResults([]);
        setSnrdResults([]);
        setCrossrefResults([]);
        setPlosResults([]);
        setDoajResults([]);
        setScieloResults([]);
        setOpenAlexResults([]);
        setEuropePmcResults([]);
    }
  };

  const handleManualUrlChange = (url: string) => {
    setManualUrl(url);
    if (url.trim()) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            const pathname = urlObj.pathname;
            const lastPart = pathname.split('/').filter(Boolean).pop();
            if (lastPart && !manualTitle) {
                const decoded = decodeURIComponent(lastPart).split('.')[0];
                setManualTitle(decoded.replace(/-/g, ' ').replace(/_/g, ' '));
            }
        } catch (e) {}
    }
  };

  const handlePinToggle = (resource: PinnedResource) => {
    updateAndStorePinnedResources(prev => {
      const isAlreadyPinned = prev.some(p => p.url === resource.url);
      if (isAlreadyPinned) {
        return prev.filter(p => p.url !== resource.url);
      } else {
        const { attachmentId, ...rest } = resource;
        return [{ ...rest, isScientific: resource.isScientific ?? isScientificUrl(resource.url) }, ...prev];
      }
    });
  };

  const handleAddManualResource = () => {
    if (!manualUrl.trim()) return;
    
    const finalUrl = manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`;
    const finalTitle = manualTitle.trim() || manualUrl;

    const resource: PinnedResource = {
        title: finalTitle,
        url: finalUrl,
        isScientific: isScientificUrl(finalUrl)
    };

    handlePinToggle(resource);
    setManualUrl('');
    setManualTitle('');
    toast({ title: 'Recurso fijado', description: `Se agregó "${finalTitle}" a tus pines.` });
  };

  const handleAttachResource = async (resource: PinnedResource) => {
    if (!selectedCard) return;

    if (selectedCard.attachments.some(att => att.url === resource.url)) {
        toast({
            variant: 'destructive',
            title: 'Recurso duplicado',
            description: 'Este enlace ya está adjunto al proyecto.',
        });
        return;
    }

    setAttachingId(resource.url);
    try {
      const newAttachment = await addAttachmentToTrelloCard({
        cardId: selectedCard.id,
        url: resource.url,
        name: resource.title,
      });

      const updatedCard = {
          ...selectedCard,
          attachments: [...selectedCard.attachments, newAttachment],
      };
      onCardUpdate(updatedCard);
      
      await logActivity('attach_resource', `Adjuntó el recurso "${resource.title}" en "${selectedCard.name}"`);

      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se adjuntó a la tarjeta.`,
      });
       updateAndStorePinnedResources(prev => 
        prev.map(r => r.url === resource.url ? { ...r, attachmentId: newAttachment.id } : r)
      );

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al adjuntar',
        description: 'No se pudo adjuntar el recurso a la tarjeta.',
      });
    } finally {
      setAttachingId(null);
    }
  };
  
  const handleRemoveAttachment = async (resource: PinnedResource) => {
    if (!selectedCard || !resource.attachmentId) return;
  
    setAttachingId(resource.url);
    try {
      await removeAttachmentFromTrelloCard({
        cardId: selectedCard.id,
        attachmentId: resource.attachmentId,
      });
      
      const updatedCard = {
          ...selectedCard,
          attachments: selectedCard.attachments.filter(att => att.id !== resource.attachmentId),
      };
      onCardUpdate(updatedCard);

      await logActivity('remove_attachment', `Quitó el recurso "${resource.title}" de "${selectedCard.name}"`);

      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se quitó de la tarjeta.`,
      });
      updateAndStorePinnedResources(prev =>
        prev.filter(r => r.url !== resource.url)
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al quitar adjunto',
        description: 'No se pudo quitar el recurso de la tarjeta.',
      });
    } finally {
      setAttachingId(null);
    }
  };

  const isManuallyPinned = (url: string) => pinnedResources.some(p => p.url === url);

  const highlightText = (text: string | undefined, query: string): React.ReactNode => {
    if (!text || !query) {
      return text;
    }

    const normalizedText = removeAccents(text).toLowerCase();
    const normalizedQuery = removeAccents(query).toLowerCase();

    if (normalizedQuery.length === 0) {
      return text;
    }

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex;

    while ((matchIndex = normalizedText.indexOf(normalizedQuery, lastIndex)) > -1) {
      if (matchIndex > lastIndex) {
        result.push(text.substring(lastIndex, matchIndex));
      }
      
      const matchedText = text.substring(matchIndex, matchIndex + normalizedQuery.length);
      result.push(
        <span key={lastIndex} className="bg-fuchsia-500/40 rounded-sm">
          {matchedText}
        </span>
      );

      lastIndex = matchIndex + normalizedQuery.length;
    }

    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result.length > 0 ? <>{result}</> : text;
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 border-0 shadow-2xl overflow-hidden bg-white">
          <DialogTitle className="sr-only">Biblioteca de Recursos</DialogTitle>
          <DialogDescription className="sr-only">
            Buscá en recursos o publicaciones científicas.
          </DialogDescription>
          <div className="w-full h-full flex flex-col">
              <CardHeader className="bg-muted/30 border-b shrink-0 space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                        <CardTitleComponent className="text-base font-bold">Biblioteca de Recursos</CardTitleComponent>
                        <CardDescriptionComponent className="text-[11px]">
                            Buscá en nuestros recursos o en publicaciones científicas externas.
                        </CardDescriptionComponent>
                    </div>
                    <Library className="h-6 w-6 text-primary/40" />
                  </div>
                  
                  <div className="grid gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar en la biblioteca, SNRD, SciELO, OpenAlex, Europe PMC, Elsevier, Crossref, PLOS y DOAJ..."
                        value={searchQuery}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-9 pr-8 h-9 text-xs bg-white shadow-sm"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQueryChange('')}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="p-2 bg-primary/5 rounded-lg border border-primary/10 flex flex-col gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Agregar Enlace Externo</p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                                <Input 
                                    placeholder="Pegá el link (URL)..." 
                                    className="h-7 pl-7 text-[11px] bg-white border-zinc-200"
                                    value={manualUrl}
                                    onChange={(e) => handleManualUrlChange(e.target.value)}
                                />
                            </div>
                            <Input 
                                placeholder="Título del documento..." 
                                className="h-7 text-[11px] bg-white border-zinc-200 flex-[0.8]"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                            />
                            <Button 
                                size="sm" 
                                className="h-7 gap-1.5 px-3 font-bold text-[9px] uppercase tracking-tighter"
                                disabled={!manualUrl.trim()}
                                onClick={handleAddManualResource}
                            >
                                <Pin className="h-3 w-3" />
                                Fijar
                            </Button>
                        </div>
                    </div>
                  </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-0 p-0 overflow-hidden">
                  <ScrollArea className="h-full px-4 py-2">
                      {manuallyPinnedResources.length > 0 && (
                        <Collapsible className="mb-2" defaultOpen={true}>
                          <div className="flex items-center justify-between mb-1 rounded-md hover:bg-muted/50">
                            <CollapsibleTrigger asChild>
                              <div className="group flex flex-grow items-center gap-2 p-1.5 text-sm font-semibold text-fuchsia-600 text-left cursor-pointer">
                                  <Pin className="h-3.5 w-3.5" />
                                  <span className="uppercase tracking-widest text-[9px] font-black">Recursos Fijados</span>
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center pr-1">
                              {pinnedResources.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => updateAndStorePinnedResources([])}
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                              <div className="flex flex-col gap-1">
                                  {manuallyPinnedResources.map((resource, index) => {
                                    const isAttached = attachedResources.some(att => att.url === resource.url);
                                    const attachmentId = isAttached ? attachedResources.find(att => att.url === resource.url)?.attachmentId : undefined;
                                    const resourceWithId = { ...resource, attachmentId };
                                    const pinned = isManuallyPinned(resource.url);

                                    return (
                                      <div
                                          key={`pinned-${resource.url}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 === 0 ? 'bg-white border-zinc-100 shadow-sm' : 'bg-muted/20 border-transparent')}
                                      >
                                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            {resource.isScientific ? (
                                                <BookText className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Link2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(resource.title, searchQuery)}</span>
                                                {resource.authors && (
                                                    <span className="text-[9px] text-muted-foreground truncate">{highlightText(Array.isArray(resource.authors) ? resource.authors.join(', ') : resource.authors, searchQuery)}</span>
                                                )}
                                                {resource.publication && (
                                                    <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(resource.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-3 items-center gap-1">
                                            {selectedCard && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className={cn(
                                                    "h-7 w-7 rounded-full transition-all",
                                                    isAttached ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-zinc-300 hover:text-zinc-600 hover:bg-muted"
                                                  )}
                                                  onClick={() => isAttached ? handleRemoveAttachment(resourceWithId) : handleAttachResource(resource)}
                                                  disabled={!!attachingId}
                                                >
                                                  <Paperclip className={cn(
                                                    "h-3.5 w-3.5",
                                                    attachingId === resource.url && 'animate-pulse'
                                                  )} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle(resource)}>
                                                <Pin className={cn("h-3.5 w-3.5 fill-current")} />
                                            </Button>
                                          </div>
                                      </div>
                                    );
                                  })}
                              </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {selectedCard && scientificAttachmentsFromCard.length > 0 && (
                          <Collapsible className="mb-2">
                            <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                                    <span className="uppercase tracking-widest text-[9px] font-black">Enlaces del Proyecto</span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                               <div className="flex flex-col mt-1 gap-1">
                                  {scientificAttachmentsFromCard.map((attachment, index) => {
                                    const pinnedVersion = pinnedResources.find(p => p.url === attachment.url);
                                    const itemToRender = pinnedVersion || attachment;
                                    const itemToPin = pinnedVersion || attachment;
                                    const isPinned = isManuallyPinned(attachment.url);

                                    return (
                                       <div
                                          key={`attached-${attachment.attachmentId}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 === 0 ? 'bg-primary/5 border-primary/10' : 'bg-white border-zinc-100')}
                                      >
                                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            <BookText className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(itemToRender.title, searchQuery)}</span>
                                                {itemToRender.authors && (
                                                    <span className="text-[9px] text-muted-foreground truncate">{highlightText(Array.isArray(itemToRender.authors) ? itemToRender.authors.join(', ') : itemToRender.authors, searchQuery)}</span>
                                                )}
                                                {itemToRender.publication && (
                                                    <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(itemToRender.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-3 items-center gap-1">
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7 rounded-full text-primary bg-primary/10 hover:bg-primary/20"
                                              onClick={() => handleRemoveAttachment(attachment)}
                                              disabled={!!attachingId}
                                            >
                                              <Paperclip className={cn( "h-3.5 w-3.5", attachingId === attachment.url && 'animate-pulse' )}/>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle(itemToPin)}>
                                                <Pin className={cn("h-3.5 w-3.5", isPinned ? "fill-current" : "")} />
                                            </Button>
                                          </div>
                                      </div>
                                    )
                                  })}
                                </div>
                            </CollapsibleContent>
                          </Collapsible>
                      )}

                      {(manuallyPinnedResources.length > 0 || (selectedCard && scientificAttachmentsFromCard.length > 0)) && <Separator className="my-3" />}

                      <Collapsible className="mb-2" defaultOpen={false}>
                        <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                           <div className="flex items-center gap-2">
                              <FolderIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="uppercase tracking-widest text-[9px] font-black">Recursos externos ({filteredLocalResources.length})</span>
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                          {filteredLocalResources.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {filteredLocalResources.map((resource, index) => (
                                    <div key={resource.url} className={cn("group/item flex items-center justify-between py-1 px-2 rounded-md transition-colors", index % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20')}>
                                        <a
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 flex-1 overflow-hidden"
                                        >
                                          <Link2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                                          <span className="text-xs text-foreground font-medium group-hover/item:text-primary transition-colors truncate">{highlightText(resource.title, searchQuery)}</span>
                                        </a>
                                        <div className="flex items-center ml-2">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-fuchsia-500/40 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: resource.title, url: resource.url })}>
                                                <Pin className={cn("h-3 w-3", isManuallyPinned(resource.url) ? "fill-current opacity-100" : "")} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                          ) : (
                            searchQuery && <p className="p-3 text-center text-[11px] text-muted-foreground italic">
                              No hay recursos para tu búsqueda.
                            </p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {(elsevierResults.length > 0 || snrdResults.length > 0 || scieloResults.length > 0 || openAlexResults.length > 0 || europePmcResults.length > 0 || crossrefResults.length > 0 || plosResults.length > 0 || doajResults.length > 0 || isSearchingExternal) && (
                        <>
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            
                            <Collapsible defaultOpen={true}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Repositorios Nacionales (SNRD / CONICET)</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{snrdResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : snrdResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {snrdResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.handle || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(Array.isArray(article.authors) ? article.authors.join(', ') : article.authors, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Repositorios Nacionales.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">SciELO / Red Iberoamericana</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{scieloResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : scieloResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {scieloResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.journal, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.journal, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en SciELO / Iberoamérica.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Library className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">OpenAlex (Catálogo Científico Global)</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{openAlexResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : openAlexResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {openAlexResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en OpenAlex.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Europe PMC / PubMed Central</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{europePmcResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : europePmcResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {europePmcResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Europe PMC.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                            

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Elsevier / Scopus</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{elsevierResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : elsevierResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {elsevierResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.doi || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publicationName, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publicationName, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Elsevier.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <BookText className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Crossref / DOI</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{crossrefResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : crossrefResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {crossrefResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.doi || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Crossref.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                            
                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <BookText className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">PLOS / Public Science</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{plosResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : plosResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {plosResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en PLOS.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                             <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-left">
                                    <div className="flex items-center gap-2">
                                        <Library className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">DOAJ (Acceso Abierto)</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{doajResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : doajResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {doajResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en DOAJ.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                          </div>
                        </>
                      )}
                      
                    <Separator className="my-3" />

                    <Collapsible defaultOpen={true}>
                        <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                           <div className="flex items-center gap-2">
                              <FolderIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="uppercase tracking-widest text-[9px] font-black">
                                Recursos Internos ({internalResources.length})
                              </span>
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                           <div className="flex flex-col gap-3 pb-3">
                             {/* Subsección 1: Documentación Institucional y Guías */}
                             <div>
                               <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1 flex items-center justify-between">
                                 <span>Documentación Institucional y Guías</span>
                                 <span className="text-[9px] font-semibold text-zinc-400">
                                   {internalResources.filter(r => r.section === 'guias' || !r.section).length} recursos
                                 </span>
                               </div>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {internalResources
                                   .filter(r => r.section === 'guias' || !r.section)
                                   .map((resource, idx) => {
                                     const colors = [
                                       'bg-sky-50/70 border-sky-200/70 hover:bg-sky-100/70',
                                       'bg-teal-50/70 border-teal-200/70 hover:bg-teal-100/70',
                                       'bg-violet-50/70 border-violet-200/70 hover:bg-violet-100/70',
                                       'bg-amber-50/70 border-amber-200/70 hover:bg-amber-100/70',
                                     ];
                                     const isFolder = Boolean(resource.isFolder);
                                     return (
                                       <div
                                         key={resource.id || resource.title}
                                         role="button"
                                         tabIndex={0}
                                         onClick={() => {
                                           if (isFolder) {
                                             window.open(resource.url, '_blank', 'noopener,noreferrer');
                                           } else {
                                             setDownloadWarningTarget({
                                               title: resource.title,
                                               fileName: resource.fileName || `${resource.title}.docx`,
                                               url: resource.url,
                                             });
                                           }
                                         }}
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter' || e.key === ' ') {
                                             if (isFolder) {
                                               window.open(resource.url, '_blank', 'noopener,noreferrer');
                                             } else {
                                               setDownloadWarningTarget({
                                                 title: resource.title,
                                                 fileName: resource.fileName || `${resource.title}.docx`,
                                                 url: resource.url,
                                               });
                                             }
                                           }
                                         }}
                                         className={cn(
                                           "group relative flex items-center justify-between rounded-lg border text-card-foreground shadow-2xs transition-all px-2.5 py-1.5 min-h-[38px] hover:shadow-xs hover:border-zinc-300 text-left cursor-pointer select-none overflow-hidden",
                                           colors[idx % colors.length]
                                         )}
                                         title={isFolder ? `Abrir carpeta Drive: ${resource.title}` : `Descargar archivo: ${resource.title}`}
                                       >
                                         <span className="text-[11px] sm:text-xs font-bold text-foreground leading-snug line-clamp-1 truncate group-hover:text-primary transition-colors pr-1.5 flex-1 min-w-0">
                                           {resource.title}
                                         </span>

                                         <button
                                           type="button"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             e.preventDefault();
                                             setSelectedResourceInfo(resource);
                                             setIsEditingResource(false);
                                             setNewVersionFile(null);
                                           }}
                                           className="h-5 w-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-white/80 transition-all shrink-0 cursor-pointer ml-1"
                                           title={`Ver información y metadatos de ${resource.title}`}
                                         >
                                           <Info className="h-3 w-3" />
                                         </button>
                                       </div>
                                     );
                                   })}
                               </div>
                             </div>

                             {/* Separador fino */}
                             <div className="border-t border-zinc-200/80 my-1" />

                             {/* Subsección 2: Plantillas y Modelos de Gestión */}
                             <div>
                               <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1 flex items-center justify-between">
                                 <span>Plantillas y Modelos de Gestión</span>
                                 <span className="text-[9px] font-semibold text-zinc-400">
                                   {internalResources.filter(r => r.section === 'plantillas').length} recursos
                                 </span>
                               </div>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {internalResources
                                   .filter(r => r.section === 'plantillas')
                                   .map((resource, idx) => {
                                     const colors = [
                                       'bg-violet-50/70 border-violet-200/70 hover:bg-violet-100/70',
                                       'bg-amber-50/70 border-amber-200/70 hover:bg-amber-100/70',
                                       'bg-sky-50/70 border-sky-200/70 hover:bg-sky-100/70',
                                       'bg-teal-50/70 border-teal-200/70 hover:bg-teal-100/70',
                                     ];
                                     const isFolder = Boolean(resource.isFolder);
                                     return (
                                       <div
                                         key={resource.id || resource.title}
                                         role="button"
                                         tabIndex={0}
                                         onClick={() => {
                                           if (isFolder) {
                                             window.open(resource.url, '_blank', 'noopener,noreferrer');
                                           } else {
                                             setDownloadWarningTarget({
                                               title: resource.title,
                                               fileName: resource.fileName || `${resource.title}.docx`,
                                               url: resource.url,
                                             });
                                           }
                                         }}
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter' || e.key === ' ') {
                                             if (isFolder) {
                                               window.open(resource.url, '_blank', 'noopener,noreferrer');
                                             } else {
                                               setDownloadWarningTarget({
                                                 title: resource.title,
                                                 fileName: resource.fileName || `${resource.title}.docx`,
                                                 url: resource.url,
                                               });
                                             }
                                           }
                                         }}
                                         className={cn(
                                           "group relative flex items-center justify-between rounded-lg border text-card-foreground shadow-2xs transition-all px-2.5 py-1.5 min-h-[38px] hover:shadow-xs hover:border-zinc-300 text-left cursor-pointer select-none overflow-hidden",
                                           colors[idx % colors.length]
                                         )}
                                         title={isFolder ? `Abrir carpeta Drive: ${resource.title}` : `Descargar archivo: ${resource.title}`}
                                       >
                                         <span className="text-[11px] sm:text-xs font-bold text-foreground leading-snug line-clamp-1 truncate group-hover:text-primary transition-colors pr-1.5 flex-1 min-w-0">
                                           {resource.title}
                                         </span>

                                         <button
                                           type="button"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             e.preventDefault();
                                             setSelectedResourceInfo(resource);
                                             setIsEditingResource(false);
                                             setNewVersionFile(null);
                                           }}
                                           className="h-5 w-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-white/80 transition-all shrink-0 cursor-pointer ml-1"
                                           title={`Ver información y metadatos de ${resource.title}`}
                                         >
                                           <Info className="h-3 w-3" />
                                         </button>
                                       </div>
                                     );
                                   })}
                               </div>
                             </div>
                           </div>
                        </CollapsibleContent>
                      </Collapsible>

                    <Separator className="my-3" />

                    <Collapsible className="mb-4" defaultOpen={false}>
                      <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                        <div className="flex items-center gap-2">
                          <FolderIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="uppercase tracking-widest text-[9px] font-black">
                            Documentación de Referencia ({filteredReferenceDocs.length})
                          </span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                        <div className="flex flex-col gap-2.5 pb-4">
                          {activeRefFolder ? (
                            /* Vista de Navegación Dentro de Carpeta en el Mismo Panel */
                            <div className="flex flex-col gap-2.5">
                              {/* Barra superior de navegación de carpeta */}
                              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-amber-50/60 rounded-lg border border-amber-200/80">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setActiveRefFolder(null);
                                    setRefFolderSearchQuery('');
                                  }}
                                  className="h-7 text-xs gap-1 px-2 font-bold text-foreground hover:bg-white"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                  <span>Volver a Documentación de Referencia</span>
                                </Button>

                                {activeRefFolder.folderDriveUrl && (
                                  <a
                                    href={activeRefFolder.folderDriveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors shrink-0 shadow-2xs"
                                    title="Abrir carpeta completa en Google Drive"
                                  >
                                    <FolderIcon className="h-3 w-3 text-amber-600" />
                                    <span>Abrir en Drive</span>
                                    <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                                  </a>
                                )}
                              </div>

                              {/* Título y descripción de la carpeta activa */}
                              <div className="px-1">
                                <div className="flex items-center gap-1.5">
                                  <FolderIcon className="h-4 w-4 text-amber-500 shrink-0" />
                                  <h4 className="text-xs font-bold text-foreground leading-tight">
                                    {activeRefFolder.title || activeRefFolder.fileName}
                                  </h4>
                                </div>
                                {activeRefFolder.comments && (
                                  <p className="text-[11px] text-zinc-600 leading-snug mt-1">
                                    {activeRefFolder.comments}
                                  </p>
                                )}
                              </div>

                              {/* Buscador de archivos en la carpeta */}
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder={`Buscar entre los ${activeRefFolder.folderFiles?.length || 0} archivos de esta carpeta...`}
                                  value={refFolderSearchQuery}
                                  onChange={(e) => setRefFolderSearchQuery(e.target.value)}
                                  className="h-8 pl-8 pr-7 text-xs bg-white border-zinc-200"
                                />
                                {refFolderSearchQuery && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setRefFolderSearchQuery('')}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>

                              {/* Listado de archivos en la carpeta */}
                              <div className="flex flex-col gap-1.5">
                                {filteredFolderFiles.map((fileItem, idx) => (
                                  <div
                                    key={fileItem.name + idx}
                                    className={cn(
                                      "group/file flex items-start justify-between py-2 px-2.5 rounded-md border transition-all",
                                      idx % 2 === 0 ? 'bg-white border-zinc-100 shadow-2xs' : 'bg-muted/20 border-transparent'
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDownloadWarningTarget({
                                          title: fileItem.name,
                                          fileName: fileItem.name,
                                          url: fileItem.url,
                                          fileSize: fileItem.size,
                                        });
                                      }}
                                      className="flex flex-grow items-start gap-2.5 overflow-hidden text-left cursor-pointer hover:opacity-90 transition-opacity"
                                      title={`Descargar ${fileItem.name}`}
                                    >
                                      <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                      <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-bold text-foreground group-hover/file:text-primary transition-colors leading-tight truncate">
                                            {highlightText(fileItem.name, refFolderSearchQuery)}
                                          </span>
                                          <Download className="h-3 w-3 text-muted-foreground opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0" />
                                        </div>
                                        {fileItem.comments && (
                                          <p className="text-[10px] text-zinc-600 line-clamp-1 leading-snug">
                                            {highlightText(fileItem.comments, refFolderSearchQuery)}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                                          {fileItem.sizeFormatted && (
                                            <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-semibold">
                                              {fileItem.sizeFormatted}
                                            </Badge>
                                          )}
                                          {fileItem.format && (
                                            <span className="uppercase font-mono text-[8px] bg-zinc-100 px-1 py-0.5 rounded text-zinc-600 border border-zinc-200">
                                              {fileItem.format}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setDownloadWarningTarget({
                                          title: fileItem.name,
                                          fileName: fileItem.name,
                                          url: fileItem.url,
                                          fileSize: fileItem.size,
                                        });
                                      }}
                                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-zinc-100 shrink-0 ml-2"
                                      title={`Descargar ${fileItem.name}`}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}

                                {filteredFolderFiles.length === 0 && (
                                  <p className="p-4 text-center text-[11px] text-muted-foreground italic">
                                    No se encontraron archivos en esta carpeta que coincidan con la búsqueda.
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Vista General de Documentación de Referencia */
                            <>
                              <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-zinc-200/70">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder="Buscar en Documentación de Referencia..."
                                    value={refSearchQuery}
                                    onChange={(e) => setRefSearchQuery(e.target.value)}
                                    className="h-8 pl-8 pr-7 text-xs bg-white border-zinc-200"
                                  />
                                  {refSearchQuery && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setRefSearchQuery('')}
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    resetUploadModal();
                                    setIsUploadModalOpen(true);
                                  }}
                                  className="h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider shrink-0"
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  Subir documento
                                </Button>
                              </div>

                              {isLoadingRefDocs ? (
                                <SkeletonLoader />
                              ) : filteredReferenceDocs.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {filteredReferenceDocs.map((docItem, index) => {
                                    const displayTitle = docItem.title?.trim() || docItem.fileName;
                                    const showSubFileName = Boolean(docItem.title?.trim() && docItem.title.trim() !== docItem.fileName);
                                    const activeQuery = refSearchQuery || searchQuery;
                                    const isAttached = attachedResources.some(att => att.url === docItem.downloadUrl);
                                    const attachmentId = isAttached
                                      ? attachedResources.find(att => att.url === docItem.downloadUrl)?.attachmentId
                                      : undefined;
                                    const pinned = isManuallyPinned(docItem.downloadUrl);
                                    const resourceObj: PinnedResource = {
                                      title: displayTitle,
                                      url: docItem.downloadUrl,
                                      authors: docItem.uploadedBy,
                                      publication: docItem.comments || docItem.fileName,
                                      attachmentId,
                                      isScientific: false,
                                    };

                                    return (
                                      <div
                                        key={docItem.id}
                                        className={cn(
                                          "group/item flex items-start justify-between py-2 px-2.5 rounded-md border transition-all",
                                          docItem.isFolder
                                            ? 'bg-amber-50/40 border-amber-200/60 hover:bg-amber-50/70 shadow-2xs'
                                            : index % 2 === 0
                                              ? 'bg-white border-zinc-100 shadow-sm'
                                              : 'bg-muted/20 border-transparent'
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (docItem.isFolder) {
                                              setActiveRefFolder(docItem);
                                              setRefFolderSearchQuery('');
                                            } else {
                                              setDownloadWarningTarget({
                                                title: displayTitle,
                                                fileName: docItem.fileName,
                                                url: docItem.downloadUrl,
                                                fileSize: docItem.fileSize,
                                              });
                                            }
                                          }}
                                          className="flex flex-grow items-start gap-2.5 overflow-hidden text-left cursor-pointer hover:opacity-90 transition-opacity"
                                          title={docItem.isFolder ? `Explorar carpeta ${displayTitle}` : `Descargar ${displayTitle}`}
                                        >
                                          {docItem.isFolder ? (
                                            <FolderIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                          ) : (
                                            <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                          )}
                                          <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight truncate">
                                                {highlightText(displayTitle, activeQuery)}
                                              </span>
                                              {docItem.isFolder ? (
                                                <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-bold border-amber-400 text-amber-700 bg-amber-50">
                                                  Carpeta ({docItem.folderFiles?.length || 0} archivos)
                                                </Badge>
                                              ) : (
                                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0" />
                                              )}
                                            </div>
                                            {showSubFileName && !docItem.isFolder && (
                                              <span className="text-[10px] text-muted-foreground font-mono truncate">
                                                {highlightText(docItem.fileName, activeQuery)}
                                              </span>
                                            )}
                                            {docItem.comments && (
                                              <p className="text-[10px] text-zinc-600 line-clamp-2 leading-snug mt-0.5">
                                                {highlightText(docItem.comments, activeQuery)}
                                              </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                                              {docItem.fileSize > 0 && (
                                                <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-semibold">
                                                  {formatFileSize(docItem.fileSize)}
                                                </Badge>
                                              )}
                                              {docItem.createdAt && (
                                                <span className="inline-flex items-center gap-1 text-[9px] text-zinc-500">
                                                  <Calendar className="h-2.5 w-2.5" />
                                                  {formatUploadDate(docItem.createdAt)}
                                                </span>
                                              )}
                                              {docItem.uploadedBy && <span>· Subido por {docItem.uploadedBy}</span>}
                                            </div>
                                          </div>
                                        </button>
                                        <div className="flex flex-shrink-0 ml-3 items-center gap-1">
                                          {selectedCard && !docItem.isFolder && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className={cn(
                                                "h-7 w-7 rounded-full transition-all",
                                                isAttached
                                                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                                                  : "text-zinc-300 hover:text-zinc-600 hover:bg-muted"
                                              )}
                                              onClick={() =>
                                                isAttached
                                                  ? handleRemoveAttachment(resourceObj)
                                                  : handleAttachResource(resourceObj)
                                              }
                                              disabled={!!attachingId}
                                              title={isAttached ? 'Quitar del proyecto' : 'Adjuntar al proyecto'}
                                            >
                                              <Paperclip
                                                className={cn(
                                                  "h-3.5 w-3.5",
                                                  attachingId === docItem.downloadUrl && 'animate-pulse'
                                                )}
                                              />
                                            </Button>
                                          )}
                                          {!docItem.isFolder && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 rounded-full text-fuchsia-500/50 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                                              onClick={() => handlePinToggle(resourceObj)}
                                              title={pinned ? 'Quitar de fijados' : 'Fijar documento'}
                                            >
                                              <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-current text-fuchsia-500 opacity-100" : "")} />
                                            </Button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full text-zinc-400 hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setDocToDelete(docItem)}
                                            disabled={deletingRefDocId === docItem.id}
                                            title="Eliminar documento de referencia"
                                          >
                                            {deletingRefDocId === docItem.id ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                                            ) : (
                                              <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="p-4 text-center text-[11px] text-muted-foreground italic">
                                  No se encontraron documentos de referencia.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Separator className="my-3" />

                    <Collapsible className="mb-4" defaultOpen={false}>
                      <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                        <div className="flex items-center gap-2">
                          <FolderIcon className="h-3.5 w-3.5 text-amber-600" />
                          <span className="uppercase tracking-widest text-[9px] font-black">
                            Misceláneas ({filteredMiscCards.length})
                          </span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                        <div className="flex flex-col gap-2.5 pb-4">
                          <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-zinc-200/70">
                            <div className="relative flex-1">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Buscar en Misceláneas (metodología, planillas, Kobo, consultorías)..."
                                value={miscSearchQuery}
                                onChange={(e) => setMiscSearchQuery(e.target.value)}
                                className="h-8 pl-8 pr-7 text-xs bg-white border-zinc-200"
                              />
                              {miscSearchQuery && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setMiscSearchQuery('')}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {isLoadingMiscCards ? (
                            <SkeletonLoader />
                          ) : filteredMiscCards.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {filteredMiscCards.map((cardItem, index) => {
                                const activeQuery = miscSearchQuery || searchQuery;
                                return (
                                  <div
                                    key={cardItem.id}
                                    className={cn(
                                      "flex flex-col gap-1.5 py-2.5 px-3 rounded-lg border transition-all",
                                      index % 2 === 0 ? 'bg-white border-zinc-200/80 shadow-sm' : 'bg-muted/20 border-zinc-200/40'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-xs font-bold text-foreground leading-tight">
                                            {highlightText(cardItem.name, activeQuery)}
                                          </span>
                                          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-semibold border-amber-500/40 text-amber-700 bg-amber-50">
                                            {cardItem.boardName} · {cardItem.listName}
                                          </Badge>
                                        </div>
                                        {cardItem.desc && (
                                          <p className="text-[10px] text-zinc-600 whitespace-pre-wrap leading-relaxed mt-0.5">
                                            {highlightText(cardItem.desc, activeQuery)}
                                          </p>
                                        )}
                                      </div>

                                      {cardItem.url && (
                                        <a
                                          href={cardItem.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                                          title="Abrir tarjeta original en Trello"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          <span>Trello</span>
                                        </a>
                                      )}
                                    </div>

                                    {cardItem.attachments && cardItem.attachments.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100">
                                        {cardItem.attachments.map((att) => {
                                          const isDrive = (att.url || '').includes('drive.google.com');
                                          return (
                                            <a
                                              key={att.id}
                                              href={att.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border",
                                                isDrive
                                                  ? "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100"
                                                  : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200"
                                              )}
                                            >
                                              {isDrive ? (
                                                <FolderIcon className="h-3 w-3 text-amber-600 shrink-0" />
                                              ) : (
                                                <FileText className="h-3 w-3 text-primary shrink-0" />
                                              )}
                                              <span className="truncate max-w-[240px]">{att.name}</span>
                                              <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                                            </a>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="p-4 text-center text-[11px] text-muted-foreground italic">
                              No se encontraron tarjetas en Misceláneas.
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </ScrollArea>
              </CardContent>
          </div>
      </DialogContent>

      <Dialog
        open={isUploadModalOpen}
        onOpenChange={(open) => {
          if (!isUploadingRefDoc) {
            setIsUploadModalOpen(open);
            if (!open) resetUploadModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Subir a Documentación de Referencia
            </DialogTitle>
            <DialogDescription className="text-xs">
              Arrastrá el documento aquí. El título y los comentarios son opcionales.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploadingRefDoc) setIsDraggingRefFile(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingRefFile(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingRefFile(false);
                if (isUploadingRefDoc) return;
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) {
                  setUploadFile(droppedFile);
                }
              }}
              onClick={() => {
                if (!isUploadingRefDoc) fileInputRef.current?.click();
              }}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                isDraggingRefFile
                  ? "border-primary bg-primary/10"
                  : uploadFile
                  ? "border-emerald-500/60 bg-emerald-50/40"
                  : "border-zinc-300 hover:border-primary/60 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) setUploadFile(selected);
                }}
              />
              {uploadFile ? (
                <>
                  <FileText className="h-8 w-8 text-emerald-600" />
                  <div className="space-y-0.5 max-w-full overflow-hidden">
                    <p className="text-xs font-bold text-foreground truncate px-2">{uploadFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  {!isUploadingRefDoc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-muted-foreground hover:text-destructive mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Cambiar archivo
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Tirá el documento acá o hacé clic para seleccionarlo
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Soporta archivos PDF y documentos de referencia (Firebase Storage)
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-doc-title" className="text-xs font-semibold flex items-center justify-between">
                <span>Título</span>
                <span className="text-[10px] font-normal text-muted-foreground">(Opcional)</span>
              </Label>
              <Input
                id="ref-doc-title"
                placeholder="Ej: Informe Ambiente Costero..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                disabled={isUploadingRefDoc}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-doc-comments" className="text-xs font-semibold flex items-center justify-between">
                <span>Comentarios</span>
                <span className="text-[10px] font-normal text-muted-foreground">(Opcional)</span>
              </Label>
              <Textarea
                id="ref-doc-comments"
                placeholder="Notas, alcance o descripción breve del documento..."
                value={uploadComments}
                onChange={(e) => setUploadComments(e.target.value)}
                disabled={isUploadingRefDoc}
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            {isUploadingRefDoc && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Subiendo a Firebase Storage...</span>
                  <span>{uploadRefProgress}%</span>
                </div>
                <Progress value={uploadRefProgress} className="h-1.5" />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant={isUploadingRefDoc ? "destructive" : "outline"}
              size="sm"
              onClick={handleCancelRefUpload}
              className="gap-1.5"
            >
              {isUploadingRefDoc ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancelar subida
                </>
              ) : (
                'Cancelar'
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!uploadFile || isUploadingRefDoc}
              onClick={handleUploadReferenceDocument}
              className="gap-1.5"
            >
              {isUploadingRefDoc ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Subir documento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(duplicateCandidate)}
        onOpenChange={(open) => {
          if (!open) setDuplicateCandidate(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Posible archivo duplicado
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Ya existe un archivo en <strong>Documentación de Referencia</strong> con el mismo nombre y tamaño (
              <span className="font-semibold text-foreground">{duplicateCandidate?.fileName}</span> —{' '}
              {duplicateCandidate ? formatFileSize(duplicateCandidate.fileSize) : ''}).
              <br />
              ¿Qué acción deseás realizar?
            </DialogDescription>
          </DialogHeader>

          {uploadFile && (
            <div className="rounded-lg bg-muted/40 border p-3 text-xs space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                • <strong>Sobreescribir:</strong> reemplaza el documento existente por esta nueva versión.
              </p>
              <p className="text-[11px] text-muted-foreground">
                • <strong>Conservar ambos:</strong> guarda el nuevo archivo como{' '}
                <span className="font-mono font-semibold text-foreground">
                  {getNextEnumeratedFileName(uploadFile.name, referenceDocs)}
                </span>
                .
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDuplicateCandidate(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (duplicateCandidate) {
                  executeUploadReferenceDocument({ mode: 'keep-both' });
                }
              }}
            >
              Conservar ambos
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (duplicateCandidate) {
                  executeUploadReferenceDocument({
                    mode: 'overwrite',
                    targetDoc: duplicateCandidate,
                  });
                }
              }}
            >
              Sobreescribir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal compacto de aviso para descarga directa de archivos únicos */}
      <Dialog
        open={Boolean(downloadWarningTarget)}
        onOpenChange={(open) => {
          if (!open) setDownloadWarningTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px] w-full max-w-[calc(100vw-2rem)] bg-white p-5 border-zinc-200 overflow-hidden">
          <DialogHeader className="gap-1.5 min-w-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <FileDown className="h-4 w-4" />
              </div>
              <span className="truncate">Descarga directa de documento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Para preservar el formato visual original del documento y evitar desconfiguraciones que se producen en visores web (como Google Docs o Sheets), este recurso se descargará directamente a su equipo.
            </DialogDescription>
          </DialogHeader>

          {downloadWarningTarget && (
            <div className="my-2 w-full min-w-0 max-w-full rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 flex items-start gap-3 overflow-hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white border border-zinc-200 shadow-xs shrink-0 mt-0.5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs font-bold text-foreground leading-snug line-clamp-2 break-words">
                  {downloadWarningTarget.title}
                </p>
                <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5" title={downloadWarningTarget.fileName}>
                  {downloadWarningTarget.fileName}
                </p>
                {downloadWarningTarget.fileSize && downloadWarningTarget.fileSize > 0 ? (
                  <span className="inline-block mt-1.5 text-[9px] text-zinc-600 font-semibold bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                    {formatFileSize(downloadWarningTarget.fileSize)}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 w-full min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDownloadWarningTarget(null)}
              className="h-8 text-xs shrink-0"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (downloadWarningTarget) {
                  handleExecuteDownload(downloadWarningTarget.url, downloadWarningTarget.fileName);
                  setDownloadWarningTarget(null);
                }
              }}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar documento de referencia */}
      <Dialog
        open={Boolean(docToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingRefDocId) setDocToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px] w-full max-w-[calc(100vw-2rem)] bg-white p-5 border-zinc-200 overflow-hidden">
          <DialogHeader className="gap-1.5 min-w-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                <Trash2 className="h-4 w-4" />
              </div>
              <span className="truncate">Eliminar documento de referencia</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              ¿Estás seguro de que deseás eliminar este documento de la Biblioteca de Recursos? Esta acción eliminará el archivo de forma permanente y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {docToDelete && (
            <div className="my-2 w-full min-w-0 max-w-full rounded-lg border border-red-100 bg-red-50/50 p-3 flex items-start gap-3 overflow-hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white border border-red-200 shadow-xs shrink-0 mt-0.5">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs font-bold text-foreground leading-snug line-clamp-2 break-words">
                  {docToDelete.title || docToDelete.fileName}
                </p>
                <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5" title={docToDelete.fileName}>
                  {docToDelete.fileName}
                </p>
                {docToDelete.fileSize && docToDelete.fileSize > 0 ? (
                  <span className="inline-block mt-1.5 text-[9px] text-zinc-600 font-semibold bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                    {formatFileSize(docToDelete.fileSize)}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 w-full min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(deletingRefDocId)}
              onClick={() => setDocToDelete(null)}
              className="h-8 text-xs shrink-0"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={Boolean(deletingRefDocId)}
              onClick={() => {
                if (docToDelete) {
                  handleDeleteReferenceDoc(docToDelete);
                }
              }}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              {deletingRefDocId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de información y metadatos de Recurso Interno (con modo edición y versionado) */}
      <Dialog
        open={Boolean(selectedResourceInfo)}
        onOpenChange={(open) => {
          if (!open && !isSavingResource) {
            setSelectedResourceInfo(null);
            setIsEditingResource(false);
            setNewVersionFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] w-full max-w-[calc(100vw-2rem)] bg-white p-5 border-zinc-200 overflow-hidden">
          <DialogHeader className="gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground truncate">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 shrink-0">
                  <Info className="h-4 w-4" />
                </div>
                <span className="truncate">
                  {isEditingResource ? 'Editar Recurso Institucional' : 'Información del Recurso'}
                </span>
              </DialogTitle>
              {!isEditingResource && selectedResourceInfo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingResource(true);
                    setEditTitle(selectedResourceInfo.title || '');
                    setEditDescription(selectedResourceInfo.description || '');
                    setEditDriveUrl(selectedResourceInfo.url || '');
                    setNewVersionFile(null);
                  }}
                  className="h-7 text-xs gap-1.5 border-zinc-200 shrink-0 hover:bg-zinc-100"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-0.5 leading-relaxed">
              {isEditingResource
                ? 'Modifique el título, descripción, vínculo de Drive o suba una nueva versión del archivo.'
                : 'Detalles técnicos, metadatos y origen del recurso institucional.'}
            </DialogDescription>
          </DialogHeader>

          {selectedResourceInfo && !isEditingResource && (
            <div className="space-y-3 py-1 w-full min-w-0 max-w-full overflow-hidden">
              {/* Cabecera del recurso */}
              <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 flex items-start gap-3 overflow-hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white border border-zinc-200 shadow-xs shrink-0 mt-0.5">
                  {selectedResourceInfo.isFolder ? (
                    <FolderIcon className="h-5 w-5 text-amber-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-foreground leading-snug line-clamp-2 break-words">
                    {selectedResourceInfo.title}
                  </p>
                  {selectedResourceInfo.fileName && (
                    <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5" title={selectedResourceInfo.fileName}>
                      {selectedResourceInfo.fileName}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase font-semibold">
                      {selectedResourceInfo.format === 'folder'
                        ? 'Carpeta Drive'
                        : selectedResourceInfo.format?.toUpperCase() || 'Archivo'}
                    </Badge>
                    {selectedResourceInfo.fileSizeText && (
                      <span className="text-[9px] text-zinc-500 font-semibold bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                        {selectedResourceInfo.fileSizeText}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla de metadatos */}
              <div className="rounded-lg border border-zinc-200/70 divide-y divide-zinc-100 text-xs overflow-hidden">
                {selectedResourceInfo.description && (
                  <div className="p-2.5 bg-white">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Descripción</span>
                    <p className="text-[11px] text-zinc-700 leading-relaxed break-words">{selectedResourceInfo.description}</p>
                  </div>
                )}
                {selectedResourceInfo.fileName && (
                  <div className="p-2.5 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">Nombre de archivo</span>
                    <span className="text-[11px] font-mono text-zinc-800 truncate" title={selectedResourceInfo.fileName}>
                      {selectedResourceInfo.fileName}
                    </span>
                  </div>
                )}
                {selectedResourceInfo.fileSizeText && (
                  <div className="p-2.5 bg-white flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Tamaño</span>
                    <span className="text-[11px] font-semibold text-zinc-800">{selectedResourceInfo.fileSizeText}</span>
                  </div>
                )}
                {selectedResourceInfo.createdAtText && (
                  <div className="p-2.5 bg-zinc-50/50 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Fecha de registro</span>
                    <span className="text-[11px] text-zinc-700 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-zinc-400" />
                      {selectedResourceInfo.createdAtText}
                    </span>
                  </div>
                )}
                {selectedResourceInfo.uploadedBy && (
                  <div className="p-2.5 bg-white flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Origen / Autor</span>
                    <span className="text-[11px] font-semibold text-zinc-800">{selectedResourceInfo.uploadedBy}</span>
                  </div>
                )}
                <div className="p-2.5 bg-zinc-50/50 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de acceso</span>
                  <span className="text-[11px] text-zinc-700">
                    {selectedResourceInfo.isFolder
                      ? 'Acceso directo a carpeta compartida de Google Drive'
                      : 'Descarga directa con protección de formato'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedResourceInfo && isEditingResource && (
            <div className="space-y-3 py-1 w-full min-w-0 max-w-full overflow-hidden">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Título del Recurso</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ej: Plan de Gestión Ambiental (PGA Modelo)"
                  className="h-8 text-xs bg-white border-zinc-300"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Descripción</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalles sobre el uso, alcance o vigencia del recurso..."
                  className="min-h-[70px] text-xs bg-white border-zinc-300 resize-none leading-relaxed"
                />
              </div>

              {selectedResourceInfo.isFolder ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Enlace a Carpeta en Google Drive</Label>
                  <Input
                    value={editDriveUrl}
                    onChange={(e) => setEditDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="h-8 text-xs font-mono bg-white border-zinc-300"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Los usuarios accederán directamente a esta carpeta al hacer clic sobre la tarjeta.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Versión del Archivo</Label>
                    {selectedResourceInfo.fileName && (
                      <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]" title={selectedResourceInfo.fileName}>
                        Actual: {selectedResourceInfo.fileName}
                      </span>
                    )}
                  </div>

                  <input
                    ref={editFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".docx,.doc,.xlsx,.xls,.pdf,.pptx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewVersionFile(file);
                      }
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-full h-8 text-xs gap-1.5 justify-center border-dashed border-zinc-300 hover:bg-zinc-50 text-zinc-700"
                  >
                    <Upload className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{newVersionFile ? 'Cambiar archivo seleccionado' : 'Cargar nueva versión de archivo...'}</span>
                  </Button>

                  {newVersionFile && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 flex items-center justify-between gap-2 overflow-hidden">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-emerald-950 truncate">{newVersionFile.name}</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          {(newVersionFile.size / 1024).toFixed(1)} KB · Se subirá a Storage y reemplazará la versión actual al guardar.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setNewVersionFile(null)}
                        className="h-6 w-6 text-emerald-800 hover:text-red-600 hover:bg-white/60 shrink-0"
                        title="Quitar nuevo archivo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 w-full min-w-0">
            {isEditingResource ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingResource}
                  onClick={() => {
                    setIsEditingResource(false);
                    setNewVersionFile(null);
                  }}
                  className="h-8 text-xs shrink-0"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingResource}
                  onClick={handleSaveResource}
                  className="h-8 text-xs gap-1.5 shrink-0"
                >
                  {isSavingResource ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Guardar cambios</span>
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedResourceInfo(null)}
                  className="h-8 text-xs shrink-0"
                >
                  Cerrar
                </Button>
                {selectedResourceInfo && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const target = selectedResourceInfo;
                      setSelectedResourceInfo(null);
                      if (target.isFolder) {
                        window.open(target.url, '_blank', 'noopener,noreferrer');
                      } else {
                        setDownloadWarningTarget({
                          title: target.title,
                          fileName: target.fileName || `${target.title}.docx`,
                          url: target.url,
                        });
                      }
                    }}
                    className="h-8 text-xs gap-1.5 shrink-0"
                  >
                    {selectedResourceInfo.isFolder ? (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir carpeta
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Descargar archivo
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
