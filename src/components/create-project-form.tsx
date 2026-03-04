'use client';

import { useActionState, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, updateProject, type ProjectState } from '@/app/actions/project-actions';
import { CUENCAS, DESCRIPCION_PLANTILLA } from '@/lib/cuencas';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Search, Plus, ChevronDown, Loader2, ArrowLeft } from 'lucide-react';
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
}

export default function CreateProjectForm({ setOpen, onEditCard }: CreateProjectFormProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<TrelloCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<TrelloCard | null>(null);

  const [createState, createAction, isCreating] = useActionState(createProject, initialState);
  const [updateState, updateAction, isUpdating] = useActionState(updateProject, initialState);

  const isPending = isCreating || isUpdating;
  const currentStatus = editingCard ? updateState : createState;

  const [nombre, setNombre] = useState('');
  const [selectedCuenca, setSelectedCuenca] = useState('');
  const [estado, setEstado] = useState('Sin iniciar');
  const [selectedPartidos, setSelectedPartidos] = useState<string[]>([]);
  const [selectedProyectistas, setSelectedProyectistas] = useState<string[]>([]);
  const [selectedFinanciamiento, setSelectedFinanciamiento] = useState<string[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);
  const [selectedDron, setSelectedDron] = useState<string[]>([]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCards = await getAllCardsFromAllBoards();
      const projectCards = allCards
        .filter(card => card.name.match(/\(([A-Z]{3}\d{3})\)$/))
        .sort((a, b) => {
          const codeA = a.name.match(/\(([^)]+)\)$/)?.[1] || "";
          const codeB = b.name.match(/\(([^)]+)\)$/)?.[1] || "";
          return codeA.localeCompare(codeB);
        });
      setProjects(projectCards);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const extractFieldFromDesc = (desc: string, field: string): string => {
    if (!desc) return '';
    const lines = desc.split('\n');
    const fieldLower = field.toLowerCase().trim();
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().startsWith(fieldLower + ':')) {
            let val = trimmedLine.substring(fieldLower.length + 1).trim();
            // Limpiar asteriscos de negrita si existen
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
    
    const cuencaCode = card.name.match(/\(([A-Z]{3})\d{3}\)$/)?.[1];
    const cuenca = CUENCAS.find(c => c.code === cuencaCode);
    setSelectedCuenca(cuenca?.id || '');

    setEstado(extractFieldFromDesc(card.desc, 'ESTADO') || 'Sin iniciar');
    setSelectedPartidos(extractListFromDesc(card.desc, 'PARTIDO'));
    setSelectedProyectistas(extractListFromDesc(card.desc, '- Proyectista'));
    setSelectedFinanciamiento(extractListFromDesc(card.desc, 'FINANCIAMIENTO'));
    setSelectedEquipo(extractListFromDesc(card.desc, '- Diagnóstico ambiental-socioeconómico'));
    setSelectedSig(extractListFromDesc(card.desc, '- Información SIG-imágenes'));
    setSelectedDron(extractListFromDesc(card.desc, '- Información LIDAR/vuelos Dron'));
    
    setIsFormOpen(true);
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
    if (currentStatus.success && currentStatus.message) {
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

      setIsFormOpen(false);
      resetForm();
      fetchProjects();
    } else if (!currentStatus.success && currentStatus.message) {
      toast({ variant: 'destructive', title: 'Error', description: currentStatus.message });
    }
  }, [currentStatus, toast, fetchProjects, user, db, editingCard]);

  return (
    <>
      <Card className="w-full h-full flex flex-col border-0 shadow-none overflow-hidden">
        <CardHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
              <div>
                  <CardTitle className="text-base font-medium">Gestión de Proyectos</CardTitle>
                  <CardDescription className="text-xs">Consultá la lista o gestioná proyectos.</CardDescription>
              </div>
              <Button size="icon" onClick={() => { resetForm(); setIsFormOpen(true); }} className="ml-auto"><Plus /></Button>
          </div>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                inputMode="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoading ? <p className="p-4 text-sm">Cargando...</p> : (
              <Table className="text-xs">
                <TableBody>
                  {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project, idx) => (
                    <TableRow 
                      key={project.id} 
                      className={cn(
                        "cursor-pointer hover:bg-muted/40 transition-colors",
                        idx % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20'
                      )}
                      onClick={() => {
                        onEditCard?.(project);
                        setOpen(false);
                      }}
                    >
                      <TableCell className="font-mono py-1.5 w-[100px] border-r border-muted/30">{project.name.match(/\(([^)]+)\)$/)?.[1]}</TableCell>
                      <TableCell className="py-1.5">{project.name.replace(/\([^)]+\)$/, '').trim()}</TableCell>
                      <TableCell className="text-right py-1.5 w-[50px]">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
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
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg p-0 border-0 overflow-hidden flex flex-col h-[90vh] max-h-[90vh]">
          <DialogHeader className="p-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsFormOpen(false)}><ArrowLeft className="h-4 w-4" /></Button>
                {editingCard ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'}
            </DialogTitle>
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
            
            <ScrollArea className="flex-grow px-4">
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre del Proyecto *</Label>
                  <Input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="h-8 text-xs bg-white" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cuenca *</Label>
                      <Select name="cuenca" value={selectedCuenca} onValueChange={setSelectedCuenca} required>
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Seleccioná cuenca" /></SelectTrigger>
                        <SelectContent>{CUENCAS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Estado Actual</Label>
                      <Select name="estado" value={estado} onValueChange={setEstado}>
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Seleccioná estado" /></SelectTrigger>
                        <SelectContent>{ESTADOS_PROYECTO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                </div>
                {editingCard && <p className="text-[10px] text-amber-600 font-medium pt-0.5">Nota: Si cambiás la cuenca, se generará un nuevo código. Si cambiás el estado, se registrará un hito.</p>}
                
                <Separator className="my-1" />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Partido(s)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">{selectedPartidos.length > 0 ? `${selectedPartidos.length} sel.` : 'Seleccioná'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-48 overflow-y-auto">
                        {MUNICIPIOS.map(m => <DropdownMenuCheckboxItem key={m} checked={selectedPartidos.includes(m)} onCheckedChange={c => setSelectedPartidos(curr => c ? [...curr, m] : curr.filter(x => x !== m))} onSelect={e => e.preventDefault()}>{m}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Proyectista/s</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">
                          {selectedProyectistas.length > 0 ? `${selectedProyectistas.length} sel.` : 'Seleccioná'} 
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-48 overflow-y-auto">
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

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Financiamiento</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">{selectedFinanciamiento.length > 0 ? `${selectedFinanciamiento.length} sel.` : 'Seleccioná'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-48 overflow-y-auto">
                      {FINANCIAMIENTO.map(f => <DropdownMenuCheckboxItem key={f} checked={selectedFinanciamiento.includes(f)} onCheckedChange={c => setSelectedFinanciamiento(curr => c ? [...curr, f] : curr.filter(x => x !== f))} onSelect={e => e.preventDefault()}>{f}</DropdownMenuCheckboxItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Separator className="my-1" />
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Nominados del Equipo</p>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Diagnóstico Ambiental-Socioeconómico (DEA)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">{selectedEquipo.length > 0 ? `${selectedEquipo.length} sel.` : 'Seleccioná responsables'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-48 overflow-y-auto">
                      {EQUIPO_DEA.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedEquipo.includes(p)} onCheckedChange={c => setSelectedEquipo(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Equipo SIG</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">{selectedSig.length > 0 ? `${selectedSig.length} sel.` : 'Personal SIG'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-48 overflow-y-auto">
                        {EQUIPO_SIG.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedSig.includes(p)} onCheckedChange={c => setSelectedSig(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Equipo Dron</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between font-normal bg-white">{selectedDron.length > 0 ? `${selectedDron.length} sel.` : 'Personal Dron'} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-48 overflow-y-auto">
                        {EQUIPO_DRON.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedDron.includes(p)} onCheckedChange={c => setSelectedDron(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/30 shrink-0">
              <Button variant="ghost" type="button" onClick={() => setIsFormOpen(false)} disabled={isPending} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={isPending} className="min-w-[140px] h-9 text-xs">
                {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                {editingCard ? 'Guardar Cambios' : 'Crear Proyecto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
