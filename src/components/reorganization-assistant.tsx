'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
    FileText, 
    Folder, 
    ChevronRight, 
    Loader2, 
    Move, 
    History, 
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    HardDrive,
    ShieldCheck,
    Briefcase
} from 'lucide-react';
import { listFolderContents, moveFile, getTimelineFolderForProject, createMilestoneFolder } from '@/services/google-drive';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Milestone } from '@/timeline/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReorganizationAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  looseFiles: any[];
  projectId: string;
  projectName: string;
  onReorganized: (movedIds: string[]) => void;
}

export default function ReorganizationAssistant({
  isOpen,
  onOpenChange,
  looseFiles,
  projectId,
  projectName,
  onReorganized,
}: ReorganizationAssistantProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<'work' | 'final' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estados para "Mover a Trabajo"
  const [workPath, setWorkPath] = useState<{id: string, name: string}[]>([]);
  const [workFolders, setWorkFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Mapeo de archivos a hitos
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
        setWorkPath([]);
        fetchMilestones();
        setSelectedFiles([]);
        setTargetType(null);
        
        // Inicializar el path de trabajo si hay archivos sueltos
        if (looseFiles.length > 0) {
            setWorkPath([{ id: looseFiles[0].parentId, name: 'Raíz Proyecto' }]);
        }
    }
  }, [isOpen, looseFiles]);

  useEffect(() => {
    if (workPath.length > 0 && targetType === 'work') {
        const fetchSubfolders = async () => {
            setIsLoadingFolders(true);
            try {
                const current = workPath[workPath.length - 1];
                const contents = await listFolderContents(current.id);
                setWorkFolders(contents.files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'));
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingFolders(false);
            }
        };
        fetchSubfolders();
    }
  }, [workPath, targetType]);

  const fetchMilestones = () => {
    if (!db || !projectId) return () => {};
    const q = collection(db, 'timeline_projects', projectId, 'milestones');
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
        setMilestones(ms.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
    }, (error) => {
        console.error("Error fetching milestones:", error);
    });
    return unsubscribe;
  };

  const getLinkedMilestone = (fileId: string): Milestone | null => {
    return milestones.find(m => (m.associatedFiles || []).some(f => f.id === fileId || f.driveId === fileId)) || null;
  };

  const handleToggleFile = (id: string) => {
    setSelectedFiles(prev => 
        prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleExecuteMove = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);

    const { id: toastId, dismiss, update } = toast({
        title: "Reorganizando archivos...",
        description: "Iniciando proceso de movimiento conciliado.",
        duration: Infinity
    });

    try {
        const movedIds = [...selectedFiles];
        const codeMatch = projectName.match(/\b([A-Z]{2,4}\d{3})\b/i);
        const projectCode = codeMatch ? codeMatch[0].toUpperCase() : 'S/C';

        for (const fileId of selectedFiles) {
            const file = looseFiles.find(f => f.id === fileId);
            if (!file) continue;

            const linkedMilestone = getLinkedMilestone(fileId);
            let finalTargetFolderId = '';

            if (targetType === 'work') {
                finalTargetFolderId = workPath[workPath.length - 1].id;
            } else {
                // Lógica de ARCHIVO FINAL: Crear o buscar carpeta jerárquica del hito
                if (!linkedMilestone) {
                    throw new Error(`El archivo ${file.name} no tiene un hito vinculado en Firestore.`);
                }

                if (!linkedMilestone.driveFolderId) {
                    update({ id: toastId, description: `Creando carpeta para: ${linkedMilestone.name}...` });
                    const tlRootId = await getTimelineFolderForProject(projectCode, projectName);
                    if (!tlRootId) throw new Error("No se pudo localizar la carpeta raíz de la TL.");
                    
                    const newFolderId = await createMilestoneFolder(tlRootId, linkedMilestone.name, new Date(linkedMilestone.occurredAt));
                    
                    await updateDoc(doc(db, 'timeline_projects', projectId, 'milestones', linkedMilestone.id), {
                        driveFolderId: newFolderId
                    });
                    finalTargetFolderId = newFolderId;
                    linkedMilestone.driveFolderId = newFolderId;
                } else {
                    finalTargetFolderId = linkedMilestone.driveFolderId;
                }
            }

            update({ id: toastId, description: `Moviendo: ${file.name}...` });
            await moveFile(fileId, file.parentId, finalTargetFolderId);

            // Si se movió a Final, nos aseguramos de que el hito registre el archivo correctamente
            if (targetType === 'final' && linkedMilestone) {
                const currentFiles = linkedMilestone.associatedFiles || [];
                const alreadyUpdated = currentFiles.some(f => (f.id === fileId || f.driveId === fileId) && f.isTimelineFile);
                
                if (!alreadyUpdated) {
                    const updatedFiles = currentFiles.map(f => {
                        if (f.id === fileId || f.driveId === fileId) {
                            return { ...f, isTimelineFile: true };
                        }
                        return f;
                    });
                    await updateDoc(doc(db, 'timeline_projects', projectId, 'milestones', linkedMilestone.id), {
                        associatedFiles: updatedFiles
                    });
                }
            }
        }

        dismiss(toastId);
        toast({ title: "¡Éxito!", description: "Archivos reubicados correctamente en su estructura jerárquica." });
        onReorganized(movedIds);
    } catch (e: any) {
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error al reorganizar", description: e.message });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 border-0 bg-zinc-100 text-black shadow-2xl">
        <DialogHeader className="p-6 bg-amber-500 text-white shrink-0">
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <AlertCircle className="h-6 w-6" />
            Conciliación de Archivos Históricos
          </DialogTitle>
          <DialogDescription className="text-white/90">
            Se han detectado archivos fuera de estructura. El sistema ha identificado a qué hitos pertenecen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Columna Izquierda: Archivos y sus Hitos vinculados */}
          <div className="w-1/2 border-r border-zinc-200 flex flex-col">
            <div className="p-4 bg-zinc-200/50 border-b border-zinc-200">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Archivos para conciliar ({looseFiles.length})</h3>
            </div>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                    {looseFiles.map(file => {
                        const milestone = getLinkedMilestone(file.id);
                        return (
                            <div 
                                key={file.id} 
                                onClick={() => !isProcessing && handleToggleFile(file.id)}
                                className={cn(
                                    "flex flex-col gap-1 p-3 rounded-lg cursor-pointer transition-all border",
                                    selectedFiles.includes(file.id) 
                                        ? "bg-amber-50 border-amber-300 shadow-sm" 
                                        : "bg-white border-transparent hover:border-zinc-200"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText className={cn("h-4 w-4 shrink-0", selectedFiles.includes(file.id) ? "text-amber-600" : "text-zinc-400")} />
                                    <span className="text-xs font-bold truncate flex-1">{file.name}</span>
                                    {selectedFiles.includes(file.id) && <CheckCircle2 className="h-3 w-3 text-amber-600" />}
                                </div>
                                {milestone ? (
                                    <div className="ml-6 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <History className="h-3 w-3 text-primary" />
                                            <span className="text-[10px] text-zinc-600 font-medium">Vinculado a: <span className="text-primary font-bold">{milestone.name}</span></span>
                                        </div>
                                        <span className="text-[9px] text-zinc-400 ml-4 italic">{format(new Date(milestone.occurredAt), 'PPP', { locale: es })}</span>
                                    </div>
                                ) : (
                                    <div className="ml-6 flex items-center gap-1.5 text-destructive">
                                        <AlertCircle className="h-3 w-3" />
                                        <span className="text-[10px] font-bold uppercase">Sin hito vinculado en Firestore</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
          </div>

          {/* Columna Derecha: Selección de Destino */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-6 space-y-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">¿Qué tipo de archivos son?</h3>
                    
                    <button 
                        onClick={() => setTargetType('final')}
                        className={cn(
                            "w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left group",
                            targetType === 'final' 
                                ? "bg-primary/5 border-primary shadow-md" 
                                : "bg-white border-zinc-100 hover:border-zinc-200"
                        )}
                    >
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                            targetType === 'final' ? "bg-primary text-white" : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200"
                        )}>
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <p className={cn("text-sm font-bold", targetType === 'final' ? "text-primary" : "text-zinc-700")}>Documentación Final (Intocable)</p>
                            <p className="text-[11px] text-zinc-500 leading-tight">Mueve los archivos a carpetas jerárquicas cerradas dentro de la Línea de Tiempo. Se creará una carpeta por cada hito automáticamente.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setTargetType('work')}
                        className={cn(
                            "w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left group",
                            targetType === 'work' 
                                ? "bg-amber-50 border-amber-500 shadow-md" 
                                : "bg-white border-zinc-100 hover:border-zinc-200"
                        )}
                    >
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                            targetType === 'work' ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200"
                        )}>
                            <Briefcase className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <p className={cn("text-sm font-bold", targetType === 'work' ? "text-amber-600" : "text-zinc-700")}>Archivos de Trabajo (Tocable)</p>
                            <p className="text-[11px] text-zinc-500 leading-tight">Mueve los archivos a la carpeta técnica de la obra en el servidor EIAS_AMBIENTALES. Deberás elegir la carpeta de destino.</p>
                        </div>
                    </button>
                </div>

                {targetType === 'work' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-3 pt-4 border-t border-zinc-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                            <HardDrive className="h-4 w-4" />
                            <span>Seleccionar Carpeta Técnica</span>
                        </div>
                        
                        <div className="bg-zinc-100 p-2 rounded-lg flex flex-wrap gap-1 items-center border border-zinc-200">
                            {workPath.map((f, idx) => (
                                <React.Fragment key={f.id}>
                                    {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-400" />}
                                    <button 
                                        className={cn("text-[10px] hover:text-primary transition-colors", idx === workPath.length - 1 && "font-bold text-zinc-800")}
                                        onClick={() => setWorkPath(prev => prev.slice(0, idx + 1))}
                                    >
                                        {f.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <ScrollArea className="h-[150px] border rounded-lg bg-zinc-50 p-2">
                            {isLoadingFolders ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {workFolders.map(folder => (
                                        <button 
                                            key={folder.id}
                                            onClick={() => setWorkPath(prev => [...prev, { id: folder.id, name: folder.name }])}
                                            className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-md hover:border-primary transition-colors text-left group"
                                        >
                                            <Folder className="h-3.5 w-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                                            <span className="text-[11px] truncate text-zinc-700">{folder.name}</span>
                                        </button>
                                    ))}
                                    {workFolders.length === 0 && (
                                        <p className="col-span-2 text-center py-8 text-[10px] text-zinc-400 italic">No hay más subcarpetas aquí.</p>
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-zinc-200 border-t border-zinc-300 shrink-0">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 text-xs font-medium">
                    {selectedFiles.length > 0 ? (
                        <>
                            <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-none font-bold">
                                {selectedFiles.length} {selectedFiles.length === 1 ? 'archivo' : 'archivos'}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-zinc-400" />
                            <span className={cn(
                                "font-bold px-3 py-1 rounded-full",
                                targetType === 'final' ? "bg-primary text-white" : targetType === 'work' ? "bg-amber-100 text-amber-700 border border-amber-200" : "text-zinc-400 italic"
                            )}>
                                {targetType === 'final' 
                                    ? "Pasar a Estructura de Hitos Finales" 
                                    : targetType === 'work' 
                                        ? `Mover a Trabajo: ${workPath[workPath.length-1]?.name}` 
                                        : 'Seleccioná el tipo de destino'}
                            </span>
                        </>
                    ) : (
                        <span className="text-zinc-500 italic">Selecciona archivos de la izquierda para comenzar</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-zinc-600">Cancelar</Button>
                    <Button 
                        size="sm" 
                        disabled={selectedFiles.length === 0 || !targetType || isProcessing}
                        onClick={handleExecuteMove}
                        className="shadow-md min-w-[180px]"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Move className="h-4 w-4 mr-2" />}
                        {targetType === 'final' ? 'Conciliar Hitos' : 'Mover Archivos'}
                    </Button>
                </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
