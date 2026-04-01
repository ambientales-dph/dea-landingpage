
'use client';

import * as React from 'react';
import { Sidebar } from '@/timeline/components/sidebar';
import { Header } from '@/timeline/components/header';
import { Timeline } from '@/timeline/components/timeline';
import { MilestoneDetail } from '@/timeline/components/milestone-detail';
import { type Milestone, type Category, type AssociatedFile } from '@/timeline/types';
import { CATEGORIES } from '@/timeline/lib/data';
import { useToast } from '@/hooks/use-toast';
import { addMonths, parseISO, startOfDay, endOfDay, subMonths, subYears, format, isSameDay, subHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { 
    getCardAttachments, 
    getCardActions, 
    attachUrlToCard, 
    deleteAttachmentFromCard, 
    deleteAction, 
    getCardById,
    updateTrelloCard
} from '@/timeline/services/trello';
import { FileUpload } from '@/timeline/components/file-upload';
import { MilestoneSummaryTable } from '@/timeline/components/milestone-summary-sheet';
import { WelcomeScreen } from '@/timeline/components/welcome-screen';
import { RSA060_MILESTONES } from '@/timeline/lib/rsa060-data';
import { FeedbackDialog } from '@/timeline/components/feedback-dialog';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, setDoc, addDoc, getDocs, writeBatch, deleteDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { uploadFileToDrive, getOrCreateProjectFolder, findFileInFolder, deleteFileFromDrive, createMilestoneFolder } from '@/timeline/services/google-drive';
import { Buffer } from 'buffer';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
import { FileConflictDialog, type ConflictStrategy } from '@/timeline/components/file-conflict-dialog';
import { useProject } from '@/providers/project-provider';
import { WHITELIST } from '@/lib/auth-data';
import { type FileConfig } from '@/timeline/components/add-files-dialog';
import { TrashDialog } from '@/timeline/components/trash-dialog';

const STATUS_COLORS_HEX: Record<string, string | null> = {
    'Sin iniciar': 'red',
    'Iniciado': 'orange',
    'Neutralizado': 'pink',
    'Terminado': 'yellow',
    'Con DIA': 'green',
    'Rescindido': 'black',
    'En seguimiento': 'sky',
};

function getTrelloObjectCreationDate(trelloId: string): Date {
    const timestampHex = trelloId.substring(0, 8);
    const timestampSeconds = parseInt(timestampHex, 16);
    return new Date(timestampSeconds * 1000);
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardIdParam = searchParams.get('cardId');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const { allCards, selectedCard, setSelectedCard, refreshCards } = useProject();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ start: Date; end: Date } | null>(null);
  const [selectedMilestone, setSelectedMilestone] = React.useState<Milestone | null>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [isTrashOpen, setIsTrashOpen] = React.useState(false);
  const [isProcessingTrash, setIsProcessingTrash] = React.useState(false);
  const [view, setView] = React.useState<'timeline' | 'summary'>('timeline');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadText, setUploadText] = React.useState('');

  const [selectedBoard, setSelectedBoard] = React.useState('');
  const [selectedList, setSelectedList] = React.useState('');
  const [cardSearchTerm, setCardSearchTerm] = React.useState('');

  const [isConflictDialogOpen, setIsConflictDialogOpen] = React.useState(false);
  const [pendingUploadData, setPendingUploadData] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<any[]>([]);

  const syncPerformedForCard = React.useRef<string | null>(null);

  const [firestoreCategories, setFirestoreCategories] = React.useState<Category[]>([]);
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !user) return;
    const unsubscribe = onSnapshot(collection(firestore, 'timeline_categories'), (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      if (cats.length > 0) {
          setFirestoreCategories(cats);
      }
    }, (error) => {
        console.warn("Error en listener de categorías TL:", error.message);
    });
    return () => unsubscribe();
  }, [firestore, user]);

  const categories = React.useMemo(() => {
    return firestoreCategories.length > 0 ? firestoreCategories : CATEGORIES;
  }, [firestoreCategories]);

  React.useEffect(() => {
    if (!firestore || !user || !selectedCard || selectedCard.id === 'training-rsa999') {
        if (!selectedCard) setIsLoadingTimeline(false);
        return;
    }

    setIsLoadingTimeline(true);
    const q = collection(firestore, 'timeline_projects', selectedCard.id, 'milestones');
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
        console.warn("Error en listener de hitos TL:", error.message);
        setIsLoadingTimeline(false);
    });

    return () => unsubscribe();
  }, [firestore, user, selectedCard, categories]);

  React.useEffect(() => {
    if (cardIdParam && (!selectedCard || selectedCard.id !== cardIdParam)) {
        const cached = allCards.find(c => c.id === cardIdParam);
        if (cached) {
            setSelectedCard(cached);
        } else {
            const fetchCard = async () => {
                try {
                    const card = await getCardById(cardIdParam);
                    if (card) {
                        setSelectedCard(card as any);
                    }
                } catch (error) {
                    console.error("Error fetching card from URL param:", error);
                }
            };
            fetchCard();
        }
    }
  }, [cardIdParam, allCards, selectedCard, setSelectedCard]);

  const displayedMilestones = React.useMemo(() => {
    if (selectedCard?.id === 'training-rsa999') {
        return RSA060_MILESTONES.map(m => {
            const currentCat = categories.find(c => c.id === m.category.id);
            return currentCat ? { ...m, category: currentCat } : m;
        }).filter(m => !m.isDeleted);
    }
    return (milestones || []).filter(m => !m.isDeleted);
  }, [selectedCard, milestones, categories]);

  const deletedMilestones = React.useMemo(() => {
    return (milestones || []).filter(m => m.isDeleted);
  }, [milestones]);

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

  const handleCardSelect = React.useCallback(async (card: any | null) => {
    setSelectedCard(card);
    setSelectedMilestone(null);
    if (card) {
        router.push(`${pathname}?cardId=${card.id}`);
    } else {
        router.push(pathname);
    }
  }, [router, pathname, setSelectedCard]);
  
  const logTimelineActivity = React.useCallback(async (actionType: string, detail: string) => {
    if (user && firestore && selectedCard) {
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
        await addDoc(collection(firestore, 'app_activities'), activityData);
      } catch (error) {
        console.error("Error logging activity:", error);
      }
    }
  }, [user, firestore, selectedCard]);

  React.useEffect(() => {
    const syncTrelloToFirestore = async () => {
        if (!selectedCard || !firestore || !user || syncPerformedForCard.current === selectedCard.id) {
            return;
        }

        if (selectedCard.id === 'training-rsa999') {
            syncPerformedForCard.current = selectedCard.id;
            return;
        }

        syncPerformedForCard.current = selectedCard.id;
        
        try {
            const projectRef = doc(firestore, 'timeline_projects', selectedCard.id);
            const codeMatch = selectedCard.name.match(/\b([A-Z]{2,4}\d{3})\b/i);
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
            
            const milestonesRef = collection(firestore, 'timeline_projects', selectedCard.id, 'milestones');
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
                        history: [...(data.history || []), `${format(new Date(), "PPpp", { locale: es })} - Sincronización: se removió un archivo que ya no existe en Trello.`]
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
            const statusChangeCategory = categories.find(c => c.name.toLowerCase().includes('cambio de estado')) || { id: 'cat-status', name: 'Cambio de Estado', color: '#f59e0b' };
            const activityCategory = categories.find(c => c.id === 'cat-11') || { id: 'cat-11', name: 'Actividad de Tarjeta', color: '#9E9E9E' };

            const actionMilestones: Milestone[] = actions
              .filter(action => !existingHitosByTrelloId.has(action.id))
              .map(action => {
                let milestone: Milestone | null = null;
                if (action.type === 'commentCard' && action.data.text) {
                    const isStatusUpdate = action.data.text.includes('📍 HITO DE PROYECTO');
                    milestone = { 
                        id: `hito-${action.id}`, 
                        name: isStatusUpdate ? 'Actualización de Estado' : `Comentario de ${action.memberCreator.fullName}`, 
                        description: action.data.text, 
                        occurredAt: action.date, 
                        category: isStatusUpdate ? statusChangeCategory : commentsCategory, 
                        tags: isStatusUpdate ? ['estado', 'sistema'] : ['comentario'], 
                        associatedFiles: [], 
                        isImportant: false, 
                        history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] 
                    };
                } else if (action.type === 'updateCard' && action.data.listAfter && action.data.listBefore) {
                    milestone = { id: `hito-${action.id}`, name: `Tarjeta movida`, description: `Movida de "${action.data.listBefore.name}" a "${action.data.listAfter.name}" por ${action.memberCreator.fullName}.`, occurredAt: action.date, category: activityCategory, tags: ['activity', 'movimiento'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                }
                return milestone;
            }).filter((m): m is Milestone => m !== null);

            const allTrelloItems = [creationMilestone, ...attachmentMilestones, ...actionMilestones];
            
            if (allTrelloItems.length > 0 || hasChanges) {
                allTrelloItems.forEach(milestone => {
                    const milestoneRef = doc(firestore, 'timeline_projects', selectedCard.id, 'milestones', milestone.id);
                    batch.set(milestoneRef, milestone, { merge: true });
                });
                batch.commit().catch(err => console.error("Error committing sync batch:", err));
            }
        } catch (error: any) {
            console.error("Error synchronizing Trello:", error);
            syncPerformedForCard.current = null;
        }
    };

    syncTrelloToFirestore();
  }, [selectedCard, firestore, user, categories]);


  const executeFinalUpload = React.useCallback(async (data: any, finalRootId: string, workFolderId: string, resolutions: Record<string, ConflictStrategy>) => {
    const { fileConfigs, categoryId, name, description, occurredAt } = data;
    const category = categories.find((c: any) => c.id === categoryId);
    if (!category || !selectedCard || !firestore) {
        setIsUploading(false);
        return;
    }

    setIsUploading(true);
    const { id: toastId, dismiss, update } = toast({
      title: "Procesando archivos mixtos...",
      description: "Preparando carpetas en Drive.",
      duration: Infinity,
    });

    try {
      const hasFinal = fileConfigs.some((c: any) => c.isFinal);
      let milestoneFolderId = '';

      if (hasFinal) {
          update({ id: toastId, description: "Creando carpeta de hito en TL..." });
          milestoneFolderId = await createMilestoneFolder(finalRootId, name);
      }

      const associatedFiles: AssociatedFile[] = [];
      const totalFiles = fileConfigs.length;

      for (const [index, config] of (fileConfigs as FileConfig[]).entries()) {
          const strategy = resolutions[config.file.name] || 'rename';
          if (strategy === 'omit') continue;

          setUploadProgress(((index) / totalFiles) * 100);
          
          const arrayBuffer = await config.file.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          let targetName = config.file.name;
          const folderToUse = config.isFinal ? milestoneFolderId : workFolderId;
          
          let existingId = strategy === 'overwrite' ? conflicts.find(c => c.name === config.file.name)?.existingId : undefined;

          if (strategy === 'rename') {
             const nameParts = config.file.name.split('.');
             const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
             const baseName = nameParts.join('.');
             let currentTryName = config.file.name;
             let counter = 1;
             while (true) {
                const check = await findFileInFolder(folderToUse, currentTryName);
                if (!check) break;
                currentTryName = `${baseName} (${counter})${ext}`;
                counter++;
             }
             targetName = currentTryName;
          }

          setUploadText(`Subiendo (${config.isFinal ? 'Final' : 'Trabajo'}): ${targetName}`);

          const driveResult = await uploadFileToDrive(targetName, config.file.type, base64Data, folderToUse, existingId);
          
          let trelloId: string | undefined = undefined;
          if (config.isFinal) {
              const trelloAtt = await attachUrlToCard(selectedCard.id, driveResult.name, driveResult.webViewLink);
              if (trelloAtt) trelloId = trelloAtt.id;
          }
          
          associatedFiles.push({
            id: driveResult.id,
            name: driveResult.name,
            size: `${(config.file.size / 1024).toFixed(2)} KB`,
            type: config.file.type.startsWith('image/') ? 'image' : config.file.type.startsWith('video/') ? 'video' : config.file.type.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => config.file.type.includes(t)) ? 'document' : 'other',
            url: driveResult.webViewLink || null as any,
            downloadUrl: driveResult.webContentLink || null as any,
            driveId: driveResult.id,
            trelloId: trelloId || null as any,
            isTimelineFile: config.isFinal
          });
          
          setUploadProgress(((index + 1) / totalFiles) * 100);
      }
      
      const now = new Date();
      const targetDate = new Date(occurredAt);
      const isTodayVal = isSameDay(targetDate, now);

      let finalOccurredDate: Date;

      if (isTodayVal) {
          // Si es hoy, usamos la hora actual exacta
          finalOccurredDate = now;
      } else {
          // Si es pasado, aplicamos lógica de 07:00 AM + espaciado de 10 min
          targetDate.setHours(0, 0, 0, 0);
          const dayMilestones = (milestones || []).filter(m => {
            const mDate = parseISO(m.occurredAt);
            return isSameDay(mDate, targetDate);
          });
          
          finalOccurredDate = new Date(targetDate);
          if (dayMilestones.length > 0) {
            const minutesArray = dayMilestones.map(m => {
                const d = parseISO(m.occurredAt);
                return d.getHours() * 60 + d.getMinutes();
            });
            const maxMins = Math.max(...minutesArray);
            // Iniciamos en 7:00 AM (420 mins) o sumamos 10 min al último
            const nextMins = Math.max(7 * 60, maxMins + 10);
            finalOccurredDate.setHours(Math.floor(nextMins / 60), nextMins % 60, 0, 0);
          } else {
            finalOccurredDate.setHours(7, 0, 0, 0);
          }
      }

      const newMilestoneData = {
          name: name,
          description: description,
          occurredAt: finalOccurredDate.toISOString(),
          category: { id: category.id, name: category.name, color: category.color },
          tags: [hasFinal ? 'manual' : 'trabajo'],
          associatedFiles: associatedFiles,
          isImportant: false,
          history: [`${format(new Date(), "PPpp", { locale: es })} - Hito creado con carga mixta de ${associatedFiles.length} archivo(s).`],
          driveFolderId: hasFinal ? (milestoneFolderId || null) : null
      };

      const milestonesRef = collection(firestore, 'timeline_projects', selectedCard.id, 'milestones');
      await addDoc(milestonesRef, newMilestoneData);
      
      logTimelineActivity('timeline_milestone_created', `Hito creado: "${name}" con ${associatedFiles.length} archivos.`);

      setIsUploadOpen(false);
      dismiss(toastId);
      toast({ title: `Hito "${name}" creado exitosamente.` });
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
  }, [categories, selectedCard, firestore, toast, milestones, conflicts, logTimelineActivity]);

  const handleUpload = React.useCallback(async (data: { 
    fileConfigs: FileConfig[], 
    categoryId: string, 
    name: string, 
    description: string, 
    occurredAt: Date,
    targetFolderId?: string
  }) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
        toast({ variant: "destructive", title: "Acción no permitida", description: "Proyecto de entrenamiento solo lectura." });
        return;
    }

    const { fileConfigs, targetFolderId } = data;
    const codeMatch = selectedCard.name.match(/\b([A-Z]{2,4}\d{3})\b/i);
    const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

    setIsUploading(true);
    setUploadText("Analizando destinos en Drive...");

    try {
        const finalRootId = await getOrCreateProjectFolder(projectCode, selectedCard.name, true);
        const workRootId = targetFolderId || await getOrCreateProjectFolder(projectCode, selectedCard.name, false);

        const foundConflicts = [];
        for (const config of fileConfigs) {
            if (!config.isFinal) {
                const existing = await findFileInFolder(workRootId, config.file.name);
                if (existing) foundConflicts.push({ name: config.file.name, existingId: existing.id });
            }
        }

        if (foundConflicts.length > 0) {
            setConflicts(foundConflicts);
            setPendingUploadData({ ...data, finalRootId, workRootId });
            setIsConflictDialogOpen(true);
            return;
        }
        
        executeFinalUpload(data, finalRootId, workRootId, {});
    } catch (error: any) {
        setIsUploading(false);
        toast({ variant: "destructive", title: "Error de Drive", description: error.message });
    }
  }, [selectedCard, firestore, toast, executeFinalUpload]);

  const handleConflictResolve = (resolutions: Record<string, ConflictStrategy>) => {
    setIsConflictDialogOpen(false);
    if (pendingUploadData) {
        executeFinalUpload(pendingUploadData, pendingUploadData.finalRootId, pendingUploadData.workRootId, resolutions);
    }
  };

  const handleMilestoneUpdate = React.useCallback((updatedMilestone: Milestone) => {
    if (!firestore || !selectedCard) return;
    const milestoneRef = doc(firestore, 'timeline_projects', selectedCard.id, 'milestones', updatedMilestone.id);
    updateDoc(milestoneRef, updatedMilestone as any);
    toast({ title: "Hito actualizado" });
    if (selectedMilestone && selectedMilestone.id === updatedMilestone.id) {
        setSelectedMilestone(updatedMilestone);
    }
  }, [selectedCard, selectedMilestone, firestore, toast]);

  const handleMilestoneDelete = React.useCallback(async (milestoneId: string) => {
    if (!firestore || !selectedCard) return;
    
    try {
        const milestoneRef = doc(firestore, 'timeline_projects', selectedCard.id, 'milestones', milestoneId);
        await updateDoc(milestoneRef, {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
        
        setSelectedMilestone(null);
        toast({ 
            title: "Hito movido a la papelera", 
            description: "Puedes restaurarlo en cualquier momento desde el menú de papelera." 
        });
        
        logTimelineActivity('timeline_milestone_deleted', `Movió hito a papelera: ${milestoneId}`);
    } catch (err: any) {
        toast({ variant: "destructive", title: "Error al borrar", description: err.message });
    }
  }, [selectedCard, firestore, toast, logTimelineActivity]);

  const handleMilestoneRestore = React.useCallback(async (milestone: Milestone) => {
    if (!firestore || !selectedCard) return;
    setIsProcessingTrash(true);

    try {
        const milestoneRef = doc(firestore, 'timeline_projects', selectedCard.id, 'milestones', milestone.id);
        await updateDoc(milestoneRef, {
            isDeleted: false,
            deletedAt: null
        });

        if (milestone.category.id === 'cat-status' || milestone.tags?.includes('estado')) {
            const statusMatch = milestone.description.match(/a "(.*?)". Fecha/);
            if (statusMatch && statusMatch[1]) {
                const newStatus = statusMatch[1];
                const color = STATUS_COLORS_HEX[newStatus] || 'red';
                await updateTrelloCard({ 
                    cardId: selectedCard.id, 
                    cover: { color } 
                });
                refreshCards();
            }
        }

        toast({ title: "Hito restaurado correctamente" });
        logTimelineActivity('timeline_milestone_restored', `Restauró hito: "${milestone.name}"`);
    } catch (err: any) {
        toast({ variant: "destructive", title: "Error al restaurar", description: err.message });
    } finally {
        setIsProcessingTrash(false);
    }
  }, [selectedCard, firestore, toast, refreshCards, logTimelineActivity]);

  const handleMilestonePermanentDelete = React.useCallback(async (milestoneId: string) => {
    if (!firestore || !selectedCard) return;
    const hitoToDelete = milestones?.find(m => m.id === milestoneId);
    if (!hitoToDelete) return;

    setIsProcessingTrash(true);
    const { id: toastId, dismiss } = toast({
      title: "Eliminando permanentemente...",
      description: "Borrando archivos físicos en Drive.",
      duration: Infinity,
    });

    try {
        for (const file of hitoToDelete.associatedFiles) {
            if (file.trelloId) await deleteAttachmentFromCard(selectedCard.id, file.trelloId);
        }

        if (hitoToDelete.driveFolderId) {
            await deleteFileFromDrive(hitoToDelete.driveFolderId);
        } else {
            for (const file of hitoToDelete.associatedFiles) {
                const driveId = file.driveId || file.id;
                if (driveId) await deleteFileFromDrive(driveId);
            }
        }

        const milestoneRef = doc(firestore, 'timeline_projects', selectedCard.id, 'milestones', milestoneId);
        await deleteDoc(milestoneRef);
        
        toast({ title: "Hito eliminado definitivamente" });
        logTimelineActivity('timeline_milestone_purged', `Eliminó permanentemente: "${hitoToDelete.name}"`);
    } catch (e: any) {
        toast({ variant: "destructive", title: "Error en limpieza física", description: e.message });
    } finally {
        dismiss(toastId);
        setIsProcessingTrash(false);
    }
  }, [selectedCard, firestore, milestones, toast, logTimelineActivity]);

  const handleSetRange = React.useCallback((rangeType: '1H' | '1D' | '1M' | '1Y' | 'All') => {
    if (rangeType === 'All') {
        if (milestoneDateBounds.current) {
            setDateRange({ start: subMonths(parseISO(milestoneDateBounds.current.start), 1), end: addMonths(parseISO(milestoneDateBounds.current.end), 1) });
        }
        return;
    }
    const now = new Date();
    if (rangeType === '1H') setDateRange({ start: subHours(now, 1), end: now });
    else if (rangeType === '1D') setDateRange({ start: startOfDay(now), end: endOfDay(now) });
    else if (rangeType === '1M') setDateRange({ start: subMonths(now, 1), end: now });
    else if (rangeType === '1Y') setDateRange({ start: subYears(now, 1), end: now });
  }, []);

  const handleGoHome = React.useCallback(() => {
    let path = '/';
    if (selectedCard) {
      path += `?cardId=${selectedCard.id}`;
    }
    router.push(path);
  }, [router, selectedCard]);

  const handleCategoryColorChange = React.useCallback((categoryId: string, color: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'timeline_categories', categoryId);
    updateDoc(catRef, { color });
  }, [firestore]);
  
  const handleCategoryAdd = React.useCallback((name: string) => {
    if (!firestore) return;
    const DEFAULT_COLORS = ['#a3e635', '#22c55e', '#14b8a6', '#0ea5e9', '#4f46e5', '#8b5cf6', '#be185d', '#f97316', '#facc15'];
    const color = DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];
    addDoc(collection(firestore, 'timeline_categories'), { name, color });
  }, [firestore, categories]);

  const handleCategoryUpdate = React.useCallback((categoryId: string, name: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'timeline_categories', categoryId);
    updateDoc(catRef, { name: name.trim() });
  }, [firestore]);
  
  const handleCategoryDelete = React.useCallback((categoryId: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'timeline_categories', categoryId);
    deleteDoc(catRef);
  }, [firestore]);

  const [isResizing, setIsResizing] = React.useState(false);
  const [timelinePanelHeight, setTimelinePanelHeight] = React.useState(40);
  const resizeContainerRef = React.useRef<HTMLDivElement>(null);
  const milestoneDateBounds = React.useRef<{start: string; end: string} | null>(null);

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  };
  
  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing || !resizeContainerRef.current) return;
      const container = resizeContainerRef.current;
      const rect = container.getBoundingClientRect();
      const newHeight = event.clientY - rect.top;
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

  const projectCode = selectedCard ? (selectedCard.name.match(/\b([A-Z]{2,4}\d{3})\b/i)?.[0] || null) : null;

  const handleToggleView = () => setView(prev => prev === 'timeline' ? 'summary' : 'timeline');

  return (
    <div className="timeline-app-root flex h-screen w-full bg-background font-sans text-foreground">
      <Sidebar 
        categories={categories} 
        onCategoryColorChange={handleCategoryColorChange}
        onCategoryAdd={handleCategoryAdd}
        onCategoryUpdate={handleCategoryUpdate}
        onCategoryDelete={handleCategoryDelete}
        onCardSelect={handleCardSelect}
        selectedCard={selectedCard as any}
        onGoHome={handleGoHome}
        cardFromUrl={null}
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
          onFeedbackClick={() => setIsFeedbackOpen(true)}
          onTrashClick={() => setIsTrashOpen(true)}
          trelloCardUrl={selectedCard?.url ?? null}
          isProjectLoaded={!!selectedCard}
          deletedCount={deletedMilestones.length}
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
                            onMilestoneClick={(m) => setSelectedMilestone(m)}
                            isDetailOpen={!!selectedMilestone}
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
                              onClose={() => setSelectedMilestone(null)}
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
        projectCode={projectCode}
        projectName={selectedCard?.name || null}
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

      <FeedbackDialog isOpen={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
      
      <TrashDialog 
        isOpen={isTrashOpen} 
        onOpenChange={setIsTrashOpen}
        deletedMilestones={deletedMilestones}
        onRestore={handleMilestoneRestore}
        onPermanentDelete={handleMilestonePermanentDelete}
        isProcessing={isProcessingTrash}
      />
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
