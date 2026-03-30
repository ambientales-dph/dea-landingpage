'use client';

import * as React from 'react';
import type { Milestone, Category, AssociatedFile } from '@/timeline/types';
import { FileIcon } from './file-icon';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Paperclip, Tag, X, Star, Pencil, History, UploadCloud, Clock, ExternalLink, Trash2, CalendarIcon, Download, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameDay, isValid, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToDrive, getOrCreateProjectFolder, findFileInFolder, deleteFileFromDrive, listFolderContents, createMilestoneFolder } from '@/timeline/services/google-drive';
import { attachUrlToCard, deleteAttachmentFromCard, getCardAttachments } from '@/timeline/services/trello';
import { Buffer } from 'buffer';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { FileConflictDialog, type ConflictStrategy } from './file-conflict-dialog';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { AddFilesDialog } from './add-files-dialog';

interface MilestoneDetailProps {
  milestone: Milestone;
  categories: Category[];
  onMilestoneUpdate: (updatedMilestone: Milestone) => void;
  onMilestoneDelete: (milestoneId: string) => void;
  onClose: () => void;
  projectName: string;
  cardId: string | null;
}

export function MilestoneDetail({ milestone, categories, onMilestoneUpdate, onMilestoneDelete, onClose, projectName, cardId }: MilestoneDetailProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [newTag, setNewTag] = React.useState('');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableTitle, setEditableTitle] = React.useState('');
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [editableDescription, setEditableDescription] = React.useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  
  const [fileToDelete, setFileToDelete] = React.useState<AssociatedFile | null>(null);
  const [fileDeleteConfirmation, setFileDeleteConfirmation] = React.useState('');

  const [showCalendar, setShowCalendar] = React.useState(false);
  const [manualDateText, setManualDateText] = React.useState('');
  const [manualTimeText, setManualTimeText] = React.useState('');

  const [isAddFilesDialogOpen, setIsAddFilesDialogOpen] = React.useState(false);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<any[]>([]);
  const [pendingUploadConfig, setPendingUploadConfig] = React.useState<{files: File[], isFinal: boolean, targetFolderId?: string} | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const { toast } = useToast();

  React.useEffect(() => {
    if (milestone) {
      const date = parseISO(milestone.occurredAt);
      setEditableTitle(milestone.name);
      setEditableDescription(milestone.description);
      setManualDateText(format(date, "dd/MM/yyyy"));
      setManualTimeText(format(date, "HH:mm:ss"));
      setNewTag('');
      setIsEditingTitle(false);
      setIsEditingDescription(false);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmation('');
      setFileToDelete(null);
      setFileDeleteConfirmation('');
      setShowCalendar(false);
    }
  }, [milestone]);

  const logActivity = React.useCallback(async (actionType: string, detail: string) => {
    if (user && db && cardId) {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      const realName = authorizedUser?.name || user.displayName || 'Usuario';

      const activityData = {
        userId: user.uid,
        userName: realName,
        userEmail: user.email,
        userPhoto: user.photoURL || '',
        actionType: actionType,
        projectName: projectName,
        detail: detail,
        cardId: cardId,
        timestamp: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, 'app_activities'), activityData);
      } catch (error) {
        console.error("Error logging activity:", error);
      }
    }
  }, [user, db, cardId, projectName]);

  const createLogEntry = (action: string): string => {
    return `${format(new Date(), "PPpp", { locale: es })} - ${action}`;
  };

  const handleTitleSave = () => {
    if (milestone && editableTitle.trim() && editableTitle.trim() !== milestone.name) {
      const updatedMilestone = {
        ...milestone,
        name: editableTitle.trim(),
        history: [...milestone.history, createLogEntry(`Título cambiado a "${editableTitle.trim()}"`)],
      };
      onMilestoneUpdate(updatedMilestone);
    }
    setIsEditingTitle(false);
  };
  
  const handleDescriptionSave = () => {
    if (milestone && editableDescription.trim() !== milestone.description) {
        onMilestoneUpdate({
            ...milestone,
            description: editableDescription.trim(),
            history: [...milestone.history, createLogEntry('Descripción actualizada.')],
        });
    }
    setIsEditingDescription(false);
  };

  const handleCategoryChange = (categoryId: string) => {
    const newCategory = categories.find(c => c.id === categoryId);
    if (newCategory && milestone && newCategory.id !== milestone.category.id) {
      onMilestoneUpdate({
        ...milestone,
        category: newCategory,
        history: [...milestone.history, createLogEntry(`Categoría cambiada a "${newCategory.name}"`)],
      });
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate && milestone) {
      const current = parseISO(milestone.occurredAt);
      const finalDate = new Date(newDate);
      finalDate.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());

      if (finalDate.toISOString() !== milestone.occurredAt) {
        onMilestoneUpdate({
          ...milestone,
          occurredAt: finalDate.toISOString(),
          history: [...milestone.history, createLogEntry(`Fecha cambiada a ${format(finalDate, 'PPP', { locale: es })}`)],
        });
      }
      setShowCalendar(false);
    }
  };

  const handleManualDateChange = (val: string) => {
    const cleaned = val.replace(/[^0-9/]/g, "");
    setManualDateText(cleaned);
    
    if (cleaned.length === 10) {
      const parsedDate = parse(cleaned, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        const current = parseISO(milestone.occurredAt);
        const finalDate = new Date(parsedDate);
        finalDate.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());
        
        if (finalDate.toISOString() !== milestone.occurredAt) {
          onMilestoneUpdate({
            ...milestone,
            occurredAt: finalDate.toISOString(),
            history: [...milestone.history, createLogEntry(`Fecha cambiada a ${cleaned}`)],
          });
        }
      }
    }
  };

  const handleManualTimeChange = (val: string) => {
    const cleaned = val.replace(/[^0-9:]/g, "");
    setManualTimeText(cleaned);
    
    if (cleaned.length === 8) { // HH:mm:ss
      const parts = cleaned.split(':').map(Number);
      if (parts.length === 3 && parts[0] >= 0 && parts[0] < 24 && parts[1] >= 0 && parts[1] < 60 && parts[2] >= 0 && parts[2] < 60) {
        const currentDate = parseISO(milestone.occurredAt);
        const newDate = new Date(currentDate);
        newDate.setHours(parts[0], parts[1], parts[2]);
        
        if (isValid(newDate) && newDate.toISOString() !== milestone.occurredAt) {
          onMilestoneUpdate({
            ...milestone,
            occurredAt: newDate.toISOString(),
            history: [...milestone.history, createLogEntry(`Hora cambiada a ${cleaned}`)],
          });
        }
      }
    }
  };

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim() !== '' && milestone) {
      e.preventDefault();
      if (milestone.tags && milestone.tags.includes(newTag.trim())) {
        setNewTag('');
        return;
      }
      const newTagName = newTag.trim();
      const updatedTags = [...(milestone.tags || []), newTagName];
      onMilestoneUpdate({
        ...milestone,
        tags: updatedTags,
        history: [...milestone.history, createLogEntry(`Etiqueta añadida: "${newTagName}"`)],
      });
      setNewTag('');
    }
  };
  
  const handleTagRemove = (tagToRemove: string) => {
    if (milestone) {
        const updatedTags = (milestone.tags || []).filter(tag => tag !== tagToRemove);
        onMilestoneUpdate({
          ...milestone,
          tags: updatedTags,
          history: [...milestone.history, createLogEntry(`Etiqueta eliminada: "${tagToRemove}"`)],
        });
    }
  };

  const handleToggleImportant = () => {
    if (milestone) {
      const action = !milestone.isImportant ? 'marcado como importante' : 'desmarcado como importante';
      onMilestoneUpdate({
        ...milestone,
        isImportant: !milestone.isImportant,
        history: [...milestone.history, createLogEntry(`Hito ${action}`)],
      });
    }
  };

  const handleStartUpload = async (data: { files: File[], isFinalDocument: boolean, targetFolderId?: string }) => {
    if (!milestone) return;
    const { files, isFinalDocument, targetFolderId } = data;

    const codeMatch = projectName.match(/\b([A-Z]{2,4}\d{3})\b/i);
    const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

    setIsUploading(true);
    const { id: toastId, dismiss } = toast({
      title: "Verificando Drive...",
      description: "Preparando destino.",
      duration: Infinity,
    });

    try {
        let finalFolderId = '';
        if (isFinalDocument) {
            // Lógica de archivo final: usar carpeta de hito o crearla
            if (milestone.driveFolderId) {
                finalFolderId = milestone.driveFolderId;
            } else {
                const rootTLId = await getOrCreateProjectFolder(projectCode, projectName, true);
                finalFolderId = await createMilestoneFolder(rootTLId, milestone.name);
                // Actualizar ID de carpeta en Firestore
                const updatedMs = { ...milestone, driveFolderId: finalFolderId };
                onMilestoneUpdate(updatedMs);
            }
        } else {
            // Lógica de archivo de trabajo: usar la carpeta seleccionada
            finalFolderId = targetFolderId || await getOrCreateProjectFolder(projectCode, projectName, false);
        }

        // Buscar conflictos
        const foundConflicts = [];
        for (const file of files) {
            const existing = await findFileInFolder(finalFolderId, file.name);
            if (existing) {
                foundConflicts.push({ name: file.name, existingId: existing.id });
            }
        }

        dismiss(toastId);

        if (foundConflicts.length > 0) {
            setConflicts(foundConflicts);
            setPendingUploadConfig({ files, isFinal: isFinalDocument, targetFolderId: finalFolderId });
            setIsConflictDialogOpen(true);
        } else {
            executeFinalFileAdd(files, finalFolderId, isFinalDocument);
        }
    } catch (error: any) {
        dismiss(toastId);
        setIsUploading(false);
        toast({ variant: "destructive", title: "Error en Drive", description: error.message });
    }
  };

  const executeFinalFileAdd = async (files: File[], folderId: string, isFinal: boolean, resolutions: Record<string, ConflictStrategy> = {}) => {
    if (!milestone) return;

    const { id: toastId, update, dismiss } = toast({
      title: "Subiendo archivos a Drive...",
      description: "Iniciando proceso.",
      duration: Infinity,
    });

    try {
      const newAssociatedFiles: AssociatedFile[] = [];

      for (const file of files) {
        const strategy = resolutions[file.name] || 'rename';
        if (strategy === 'omit') continue;

        let targetName = file.name;
        let existingId = strategy === 'overwrite' ? conflicts.find(c => c.name === file.name)?.existingId : undefined;

        if (strategy === 'rename') {
            const nameParts = file.name.split('.');
            const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
            const baseName = nameParts.join('.');
            let currentTryName = file.name;
            let counter = 1;
            while (true) {
               const check = await findFileInFolder(folderId, currentTryName);
               if (!check) break;
               currentTryName = `${baseName} (${counter})${ext}`;
               counter++;
            }
            targetName = currentTryName;
        }

        update({ id: toastId, description: `Guardando en Drive: "${targetName}"...` });

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        const driveResult = await uploadFileToDrive(targetName, file.type, base64Data, folderId, existingId);
        
        let trelloId: string | undefined = undefined;
        if (cardId && isFinal) {
            update({ id: toastId, title: "Actualizando Trello...", description: `Vinculando link de: ${driveResult.name}` });
            const trelloAtt = await attachUrlToCard(cardId, driveResult.name, driveResult.webViewLink);
            if (trelloAtt) trelloId = trelloAtt.id;
        }

        newAssociatedFiles.push({
          id: driveResult.id,
          name: driveResult.name,
          size: `${(file.size / 1024).toFixed(2)} KB`,
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => file.type.includes(t)) ? 'document' : 'other',
          url: driveResult.webViewLink,
          downloadUrl: driveResult.webContentLink,
          driveId: driveResult.id,
          trelloId: trelloId,
          isTimelineFile: isFinal
        });
      }

      if (newAssociatedFiles.length > 0) {
        onMilestoneUpdate({
          ...milestone,
          associatedFiles: [...(milestone.associatedFiles || []), ...newAssociatedFiles],
          history: [...milestone.history, createLogEntry(`Se añadieron ${newAssociatedFiles.length} archivo(s) (${isFinal ? 'FINAL' : 'TRABAJO'}).`)],
        });
        logActivity('milestone_files_added', `Subió ${newAssociatedFiles.length} archivo(s) al hito: "${milestone.name}"`);
      }

      dismiss(toastId);
      toast({ title: "Archivos guardados correctamente" });
      setIsAddFilesDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding files:", error);
      dismiss(toastId);
      toast({ variant: "destructive", title: "Error al añadir archivos", description: error.message });
    } finally {
        setIsUploading(false);
        setConflicts([]);
        setPendingUploadConfig(null);
    }
  };

  const handleSyncFolder = async () => {
    if (!milestone.driveFolderId) return;
    setIsSyncing(true);
    const { id: toastId, dismiss } = toast({
        title: "Sincronizando con Drive...",
        description: "Buscando archivos en la carpeta del hito.",
        duration: Infinity,
    });

    try {
        const { files } = await listFolderContents(milestone.driveFolderId);
        
        const newAssociatedFiles: AssociatedFile[] = files.map(file => ({
            id: file.id,
            name: file.name,
            size: file.size ? `${(parseInt(file.size) / 1024).toFixed(2)} KB` : "---",
            type: file.mimeType.startsWith('image/') ? 'image' : file.mimeType.startsWith('video/') ? 'video' : file.mimeType.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => file.mimeType.includes(t)) ? 'document' : 'other',
            url: file.webViewLink,
            downloadUrl: file.webContentLink,
            driveId: file.id,
            isTimelineFile: true
        }));

        const existingIds = new Set((milestone.associatedFiles || []).map(f => f.id || f.driveId));
        const mergedFiles = [...(milestone.associatedFiles || [])];
        let recoveredCount = 0;
        
        newAssociatedFiles.forEach(f => {
            if (!existingIds.has(f.id)) {
                mergedFiles.push(f);
                recoveredCount++;
            }
        });

        if (recoveredCount > 0) {
            onMilestoneUpdate({
                ...milestone,
                associatedFiles: mergedFiles,
                history: [...milestone.history, createLogEntry(`Sincronización manual: se recuperaron ${recoveredCount} archivo(s) desde Drive.`)],
            });
            toast({ title: "Sincronización completada", description: `Se recuperaron ${recoveredCount} archivos.` });
        } else {
            toast({ title: "Sincronización completada", description: "No se encontraron archivos nuevos en la carpeta." });
        }
        dismiss(toastId);
    } catch (error: any) {
        console.error(error);
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error al sincronizar", description: error.message });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleConflictResolve = async (resolutions: Record<string, ConflictStrategy>) => {
    setIsConflictDialogOpen(false);
    if (pendingUploadConfig) {
        executeFinalFileAdd(pendingUploadConfig.files, pendingUploadConfig.targetFolderId!, pendingUploadConfig.isFinal, resolutions);
    }
  };

  const handleDeleteConfirmed = () => {
    if (deleteConfirmation === 'borralo') {
      onMilestoneDelete(milestone.id);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleFileDeleteConfirm = async () => {
    if (fileDeleteConfirmation !== 'borralo' || !fileToDelete || !milestone) return;

    const fileToRem = fileToDelete;
    setFileToDelete(null);

    const { id: toastId, update, dismiss } = toast({
      title: "Eliminando archivo...",
      description: fileToRem.name,
      duration: Infinity,
    });

    try {
        if (cardId && fileToRem.trelloId) {
            update({ id: toastId, description: `Eliminando link de Trello: ${fileToRem.name}` });
            await deleteAttachmentFromCard(cardId, fileToRem.trelloId);
        }

        const driveId = fileToRem.driveId || fileToRem.id;
        if (driveId) {
            update({ id: toastId, description: `Eliminando archivo de Drive: ${fileToRem.name}` });
            await deleteFileFromDrive(driveId);
        }

        const updatedFiles = milestone.associatedFiles.filter(f => f.id !== fileToRem.id);
        onMilestoneUpdate({
            ...milestone,
            associatedFiles: updatedFiles,
            history: [...milestone.history, createLogEntry(`Archivo eliminado: "${fileToRem.name}"`)],
        });

        logActivity('milestone_file_deleted', `Eliminó el archivo "${fileToRem.name}" del hito "${milestone.name}"`);
        dismiss(toastId);
        toast({ title: "Archivo eliminado" });
    } catch (error: any) {
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error al eliminar archivo", description: error.message });
    }
  };

  const uniqueFiles = React.useMemo(() => {
    const seen = new Set();
    return (milestone.associatedFiles || []).filter(file => {
      if (seen.has(file.id)) return false;
      seen.add(file.id);
      return true;
    });
  }, [milestone.associatedFiles]);

  const projectCode = projectName.match(/\b([A-Z]{2,4}\d{3})\b/i)?.[0] || null;

  return (
    <div className="flex flex-col h-full p-3 overflow-hidden text-black">
        <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                <Input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    className="text-lg font-headline font-medium h-auto p-0 border-0 border-b-2 border-primary rounded-none focus-visible:ring-0 bg-transparent"
                    autoFocus
                />
                ) : (
                <h2 className="font-headline text-lg font-medium flex items-center gap-2 truncate">
                    <span className="truncate" title={milestone.name}>{milestone.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setIsEditingTitle(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                </h2>
                )}
                <div className="flex items-center pt-1.5">
                    <Select value={milestone.category.id} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-auto border-none shadow-none focus:ring-0 gap-2 h-auto p-0 text-xs font-medium text-zinc-700 hover:text-black focus:text-black disabled:opacity-100 bg-transparent">
                            <SelectValue asChild>
                                <div className="flex items-center cursor-pointer">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full mr-2 shrink-0"
                                        style={{ backgroundColor: milestone.category.color }}
                                    />
                                    <span>{milestone.category.name}</span>
                                </div>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                                        {category.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex flex-col text-xs text-zinc-700 mt-1.5 space-y-2">
                    <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 mr-1" />
                        <div className="flex gap-1">
                          <Input 
                            placeholder="DD/MM/YYYY" 
                            className="h-7 text-[10px] w-24 bg-zinc-100 text-black border-zinc-400"
                            value={manualDateText}
                            onChange={(e) => handleManualDateChange(e.target.value)}
                          />
                          <Input 
                            placeholder="HH:mm:ss" 
                            className="h-7 text-[10px] w-24 bg-zinc-100 text-black border-zinc-400"
                            value={manualTimeText}
                            onChange={(e) => handleManualTimeChange(e.target.value)}
                          />
                          <button 
                              onClick={() => setShowCalendar(!showCalendar)}
                              className={cn(
                                  "hover:text-black transition-colors focus:outline-none flex items-center p-1 border border-zinc-400 rounded bg-zinc-100",
                                  showCalendar && "text-primary border-primary font-bold"
                              )}
                          >
                              <CalendarIcon className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[10px] text-zinc-500 italic">
                          {format(parseISO(milestone.occurredAt), "PPP ppp", { locale: es })}
                        </span>
                    </div>

                    {showCalendar && (
                        <div className="p-2 bg-white rounded-lg shadow-lg border border-zinc-300 animate-in fade-in zoom-in-95 duration-200 z-50">
                            <Calendar
                                mode="single"
                                selected={parseISO(milestone.occurredAt)}
                                onSelect={handleDateChange}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                captionLayout="dropdown"
                                fromYear={1900}
                                toYear={new Date().getFullYear()}
                                locale={es}
                            />
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button 
                    onClick={handleToggleImportant} 
                    className="p-1 rounded-full text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:hover:text-zinc-500 disabled:hover:bg-transparent"
                    aria-label={milestone.isImportant ? 'Quitar de importantes' : 'Marcar como importante'}
                >
                    <Star className={cn("h-5 w-5", milestone.isImportant && "fill-yellow-400 text-yellow-400")} />
                </button>
                <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="h-8 w-8 text-zinc-700 hover:text-destructive transition-colors" title="Eliminar hito">
                    <Trash2 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-700 hover:text-black">
                    <X className="h-5 w-5" />
                </Button>
            </div>
        </div>
        
        <Separator className="my-2 shrink-0 bg-zinc-400/50" />
        
        <ScrollArea className="flex-1 -mr-3 pr-3">
            <div className="space-y-3">
                {isEditingDescription ? (
                <Textarea
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    onBlur={handleDescriptionSave}
                    onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        setIsEditingDescription(false);
                        setEditableDescription(milestone.description);
                    }
                    }}
                    className="text-sm leading-normal w-full bg-zinc-100 border-zinc-400 text-black"
                    autoFocus
                    rows={3}
                />
                ) : (
                <div
                    className={cn(
                        "text-sm text-zinc-700 leading-normal relative",
                        "cursor-pointer hover:bg-zinc-400/30 p-2 -m-2 rounded-md transition-colors group"
                    )}
                    onClick={() => setIsEditingDescription(true)}
                >
                    <p className="whitespace-pre-wrap">{milestone.description || 'Añade una descripción...'}</p>
                    <Pencil className="h-3 w-3 absolute top-1 right-1 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                )}
                
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Tag className="h-4 w-4 text-zinc-600" />
                        {(milestone.tags || []).map(tag => (
                            <Badge key={tag} className="group/badge relative pl-2.5 pr-1 py-0.5 text-xs bg-zinc-200 text-black hover:bg-zinc-200/80 border-transparent">
                                {tag}
                                <button 
                                    onClick={() => handleTagRemove(tag)} 
                                    className="ml-1 rounded-full opacity-50 group-hover/badge:opacity-100 hover:bg-destructive/10 p-0.5 transition-opacity disabled:hover:bg-transparent text-destructive"
                                    aria-label={`Quitar etiqueta ${tag}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <Input 
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleTagAdd}
                        placeholder={"Añadir etiqueta y presionar Enter..."}
                        className="h-8 bg-zinc-100 text-xs border border-zinc-400 text-black placeholder:text-zinc-500"
                    />
                </div>
            
                <Separator className="bg-zinc-400/50" />

                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center justify-between gap-2 text-sm text-black">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" /> Archivos del Hito
                        </div>
                        <div className="flex gap-1">
                            {milestone.driveFolderId && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-primary border-primary/30 hover:bg-primary/10" 
                                    onClick={handleSyncFolder}
                                    disabled={isSyncing}
                                    title="Sincronizar con carpeta de Drive"
                                >
                                    {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 text-black border-zinc-400 hover:bg-zinc-200" onClick={() => setIsAddFilesDialogOpen(true)}>
                                <UploadCloud className="mr-2 h-3 w-3"/>
                                Subir
                            </Button>
                        </div>
                    </h3>
                    {uniqueFiles.length > 0 ? (
                        <ul className="space-y-1.5 border border-zinc-400 rounded-md p-2 bg-zinc-200">
                           {uniqueFiles.map(file => {
                                const isTL = file.isTimelineFile || milestone.tags?.includes('intocable');
                                const finalDownloadUrl = file.downloadUrl || (file.driveId || file.id ? `https://drive.google.com/uc?export=download&id=${file.driveId || file.id}` : null);
                                
                                return (
                                <li key={file.id} className="group/file flex items-center justify-between p-1.5 bg-zinc-100 rounded-md hover:bg-zinc-50 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <FileIcon type={file.type} />
                                        <span className="text-xs font-medium truncate text-black" title={file.name}>{file.name}</span>
                                    </div>
                                    <div className="flex items-center shrink-0 ml-2 gap-2">
                                        <span className="text-[10px] text-zinc-500">{file.size}</span>
                                        <div className="flex items-center gap-1">
                                            {finalDownloadUrl && (
                                                <a href={finalDownloadUrl} className="p-1 rounded-md hover:bg-primary/10 text-zinc-500 hover:text-primary transition-colors" title="Descargar archivo">
                                                    <Download className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                            {file.url && !isTL && (
                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-primary/10 text-zinc-500 hover:text-primary transition-colors" title="Abrir en Drive">
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                            <button onClick={() => setFileToDelete(file)} className="p-1 rounded-md hover:bg-destructive/10 text-zinc-500 hover:text-destructive transition-colors" title="Eliminar">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="text-xs text-zinc-700 italic">No hay archivos guardados para este hito.</p>
                    )}
                </div>
                
                <Separator className="bg-zinc-400/50" />

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="history" className="border-b-0">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-1 text-black">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4" /> Historial de Cambios
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <ul className="space-y-1.5 text-xs text-zinc-700 pr-4 max-h-24 overflow-y-auto">
                            {milestone.history.slice().reverse().map((entry, index) => (
                                <li key={index}>{entry}</li>
                            ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </ScrollArea>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[400px] bg-zinc-100 text-black border-zinc-400">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <Trash2 className="h-5 w-5" /> Confirmar Eliminación
                    </DialogTitle>
                    <DialogDescription className="text-zinc-700 pt-2 text-xs">
                        Esta acción es irreversible y eliminará el hito permanentemente de Firestore y Drive. 
                        Escribí <span className="font-bold text-black select-none">borralo</span> para confirmar:
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Escribí aquí..."
                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background border-zinc-400 text-black focus:ring-destructive focus:border-destructive"
                        autoFocus
                    />
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-zinc-400 text-black hover:bg-zinc-200">Cancelar</Button>
                    <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={deleteConfirmation !== 'borralo'}>Eliminar hito</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
            <DialogContent className="sm:max-w-[400px] bg-zinc-100 text-black border-zinc-400">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <Trash2 className="h-5 w-5" /> Eliminar Archivo
                    </DialogTitle>
                    <DialogDescription className="text-zinc-700 pt-2 text-xs">
                        Se borrará <span className="font-bold text-black">{fileToDelete?.name}</span> de Drive y Trello.
                        Escribí <span className="font-bold text-black select-none">borralo</span> para confirmar:
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <input
                        value={fileDeleteConfirmation}
                        onChange={(e) => setFileDeleteConfirmation(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Escribí aquí..."
                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background border-zinc-400 text-black focus:ring-destructive focus:border-destructive"
                        autoFocus
                    />
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setFileToDelete(null)} className="border-zinc-400 text-black hover:bg-zinc-200">Cancelar</Button>
                    <Button variant="destructive" onClick={handleFileDeleteConfirm} disabled={fileDeleteConfirmation !== 'borralo'}>Eliminar archivo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AddFilesDialog 
            isOpen={isAddFilesDialogOpen}
            onOpenChange={setIsAddFilesDialogOpen}
            projectCode={projectCode}
            projectName={projectName}
            milestoneName={milestone.name}
            onUpload={handleStartUpload}
            isUploading={isUploading}
        />

        <FileConflictDialog 
            isOpen={isConflictDialogOpen}
            conflicts={conflicts}
            onResolve={handleConflictResolve}
            onCancel={() => { setIsConflictDialogOpen(false); setConflicts([]); setPendingUploadConfig(null); setIsUploading(false); }}
        />
    </div>
  );
}
