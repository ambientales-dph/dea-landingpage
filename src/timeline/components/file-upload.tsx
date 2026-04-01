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
import type { Category } from '@/timeline/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from './ui/textarea';
import { 
    UploadCloud, 
    X, 
    File as FileIconLucide, 
    Loader2, 
    ShieldCheck, 
    PlusCircle, 
    Folder, 
    ChevronRight, 
    Briefcase,
    CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { listSubfolders, createSubfolder, getOrCreateProjectFolder } from '@/timeline/services/google-drive';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { type FileConfig } from './add-files-dialog';
import { CUENCAS } from '@/lib/cuencas';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const uploadSchema = z.object({
  name: z.string().min(1, { message: 'El título del hito no puede estar vacío.' }),
  description: z.string().optional().default(''),
  categoryId: z.string().min(1, 'Por favor, seleccioná una categoría.'),
  occurredAt: z.date({ required_error: "Debes seleccionar una fecha." }),
  targetFolderId: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface FileUploadProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: Category[];
  projectCode: string | null;
  projectName: string | null;
  onUpload: (data: { 
    fileConfigs: FileConfig[], 
    categoryId: string, 
    name: string, 
    description: string, 
    occurredAt: Date,
    targetFolderId?: string
  }) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadText: string;
}

export function FileUpload({
  isOpen,
  onOpenChange,
  categories,
  projectCode,
  projectName,
  onUpload,
  isUploading,
  uploadProgress,
  uploadText,
}: FileUploadProps) {
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [fileConfigs, setFileConfigs] = React.useState<FileConfig[]>([]);
  
  const [navigationStack, setNavigationStack] = React.useState<{id: string, name: string}[]>([]);
  const [currentSubfolders, setCurrentSubfolders] = React.useState<{id: string, name: string}[]>([]);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      occurredAt: new Date(),
      targetFolderId: 'root',
    },
  });

  const hasWorkFiles = fileConfigs.some(c => !c.isFinal);

  React.useEffect(() => {
    if (!isOpen) {
      form.reset({
        name: '',
        description: '',
        categoryId: '',
        occurredAt: new Date(),
        targetFolderId: 'root'
      });
      setIsCreatingFolder(false);
      setNavigationStack([]);
      setCurrentSubfolders([]);
      setFileConfigs([]);
    }
  }, [form, isOpen]);

  React.useEffect(() => {
    const initExplorer = async () => {
        if (hasWorkFiles && projectCode && isOpen && navigationStack.length === 0) {
            setIsLoadingFolders(true);
            try {
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
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;
    
    const newConfigs: FileConfig[] = newFiles.map(f => ({ file: f, isFinal: true }));
    setFileConfigs(prev => [...prev, ...newConfigs]);
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

  const handleFormSubmit = (data: UploadFormValues) => {
    onUpload({
        ...data,
        fileConfigs,
        description: data.description || '',
        targetFolderId: hasWorkFiles ? navigationStack[navigationStack.length - 1]?.id : undefined
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-300 text-black p-0 transition-all duration-300 overflow-hidden sm:max-w-[600px]">
        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col h-full">
              <div className="flex-1 p-6">
                  <DialogHeader className="space-y-1 mb-4">
                  <DialogTitle className="font-headline text-lg">Cargar un nuevo hito</DialogTitle>
                  <DialogDescription className="text-zinc-700 text-xs">
                      Solo el título y la categoría son obligatorios. Podés seleccionar una fecha pasada si lo necesitás.
                  </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                      {isUploading ? (
                      <div className="space-y-4 py-8 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <div className="space-y-1">
                              <p className="text-xs font-medium text-zinc-800">{uploadText}</p>
                              <p className="text-[10px] text-zinc-600">Este proceso puede tardar unos segundos...</p>
                          </div>
                      </div>
                      ) : (
                      <fieldset disabled={isUploading} className="space-y-4">
                          
                          <div className="grid grid-cols-2 gap-3">
                              <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                  <FormItem className="space-y-1 col-span-2">
                                  <FormLabel className="text-xs font-semibold">Título del hito *</FormLabel>
                                  <FormControl>
                                      <Input {...field} className="h-8 text-sm bg-zinc-100 text-black border-zinc-400" />
                                  </FormControl>
                                  <FormMessage className="text-[10px]" />
                                  </FormItem>
                              )}
                              />
                              
                              <div className="col-span-2 grid grid-cols-2 gap-3">
                                  <FormField
                                  control={form.control}
                                  name="categoryId"
                                  render={({ field }) => (
                                      <FormItem className="space-y-1">
                                      <FormLabel className="text-xs font-semibold">Categoría *</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                          <SelectTrigger className="h-8 text-sm bg-zinc-100 border-zinc-400">
                                              <SelectValue placeholder="Seleccioná" />
                                          </SelectTrigger>
                                          </FormControl>
                                          <SelectContent className="max-h-[200px]" position="popper">
                                          {categories.map(category => (
                                              <SelectItem key={category.id} value={category.id} className="text-xs">
                                                  {category.name}
                                              </SelectItem>
                                          ))}
                                          </SelectContent>
                                      </Select>
                                      <FormMessage className="text-[10px]" />
                                      </FormItem>
                                  )}
                                  />

                                  <FormField
                                  control={form.control}
                                  name="occurredAt"
                                  render={({ field }) => (
                                      <FormItem className="space-y-1">
                                      <FormLabel className="text-xs font-semibold">Fecha del hito</FormLabel>
                                      <Popover>
                                          <PopoverTrigger asChild>
                                              <FormControl>
                                                  <Button
                                                      variant={"outline"}
                                                      className={cn(
                                                          "w-full h-8 pl-3 text-left font-normal bg-zinc-100 border-zinc-400 text-sm",
                                                          !field.value && "text-muted-foreground"
                                                      )}
                                                  >
                                                      {field.value ? (
                                                          format(field.value, "dd/MM/yyyy")
                                                      ) : (
                                                          <span>Seleccioná fecha</span>
                                                      )}
                                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                  </Button>
                                              </FormControl>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0 bg-white" align="start">
                                              <Calendar
                                                  mode="single"
                                                  selected={field.value}
                                                  onSelect={field.onChange}
                                                  disabled={(date) =>
                                                      date > new Date() || date < new Date("1900-01-01")
                                                  }
                                                  initialFocus
                                                  locale={es}
                                                  captionLayout="dropdown-buttons"
                                                  fromYear={1900}
                                                  toYear={new Date().getFullYear()}
                                              />
                                          </PopoverContent>
                                      </Popover>
                                      <FormMessage className="text-[10px]" />
                                      </FormItem>
                                  )}
                                  />
                              </div>

                              <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                  <FormItem className="space-y-1 col-span-2">
                                  <FormLabel className="text-xs font-semibold">Descripción / Detalles (Opcional)</FormLabel>
                                  <FormControl>
                                      <Textarea className="min-h-[60px] text-sm bg-zinc-100 text-black border-zinc-400" rows={2} {...field} />
                                  </FormControl>
                                  <FormMessage className="text-[10px]" />
                                  </FormItem>
                              )}
                              />
                          </div>

                          <div className="space-y-2 border-t border-zinc-400/30 pt-3">
                              <Label className="text-xs font-bold uppercase text-zinc-500">Archivos y Clasificación</Label>
                              <div 
                                  className="border-2 border-dashed border-zinc-500/50 rounded-lg p-3 text-center cursor-pointer hover:bg-zinc-400/50 transition-colors"
                                  onClick={() => document.getElementById('file-input-new-ms')?.click()}
                              >
                                  <UploadCloud className="mx-auto h-6 w-6 text-zinc-600" />
                                  <p className="text-[9px] text-zinc-500 mt-1">Hacé clic aquí para seleccionar archivos</p>
                                  <input id="file-input-new-ms" type="file" className="hidden" multiple onChange={handleFileChange} />
                              </div>
                              
                              {fileConfigs.length > 0 && (
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-zinc-400 p-1.5 bg-zinc-200">
                                      {fileConfigs.map((config, index) => (
                                          <div key={index} className="flex items-center justify-between p-1.5 bg-zinc-100 rounded gap-2">
                                              <div className="flex items-center gap-1.5 truncate flex-1">
                                                  <FileIconLucide className="h-3 w-3 shrink-0 text-zinc-400" />
                                                  <span className="text-[10px] truncate font-medium">{config.file.name}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                  <button 
                                                      type="button"
                                                      onClick={() => toggleFileType(index)}
                                                      className={cn(
                                                          "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border",
                                                          config.isFinal 
                                                              ? "bg-primary/10 border-primary/20 text-primary" 
                                                              : "bg-amber-50 border-amber-200 text-amber-700"
                                                      )}
                                                  >
                                                      {config.isFinal ? <ShieldCheck className="h-2.5 w-2.5" /> : <Briefcase className="h-2.5 w-2.5" />}
                                                      {config.isFinal ? 'Final' : 'Trabajo'}
                                                  </button>
                                                  <button type="button" onClick={() => removeFile(index)} className="text-destructive hover:bg-red-50 p-0.5 rounded"><X className="h-3 w-3" /></button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>

                          {hasWorkFiles && (
                              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2 border-t border-zinc-400/30 pt-3">
                                  <div className="flex items-center justify-between">
                                      <Label className="text-[10px] uppercase font-bold text-zinc-500">Destino de Trabajo</Label>
                                      <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="xs" 
                                          className="h-6 text-[9px] gap-1 border border-zinc-400 px-2 hover:bg-zinc-100"
                                          onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                                      >
                                          <PlusCircle className="h-3 w-3" /> Nueva
                                      </Button>
                                  </div>

                                  <div className="bg-white/60 rounded-md border border-zinc-400 overflow-hidden shadow-sm">
                                      <div className="bg-zinc-100/80 px-2 py-1 border-b border-zinc-300 flex items-center flex-wrap gap-1">
                                          {navigationStack.map((folder, idx) => (
                                              <React.Fragment key={folder.id}>
                                                  {idx > 0 && <ChevronRight className="h-2 w-2 text-zinc-400" />}
                                                  <button 
                                                      type="button" 
                                                      onClick={() => handleNavigateBack(idx)}
                                                      className={cn(
                                                          "text-[9px] hover:text-primary transition-colors truncate max-w-[120px]",
                                                          idx === navigationStack.length - 1 ? "font-bold text-zinc-800" : "text-zinc-500"
                                                      )}
                                                  >
                                                      {folder.name}
                                                  </button>
                                              </React.Fragment>
                                          ))}
                                      </div>

                                      {isCreatingFolder && (
                                          <div className="flex gap-1 p-1 bg-primary/5 border-b border-zinc-300 animate-in zoom-in-95">
                                              <Input 
                                                  placeholder="Nombre..." 
                                                  className="h-6 text-[10px] bg-white border-zinc-400" 
                                                  value={newFolderName}
                                                  onChange={(e) => setNewFolderName(e.target.value)}
                                                  autoFocus
                                              />
                                              <Button type="button" size="sm" className="h-6 text-[9px]" onClick={handleCreateFolder}>Ok</Button>
                                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsCreatingFolder(false)}><X className="h-3 w-3" /></Button>
                                          </div>
                                      )}

                                      <ScrollArea className="h-[100px]">
                                          {isLoadingFolders ? (
                                              <div className="flex items-center justify-center h-full py-4">
                                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                              </div>
                                          ) : currentSubfolders.length > 0 ? (
                                              <div className="p-1 space-y-0.5">
                                                  {currentSubfolders.map(folder => (
                                                      <button 
                                                          key={folder.id}
                                                          type="button"
                                                          onClick={() => handleNavigateIn(folder)}
                                                          className="w-full flex items-center gap-2 p-1 hover:bg-primary/10 rounded text-left transition-colors group"
                                                      >
                                                          <Folder className="h-3 w-3 text-amber-600 group-hover:scale-110 transition-transform" />
                                                          <span className="text-[10px] truncate">{folder.name}</span>
                                                      </button>
                                                  ))}
                                              </div>
                                          ) : (
                                              <div className="p-4 text-center text-[9px] text-zinc-400 italic">Carpeta vacía.</div>
                                          )}
                                      </ScrollArea>
                                  </div>
                              </div>
                          )}
                      </fieldset>
                      )}
                      <DialogFooter className="pt-2 gap-2 flex flex-row justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 border-zinc-400">Cerrar</Button>
                        <Button type="submit" size="sm" disabled={isUploading} className="h-8 shadow-md">Crear e Iniciar Hito</Button>
                      </DialogFooter>
                  </form>
                  </Form>
              </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
