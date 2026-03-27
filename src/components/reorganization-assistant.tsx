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
    HardDrive
} from 'lucide-react';
import { listFolderContents, moveFile, getTimelineFolderForProject } from '@/services/google-drive';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Milestone } from '@/timeline/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReorganizationAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  looseFiles: any[];
  projectRootId: string | null;
  projectId: string;
  projectName: string;
  onReorganized: () => void;
}

export default function ReorganizationAssistant({
  isOpen,
  onOpenChange,
  looseFiles,
  projectRootId,
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

  // Estados para "Convertir en Hito Final"
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && projectRootId) {
        setWorkPath([{ id: projectRootId, name: 'Raíz' }]);
        fetchMilestones();
    }
  }, [isOpen, projectRootId]);

  useEffect(() => {
    if (workPath.length > 0) {
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
  }, [workPath]);

  const fetchMilestones = () => {
    const q = collection(db, 'timeline_projects', projectId, 'milestones');
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
        setMilestones(ms.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
    });
    return unsubscribe;
  };

  const handleToggleFile = (id: string) => {
    setSelectedFiles(prev => 
        prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleExecuteMove = async () => {
    if (selectedFiles.length === 0 || !projectRootId) return;
    setIsProcessing(true);

    const { id: toastId, dismiss, update } = toast({
        title: "Reorganizando archivos...",
        description: "Iniciando proceso de movimiento.",
        duration: Infinity
    });

    try {
        let targetFolderId = '';
        
        if (targetType === 'work') {
            targetFolderId = workPath[workPath.length - 1].id;
        } else if (targetType === 'final') {
            if (!selectedMilestoneId) throw new Error("Debes seleccionar un hito.");
            const ms = milestones.find(m => m.id === selectedMilestoneId);
            if (!ms) throw new Error("Hito no encontrado.");
            
            // Si el hito no tiene carpeta física aún, error (debería tenerla si es final)
            if (!ms.driveFolderId) {
                const codeMatch = projectName.match(/\b([A-Z]{2,4}\d{3})\b/i);
                const projectCode = codeMatch ? codeMatch[0].toUpperCase() : 'S/C';
                const tlRootId = await getTimelineFolderForProject(projectCode, projectName);
                if (!tlRootId) throw new Error("No se pudo localizar la carpeta de TL.");
                targetFolderId = tlRootId; // Por ahora a la raíz de TL si no hay carpeta de hito
            } else {
                targetFolderId = ms.driveFolderId;
            }
        }

        for (const fileId of selectedFiles) {
            const file = looseFiles.find(f => f.id === fileId);
            update({ id: toastId, description: `Moviendo: ${file?.name || 'archivo'}...` });
            
            await moveFile(fileId, projectRootId, targetFolderId);

            // Si es hito final, actualizar Firestore para que reconozca el nuevo archivo como parte del hito
            if (targetType === 'final' && selectedMilestoneId) {
                const ms = milestones.find(m => m.id === selectedMilestoneId);
                if (ms) {
                    const fileData = looseFiles.find(f => f.id === fileId);
                    const newFile = {
                        id: fileId,
                        name: fileData.name,
                        size: '---',
                        type: 'other',
                        url: fileData.webViewLink,
                        isTimelineFile: true
                    };
                    const updatedFiles = [...(ms.associatedFiles || []), newFile];
                    await updateDoc(doc(db, 'timeline_projects', projectId, 'milestones', selectedMilestoneId), {
                        associatedFiles: updatedFiles
                    });
                }
            }
        }

        dismiss(toastId);
        toast({ title: "¡Éxito!", description: "Archivos reubicados correctamente." });
        onReorganized();
    } catch (e: any) {
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error al reorganizar", description: e.message });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 border-0 bg-zinc-100 text-black shadow-2xl">
        <DialogHeader className="p-6 bg-amber-500 text-white shrink-0">
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <AlertCircle className="h-6 w-6" />
            Asistente de Reorganización de Archivos
          </DialogTitle>
          <DialogDescription className="text-white/90">
            Mueve los archivos antiguos desde la raíz del proyecto hacia sus carpetas de trabajo o vincúlalos a hitos finales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Columna Izquierda: Archivos Sueltos */}
          <div className="w-1/3 border-r border-zinc-200 flex flex-col">
            <div className="p-4 bg-zinc-200/50 border-b border-zinc-200">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Archivos en Raíz ({looseFiles.length})</h3>
            </div>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-1">
                    {looseFiles.map(file => (
                        <div 
                            key={file.id} 
                            onClick={() => !isProcessing && handleToggleFile(file.id)}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-xs border",
                                selectedFiles.includes(file.id) 
                                    ? "bg-amber-50 border-amber-300 text-amber-900" 
                                    : "hover:bg-white border-transparent"
                            )}
                        >
                            <FileText className={cn("h-4 w-4 shrink-0", selectedFiles.includes(file.id) ? "text-amber-600" : "text-zinc-400")} />
                            <span className="truncate flex-1">{file.name}</span>
                            {selectedFiles.includes(file.id) && <CheckCircle2 className="h-3 w-3 text-amber-600" />}
                        </div>
                    ))}
                </div>
            </ScrollArea>
          </div>

          {/* Columna Derecha: Destinos */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 bg-white border-b border-zinc-200 flex gap-4">
                <Button 
                    variant={targetType === 'work' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setTargetType('work')}
                >
                    <Folder className="h-4 w-4" /> Mover a Trabajo
                </Button>
                <Button 
                    variant={targetType === 'final' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setTargetType('final')}
                >
                    <History className="h-4 w-4" /> Convertir en Hito Final
                </Button>
            </div>

            <ScrollArea className="flex-1 p-6">
                {!targetType ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-4">
                        <Move className="h-12 w-12 opacity-20" />
                        <p className="text-sm italic">Selecciona arriba si quieres mover a una carpeta de trabajo o archivar como hito final.</p>
                    </div>
                ) : targetType === 'work' ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <HardDrive className="h-4 w-4 text-primary" />
                            <span>Explorar Carpetas de Trabajo</span>
                        </div>
                        
                        <div className="bg-zinc-200/50 p-2 rounded-md flex flex-wrap gap-1 items-center border border-zinc-300">
                            {workPath.map((f, idx) => (
                                <React.Fragment key={f.id}>
                                    {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-400" />}
                                    <button 
                                        className={cn("text-[10px] hover:text-primary", idx === workPath.length - 1 && "font-bold")}
                                        onClick={() => setWorkPath(prev => prev.slice(0, idx + 1))}
                                    >
                                        {f.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {isLoadingFolders ? (
                                <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
                            ) : workFolders.map(folder => (
                                <button 
                                    key={folder.id}
                                    onClick={() => setWorkPath(prev => [...prev, { id: folder.id, name: folder.name }])}
                                    className="flex items-center gap-2 p-3 bg-white border border-zinc-200 rounded-lg hover:border-primary transition-colors text-left"
                                >
                                    <Folder className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs truncate">{folder.name}</span>
                                </button>
                            ))}
                        </div>
                        {workFolders.length === 0 && !isLoadingFolders && (
                            <p className="text-xs text-zinc-500 italic">No hay más subcarpetas aquí.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <History className="h-4 w-4 text-primary" />
                            <span>Vincular a Hito Existente</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {milestones.map(ms => (
                                <button 
                                    key={ms.id}
                                    onClick={() => setSelectedMilestoneId(ms.id)}
                                    className={cn(
                                        "flex flex-col gap-1 p-3 border rounded-lg transition-colors text-left",
                                        selectedMilestoneId === ms.id 
                                            ? "bg-primary/10 border-primary" 
                                            : "bg-white border-zinc-200 hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold">{ms.name}</span>
                                        <Badge variant="outline" className="text-[8px]" style={{ color: ms.category.color, borderColor: ms.category.color }}>
                                            {ms.category.name}
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 italic">{format(new Date(ms.occurredAt), 'PP', { locale: es })}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 bg-zinc-200 border-t border-zinc-300 shrink-0">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-xs font-medium">
                    {selectedFiles.length > 0 ? (
                        <>
                            <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full">{selectedFiles.length}</span>
                            <span>archivos seleccionados</span>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <span className="text-primary font-bold">
                                {targetType === 'work' ? `Mover a ${workPath[workPath.length-1].name}` : selectedMilestoneId ? `Vincular a Hito` : 'Seleccionar destino'}
                            </span>
                        </>
                    ) : (
                        <span className="text-zinc-500 italic">Selecciona archivos de la izquierda</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button 
                        size="sm" 
                        disabled={selectedFiles.length === 0 || !targetType || (targetType === 'final' && !selectedMilestoneId) || isProcessing}
                        onClick={handleExecuteMove}
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Move className="h-4 w-4 mr-2" />}
                        Ejecutar Movimiento
                    </Button>
                </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
