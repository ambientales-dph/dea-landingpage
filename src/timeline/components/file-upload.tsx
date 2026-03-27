
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
import type { Category } from '@/timeline/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from './ui/textarea';
import { UploadCloud, X, File as FileIconLucide, CalendarIcon, Loader2, ShieldCheck, FolderEdit, PlusCircle, Folder, HardDrive, Map, ChevronRight, ChevronLeft } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format, isValid, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { listSubfolders, createSubfolder, getOrCreateProjectFolder } from '@/timeline/services/google-drive';
import { Badge } from './ui/badge';
import { CUENCAS } from '@/lib/cuencas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const uploadSchema = z.object({
  name: z.string().min(1, { message: 'El título del hito no puede estar vacío.' }),
  description: z.string().optional().or(z.string().min(0)),
  occurredAt: z.date({
    required_error: "Se requiere una fecha para el hito.",
  }),
  files: z.array(z.instanceof(File)).optional(),
  categoryId: z.string().min(1, 'Por favor, seleccioná una categoría.'),
  isFinalDocument: z.boolean().default(true),
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
    files?: File[], 
    categoryId: string, 
    name: string, 
    description: string, 
    occurredAt: Date,
    isFinalDocument: boolean,
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
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [manualDateText, setManualDateText] = React.useState('');
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  
  // Navegación de carpetas
  const [navigationStack, setNavigationStack] = React.useState<{id: string, name: string}[]>([]);
  const [currentSubfolders, setCurrentSubfolders] = React.useState<{id: string, name: string}[]>([]);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: '',
      description: '',
      files: [],
      categoryId: '',
      occurredAt: new Date(),
      isFinalDocument: true,
      targetFolderId: 'root',
    },
  });

  const isFinal = form.watch('isFinalDocument');
  const hitoName = form.watch('name');

  // Reset al cerrar
  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
      form.setValue('occurredAt', new Date());
      setManualDateText(format(new Date(), "dd/MM/yyyy"));
      setShowCalendar(false);
      setIsCreatingFolder(false);
      setNavigationStack([]);
      setCurrentSubfolders([]);
    }
  }, [form, isOpen]);

  // Cargar carpeta inicial del proyecto
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
        if (navigationStack.length > 0) {
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
  }, [navigationStack]);

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

  const handleManualDateChange = (val: string) => {
    const cleaned = val.replace(/[^0-9/]/g, "");
    setManualDateText(cleaned);
    
    if (cleaned.length === 10) {
      const parsedDate = parse(cleaned, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        form.setValue('occurredAt', parsedDate, { shouldValidate: true });
      }
    }
  };

  const onSubmit = (data: UploadFormValues) => {
    onUpload({
        ...data,
        description: data.description || '',
        targetFolderId: isFinal ? undefined : navigationStack[navigationStack.length - 1]?.id
    });
  };
  
  const selectedFiles = form.watch('files') || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;
    
    const currentFiles = form.getValues('files') || [];
    form.setValue('files', [...currentFiles, ...newFiles], { shouldValidate: true });
    if (e.target) e.target.value = '';
  };

  const basinName = React.useMemo(() => {
      if (!projectCode) return '';
      const basinCodeMatch = projectCode.match(/^([A-Z]{2,4})/i);
      if (!basinCodeMatch) return '';
      const basin = CUENCAS.find(c => c.code === basinCodeMatch[1].toUpperCase());
      return basin ? basin.name : '';
  }, [projectCode]);

  const fullPathString = React.useMemo(() => {
      if (isFinal) {
          const cleanName = (projectName || projectCode || '').replace(/\s*\([^)]+\)$/, '').trim();
          return `${projectCode} - ${cleanName} / YYMMDDHHMMSS_${hitoName || 'Hito'}`;
      }
      return navigationStack.map(f => f.name).join(' / ');
  }, [isFinal, navigationStack, projectName, projectCode, hitoName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-zinc-300 text-black p-0 transition-all duration-300 overflow-hidden",
        showCalendar ? "sm:max-w-[800px]" : "sm:max-w-[550px]"
      )}>
        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col sm:flex-row h-full">
              <div className="flex-1 p-6 border-b sm:border-b-0 sm:border-r border-zinc-400/30">
                  <DialogHeader className="space-y-1 mb-4">
                  <DialogTitle className="font-headline text-lg">Cargar un nuevo hito</DialogTitle>
                  <DialogDescription className="text-zinc-700 text-xs">
                      Define si los archivos son finales (intocables) o de trabajo.
                  </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      {isUploading ? (
                      <div className="space-y-4 py-8 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <div className="space-y-1">
                              <p className="text-xs font-medium text-zinc-800">{uploadText}</p>
                              <p className="text-[10px] text-zinc-600">Este proceso puede tardar unos segundos...</p>
                          </div>
                      </div>
                      ) : (
                      <fieldset disabled={isUploading} className="space-y-3">
                          
                          <div className="bg-white/40 p-3 rounded-lg border border-zinc-400/50 mb-4 space-y-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Destino de Carga</p>
                              <div className="flex items-center gap-2">
                                  <HardDrive className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-[10px] font-bold">Raíz: {isFinal ? 'DEA_TL_archivos' : 'EIAS_AMBIENTALES'}</span>
                              </div>
                              {!isFinal && basinName && (
                                  <div className="flex items-center gap-2">
                                      <Map className="h-3.5 w-3.5 text-zinc-500" />
                                      <span className="text-[10px] truncate max-w-full">Cuenca: <span className="font-bold">{basinName}</span></span>
                                  </div>
                              )}
                              <div className="flex items-start gap-2">
                                  <Folder className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                  <span className="text-[10px] leading-tight break-all">Ruta: <span className="font-bold">{fullPathString}</span></span>
                              </div>
                          </div>

                          <FormField
                          control={form.control}
                          name="isFinalDocument"
                          render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-zinc-400 p-3 bg-zinc-200/50 shadow-inner">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-xs font-bold flex items-center gap-2">
                                    {field.value ? <ShieldCheck className="h-4 w-4 text-primary" /> : <FolderEdit className="h-4 w-4 text-amber-600" />}
                                    {field.value ? 'Documentación Final (Intocable)' : 'Archivo de Trabajo (Tocable)'}
                                  </FormLabel>
                                  <FormDescription className="text-[9px] leading-tight text-zinc-600">
                                    {field.value 
                                      ? 'Se guarda en TL bajo una carpeta cerrada para el hito.' 
                                      : 'Se guarda en la carpeta de la cuenca/obra correspondiente.'}
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
                                      <Label className="text-[10px] uppercase font-bold text-zinc-500">Navegador de Carpetas</Label>
                                      <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="xs" 
                                          className="h-6 text-[9px] gap-1 border border-zinc-400 px-2 hover:bg-zinc-100"
                                          onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                                      >
                                          <PlusCircle className="h-3 w-3" /> Nueva carpeta aquí
                                      </Button>
                                  </div>

                                  <div className="bg-white/60 rounded-md border border-zinc-400 overflow-hidden">
                                      {/* Breadcrumbs de navegación */}
                                      <div className="bg-zinc-100/80 px-2 py-1.5 border-b border-zinc-300 flex items-center flex-wrap gap-1">
                                          {navigationStack.map((folder, idx) => (
                                              <React.Fragment key={folder.id}>
                                                  {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-400" />}
                                                  <button 
                                                      type="button" 
                                                      onClick={() => handleNavigateBack(idx)}
                                                      className={cn(
                                                          "text-[10px] hover:text-primary transition-colors truncate max-w-[80px]",
                                                          idx === navigationStack.length - 1 ? "font-bold text-zinc-800" : "text-zinc-500"
                                                      )}
                                                  >
                                                      {folder.name}
                                                  </button>
                                              </React.Fragment>
                                          ))}
                                      </div>

                                      {isCreatingFolder && (
                                          <div className="flex gap-1 p-2 bg-primary/5 border-b border-zinc-300 animate-in zoom-in-95">
                                              <Input 
                                                  placeholder="Nombre de la carpeta..." 
                                                  className="h-7 text-xs bg-white border-zinc-400" 
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
                                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                                              <div className="p-8 text-center text-[10px] text-zinc-400 italic">Esta carpeta está vacía.</div>
                                          )}
                                      </ScrollArea>
                                  </div>
                              </div>
                          )}

                          <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                              <FormItem className="space-y-1">
                              <FormLabel className="text-xs font-semibold">Título del hito</FormLabel>
                              <FormControl>
                                  <Input {...field} className="h-8 text-sm bg-zinc-100 text-black border-zinc-400" />
                              </FormControl>
                              <FormMessage className="text-[10px]" />
                              </FormItem>
                          )}
                          />
                          <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                              <FormItem className="space-y-1">
                              <FormLabel className="text-xs font-semibold">Descripción / Detalles</FormLabel>
                              <FormControl>
                                  <Textarea className="min-h-[60px] text-sm bg-zinc-100 text-black border-zinc-400" rows={2} {...field} />
                              </FormControl>
                              <FormMessage className="text-[10px]" />
                              </FormItem>
                          )}
                          />
                          <div className="grid grid-cols-2 gap-3 items-start">
                              <FormField
                              control={form.control}
                              name="occurredAt"
                              render={() => (
                                  <FormItem className="space-y-1">
                                  <FormLabel className="text-xs font-semibold">Fecha</FormLabel>
                                  <div className="flex gap-1">
                                    <Input 
                                      placeholder="DD/MM/YYYY" 
                                      className="h-8 text-sm bg-zinc-100 text-black border-zinc-400"
                                      value={manualDateText}
                                      onChange={(e) => handleManualDateChange(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowCalendar(!showCalendar)}
                                        className={cn("h-8 w-8 p-0 shrink-0 border-zinc-400", showCalendar && "bg-primary text-white hover:bg-primary")}
                                    >
                                        <CalendarIcon className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <FormMessage className="text-[10px]" />
                                  </FormItem>
                              )}
                              />
                              <FormField
                              control={form.control}
                              name="categoryId"
                              render={({ field }) => (
                                  <FormItem className="space-y-1">
                                  <FormLabel className="text-xs font-semibold">Categoría</FormLabel>
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
                          </div>
                          
                          <FormField
                          control={form.control}
                          name="files"
                          render={() => (
                              <FormItem className="space-y-1">
                              <FormLabel className="text-xs font-semibold">Archivos a subir</FormLabel>
                              <FormControl>
                                  <div className="space-y-2">
                                  <div 
                                      className="border-2 border-dashed border-zinc-500/50 rounded-lg p-3 text-center cursor-pointer hover:bg-zinc-400/50 transition-colors"
                                      onClick={() => document.getElementById('file-input')?.click()}
                                  >
                                      <UploadCloud className="mx-auto h-6 w-6 text-zinc-600" />
                                      <p className="text-[9px] text-zinc-500 mt-1">Click para seleccionar archivos</p>
                                      <input id="file-input" type="file" className="hidden" multiple onChange={handleFileChange} />
                                  </div>
                                  {selectedFiles.length > 0 && (
                                      <ul className="max-h-24 overflow-y-auto space-y-1 rounded-md border border-zinc-400 p-1.5 bg-zinc-200 text-[10px]">
                                          {selectedFiles.map((file, index) => (
                                              <li key={index} className="flex items-center justify-between p-1 bg-zinc-100 rounded">
                                              <div className="flex items-center gap-1.5 truncate">
                                                  <FileIconLucide className="h-3 w-3 shrink-0 text-zinc-400" />
                                                  <span className="truncate">{file.name}</span>
                                              </div>
                                              <button type="button" onClick={() => {
                                                  const updatedFiles = selectedFiles.filter((_, i) => i !== index);
                                                  form.setValue('files', updatedFiles, { shouldValidate: true });
                                              }} className="text-destructive hover:bg-red-50 p-0.5 rounded"><X className="h-3 w-3" /></button>
                                              </li>
                                          ))}
                                      </ul>
                                  )}
                                  </div>
                              </FormControl>
                              </FormItem>
                          )}
                          />
                      </fieldset>
                      )}
                      <DialogFooter className="pt-2 gap-2 flex flex-row justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 border-zinc-400">Cerrar</Button>
                        <Button type="submit" size="sm" disabled={isUploading} className="h-8 shadow-md">Subir e Iniciar Hito</Button>
                      </DialogFooter>
                  </form>
                  </Form>
              </div>

              {showCalendar && (
                  <div className="w-full sm:w-[320px] bg-zinc-200 p-4 flex flex-col items-center border-l border-zinc-400/30">
                      <Calendar
                          mode="single"
                          selected={form.watch('occurredAt')}
                          onSelect={(date) => {
                              if (date) {
                                  form.setValue('occurredAt', date);
                                  setShowCalendar(false);
                              }
                          }}
                          locale={es}
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear() + 10}
                          className="bg-white rounded-lg shadow-xl"
                      />
                  </div>
              )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
