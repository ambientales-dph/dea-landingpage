
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Category } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from './ui/textarea';
import { UploadCloud, X, File as FileIconLucide, CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format, isValid, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';

const uploadSchema = z.object({
  name: z.string().min(1, { message: 'El título del hito no puede estar vacío.' }),
  description: z.string().optional().or(z.string().min(0)),
  occurredAt: z.date({
    required_error: "Se requiere una fecha para el hito.",
  }),
  files: z.array(z.instanceof(File)).optional(),
  categoryId: z.string().min(1, 'Por favor, seleccioná una categoría.'),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface FileUploadProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: Category[];
  onUpload: (data: { files?: File[], categoryId: string, name: string, description: string, occurredAt: Date }) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadText: string;
}

export function FileUpload({
  isOpen,
  onOpenChange,
  categories,
  onUpload,
  isUploading,
  uploadProgress,
  uploadText,
}: FileUploadProps) {
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [manualDateText, setManualDateText] = React.useState('');

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: '',
      description: '',
      files: [],
      categoryId: '',
      occurredAt: new Date(),
    },
  });

  const formDate = form.watch('occurredAt');

  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
      form.setValue('occurredAt', new Date());
      setManualDateText(format(new Date(), "dd/MM/yyyy"));
      setShowCalendar(false);
    }
  }, [form, isOpen]);

  React.useEffect(() => {
    if (formDate) {
      setManualDateText(format(formDate, "dd/MM/yyyy"));
    }
  }, [formDate]);

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
        description: data.description || ''
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

  const handleRemoveFile = (indexToRemove: number) => {
    const currentFiles = form.getValues('files') || [];
    const updatedFiles = currentFiles.filter((_, index) => index !== indexToRemove);
    form.setValue('files', updatedFiles, { shouldValidate: true });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-zinc-300 text-black p-0 transition-all duration-300 overflow-hidden",
        showCalendar ? "sm:max-w-[800px]" : "sm:max-w-[440px]"
      )}>
        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col sm:flex-row h-full">
              <div className="flex-1 p-6 border-b sm:border-b-0 sm:border-r border-zinc-400/30">
                  <DialogHeader className="space-y-1 mb-4">
                  <DialogTitle className="font-headline text-lg">Cargar un nuevo hito</DialogTitle>
                  <DialogDescription className="text-zinc-700 text-xs">
                      Agregá un hito a la línea de tiempo.
                  </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      {isUploading ? (
                      <div className="space-y-4 py-8 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <div className="space-y-1">
                              <p className="text-xs font-medium text-zinc-800">{uploadText}</p>
                              <p className="text-[10px] text-zinc-600">Procesando archivos...</p>
                          </div>
                      </div>
                      ) : (
                      <fieldset disabled={isUploading} className="space-y-3">
                          <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                              <FormItem className="space-y-1">
                              <FormLabel className="text-xs font-semibold">Título</FormLabel>
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
                              <FormLabel className="text-xs font-semibold">Descripción</FormLabel>
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
                                          <SelectValue placeholder="Categoría" />
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
                              <FormLabel className="text-xs font-semibold">Archivos</FormLabel>
                              <FormControl>
                                  <div className="space-y-2">
                                  <div 
                                      className="border-2 border-dashed border-zinc-500/50 rounded-lg p-3 text-center cursor-pointer hover:bg-zinc-400/50"
                                      onClick={() => document.getElementById('file-input')?.click()}
                                  >
                                      <UploadCloud className="mx-auto h-6 w-6 text-zinc-600" />
                                      <input id="file-input" type="file" className="hidden" multiple onChange={handleFileChange} />
                                  </div>
                                  {selectedFiles.length > 0 && (
                                      <ul className="max-h-24 overflow-y-auto space-y-1 rounded-md border border-zinc-400 p-1.5 bg-zinc-200 text-[10px]">
                                          {selectedFiles.map((file, index) => (
                                              <li key={index} className="flex items-center justify-between p-1 bg-zinc-100 rounded">
                                              <span className="truncate">{file.name}</span>
                                              <button type="button" onClick={() => handleRemoveFile(index)} className="text-destructive"><X className="h-3 w-3" /></button>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">Cerrar</Button>
                        <Button type="submit" size="sm" disabled={isUploading} className="h-8">Crear Hito</Button>
                      </DialogFooter>
                  </form>
                  </Form>
              </div>

              {showCalendar && (
                  <div className="w-full sm:w-[360px] bg-zinc-200 p-6 flex flex-col items-center">
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
