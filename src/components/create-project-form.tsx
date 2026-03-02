'use client';

import { useActionState, useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, type ProjectState } from '@/app/actions/project-actions';
import { CUENCAS } from '@/lib/cuencas';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from './ui/scroll-area';
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Search, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { EQUIPO_DEA, EQUIPO_SIG, EQUIPO_DRON } from '@/lib/equipo';
import { MUNICIPIOS } from '@/lib/municipios';
import { PROYECTISTAS } from '@/lib/proyectistas';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const createInitialState: ProjectState = { message: undefined, success: false };

export default function CreateProjectForm({ setOpen }: { setOpen: (open: boolean) => void }) {
  const { user } = useUser();
  const db = useFirestore();
  const [createState, createFormAction, isPending] = useActionState(createProject, createInitialState);
  const { toast } = useToast();
  const createFormRef = useRef<HTMLFormElement>(null);
  
  const [projects, setProjects] = useState<TrelloCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const [selectedPartidos, setSelectedPartidos] = useState<string[]>([]);
  const [selectedProyectista, setSelectedProyectista] = useState('');
  const [selectedFinanciamiento, setSelectedFinanciamiento] = useState<string[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);
  const [selectedDron, setSelectedDron] = useState<string[]>([]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCards = await getAllCardsFromAllBoards();
      const projectCards = allCards.filter(card => card.name.match(/\(([A-Z]{3}\d{3})\)$/));
      setProjects(projectCards);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (createState.success && createState.message) {
      toast({ title: '¡Éxito!', description: createState.message });
      
      if (user && db) {
        const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
        const realName = authorizedUser?.name || user.displayName || 'Usuario';

        const activityData = {
          userId: user.uid,
          userName: realName,
          userEmail: user.email,
          userPhoto: user.photoURL || '',
          actionType: 'create_project',
          projectName: createState.projectName || 'Proyecto nuevo',
          cardId: createState.cardId,
          timestamp: serverTimestamp(),
        };

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

      setCreateDialogOpen(false);
      fetchProjects();
      createFormRef.current?.reset();
      setSelectedPartidos([]);
      setSelectedProyectista('');
      setSelectedFinanciamiento([]);
      setSelectedEquipo([]);
      setSelectedSig([]);
      setSelectedDron([]);
    } else if (!createState.success && createState.message) {
      toast({ variant: 'destructive', title: 'Error', description: createState.message });
    }
  }, [createState, toast, fetchProjects, user, db]);

  return (
    <>
      <Card className="w-full h-full flex flex-col border-0 shadow-none overflow-hidden">
        <CardHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
              <div>
                  <CardTitle className="text-base font-medium">Gestión de Proyectos</CardTitle>
                  <CardDescription className="text-xs">Consultá la lista o creá uno nuevo.</CardDescription>
              </div>
              <Button size="icon" onClick={() => setCreateDialogOpen(true)} className="ml-auto"><Plus /></Button>
          </div>
          <div className="pt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-grow p-0">
          <ScrollArea className="h-full">
            {isLoading ? <p className="p-4 text-sm">Cargando...</p> : (
              <Table className="text-xs">
                <TableBody>
                  {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project, idx) => (
                    <TableRow key={project.id} className={idx % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20'}>
                      <TableCell className="font-mono py-1.5">{project.name.match(/\(([^)]+)\)$/)?.[1]}</TableCell>
                      <TableCell className="py-1.5">{project.name.replace(/\([^)]+\)$/, '').trim()}</TableCell>
                      <TableCell className="text-right py-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Crear Nuevo Proyecto</DialogTitle></DialogHeader>
          <form ref={createFormRef} action={createFormAction}>
            <input type="hidden" name="userEmail" value={user?.email || ''} />
            <input type="hidden" name="partido" value={selectedPartidos.join(', ')} />
            <input type="hidden" name="proyectista" value={selectedProyectista} />
            <input type="hidden" name="financiamiento" value={selectedFinanciamiento.join(', ')} />
            <input type="hidden" name="diagnosticoEquipo" value={selectedEquipo.join('; ')} />
            <input type="hidden" name="informacionSig" value={selectedSig.join('; ')} />
            <input type="hidden" name="informacionDron" value={selectedDron.join('; ')} />
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3 p-1">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input name="nombre" required className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuenca *</Label>
                  <Select name="cuenca" required>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                    <SelectContent>{CUENCAS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Partido(s)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between">Partidos <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-40 overflow-y-auto">
                        {MUNICIPIOS.map(m => <DropdownMenuCheckboxItem key={m} checked={selectedPartidos.includes(m)} onCheckedChange={c => setSelectedPartidos(curr => c ? [...curr, m] : curr.filter(x => x !== m))} onSelect={e => e.preventDefault()}>{m}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Proyectista</Label>
                    <Select onValueChange={setSelectedProyectista}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                      <SelectContent>{PROYECTISTAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Diagnóstico (DEA)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between">Personal <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-40 overflow-y-auto">
                      {EQUIPO_DEA.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedEquipo.includes(p)} onCheckedChange={c => setSelectedEquipo(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">SIG</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between">SIG <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {EQUIPO_SIG.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedSig.includes(p)} onCheckedChange={c => setSelectedSig(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dron</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-8 text-xs justify-between">Dron <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {EQUIPO_DRON.map(p => <DropdownMenuCheckboxItem key={p} checked={selectedDron.includes(p)} onCheckedChange={c => setSelectedDron(curr => c ? [...curr, p] : curr.filter(x => x !== p))} onSelect={e => e.preventDefault()}>{p}</DropdownMenuCheckboxItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Crear Proyecto'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
