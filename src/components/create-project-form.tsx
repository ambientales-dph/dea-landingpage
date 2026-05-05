'use client';

import { useActionState, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, updateProject, type ProjectState } from '@/app/actions/project-actions';
import { CUENCAS } from '@/lib/cuencas';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TrelloCard } from '@/services/trello';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Search, Plus, ChevronDown, Loader2, ArrowLeft, X, Crosshair } from 'lucide-react';
import { EQUIPO_DEA, EQUIPO_SIG, EQUIPO_DRON } from '@/lib/equipo';
import { MUNICIPIOS } from '@/lib/municipios';
import { PROYECTISTAS } from '@/lib/proyectistas';
import { FINANCIAMIENTO } from '@/lib/financiamiento';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { cn } from '@/lib/utils';
import { useProject } from '@/providers/project-provider';
import LocationPicker from './location-picker';

const initialState: ProjectState = { message: undefined, success: false };

const ESTADOS_PROYECTO = [
    "Sin iniciar",
    "Iniciado",
    "Neutralizado",
    "Terminado",
    "Con DIA",
    "Rescindido",
    "En seguimiento"
];

interface CreateProjectFormProps {
  setOpen: (open: boolean) => void;
  onEditCard?: (card: TrelloCard) => void;
  initialFormOpen?: boolean;
}

export default function CreateProjectForm({ setOpen, onEditCard, initialFormOpen }: CreateProjectFormProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { allCards, refreshCards } = useProject();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormView, setIsFormView] = useState(initialFormOpen || false);
  const [editingCard, setEditingCard] = useState<TrelloCard | null>(null);

  const [createState, createAction, isCreating] = useActionState(createProject, initialState);
  const [updateState, updateAction, isUpdating] = useActionState(updateProject, initialState);

  const isPending = isCreating || isUpdating;
  const currentStatus = editingCard ? updateState : createState;
  const lastProcessedActionRef = useRef<number>(0);

  // Estados del Formulario
  const [nombre, setNombre] = useState('');
  const [selectedCuenca, setSelectedCuenca] = useState('');
  const [estado, setEstado] = useState('Sin iniciar');
  const [selectedPartidos, setSelectedPartidos] = useState<string[]>([]);
  const [referencia, setReferencia] = useState('');
  const [extension, setExtension] = useState('');
  const [poblacion, setPoblacion] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [selectedFinanciamiento, setSelectedFinanciamiento] = useState<string[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);
  const [selectedDron, setSelectedDron] = useState<string[]>([]);
  const [seguimiento, setSeguimiento] = useState('');
  const [selectedProyectistas, setSelectedProyectistas] = useState<string[]>([]);
  const [expediente, setExpediente] = useState('');
  const [providencia, setProvidencia] = useState('');
  const [resolucion, setResolucion] = useState('');
  const [fechaDia, setFechaDia] = useState('');
  const [contratista, setContratista] = useState('');
  const [respAmbiental, setRespAmbiental] = useState('');
  const [otroDrive, setOtroDrive] = useState('');
  const [driveProyectista, setDriveProyectista] = useState('');
  const [coordinadas, setCoordinadas] = useState('');
  
  // Estado para el selector de ubicación
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  const logActivity = useCallback(async (actionType: string, detail: string, pName: string, cId: string) => {
    if (user && db) {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      const realName = authorizedUser?.name || user.displayName || 'Usuario';

      const activityData = {
        userId: user.uid,
        userName: realName,
        userEmail: user.email,
        userPhoto: user.photoURL || '',
        actionType: actionType,
        projectName: pName,
        detail: detail,
        cardId: cId,
        timestamp: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, 'app_activities'), activityData);
      } catch (error) {
        console.error("Error logging activity:", error);
      }
    }
  }, [user, db]);

  const extractFieldFromDesc = (desc: string, field: string): string => {
    if (!desc) return '';
    const lines = desc.split('\n');
    const fieldLower = field.toLowerCase().trim();
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith(fieldLower + ':')) {
            return trimmed.substring(fieldLower.length + 1).trim().replace(/^\*\*|\*\*$/g, '').trim();
        }
    }
    return '';
  };

  const handleEditClick = (card: TrelloCard) => {
    setEditingCard(card);
    setNombre(card.name.replace(/\s*\([^)]+\)$/, '').trim());
    const cuencaCodeMatch = card.name.match(/\(([A-Z]{2,4})\d{3}\)$/);
    const cuenca = cuencaCodeMatch ? CUENCAS.find(c => c.code === cuencaCodeMatch[1]) : null;
    setSelectedCuenca(cuenca?.id || '');

    const d = card.desc || '';
    setEstado(extractFieldFromDesc(d, '·ESTADO') || 'Sin iniciar');
    setSelectedPartidos(extractFieldFromDesc(d, '·PARTIDO').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setReferencia(extractFieldFromDesc(d, '·REFERENCIA GEOGRÁFICA'));
    setExtension(extractFieldFromDesc(d, '·EXTENSIÓN (Ha o Km)'));
    setPoblacion(extractFieldFromDesc(d, '·POBLACIÓN BENEFICIADA'));
    setPresupuesto(extractFieldFromDesc(d, '·PRESUPUESTO'));
    setSelectedFinanciamiento(extractFieldFromDesc(d, '·FINANCIAMIENTO').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setSelectedEquipo(extractFieldFromDesc(d, '·Diagnóstico ambiental-socioeconómico').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setSelectedSig(extractFieldFromDesc(d, '·Información SIG-imágenes').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setSelectedDron(extractFieldFromDesc(d, '·Información LIDAR/vuelos Dron').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setSeguimiento(extractFieldFromDesc(d, '·Seguimiento de obra'));
    setSelectedProyectistas(extractFieldFromDesc(d, '·Proyectista').split(/[,;]/).map(s => s.trim()).filter(Boolean));
    setExpediente(extractFieldFromDesc(d, '·EXPEDIENTE'));
    setProvidencia(extractFieldFromDesc(d, '·PROVIDENCIA'));
    setResolucion(extractFieldFromDesc(d, '·RESOLUCIÓN'));
    setFechaDia(extractFieldFromDesc(d, '·FECHA DIA'));
    setContratista(extractFieldFromDesc(d, '·CONTRATISRA'));
    setRespAmbiental(extractFieldFromDesc(d, '·RESPONSABLE AMBIENTAL'));
    setOtroDrive(extractFieldFromDesc(d, '·Otro Drive de trabajo'));
    setDriveProyectista(extractFieldFromDesc(d, '·Drive del proyectista'));
    setCoordinadas(extractFieldFromDesc(d, '·COORDINADAS'));

    setIsFormView(true);
  };

  const resetForm = () => {
    setEditingCard(null);
    setNombre(''); setSelectedCuenca(''); setEstado('Sin iniciar'); setSelectedPartidos([]);
    setReferencia(''); setExtension(''); setPoblacion(''); setPresupuesto(''); setSelectedFinanciamiento([]);
    setSelectedEquipo([]); setSelectedSig([]); setSelectedDron([]); setSeguimiento('');
    setSelectedProyectistas([]); setExpediente(''); setProvidencia(''); setResolucion('');
    setFechaDia(''); setContratista(''); setRespAmbiental(''); setOtroDrive(''); setDriveProyectista('');
    setCoordinadas('');
  };

  useEffect(() => {
    if (currentStatus.timestamp && currentStatus.timestamp > lastProcessedActionRef.current) {
      lastProcessedActionRef.current = currentStatus.timestamp;
      if (currentStatus.success) {
        toast({ title: '¡Éxito!', description: currentStatus.message });
        
        // Registro de actividad en Portal
        if (currentStatus.projectName && currentStatus.cardId) {
            if (editingCard) {
                if (currentStatus.isStatusChange) {
                    logActivity('status_change', `Cambió el estado a "${currentStatus.newStatus}"`, currentStatus.projectName, currentStatus.cardId);
                } else {
                    logActivity('update_project', `Actualizó la ficha técnica`, currentStatus.projectName, currentStatus.cardId);
                }
            } else {
                logActivity('create_project', `Creó el proyecto en el sistema`, currentStatus.projectName, currentStatus.cardId);
            }
        }

        setIsFormView(false);
        setOpen(false);
        resetForm();
        refreshCards();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: currentStatus.message });
      }
    }
  }, [currentStatus, toast, refreshCards, setOpen, editingCard, logActivity]);

  const handleLocationSelect = (lon: number, lat: number, zoom: number) => {
    const coordsStr = `[${lon.toFixed(6)}, ${lat.toFixed(6)}, ${zoom}]`;
    setCoordinadas(coordsStr);
    toast({ title: 'Ubicación seleccionada', description: `Se ha definido la vista del proyecto.` });
  };

  const initialLocation = useMemo(() => {
    if (coordinadas) {
      const match = coordinadas.match(/\[(.*?),(.*?),(.*?)\]/);
      if (match) {
        return {
          lon: parseFloat(match[1]),
          lat: parseFloat(match[2]),
          zoom: parseFloat(match[3]),
        };
      }
    }
    return undefined;
  }, [coordinadas]);

  if (isFormView) {
    return (
      <div className="flex flex-col h-full bg-zinc-100 overflow-hidden text-black">
        <DialogHeader className="p-4 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {!initialFormOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFormView(false)}><ArrowLeft className="h-4 w-4" /></Button>
            )}
            <DialogTitle className="text-sm font-bold">{editingCard ? 'Editar Proyecto' : 'Crear Proyecto'}</DialogTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
        </DialogHeader>

        <form action={editingCard ? updateAction : createAction} className="flex flex-col flex-grow min-h-0 overflow-hidden">
          <input type="hidden" name="userEmail" value={user?.email || ''} />
          <input type="hidden" name="cardId" value={editingCard?.id || ''} />
          <input type="hidden" name="partido" value={selectedPartidos.join(', ')} />
          <input type="hidden" name="financiamiento" value={selectedFinanciamiento.join(', ')} />
          <input type="hidden" name="diagnostico" value={selectedEquipo.join('; ')} />
          <input type="hidden" name="sig" value={selectedSig.join('; ')} />
          <input type="hidden" name="dron" value={selectedDron.join('; ')} />
          <input type="hidden" name="proyectista" value={selectedProyectistas.join('; ')} />
          <input type="hidden" name="coordinadas" value={coordinadas} />
          
          <ScrollArea className="flex-grow px-6">
            <div className="space-y-6 py-6 max-w-3xl mx-auto">
              {/* Sección 1: Identificación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Nombre del Proyecto *</Label>
                  <Input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Cuenca *</Label>
                  <Select name="cuenca" value={selectedCuenca} onValueChange={setSelectedCuenca} required>
                    <SelectTrigger className="h-9 text-xs bg-white text-black"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                    <SelectContent>{CUENCAS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Estado Actual</Label>
                  <Select name="estado" value={estado} onValueChange={setEstado}>
                    <SelectTrigger className="h-9 text-xs bg-white text-black"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                    <SelectContent>{ESTADOS_PROYECTO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Sección 2: Datos Físicos y Localización */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Partido(s)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-9 text-xs justify-between font-normal bg-white text-black">{selectedPartidos.length > 0 ? `${selectedPartidos.length} sel.` : 'Seleccioná'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">{MUNICIPIOS.map(m => <DropdownMenuCheckboxItem key={m} checked={selectedPartidos.includes(m)} onCheckedChange={c => setSelectedPartidos(curr => c ? [...curr, m] : curr.filter(x => x !== m))} onSelect={e => e.preventDefault()}>{m}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Referencia Geográfica</Label>
                  <div className="flex gap-2">
                    <Input name="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="h-9 text-xs bg-white text-black" />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className={cn("h-9 w-9 shrink-0", coordinadas && "bg-primary/10 border-primary text-primary")}
                      onClick={() => setIsLocationPickerOpen(true)}
                      title="Seleccionar ubicación en el mapa"
                    >
                      <Crosshair className="h-4 w-4" />
                    </Button>
                  </div>
                  {coordinadas && <p className="text-[9px] text-primary font-bold italic">Vista guardada: {coordinadas}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Extensión</Label>
                  <Input name="extension" value={extension} onChange={(e) => setExtension(e.target.value)} className="h-9 text-xs bg-white text-black" placeholder="Ha o Km" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Población Beneficiada</Label>
                  <Input name="poblacion" value={poblacion} onChange={(e) => setPoblacion(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Presupuesto</Label>
                  <Input name="presupuesto" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Financiamiento</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-9 text-xs justify-between font-normal bg-white text-black">{selectedFinanciamiento.length > 0 ? `${selectedFinanciamiento.length} sel.` : 'Seleccioná'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">{FINANCIAMIENTO.map(f => <DropdownMenuCheckboxItem key={f} checked={selectedFinanciamiento.includes(f)} onCheckedChange={c => setSelectedFinanciamiento(curr => c ? [...curr, f] : curr.filter(x => x !== f))} onSelect={e => e.preventDefault()}>{f}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <Separator />

              {/* Sección 3: Equipo Técnico */}
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Responsables del Equipo Técnico</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Diagnóstico (DEA)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{selectedEquipo.length > 0 ? `${selectedEquipo.length} sel.` : 'DEA'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">{EQUIPO_DEA.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedEquipo.includes(p)} onCheckedChange={c => setSelectedEquipo(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Información SIG</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{selectedSig.length > 0 ? `${selectedSig.length} sel.` : 'SIG'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">{EQUIPO_SIG.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedSig.includes(p)} onCheckedChange={c => setSelectedSig(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Información Dron</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{selectedDron.length > 0 ? `${selectedDron.length} sel.` : 'Dron'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">{EQUIPO_DRON.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedDron.includes(p)} onCheckedChange={c => setSelectedDron(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Seguimiento de Obra</Label>
                    <Input name="seguimiento" value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} className="h-8 text-xs bg-white text-black" />
                  </div>
                   <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-bold">Proyectista/s</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white text-black">{selectedProyectistas.length > 0 ? `${selectedProyectistas.length} sel.` : 'Proyectista'}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">{PROYECTISTAS.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedProyectistas.includes(p)} onCheckedChange={c => setSelectedProyectistas(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sección 4: Gestión Administrativa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Expediente</Label>
                  <Input name="expediente" value={expediente} onChange={(e) => setExpediente(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Providencia</Label>
                  <Input name="providencia" value={providencia} onChange={(e) => setProvidencia(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Resolución</Label>
                  <Input name="resolucion" value={resolucion} onChange={(e) => setResolucion(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fecha DIA</Label>
                  <Input name="fechaDia" value={fechaDia} onChange={(e) => setFechaDia(e.target.value)} className="h-9 text-xs bg-white text-black" placeholder="DD/MM/AAAA" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Contratista</Label>
                  <Input name="contratista" value={contratista} onChange={(e) => setContratista(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Resp. Ambiental</Label>
                  <Input name="respAmbiental" value={respAmbiental} onChange={(e) => setRespAmbiental(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Otro Drive de Trabajo</Label>
                  <Input name="otroDrive" value={otroDrive} onChange={(e) => setOtroDrive(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Drive del Proyectista</Label>
                  <Input name="driveProyectista" value={driveProyectista} onChange={(e) => setDriveProyectista(e.target.value)} className="h-9 text-xs bg-white text-black" />
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 border-t bg-zinc-200 shrink-0 flex flex-row justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { if(initialFormOpen) setOpen(false); else { resetForm(); setIsFormView(false); } }} disabled={isPending} className="h-10 text-sm border-zinc-400">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="min-w-[160px] h-10 text-sm shadow-md">
              {isPending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
              {editingCard ? 'Guardar Cambios' : 'Crear Proyecto'}
            </Button>
          </DialogFooter>
        </form>

        <LocationPicker 
          isOpen={isLocationPickerOpen}
          onOpenChange={setIsLocationPickerOpen}
          onSelect={handleLocationSelect}
          initialLon={initialLocation?.lon}
          initialLat={initialLocation?.lat}
          initialZoom={initialLocation?.zoom}
        />
      </div>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col border-0 shadow-none overflow-hidden bg-white text-black">
      <CardHeader className="p-4 border-b bg-muted/10">
        <div className="flex justify-between items-center">
            <div><CardTitle className="text-base font-bold">Gestión de Proyectos</CardTitle></div>
            <div className="flex gap-2">
                <Button size="icon" variant="outline" onClick={() => { resetForm(); setIsFormView(true); }} className="h-9 w-9"><Plus className="h-5 w-5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} className="h-9 w-9 rounded-full"><X className="h-5 w-5" /></Button>
            </div>
        </div>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o código..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-white text-black" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <Table className="text-xs">
            <TableBody>
              {allCards.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project, idx) => (
                <TableRow key={project.id} className={cn("cursor-pointer hover:bg-muted/40 transition-colors border-b last:border-0", idx % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/10')} onClick={() => { onEditCard?.(project); setOpen(false); }}>
                  <TableCell className="font-mono py-2.5 w-[110px] font-bold text-primary">{project.name.match(/\(([^)]+)\)$/)?.[1] || 'S/C'}</TableCell>
                  <TableCell className="py-2.5 font-medium">{project.name.replace(/\s*\([^)]+\)$/, '').trim()}</TableCell>
                  <TableCell className="text-right py-2.5 w-[60px] pr-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEditClick(project); }}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
