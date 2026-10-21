'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  UploadCloud,
  Folder,
  FileText,
  AlertTriangle,
  Plus,
  Loader2,
  CheckCircle2,
  X,
  Palette,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { CATEGORIES } from '@/timeline/lib/data';
import type { Category } from '@/timeline/types';
import { addCommentToCard, type TrelloCard } from '@/services/trello';
import { uploadWorkingFileWithStructure, getServerCurrentTime } from '@/services/google-drive';

export interface PreparedUploadFile {
  file: File;
  relativePath: string;
}

interface UploadWorkingFilesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCard: TrelloCard;
  currentFolder: { id: string; name: string };
  files: PreparedUploadFile[];
  onUploadSuccess: () => void;
}

const PRESET_COLORS = [
  '#3B5998', // Azul institucional
  '#008080', // Verde azulado
  '#8A2BE2', // Violeta
  '#FF4500', // Naranja rojizo
  '#708090', // Gris pizarra
  '#FFA500', // Naranja
  '#10B981', // Esmeralda
  '#EC4899', // Rosa
  '#6366F1', // Indigo
  '#0EA5E9', // Celeste
  '#F59E0B', // Ámbar
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(fileName: string): 'document' | 'image' | 'video' | 'audio' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'dwg', 'dxf', 'kmz', 'kml'].includes(ext)) {
    return 'document';
  }
  return 'other';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default function UploadWorkingFilesDialog({
  isOpen,
  onOpenChange,
  selectedCard,
  currentFolder,
  files,
  onUploadSuccess,
}: UploadWorkingFilesDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const [categories, setCategories] = React.useState<Category[]>(CATEGORIES);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('cat-1');
  const [milestoneTitle, setMilestoneTitle] = React.useState<string>('');
  const [occurredDate, setOccurredDate] = React.useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [occurredTime, setOccurredTime] = React.useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
  const [useServerTime, setUseServerTime] = React.useState(true);
  const [description, setDescription] = React.useState<string>('');

  // Creación de nueva categoría
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState('');
  const [newCatColor, setNewCatColor] = React.useState(PRESET_COLORS[0]);
  const [isSavingCategory, setIsSavingCategory] = React.useState(false);

  // Estado de subida
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [statusMessage, setStatusMessage] = React.useState('');

  // Suscripción a categorías en Firestore
  React.useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'timeline_categories'),
      (snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
        if (loaded.length > 0) {
          setCategories(loaded);
          // Si la categoría seleccionada no existe en las cargadas, seleccionar la primera
          setSelectedCategoryId((prev) => (loaded.some((c) => c.id === prev) ? prev : loaded[0].id));
        }
      },
      (err) => {
        console.warn('Error al cargar categorías de Firestore:', err.message);
      }
    );
    return () => unsub();
  }, [db]);

  // Inicializar título según los archivos
  React.useEffect(() => {
    if (!isOpen || files.length === 0) return;

    // Detectar si todos pertenecen a una carpeta raíz común
    const firstRel = files[0].relativePath;
    const isInsideFolder = firstRel.includes('/');
    if (isInsideFolder) {
      const rootFolder = firstRel.split('/')[0];
      setMilestoneTitle(`Carga: ${rootFolder}`);
    } else if (files.length === 1) {
      const nameWithoutExt = files[0].file.name.replace(/\.[^/.]+$/, '');
      setMilestoneTitle(`Carga: ${nameWithoutExt}`);
    } else {
      setMilestoneTitle(`Carga de archivos de trabajo (${files.length} archivos)`);
    }

    setDescription('');
    getServerCurrentTime().then((st) => {
      setOccurredDate(st.dateFormatted);
      setOccurredTime(st.timeFormatted);
      setUseServerTime(true);
    }).catch(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setOccurredDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setOccurredTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    });
    setIsCreatingCategory(false);
    setIsUploading(false);
    setUploadProgress(0);
    setStatusMessage('');
  }, [isOpen, files]);

  const totalBytes = React.useMemo(() => {
    return files.reduce((acc, f) => acc + f.file.size, 0);
  }, [files]);

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim()) {
      toast({ variant: 'destructive', title: 'Ingrese un nombre para la categoría' });
      return;
    }
    if (!db) return;

    setIsSavingCategory(true);
    try {
      const docRef = await addDoc(collection(db, 'timeline_categories'), {
        name: newCatName.trim(),
        color: newCatColor,
      });
      setSelectedCategoryId(docRef.id);
      setNewCatName('');
      setIsCreatingCategory(false);
      toast({ title: 'Nueva categoría creada exitosamente' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al crear categoría', description: e.message });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!milestoneTitle.trim()) {
      toast({ variant: 'destructive', title: 'El título del hito es obligatorio' });
      return;
    }
    if (!db) {
      toast({ variant: 'destructive', title: 'Error de conexión con la base de datos' });
      return;
    }

    const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];

    setIsUploading(true);
    setUploadProgress(5);
    setStatusMessage(`Preparando ${files.length} archivo(s)...`);

    const uploadedFiles: Array<{
      id: string;
      name: string;
      webViewLink: string;
      webContentLink?: string;
      size: number;
      mimeType: string;
      relativePath: string;
    }> = [];

    try {
      // 1. Subida individual a Google Drive manteniendo jerarquía
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setStatusMessage(`Subiendo archivo ${i + 1} de ${files.length}: ${item.relativePath || item.file.name}...`);

        const base64Data = await fileToBase64(item.file);
        const result = await uploadWorkingFileWithStructure({
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          base64Data,
          targetFolderId: currentFolder.id,
          relativePath: item.relativePath,
        });

        uploadedFiles.push({
          id: result.id,
          name: result.name,
          webViewLink: result.webViewLink,
          webContentLink: result.webContentLink,
          size: item.file.size,
          mimeType: item.file.type || result.mimeType || 'application/octet-stream',
          relativePath: item.relativePath || item.file.name,
        });

        const progressPercent = 5 + Math.round(((i + 1) / files.length) * 75);
        setUploadProgress(progressPercent);
      }

      // 2. Creación del Hito en Firestore con fecha y hora REAL del servidor
      setStatusMessage('Registrando hito en Línea de Tiempo...');
      setUploadProgress(85);

      const serverTime = await getServerCurrentTime();
      let targetOccurred: Date;
      if (useServerTime) {
        targetOccurred = new Date(serverTime.iso);
      } else {
        targetOccurred = new Date(`${occurredDate}T${occurredTime || serverTime.timeFormatted}`);
      }

      const associatedFiles = uploadedFiles.map((f) => ({
        id: f.id,
        name: f.relativePath || f.name,
        size: formatBytes(f.size),
        type: getFileType(f.name),
        url: f.webViewLink,
        downloadUrl: f.webContentLink || f.webViewLink,
        driveId: f.id,
        isTimelineFile: false,
      }));

      const milestoneData = {
        name: milestoneTitle.trim(),
        description:
          description.trim() ||
          `Carga de ${uploadedFiles.length} archivo(s) de trabajo en la carpeta "${currentFolder.name}".`,
        occurredAt: targetOccurred.toISOString(),
        category: {
          id: selectedCategory.id,
          name: selectedCategory.name,
          color: selectedCategory.color,
        },
        tags: ['trabajo'],
        associatedFiles: associatedFiles,
        isImportant: false,
        history: [
          `${format(targetOccurred, 'PPpp', { locale: es })} - Hito de trabajo generado por subida de ${uploadedFiles.length} archivo(s) en carpeta "${currentFolder.name}".`,
        ],
        driveFolderId: currentFolder.id,
        isDeleted: false,
      };

      await addDoc(
        collection(db, 'timeline_projects', selectedCard.id, 'milestones'),
        milestoneData
      );

      // 3. Comentario automático en Trello
      setStatusMessage('Registrando comentario en Trello...');
      setUploadProgress(92);

      const commentText = `📌 HITO DE PROYECTO: Carga de archivos de trabajo (${uploadedFiles.length} archivo(s)) en carpeta "${currentFolder.name}". Categoría: "${selectedCategory.name}". Hito: "${milestoneTitle.trim()}". Fecha: ${format(targetOccurred, 'dd/MM/yyyy HH:mm:ss')}.`;
      try {
        await addCommentToCard({ cardId: selectedCard.id, text: commentText });
      } catch (trelloErr: any) {
        console.warn('No se pudo registrar comentario en Trello:', trelloErr.message);
      }

      // 4. Actividad en Firestore para la Campanita de Notificaciones
      setStatusMessage('Generando notificación...');
      setUploadProgress(98);

      try {
        await addDoc(collection(db, 'app_activities'), {
          actionType: 'timeline_milestone_created',
          projectName: selectedCard.name,
          cardId: selectedCard.id,
          userName: user?.displayName || user?.email?.split('@')[0] || 'Usuario',
          userEmail: user?.email || '',
          userPhoto: user?.photoURL || null,
          timestamp: serverTimestamp(),
          details: `Carga de ${uploadedFiles.length} archivo(s) de trabajo ("${milestoneTitle.trim()}").`,
        });
      } catch (actErr: any) {
        console.warn('No se pudo registrar en app_activities:', actErr.message);
      }

      setUploadProgress(100);
      setStatusMessage('¡Completado con éxito!');

      toast({
        title: 'Archivos subidos exitosamente',
        description: `Se subieron ${uploadedFiles.length} archivo(s) y se registró el hito en la Línea de Tiempo.`,
      });

      onUploadSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error durante la subida y registro:', err);
      toast({
        variant: 'destructive',
        title: 'Error durante la subida',
        description: err.message || 'Ocurrió un error inesperado al subir los archivos.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isUploading && onOpenChange(open)}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <UploadCloud className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">Subir Archivos de Trabajo</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Los elementos se subirán a la carpeta <strong className="text-foreground">{currentFolder.name}</strong> en Google Drive y generarán un hito en la Línea de Tiempo.
          </DialogDescription>
        </DialogHeader>

        {/* Alerta recordatoria institucional */}
        <div className="flex items-start gap-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 leading-tight">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <strong>Solo archivos de trabajo:</strong> Esta sección es exclusiva para archivos de trabajo del proyecto. Para incorporar <strong>documentación final entregable</strong> a un hito, acceda al módulo <strong>Línea de Tiempo</strong>.
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="space-y-4 pt-1">
            {/* Lista resumen de archivos */}
            <div className="border rounded-md p-3 bg-zinc-50/70 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-700">
                  {files.length} elemento(s) seleccionado(s)
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  Total: {formatBytes(totalBytes)}
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                {files.map((f, idx) => {
                  const hasFolder = f.relativePath.includes('/');
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-[11px] py-0.5 px-1.5 rounded bg-white border border-zinc-200/80 truncate"
                    >
                      {hasFolder ? (
                        <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      )}
                      <span className="truncate font-mono">{f.relativePath}</span>
                      <span className="ml-auto text-[10px] text-zinc-400 shrink-0">
                        {formatBytes(f.file.size)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Categoría del hito */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Categoría del Hito *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-primary hover:bg-primary/5"
                  onClick={() => setIsCreatingCategory((prev) => !prev)}
                  disabled={isUploading}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {isCreatingCategory ? 'Cancelar nueva categoría' : 'Nueva categoría'}
                </Button>
              </div>

              {isCreatingCategory ? (
                <div className="p-3 border border-dashed rounded-md bg-zinc-50 space-y-3">
                  <div className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-primary" />
                    Crear nueva categoría en Firestore
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre de la categoría (ej. Geotecnia)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleCreateNewCategory}
                      disabled={isSavingCategory || !newCatName.trim()}
                    >
                      {isSavingCategory ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Guardar'
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Color:</span>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className="h-5 w-5 rounded-full transition-transform hover:scale-110 flex items-center justify-center border"
                        style={{ backgroundColor: c }}
                      >
                        {newCatColor === c && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                  disabled={isUploading}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccione una categoría" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#3B5998' }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Título del Hito */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre o Título del Hito *</Label>
              <Input
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="Ej: Carga de Estudios Hidrológicos"
                className="h-9 text-xs"
                disabled={isUploading}
              />
            </div>

            {/* Fecha y Hora del Hito */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Fecha y Hora del Hito</Label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const st = await getServerCurrentTime();
                      setOccurredDate(st.dateFormatted);
                      setOccurredTime(st.timeFormatted);
                      setUseServerTime(true);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  ⚡ Usar hora actual del servidor
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={occurredDate}
                  onChange={(e) => {
                    setOccurredDate(e.target.value);
                    setUseServerTime(false);
                  }}
                  className="h-8 text-xs"
                  disabled={isUploading}
                />
                <Input
                  type="time"
                  step="1"
                  value={occurredTime}
                  onChange={(e) => {
                    setOccurredTime(e.target.value);
                    setUseServerTime(false);
                  }}
                  className="h-8 text-xs font-mono"
                  disabled={isUploading}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {useServerTime
                  ? '⚡ Sincronizado: se registrará la fecha y hora exacta del servidor al completar la carga.'
                  : 'Fecha y hora personalizada.'}
              </p>
            </div>

            {/* Descripción u observaciones */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Descripción u Observaciones (Opcional)
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle breve sobre el material cargado..."
                className="text-xs h-18 resize-none"
                disabled={isUploading}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Barra de progreso durante la subida */}
        {isUploading && (
          <div className="space-y-2 pt-2 border-t mt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-primary font-medium flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusMessage}
              </span>
              <span className="font-mono text-[11px] font-semibold">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            className="text-xs h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmUpload}
            disabled={isUploading || !milestoneTitle.trim() || files.length === 0}
            className="text-xs h-9 gap-1.5"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" /> Confirmar y Subir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
