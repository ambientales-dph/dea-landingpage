'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    UploadCloud, 
    X, 
    File as FileIcon, 
    Loader2, 
    ShieldCheck, 
    FolderEdit, 
    PlusCircle, 
    Folder, 
    HardDrive, 
    ChevronRight,
    Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { listSubfolders, createSubfolder, getOrCreateProjectFolder } from '@/timeline/services/google-drive';
import { CUENCAS } from '@/lib/cuencas';

export type FileConfig = {
  file: File;
  isFinal: boolean;
};

const addFilesSchema = z.object({
  targetFolderId: z.string().optional(),
});

type AddFilesFormValues = z.infer<typeof addFilesSchema>;

interface AddFilesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string | null;
  projectName: string | null;
  milestoneName: string;
  onUpload: (data: { 
    fileConfigs: FileConfig[],
    targetFolderId?: string
  }) => void;
  isUploading: boolean;
}

export function AddFilesDialog({
  isOpen,
  onOpenChange,
  projectCode,
  projectName,
  milestoneName,
  onUpload,
  isUploading,
}: AddFilesDialogProps) {
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [navigationStack, setNavigationStack] = React.useState<{id: string, name: string}[]>([]);
  const [currentSubfolders, setCurrentSubfolders] = React.useState<{id: string, name: string}[]>([]);
  const [fileConfigs, setFileConfigs] = React.useState<FileConfig[]>([]);

  const form = useForm<AddFilesFormValues>({
    resolver: zodResolver(addFilesSchema),
    defaultValues: {
      targetFolderId: 'root',
    },
  });

  const hasWorkFiles = fileConfigs.some(c => !c.isFinal);

  // Reset al cerrar
  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsCreatingFolder(false);
      setNavigationStack([]);
      setCurrentSubfolders([]);
      setFileConfigs([]);
    }
  }, [form, isOpen]);

  // Cargar jerarquía inicial: Cuenca -> Proyecto
  React.useEffect(() => {
    const initExplorer = async () => {
        if (hasWorkFiles && projectCode && isOpen && navigationStack.length === 0) {
            setIsLoadingFolders(true);
            try {
                // 1. Identificar Cuenca
                const basinCodeMatch = projectCode.match(/^([A-Z]{2,4})/i);
                const basin = basinCodeMatch ? CUENCAS.find(c => c.code === basinCodeMatch[1].toUpperCase()) : null;
                
                if (basin && basin.driveFolderId) {
                    const basinEntry = { id: basin.driveFolderId, name: basin.name };
                    const projectFolderId = await getOrCreateProjectFolder(projectCode, projectName, false);
                    const projectEntry = { id: projectFolderId, name: projectCode };
                    
                    setNavigationStack([basinEntry, projectEntry]);
                    form.setValue('targetFolderId', projectFolderId);
                } else {
                    const projectFolderId = await getOrCreateProjectFolder(projectCode, projectName, false);
                    setNavigationStack([{ id: projectFolderId, name: projectCode }]);
                    form.setValue('targetFolderId', projectFolderId);
                }
            } catch (error) {
                console.error("Error al iniciar explorador jerárquico:", error);
            } finally {
                setIsLoadingFolders(false);
            }
        }
    };
    initExplorer();
  }, [hasWorkFiles, projectCode, projectName, isOpen, navigationStack.length, form]);

  // Cargar subcarpetas cuando cambia el nivel actual
  React.useEffect(() => {
    const fetchSubfolders = async () => {
        if (navigationStack.length > 0 && hasWorkFiles) {
            const currentFolder = navigationStack[navigationStack.length - 1];
            setIsLoadingFolders(true);
            try {
                const subfolders = await listSubfolders(currentFolder.id);
                setCurrentSubfolders(subfolders.map(f => ({ id: f.id!, name: f.name! })));
            } catch (error) {
                console.error("Error al listar subcarpetas:", error);
            } finally {
                setIsLoadingFolders(false);
            }
        }
    };
    fetchSubfolders();
  }, [navigationStack, hasWorkFiles]);

  const handleNavigateIn = (folder: {id: string, name: string}) => {
    setNavigationStack(prev => [...prev, folder]);
    form.setValue('targetFolderId', folder.id);
  };

  const handleNavigateBack = (index: number) => {
    const newStack = navigationStack.slice(0, index + 1);
    setNavigationStack(newStack);
    form.setValue('targetFolderId', newStack[newStack.length - 1].id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || navigationStack.length === 0) return;
    setIsLoadingFolders(true);
    try {
        const currentFolder = navigationStack[navigationStack.length - 1];
        const newFolder = await createSubfolder(currentFolder.id, newFolderName.trim());
        setCurrentSubfolders(prev => [{id: newFolder.id!, name: newFolder.name!}, ...prev]);
        setNewFolderName('');
        setIsCreatingFolder(false);
    } catch (error) {
        console.error(error);
    } finally {
        setIsLoadingFolders(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    
    // Se sube de a uno: reemplazamos cualquier selección previa
    setFileConfigs([{ file, isFinal: true }]);
    if (e.target) e.target.value = '';
  };

  const toggleFileType = (index: number) => {
    setFileConfigs(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isFinal: !next[index].isFinal };
        return next;
    });
  };

  const removeFile = (index: number) => {
    setFileConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (data: AddFilesFormValues) => {
    if (fileConfigs.length === 0) return;
    onUpload({
        fileConfigs,
        targetFolderId: hasWorkFiles ? navigationStack[navigationStack.length - 1]?.id : undefined
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-zinc-100 text-black p-0 overflow-hidden flex flex-col shadow-2xl">
        <DialogHeader className="p-6 bg-zinc-200 border-b border-zinc-300">
          <DialogTitle className="font-headline text-lg">Subir archivo al hito</DialogTitle>
          <DialogDescription className="text-zinc-600 text-xs">
            Subida individual: elegí si el archivo es documentación final o de trabajo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 max-h-[65vh]">
              <div className="p-6 space-y-5">
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">1. Seleccionar archivo</Label>
                  <div 
                    className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer hover:bg-white hover:border-primary/50 transition-all group"
                    onClick={() => document.getElementById('add-files-input-detail')?.click()}
                  >
                    <UploadCloud className="mx-auto h-8 w-8 text-zinc-400 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-zinc-500 mt-2">Arrastrá un archivo o hacé clic aquí</p>
                    <input id="add-files-input-detail" type="file" className="hidden" multiple={false} onChange={handleFileChange} />
                  </div>

                  {fileConfigs.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">2. Clasificación del archivo</p>
                        <div className="flex gap-3 text-[9px] font-bold text-zinc-400 uppercase">
                            <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5 text-primary" /> Final</span>
                            <span className="flex items-center gap-1"><Briefcase className="h-2.5 w-2.5 text-amber-600" /> Trabajo</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 rounded-md border border-zinc-200 p-1.5 bg-zinc-50 shadow-inner">
                        {fileConfigs.map((config, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-zinc-100 shadow-sm gap-3">
                            <div className="flex items-center gap-2 truncate flex-1">
                              <FileIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              <span className="text-[11px] truncate font-medium">{config.file.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                                <button 
                                    type="button"
                                    onClick={() => toggleFileType(index)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all border",
                                        config.isFinal 
                                            ? "bg-primary/10 border-primary/20 text-primary" 
                                            : "bg-amber-50 border-amber-200 text-amber-700"
                                    )}
                                >
                                    {config.isFinal ? <ShieldCheck className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                                    {config.isFinal ? 'Final' : 'Trabajo'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => removeFile(index)} 
                                    className="text-zinc-300 hover:text-destructive p-1 rounded transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {hasWorkFiles && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2 border-t border-zinc-200 pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500">3. Destino para archivo de trabajo</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="xs" 
                        className="h-6 text-[9px] gap-1 border border-zinc-300 px-2 hover:bg-white"
                        onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                      >
                        <PlusCircle className="h-3 w-3" /> Nueva carpeta
                      </Button>
                    </div>

                    <div className="bg-white rounded-md border border-zinc-300 overflow-hidden shadow-sm">
                      <div className="bg-zinc-50 px-2 py-1.5 border-b border-zinc-200 flex items-center flex-wrap gap-1">
                        {navigationStack.map((folder, idx) => (
                          <React.Fragment key={folder.id}>
                            {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-400" />}
                            <button 
                              type="button" 
                              onClick={() => handleNavigateBack(idx)}
                              className={cn(
                                "text-[10px] hover:text-primary transition-colors truncate max-w-[120px]",
                                idx === navigationStack.length - 1 ? "font-bold text-zinc-800" : "text-zinc-500"
                              )}
                            >
                              {folder.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>

                      {isCreatingFolder && (
                        <div className="flex gap-1 p-2 bg-primary/5 border-b border-zinc-200 animate-in zoom-in-95">
                          <Input 
                            placeholder="Nombre de la carpeta..." 
                            className="h-7 text-xs bg-white border-zinc-300" 
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            autoFocus
                          />
                          <Button type="button" size="sm" className="h-7 text-[10px]" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Crear</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsCreatingFolder(false)}><X className="h-3 w-3" /></Button>
                        </div>
                      )}

                      <ScrollArea className="h-[120px]">
                        {isLoadingFolders ? (
                          <div className="flex items-center justify-center h-full py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                          </div>
                        ) : currentSubfolders.length > 0 ? (
                          <div className="p-1 space-y-0.5">
                            {currentSubfolders.map(folder => (
                              <button 
                                key={folder.id}
                                type="button"
                                onClick={() => handleNavigateIn(folder)}
                                className="w-full flex items-center gap-2 p-1.5 hover:bg-primary/10 rounded text-left transition-colors group"
                              >
                                <Folder className="h-3.5 w-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                                <span className="text-xs truncate">{folder.name}</span>
                                <ChevronRight className="h-3 w-3 ml-auto text-zinc-300 opacity-0 group-hover:opacity-100" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-[10px] text-zinc-400 italic">No hay más subcarpetas.</div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-zinc-200 border-t border-zinc-300 flex flex-row justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isUploading || fileConfigs.length === 0} className="shadow-md min-w-[140px]">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Subir Archivo
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}