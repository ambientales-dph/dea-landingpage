'use client';

import { useActionState, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { Pencil, Search, Plus, ChevronDown, Loader2, ArrowLeft, X } from 'lucide-react';
import { EQUIPO_DEA, EQUIPO_SIG, EQUIPO_DRON } from '@/lib/equipo';
import { MUNICIPIOS } from '@/lib/municipios';
import { PROYECTISTAS } from '@/lib/proyectistas';
import { FINANCIAMIENTO } from '@/lib/financiamiento';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { useProject } from '@/providers/project-provider';

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
  const { allCards, isLoadingCards: isLoading, refreshCards } = useProject();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormView, setIsFormView] = useState(initialFormOpen || false);
  const [editingCard, setEditingCard] = useState<TrelloCard | null>(null);

  const [createState, createAction, isCreating] = useActionState(createProject, initialState);
  const [updateState, updateAction, isUpdating] = useActionState(updateProject, initialState);

  const isPending = isCreating || isUpdating;
  const currentStatus = editingCard ? updateState : createState;
  
  const lastProcessedActionRef = useRef<number>(0);

  const [nombre, setNombre] = useState('');
  const [selectedCuenca, setSelectedCuenca] = useState('');
  const [estado, setEstado] = useState('Sin iniciar');
  const [selectedPartidos, setSelectedPartidos] = useState<string[]>([]);
  const [selectedProyectistas, setSelectedProyectistas] = useState<string[]>([]);
  const [selectedFinanciamiento, setSelectedFinanciamiento] = useState<string[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);
  const [selectedDron, setSelectedDron] = useState<string[]>([]);

  useEffect(() => {
    if (initialFormOpen) {
      resetForm();
      setIsFormView(true);
    }
  }, [initialFormOpen]);

  const extractFieldFromDesc = (desc: string, field: string): string => {
    if (!desc) return '';
    const lines = desc.split('\n');
    const fieldLower = field.toLowerCase().trim();
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().startsWith(fieldLower + ':')) {
            let val = trimmedLine.substring(fieldLower.length + 1).trim();
            val = val.replace(/^\*\*|\*\*$/g, '').trim();
            if (val === '****' || val === '') return '';
            return val;
        }
    }
    return '';
  };

  const extractListFromDesc = (desc: string, field: string): string[] => {
    const val = extractFieldFromDesc(desc, field);
    if (!val) return [];
    return val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  };

  const handleEditClick = (card: TrelloCard) => {
    setEditingCard(card);
    setNombre(card.name.replace(/\([^)]+\)$/, '').trim());
    const cuencaCodeMatch = card.name.match(/\(([A-Z]{2,4})\d{3}\)$/);
    const cuencaCode = cuencaCodeMatch ? cuencaCodeMatch[1] : null;
    const cuenca = CUENCAS.find(c => c.code === cuencaCode);
    setSelectedCuenca(cuenca?.id || '');

    setEstado(extractFieldFromDesc(card.desc, 'ESTADO') || 'Sin iniciar');
    setSelectedPartidos(extractListFromDesc(card.desc, 'PARTIDO'));
    setSelectedProyectistas(extractListFromDesc(card.desc, '- Proyectista'));
    setSelectedFinanciamiento(extractListFromDesc(card.desc, 'FINANCIAMIENTO'));
    setSelectedEquipo(extractListFromDesc(card.desc, '- Diagnóstico ambiental-socioeconómico'));
    setSelectedSig(extractListFromDesc(card.desc, '- Información SIG-imágenes'));
    setSelectedDron(extractListFromDesc(card.desc, '- Información LIDAR/vuelos Dron'));
    
    setIsFormView(true);
  };

  const resetForm = () => {
    setEditingCard(null);
    setNombre('');
    setSelectedCuenca('');
    setEstado('Sin iniciar');
    setSelectedPartidos([]);
    setSelectedProyectistas([]);
    setSelectedFinanciamiento([]);
    setSelectedEquipo([]);
    setSelectedSig([]);
    setSelectedDron([]);
  };

  useEffect(() => {
    if (currentStatus.timestamp && currentStatus.timestamp > lastProcessedActionRef.current) {
      lastProcessedActionRef.current = currentStatus.timestamp;
      
      if (currentStatus.success) {
        toast({ title: '¡Éxito!', description: currentStatus.message });
        
        if (user && db) {
          const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
          const realName = authorizedUser?.name || user.displayName || 'Usuario';

          let actionType = editingCard ? 'update_project' : 'create_project';
          if (currentStatus.isStatusChange) {
              actionType = 'status_change';
          }

          const activityData: any = {
            userId: user.uid,
            userName: realName,
            userEmail: user.email,
            userPhoto: user.photoURL || '',
            actionType: actionType,
            projectName: currentStatus.projectName || 'Proyecto',
            cardId: currentStatus.cardId,
            timestamp: serverTimestamp(),
          };

          if (currentStatus.isStatusChange && currentStatus.newStatus) {
              activityData.detail = `Cambió estado a "${currentStatus.newStatus}"`;
          }

          addDoc(collection(db, 'app_activities'), activityData)
            .catch(async (error) => {
              const permissionError = new FirestorePermissionError({
                path: 'app_activities',
                operation: 'create',
                requestResourceData: activityData,
              });
              errorEmitter.emit('permission-error', permissionError);
            });
        }

        setIsFormView(false);
        setOpen(false);
        resetForm();
        refreshCards();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: currentStatus.message });
      }
    }
  }, [currentStatus, toast, refreshCards, user, db, editingCard, setOpen]);

  const sortedCards = useMemo(() => {
    return [...allCards].sort((a, b) => {
      const codeA = a.name.match(/\(([^)]+)\)$/)?.[1] || "";
      const codeB = b.name.match(/\(([^)]+)\)$/)?.[1] || "";
      return codeA.localeCompare(codeB);
    });
  }, [allCards]);

  // VISTA DE FORMULARIO (CREAR O EDITAR)
  if (isFormView) {
    return (
      <div className="flex flex-col h-full bg-zinc-100 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {!initialFormOpen && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => { resetForm(); setIsFormView(false); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-sm font-bold font-headline">
              {editingCard ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'}
            </DialogTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full" 
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <form action={editingCard ? updateAction : createAction} className="flex flex-col flex-grow min-h-0 overflow-hidden">
          <input type="hidden" name="userEmail" value={user?.email || ''} />
          <input type="hidden" name="cardId" value={editingCard?.id || ''} />
          <input type="hidden" name="partido" value={selectedPartidos.join(', ')} />
          <input type="hidden" name="proyectista" value={selectedProyectistas.join(', ')} />
          <input type="hidden" name="financiamiento" value={selectedFinanciamiento.join(', ')} />
          <input type="hidden" name="diagnosticoEquipo" value={selectedEquipo.join('; ')} />
          <input type="hidden" name="informacionSig" value={selectedSig.join('; ')} />
          <input type="hidden" name="informacionDron" value={selectedDron.join('; ')} />
          
          <ScrollArea className="flex-grow px-6">
            <div className="space-y-4 py-6 max-w-2xl mx-auto">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Nombre del Proyecto *</Label>
                <Input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="h-10 text-sm bg-white border-zinc-300" placeholder="Ej: Obra Hidráulica en Arroyo Pergamino" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Cuenca *</Label>
                    <Select name="cuenca" value={selectedCuenca} onValueChange={setSelectedCuenca} required>
                      <SelectTrigger className="h-10 text-sm bg-white border-zinc-300"><SelectValue placeholder="Seleccioná cuenca" /></SelectTrigger>
                      <SelectContent className="max-h-64">{CUENCAS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Estado Actual</Label>
                    <Select name="estado" value={estado} onValueChange={setEstado}>
                      <SelectTrigger className="h-10 text-sm bg-white border-zinc-300"><SelectValue placeholder="Seleccioná estado" /></SelectTrigger>
                      <SelectContent>{ESTADOS_PROYECTO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
              </div>
              {editingCard && <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded border border-amber-200">Aviso: Si cambiás la cuenca, se generará un nuevo código. El cambio de estado registrará un hito automático.</p>}
              
              <Separator className="my-2" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Partido(s)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-10 text-sm justify-between font-normal bg-white border-zinc-300">{selectedPartidos.length > 0 ? `${selectedPartidos.length} seleccionados` : 'Seleccioná partidos'} <ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                      {MUNICIPIOS.map(m => <DropdownMenuCheckboxItem key={m} checked={selectedPartidos.includes(m)} onCheckedChange={c => setSelectedPartidos(curr => c ? [...curr, m] : curr.filter(x => x !== m))} onSelect={e => e.preventDefault()}>{m}</DropdownMenuCheckboxItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Proyectista/s</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full h-10 text-sm justify-between font-normal bg-white border-zinc-300">
                        {selectedProyectistas.length > 0 ? `${selectedProyectistas.length} seleccionados` : 'Seleccioná profesionales'} 
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                      {PROYECTISTAS.map(p => (
                        <DropdownMenuCheckboxItem 
                          key={p} 
                          checked={selectedProyectistas.includes(p)} 
                          onCheckedChange={c => setSelectedProyectistas(curr => c ? [...curr, p] : curr.filter(x => x !== p))} 
                          onSelect={e => e.preventDefault()}
                        >
                          {p}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Financiamiento</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-10 text-sm justify-between font-normal bg-white border-zinc-300">{selectedFinanciamiento.length > 0 ? `${selectedFinanciamiento.length} seleccionados` : 'Seleccioná fuente'} <ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                    {FINANCIAMIENTO.map(f => <DropdownMenuCheckboxItem key={f} checked={selectedFinanciamiento.includes(f)} onCheckedChange={c => setSelectedFinanciamiento(curr => c ? [...curr, f] : curr.filter(x => x !== f))} onSelect={e => e.preventDefault()}>{f}</DropdownMenuCheckboxItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator className="my-2" />
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Responsables del Equipo Técnico</p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Diagnóstico Ambiental-Socioeconómico (DEA)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-9 text-sm justify-between font-normal bg-white border-zinc-300">{selectedEquipo.length > 0 ? `${selectedEquipo.length} seleccionados` : 'Responsables DEA'} <ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                      {EQUIPO_DEA.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedEquipo.includes(p)} onCheckedChange={c => setSelectedEquipo(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Equipo SIG</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-9 text-sm justify-between font-normal bg-white border-zinc-300">{selectedSig.length > 0 ? `${selectedSig.length} seleccionados` : 'Personal SIG'} <ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                        {EQUIPO_SIG.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedSig.includes(p)} onCheckedChange={c => setSelectedSig(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Equipo Dron</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-9 text-sm justify-between font-normal bg-white border-zinc-300">{selectedDron.length > 0 ? `${selectedDron.length} seleccionados` : 'Personal Dron'} <ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
                        {EQUIPO_DRON.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedDron.includes(p)} onCheckedChange={c => setSelectedDron(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 border-t bg-zinc-200 shrink-0 flex flex-row justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { if(initialFormOpen) { setOpen(false); } else { resetForm(); setIsFormView(false); } }} disabled={isPending} className="h-10 text-sm border-zinc-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[160px] h-10 text-sm shadow-md">
              {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              {editingCard ? 'Guardar Cambios' : 'Crear Proyecto'}
            </Button>
          </DialogFooter>
        </form>
      </div>
    );
  }

  // VISTA DE LISTA (GESTIÓN)
  return (
    <Card className="w-full h-full flex flex-col border-0 shadow-none overflow-hidden bg-white">
      <CardHeader className="p-4 border-b bg-muted/10">
        <div className="flex justify-between items-center">
            <div>
                <CardTitle className="text-base font-bold font-headline">Gestión de Proyectos</CardTitle>
                <CardDescription className="text-xs">Consultá la lista consolidada o editá proyectos existentes.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button size="icon" variant="outline" onClick={() => { resetForm(); setIsFormView(true); }} className="h-9 w-9 border-zinc-300"><Plus className="h-5 w-5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} className="h-9 w-9 rounded-full"><X className="h-5 w-5" /></Button>
            </div>
        </div>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-white border-zinc-300"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading && sortedCards.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
              <p className="text-xs text-muted-foreground italic">Sincronizando con Trello...</p>
            </div>
          ) : (
            <Table className="text-xs">
              <TableBody>
                {sortedCards.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project, idx) => (
                  <TableRow 
                    key={project.id} 
                    className={cn(
                      "cursor-pointer hover:bg-muted/40 transition-colors border-b last:border-0",
                      idx % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/10'
                    )}
                    onClick={() => {
                      onEditCard?.(project);
                      setOpen(false);
                    }}
                  >
                    <TableCell className="font-mono py-2.5 w-[110px] border-r border-muted/20 font-bold text-primary">
                        {project.name.match(/\(([^)]+)\)$/)?.[1] || 'S/C'}
                    </TableCell>
                    <TableCell className="py-2.5 font-medium">
                        {project.name.replace(/\([^)]+\)$/, '').trim()}
                    </TableCell>
                    <TableCell className="text-right py-2.5 w-[60px] pr-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(project);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedCards.length > 0 && sortedCards.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                   <TableRow>
                     <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">No se encontraron resultados.</TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
