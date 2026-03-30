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
    Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { listSubfolders, createSubfolder, getOrCreateProjectFolder } from '@/timeline/services/google-drive';

const addFilesSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, 'Seleccioná al menos un archivo.'),
  isFinalDocument: z.boolean().default(true),
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
    files: File[], 
    isFinalDocument: boolean,
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

  const form = useForm<AddFilesFormValues>({
    resolver: zodResolver(addFilesSchema),
    defaultValues: {
      files: [],
      isFinalDocument: true,
      targetFolderId: 'root',
    },
  });

  const isFinal = form.watch('isFinalDocument');

  // Reset al cerrar
  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsCreatingFolder(false);
      setNavigationStack([]);
      setCurrentSubfolders([]);
    }
  }, [form, isOpen]);

  // Cargar carpeta inicial del proyecto si es modo trabajo
  React.useEffect(() => {
    const initExplorer = async () => {
        if (!isFinal && projectCode && isOpen && navigationStack.length === 0) {
            setIsLoadingFolders(true);
            try {
                const projectFolderId = await getOrCreateProjectFolder(projectCode, projectName, false);
                const rootEntry = { id: projectFolderId, name: projectCode || 'Proyecto' };
                setNavigationStack([rootEntry]);
                form.setValue('targetFolderId', projectFolderId);
            } catch (error) {
                console.error("Error al iniciar explorador:", error);
            } finally {
                setIsLoadingFolders(false);
            }
        }
    };
    initExplorer();
  }, [isFinal, projectCode, projectName, isOpen, navigationStack.length, form]);

  // Cargar subcarpetas cuando cambia el nivel actual
  React.useEffect(() => {
    const fetchSubfolders = async () => {
        if (navigationStack.length > 0 && !isFinal) {
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
  }, [navigationStack, isFinal]);

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
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;
    
    const currentFiles = form.getValues('files') || [];
    form.setValue('files', [...currentFiles, ...newFiles], { shouldValidate: true });
    if (e.target) e.target.value = '';
  };

  const selectedFiles = form.watch('files') || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-100 text-black p-0 overflow-hidden flex flex-col shadow-2xl">
        <DialogHeader className="p-6 bg-zinc-200 border-b border-zinc-300">
          <DialogTitle className="font-headline text-lg">Subir archivos al hito</DialogTitle>
          <DialogDescription className="text-zinc-600 text-xs">
            Seleccioná si estos archivos son documentación final o de trabajo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onUpload)} className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="p-6 space-y-4">
                
                <FormField
                  control={form.control}
                  name="isFinalDocument"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-zinc-300 p-3 bg-white shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-xs font-bold flex items-center gap-2">
                          {field.value ? <ShieldCheck className="h-4 w-4 text-primary" /> : <FolderEdit className="h-4 w-4 text-amber-600" />}
                          {field.value ? 'Documentación Final (Intocable)' : 'Archivo de Trabajo (Tocable)'}
                        </FormLabel>
                        <FormDescription className="text-[10px] leading-tight text-zinc-500">
                          {field.value 
                            ? 'Se guarda en la carpeta cerrada del hito en la TL.' 
                            : 'Se guarda en la carpeta técnica de obra (EIAS_AMBIENTALES).'}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!isFinal && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500">Destino en Carpeta Técnica</Label>
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
                                "text-[10px] hover:text-primary transition-colors truncate max-w-[100px]",
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

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Seleccionar archivos</Label>
                  <div 
                    className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer hover:bg-white hover:border-primary/50 transition-all group"
                    onClick={() => document.getElementById('add-files-input')?.click()}
                  >
                    <UploadCloud className="mx-auto h-8 w-8 text-zinc-400 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-zinc-500 mt-2">Arrastrá archivos o hacé clic para buscar</p>
                    <input id="add-files-input" type="file" className="hidden" multiple onChange={handleFileChange} />
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-1 mt-3">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Archivos seleccionados ({selectedFiles.length})</p>
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border border-zinc-200 p-1 bg-zinc-50 shadow-inner">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-1.5 bg-white rounded border border-zinc-100 shadow-sm">
                            <div className="flex items-center gap-2 truncate">
                              <FileIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              <span className="text-[11px] truncate font-medium">{file.name}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => {
                                const updatedFiles = selectedFiles.filter((_, i) => i !== index);
                                form.setValue('files', updatedFiles, { shouldValidate: true });
                              }} 
                              className="text-zinc-400 hover:text-destructive p-1 rounded transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-zinc-200 border-t border-zinc-300 flex flex-row justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isUploading || selectedFiles.length === 0} className="shadow-md min-w-[120px]">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Subir Archivos
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
