
'use client';

import * as React from 'react';
import { Sidebar } from '@/timeline/components/sidebar';
import { Header } from '@/timeline/components/header';
import { Timeline } from '@/timeline/components/timeline';
import { MilestoneDetail } from '@/timeline/components/milestone-detail';
import { type Milestone, type Category, type AssociatedFile } from '@/timeline/types';
import { CATEGORIES } from '@/timeline/lib/data';
import { useToast } from '@/hooks/use-toast';
import { addMonths, endOfDay, parseISO, startOfDay, subMonths, subYears, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { 
    getCardAttachments, 
    type TrelloCardBasic, 
    getCardActions, 
    attachUrlToCard, 
    deleteAttachmentFromCard, 
    deleteAction, 
    getCardById 
} from '@/timeline/services/trello';
import { FileUpload } from '@/timeline/components/file-upload';
import { MilestoneSummaryTable } from '@/timeline/components/milestone-summary-sheet';
import { WelcomeScreen } from '@/timeline/components/welcome-screen';
import { RSA060_MILESTONES } from '@/timeline/lib/rsa060-data';
import { FeedbackButton } from '@/timeline/components/feedback-button';
import { FeedbackDialog } from '@/timeline/components/feedback-dialog';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, setDoc, addDoc, getDocs, writeBatch, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { uploadFileToDrive, getOrCreateProjectFolder, findFileInFolder, deleteFileFromDrive } from '@/timeline/services/google-drive';
import { Buffer } from 'buffer';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
import { FileConflictDialog, type ConflictStrategy } from '@/timeline/components/file-conflict-dialog';

function getTrelloObjectCreationDate(trelloId: string): Date {
    const timestampHex = trelloId.substring(0, 8);
    const timestampSeconds = parseInt(timestampHex, 16);
    return new Date(timestampSeconds * 1000);
}

function HomeContent() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ start: Date; end: Date } | null>(null);
  const [selectedMilestone, setSelectedMilestone] = React.useState<Milestone | null>(null);
  const [selectedCard, setSelectedCard] = React.useState<TrelloCardBasic | null>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [view, setView] = React.useState<'timeline' | 'summary'>('timeline');
  const [cardFromUrl, setCardFromUrl] = React.useState<TrelloCardBasic | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadText, setUploadText] = React.useState('');

  const [selectedBoard, setSelectedBoard] = React.useState('');
  const [selectedList, setSelectedList] = React.useState('');
  const [cardSearchTerm, setCardSearchTerm] = React.useState('');

  const [isConflictDialogOpen, setIsConflictDialogOpen] = React.useState(false);
  const [pendingUploadData, setPendingUploadData] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<any[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cardIdParam = searchParams.get('cardId');
  const firestore = useFirestore();
  const syncPerformedForCard = React.useRef<string | null>(null);
  const { toast } = useToast();

  const [firestoreCategories, setFirestoreCategories] = React.useState<Category[]>([]);
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(true);

  // Cargar Categorías desde Firestore usando nombre original
  React.useEffect(() => {
    if (!firestore) return;
    const unsubscribe = onSnapshot(collection(firestore, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      if (cats.length > 0) {
          setFirestoreCategories(cats);
      }
    });
    return () => unsubscribe();
  }, [firestore]);

  const categories = React.useMemo(() => {
    return firestoreCategories.length > 0 ? firestoreCategories : CATEGORIES;
  }, [firestoreCategories]);

  // Cargar Hitos cuando cambia el proyecto seleccionado (Nombre original 'projects')
  React.useEffect(() => {
    if (!firestore || !selectedCard || selectedCard.id === 'training-rsa999') {
        if (!selectedCard) setIsLoadingTimeline(false);
        return;
    }

    setIsLoadingTimeline(true);
    const q = collection(firestore, 'projects', selectedCard.id, 'milestones');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ms = snapshot.docs.map(d => {
          const data = d.data();
          const currentCat = categories.find(c => c.id === data.category?.id);
          return { 
              id: d.id, 
              ...data,
              category: currentCat || data.category
          } as Milestone;
      });
      setMilestones(ms);
      setIsLoadingTimeline(false);
    }, (error) => {
        console.error("Error loading milestones:", error);
        setIsLoadingTimeline(false);
    });

    return () => unsubscribe();
  }, [firestore, selectedCard, categories]);

  // Sincronización de URL
  React.useEffect(() => {
    if (!cardIdParam) {
        if (selectedCard !== null) setSelectedCard(null);
        syncPerformedForCard.current = null;
        return;
    }

    if (cardIdParam && (!selectedCard || selectedCard.id !== cardIdParam)) {
        const fetchCard = async () => {
            try {
                const card = await getCardById(cardIdParam);
                if (card) {
                    setSelectedCard(card);
                    setCardFromUrl(card);
                }
            } catch (error) {
                console.error("Error fetching card from URL param:", error);
            }
        };
        fetchCard();
    }
  }, [cardIdParam]);

  const displayedMilestones = React.useMemo(() => {
    if (selectedCard?.id === 'training-rsa999') {
        return RSA060_MILESTONES.map(m => {
            const currentCat = categories.find(c => c.id === m.category.id);
            return currentCat ? { ...m, category: currentCat } : m;
        });
    }
    return milestones || [];
  }, [selectedCard, milestones, categories]);

  const filteredMilestones = React.useMemo(() => {
    return (displayedMilestones || [])
    .filter(milestone => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return [milestone.name, milestone.description, milestone.category.name, ...(milestone.tags || [])]
        .some(text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedTerm));
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [displayedMilestones, searchTerm]);

  const [isResizing, setIsResizing] = React.useState(false);
  const [timelinePanelHeight, setTimelinePanelHeight] = React.useState(40);
  const resizeContainerRef = React.useRef<HTMLDivElement>(null);
  const milestoneDateBounds = React.useRef<{start: string; end: string} | null>(null);

  const handleCardSelect = React.useCallback(async (card: TrelloCardBasic | null) => {
    setSelectedCard(card);
    setSelectedMilestone(null);
    if (card) {
        router.push(`${pathname}?cardId=${card.id}`);
    } else {
        router.push(pathname);
    }
  }, [router, pathname]);
  
  // Motor de Sincronización Trello -> Firestore usando nombres originales
  React.useEffect(() => {
    const syncTrelloToFirestore = async () => {
        if (!selectedCard || !firestore || syncPerformedForCard.current === selectedCard.id) {
            return;
        }

        if (selectedCard.id === 'training-rsa999') {
            syncPerformedForCard.current = selectedCard.id;
            return;
        }

        syncPerformedForCard.current = selectedCard.id;
        
        try {
            const projectRef = doc(firestore, 'projects', selectedCard.id);
            const codeMatch = selectedCard.name.match(/\b([A-Z]{3}\d{3})\b/i);
            const projectData = {
                name: selectedCard.name,
                code: codeMatch ? codeMatch[0].toUpperCase() : null
            };
            
            setDoc(projectRef, projectData, { merge: true });

            const [attachments, actions] = await Promise.all([
                getCardAttachments(selectedCard.id),
                getCardActions(selectedCard.id),
            ]);

            const currentTrelloAttachmentIds = new Set(attachments.map(a => a.id));
            const currentTrelloActionIds = new Set(actions.map(a => a.id));
            
            const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
            const existingDocsSnapshot = await getDocs(milestonesRef);
            
            const existingHitosByTrelloId = new Map();
            const batch = writeBatch(firestore);
            let hasChanges = false;

            existingDocsSnapshot.docs.forEach(d => {
                const data = d.data() as Milestone;
                let milestoneChanged = false;

                const validFiles = (data.associatedFiles || []).filter(f => {
                    if (f.trelloId && !currentTrelloAttachmentIds.has(f.trelloId)) {
                        milestoneChanged = true;
                        return false;
                    }
                    return true;
                });

                if (milestoneChanged) {
                    batch.update(d.ref, { 
                        associatedFiles: validFiles,
                        history: [...(data.history || []), `${format(new Date(), "PPpp", { locale: es })} - Limpieza automática: se removió un archivo que ya no existe en Trello.`]
                    });
                    hasChanges = true;
                }

                (data.associatedFiles || []).forEach(f => {
                    if (f.trelloId) existingHitosByTrelloId.set(f.trelloId, d.id);
                });
                if (d.id.startsWith('hito-')) {
                   const possibleTrelloId = d.id.replace('hito-', '');
                   existingHitosByTrelloId.set(possibleTrelloId, d.id);
                }
            });

            const systemCategory = categories.find(c => c.id === 'cat-sistema') || { id: 'cat-sistema', name: 'Sistema', color: '#000000' };
            const creationDate = getTrelloObjectCreationDate(selectedCard.id);
            const creationMilestone: Milestone = {
              id: `hito-creacion-${selectedCard.id}`,
              name: 'Ingreso al sistema',
              description: `La tarjeta de Trello fue creada en esta fecha.`,
              occurredAt: creationDate.toISOString(),
              category: systemCategory,
              tags: ['sistema', 'creación'],
              associatedFiles: [],
              isImportant: false,
              history: [`${format(new Date(), "PPpp", { locale: es })} - Hito de creación generado automáticamente.`],
            };

            const defaultCategory = categories.find(c => c.name.toLowerCase().includes('trello')) || CATEGORIES[1];
            const attachmentMilestones: Milestone[] = attachments
              .filter(att => !existingHitosByTrelloId.has(att.id))
              .map(att => {
                const fileType: AssociatedFile['type'] = att.mimeType.startsWith('image/') ? 'image' : att.mimeType.startsWith('video/') ? 'video' : att.mimeType.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => att.mimeType.includes(t)) ? 'document' : 'other';
                const associatedFile: AssociatedFile = { 
                    id: att.id, 
                    trelloId: att.id, 
                    name: att.fileName, 
                    size: `${(att.bytes / 1024).toFixed(2)} KB`, 
                    type: fileType, 
                    url: att.url 
                };
                return {
                    id: `hito-${att.id}`,
                    name: att.fileName,
                    description: `Archivo adjuntado a la tarjeta de Trello el ${new Date(att.date).toLocaleDateString()}.`,
                    occurredAt: att.date,
                    category: defaultCategory, tags: ['adjunto'], associatedFiles: [associatedFile], isImportant: false,
                    history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde Trello.`],
                };
            });
            
            const commentsCategory = categories.find(c => c.id === 'cat-10') || { id: 'cat-10', name: 'Comentarios', color: '#607D8B' };
            const activityCategory = categories.find(c => c.id === 'cat-11') || { id: 'cat-11', name: 'Actividad de Tarjeta', color: '#9E9E9E' };

            const actionMilestones: Milestone[] = actions
              .filter(action => !existingHitosByTrelloId.has(action.id))
              .map(action => {
                let milestone: Milestone | null = null;
                if (action.type === 'commentCard' && action.data.text) {
                    milestone = { id: `hito-${action.id}`, name: `Comentario de ${action.memberCreator.fullName}`, description: action.data.text, occurredAt: action.date, category: commentsCategory, tags: ['comentario'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                } else if (action.type === 'updateCard' && action.data.listAfter && action.data.listBefore) {
                    milestone = { id: `hito-${action.id}`, name: `Tarjeta movida`, description: `Movida de "${action.data.listBefore.name}" a "${action.data.listAfter.name}" por ${action.memberCreator.fullName}.`, occurredAt: action.date, category: activityCategory, tags: ['actividad', 'movimiento'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                }
                return milestone;
            }).filter((m): m is Milestone => m !== null);

            const allTrelloItems = [creationMilestone, ...attachmentMilestones, ...actionMilestones];
            
            const idsToRemove = existingDocsSnapshot.docs
              .filter(d => d.id.startsWith('hito-'))
              .map(d => d.id)
              .filter(id => {
                  if (id.includes('creacion')) return false;
                  const possibleId = id.replace('hito-', '');
                  return !currentTrelloAttachmentIds.has(possibleId) && !currentTrelloActionIds.has(possibleId);
              });

            if (allTrelloItems.length > 0 || idsToRemove.length > 0 || hasChanges) {
                allTrelloItems.forEach(milestone => {
                    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', milestone.id);
                    batch.set(milestoneRef, milestone, { merge: true });
                });
                idsToRemove.forEach(id => {
                    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', id);
                    batch.delete(milestoneRef);
                });
                batch.commit().catch(err => console.error("Error committing sync batch:", err));
            }
        } catch (error: any) {
            console.error("Error synchronizing Trello:", error);
            syncPerformedForCard.current = null;
        }
    };

    syncTrelloToFirestore();
  }, [selectedCard, firestore, categories]);


  const executeFinalUpload = React.useCallback(async (data: any, folderId: string | null, resolutions: Record<string, ConflictStrategy>) => {
    const { files, categoryId, name, description, occurredAt } = data;
    const category = categories.find((c: any) => c.id === categoryId);
    if (!category || !selectedCard || !firestore) {
        setIsUploading(false);
        return;
    }

    setIsUploading(true);
    const { id: toastId, dismiss } = toast({
      title: "Procesando archivos...",
      description: "Por favor, espera.",
      duration: Infinity,
    });

    try {
      const associatedFiles: AssociatedFile[] = [];
      if (files && files.length > 0 && folderId) {
        const totalFiles = files.length;
        for (const [index, file] of files.entries()) {
          const strategy = resolutions[file.name] || 'rename';
          if (strategy === 'omit') continue;

          setUploadText(`Subiendo: ${file.name}`);
          setUploadProgress(((index) / totalFiles) * 100);
          
          const arrayBuffer = await file.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          let targetName = file.name;
          let existingId = strategy === 'overwrite' ? conflicts.find(c => c.name === file.name)?.existingId : undefined;

          if (strategy === 'rename') {
             let counter = 1;
             let nameParts = file.name.split('.');
             let ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
             let baseName = nameParts.join('.');
             
             let currentTryName = file.name;
             let alreadyExists = conflicts.some(c => c.name === currentTryName);
             
             while (alreadyExists) {
                currentTryName = `${baseName} (${counter})${ext}`;
                const check = await findFileInFolder(folderId, currentTryName);
                if (!check) break;
                counter++;
             }
             targetName = currentTryName;
          }

          const driveResult = await uploadFileToDrive(targetName, file.type, base64Data, folderId, existingId);
          
          const currentTrelloAttachments = await getCardAttachments(selectedCard.id);
          const duplicates = currentTrelloAttachments.filter(a => a.fileName === targetName);
          for (const dup of duplicates) {
              await deleteAttachmentFromCard(selectedCard.id, dup.id);
          }

          const trelloAtt = await attachUrlToCard(selectedCard.id, driveResult.name, driveResult.webViewLink);
          
          associatedFiles.push({
            id: driveResult.id,
            name: driveResult.name,
            size: `${(file.size / 1024).toFixed(2)} KB`,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => file.type.includes(t)) ? 'document' : 'other',
            url: driveResult.webViewLink,
            driveId: driveResult.id,
            trelloId: trelloAtt?.id
          });
          
          setUploadProgress(((index + 1) / totalFiles) * 100);
        }
      }
      
      const targetDate = new Date(occurredAt);
      targetDate.setHours(0, 0, 0, 0);

      const dayMilestones = (milestones || []).filter(m => {
        const mDate = parseISO(m.occurredAt);
        return isSameDay(mDate, targetDate);
      });
      
      const finalDate = new Date(targetDate);
      if (dayMilestones.length > 0) {
        const minutesArray = dayMilestones.map(m => {
            const d = parseISO(m.occurredAt);
            return d.getHours() * 60 + d.getMinutes();
        });
        const maxMins = Math.max(...minutesArray);
        const nextMins = Math.max(7 * 60, maxMins + 10);
        finalDate.setHours(Math.floor(nextMins / 60), nextMins % 60, 0, 0);
      } else {
        finalDate.setHours(7, 0, 0, 0);
      }

      const newMilestoneData = {
          name: name,
          description: description,
          occurredAt: finalDate.toISOString(),
          category: { id: category.id, name: category.name, color: category.color },
          tags: ['manual'],
          associatedFiles: associatedFiles,
          isImportant: false,
          history: [`${format(new Date(), "PPpp", { locale: es })} - Creación de hito con ${associatedFiles.length} archivo(s).`],
      };

      const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
      addDoc(milestonesRef, newMilestoneData);
      
      setIsUploadOpen(false);
      dismiss(toastId);
      toast({ title: "Hito creado" });
    } catch (error: any) {
        console.error("Upload error:", error);
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error en la carga", description: error.message });
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadText('');
        setConflicts([]);
        setPendingUploadData(null);
    }
  }, [categories, selectedCard, firestore, toast, milestones, conflicts]);

  const handleUpload = React.useCallback(async (data: { files?: File[], categoryId: string, name: string, description: string, occurredAt: Date }) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
        toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden crear hitos para el proyecto de entrenamiento." });
        return;
    }

    const { files, categoryId } = data;
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const codeMatch = selectedCard.name.match(/\b([A-Z]{3}\d{3})\b/i);
    const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

    if (files && files.length > 0) {
        setIsUploading(true);
        setUploadText("Escaneando Drive...");
        try {
            const folderId = await getOrCreateProjectFolder(projectCode);
            const foundConflicts = [];
            for (const file of files) {
                const existing = await findFileInFolder(folderId, file.name);
                if (existing) {
                    foundConflicts.push({ name: file.name, existingId: existing.id });
                }
            }

            if (foundConflicts.length > 0) {
                setConflicts(foundConflicts);
                setPendingUploadData({ ...data, folderId });
                setIsConflictDialogOpen(true);
                return;
            } else {
                executeFinalUpload(data, folderId, {});
            }
        } catch (error: any) {
            setIsUploading(false);
            toast({ variant: "destructive", title: "Error al verificar Drive", description: error.message });
        }
    } else {
        executeFinalUpload(data, null, {});
    }
  }, [categories, selectedCard, firestore, toast, executeFinalUpload]);

  const handleConflictResolve = (resolutions: Record<string, ConflictStrategy>) => {
    setIsConflictDialogOpen(false);
    if (pendingUploadData) {
        executeFinalUpload(pendingUploadData, pendingUploadData.folderId, resolutions);
    }
  };

  const handleMilestoneUpdate = React.useCallback((updatedMilestone: Milestone) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
      toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden guardar cambios para el proyecto de entrenamiento." });
      return;
    }

    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', updatedMilestone.id);
    updateDoc(milestoneRef, updatedMilestone as any);
    toast({ title: "Hito actualizado" });
    if (selectedMilestone && selectedMilestone.id === updatedMilestone.id) {
        setSelectedMilestone(updatedMilestone);
    }
  }, [selectedCard, selectedMilestone, firestore, toast]);

  const handleMilestoneDelete = React.useCallback(async (milestoneId: string) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
      toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden borrar hitos del proyecto de entrenamiento." });
      return;
    }

    const hitoToDelete = milestones?.find(m => m.id === milestoneId);
    if (!hitoToDelete) return;

    const { id: toastId, dismiss } = toast({
      title: "Eliminando hito...",
      description: "Por favor, espera.",
      duration: Infinity,
    });

    try {
        for (const file of hitoToDelete.associatedFiles) {
            if (file.trelloId) await deleteAttachmentFromCard(selectedCard.id, file.trelloId);
            const driveId = file.driveId || (file.id && !file.trelloId ? file.id : null);
            if (driveId) await deleteFileFromDrive(driveId);
        }

        if (milestoneId.startsWith('hito-') && hitoToDelete.tags?.includes('comentario')) {
            const trelloObjectId = milestoneId.replace('hito-', '');
            await deleteAction(trelloObjectId);
        }
        
        dismiss(toastId);
    } catch (e) {
        dismiss(toastId);
    }

    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', milestoneId);
    deleteDoc(milestoneRef);
    toast({ title: "Hito eliminado" });
    setSelectedMilestone(null);
  }, [selectedCard, firestore, toast, milestones]);


  const handleSetRange = React.useCallback((rangeType: '1D' | '1M' | '1Y' | 'All') => {
    if (rangeType === 'All') {
        if (milestoneDateBounds.current) {
            setDateRange({ start: subMonths(parseISO(milestoneDateBounds.current.start), 1), end: addMonths(parseISO(milestoneDateBounds.current.end), 1) });
        }
        return;
    }
    const now = new Date();
    if (rangeType === '1D') setDateRange({ start: startOfDay(now), end: endOfDay(now) });
    else if (rangeType === '1M') setDateRange({ start: subMonths(now, 1), end: now });
    else if (rangeType === '1Y') setDateRange({ start: subYears(now, 1), end: now });
  }, []);

  const handleMilestoneClick = React.useCallback((milestone: Milestone) => {
    setSelectedMilestone(milestone);
  }, []);

  const handleDetailClose = React.useCallback(() => {
    setSelectedMilestone(null);
  }, []);
  
  const handleGoHome = React.useCallback(() => {
    router.push(pathname);
    setSelectedCard(null);
    setSelectedMilestone(null);
    setCardFromUrl(null);
    setSearchTerm('');
    setSelectedBoard('');
    setSelectedList('');
    setCardSearchTerm('');
    setView('timeline');
    syncPerformedForCard.current = null;
  }, [router, pathname]);

  const handleCategoryColorChange = React.useCallback((categoryId: string, color: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'categories', categoryId);
    updateDoc(catRef, { color });
  }, [firestore]);
  
  const handleCategoryAdd = React.useCallback((name: string) => {
    if (!firestore) return;
    const DEFAULT_COLORS = ['#a3e635', '#22c55e', '#14b8a6', '#0ea5e9', '#4f46e5', '#8b5cf6', '#be185d', '#f97316', '#facc15'];
    const color = DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];
    addDoc(collection(firestore, 'categories'), { name, color });
  }, [firestore, categories]);

  const handleCategoryUpdate = React.useCallback((categoryId: string, name: string) => {
    if (!firestore) return;
    const newName = name.trim();
    if (!newName) return;
    const catRef = doc(firestore, 'categories', categoryId);
    updateDoc(catRef, { name: newName });
  }, [firestore]);
  
  const handleCategoryDelete = React.useCallback((categoryId: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'categories', categoryId);
    deleteDoc(catRef);
  }, [firestore]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };
  
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeContainerRef.current) return;
      const container = resizeContainerRef.current;
      const rect = container.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      let newHeightPercent = (newHeight / rect.height) * 100;
      if (newHeightPercent < 20) newHeightPercent = 20;
      if (newHeightPercent > 80) newHeightPercent = 80;
      setTimelinePanelHeight(newHeightPercent);
    };

    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  React.useEffect(() => {
    if (displayedMilestones.length > 0) {
      const allDates = displayedMilestones.map(m => parseISO(m.occurredAt));
      const oldest = new Date(Math.min(...allDates.map(d => d.getTime())));
      const newest = new Date(Math.max(...allDates.map(d => d.getTime())));
      const newBounds = { start: oldest.toISOString(), end: newest.toISOString() };
      const hasBoundsChanged = newBounds.start !== milestoneDateBounds.current?.start || newBounds.end !== milestoneDateBounds.current?.end;
      if (hasBoundsChanged) {
        milestoneDateBounds.current = newBounds;
        setDateRange({ start: subMonths(oldest, 1), end: addMonths(newest, 1) });
      }
    } else {
        milestoneDateBounds.current = null;
        setDateRange(null);
    }
  }, [displayedMilestones]);

  const handleToggleView = () => setView(prev => prev === 'timeline' ? 'summary' : 'timeline');

  const handleSelectTrainingProject = () => {
    handleCardSelect({
        id: 'training-rsa999',
        name: 'Proyecto de Entrenamiento Maestro - RSA999',
        url: '',
        desc: 'Proyecto de ejemplo maestro con hitos de referencia para capacitación.'
    });
  };

  return (
    <div className="timeline-app-root flex h-screen w-full bg-background font-sans text-foreground">
      <Sidebar 
        categories={categories} 
        onCategoryColorChange={handleCategoryColorChange}
        onCategoryAdd={handleCategoryAdd}
        onCategoryUpdate={handleCategoryUpdate}
        onCategoryDelete={handleCategoryDelete}
        onCardSelect={handleCardSelect}
        selectedCard={selectedCard}
        onGoHome={handleGoHome}
        cardFromUrl={cardFromUrl}
        selectedBoard={selectedBoard}
        onBoardSelect={setSelectedBoard}
        selectedList={selectedList}
        onListSelect={setSelectedList}
        cardSearchTerm={cardSearchTerm}
        onCardSearchChange={setCardSearchTerm}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          onSetRange={handleSetRange}
          onToggleView={handleToggleView}
          view={view}
          onGoHome={handleGoHome}
          trelloCardUrl={selectedCard?.url ?? null}
          isProjectLoaded={!!selectedCard}
          onSelectTrainingProject={handleSelectTrainingProject}
        />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {selectedCard && (
              <div className="px-4 md:px-6 py-3 border-b bg-background shrink-0">
                  <h2 className="text-xl font-headline font-medium text-foreground truncate" title={selectedCard.name}>
                      {selectedCard.name}
                  </h2>
              </div>
          )}
          
          {selectedCard && selectedCard.id !== 'training-rsa999' && (
            <div className="absolute top-16 right-6 z-30 no-print">
               <TooltipProvider>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          className="h-10 w-10 shadow-lg rounded-md"
                          onClick={() => setIsUploadOpen(true)}
                        >
                          <Plus className="h-6 w-6" />
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent side="left">
                        <p>Hito nuevo</p>
                     </TooltipContent>
                  </Tooltip>
               </TooltipProvider>
            </div>
          )}

          <div ref={resizeContainerRef} className="flex-1 flex flex-col overflow-hidden">
            {view === 'timeline' ? (
              <>
                <main 
                  className="overflow-y-auto p-4 md:p-6"
                  style={{ height: selectedMilestone ? `${timelinePanelHeight}%` : '100%' }}
                >
                {isLoadingTimeline ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <h2 className="text-2xl font-medium font-headline mt-4">Cargando línea de tiempo...</h2>
                    </div>
                ) : (displayedMilestones.length > 0 && dateRange) || selectedCard?.id === 'training-rsa999' ? (
                    <div className="h-full w-full">
                        <Timeline 
                            milestones={filteredMilestones} 
                            startDate={dateRange?.start || subMonths(new Date(), 6)}
                            endDate={dateRange?.end || addMonths(new Date(), 6)}
                            onMilestoneClick={handleMilestoneClick}
                        />
                    </div>
                ) : (
                    <WelcomeScreen />
                )}
                </main>
                {selectedMilestone && (
                   <>
                      <div
                        onMouseDown={handleResizeMouseDown}
                        className="h-2 bg-border cursor-row-resize hover:bg-ring transition-colors flex-shrink-0"
                      />
                      <div className="flex-1 shrink-0 overflow-y-auto bg-zinc-300">
                          <MilestoneDetail
                              milestone={selectedMilestone}
                              categories={categories}
                              onMilestoneUpdate={handleMilestoneUpdate}
                              onMilestoneDelete={handleMilestoneDelete}
                              onClose={handleDetailClose}
                              projectName={selectedCard?.name || ''}
                              cardId={selectedCard?.id || null}
                          />
                      </div>
                   </>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto bg-zinc-200">
                <MilestoneSummaryTable milestones={filteredMilestones} projectName={selectedCard?.name} />
              </div>
            )}
          </div>
        </div>
      </div>

      <FileUpload
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        categories={categories}
        onUpload={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadText={uploadText}
      />
      
      <FileConflictDialog 
        isOpen={isConflictDialogOpen}
        conflicts={conflicts}
        onResolve={handleConflictResolve}
        onCancel={() => {
            setIsConflictDialogOpen(false);
            setIsUploading(false);
        }}
      />

      <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
      <FeedbackDialog isOpen={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <HomeContent />
    </React.Suspense>
  );
}
