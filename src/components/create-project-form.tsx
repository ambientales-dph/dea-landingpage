'use client';

import { useActionState, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, updateProject, type ProjectState } from '@/app/actions/project-actions';
import { CUENCAS } from '@/lib/cuencas';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from './ui/scroll-area';
import { getAllCardsFromAllBoards, TrelloCard, getCardById } from '@/services/trello';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Search, X, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EQUIPO_DEA, EQUIPO_SIG } from '@/lib/equipo';
import { MUNICIPIOS } from '@/lib/municipios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const createInitialState: ProjectState = {
  message: undefined,
  errors: undefined,
  success: false,
};

const updateInitialState: ProjectState = {
  message: undefined,
  errors: undefined,
  success: false,
};

const getProjectInfo = (name: string): { code: string | null; nameWithoutCode: string } => {
  const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
  const match = name.match(projectRegex);
  if (match && match[1]) {
    return {
      code: match[1],
      nameWithoutCode: name.replace(projectRegex, '').trim()
    };
  }
  return { code: null, nameWithoutCode: name };
};

// Edit Project Dialog Component
interface EditProjectDialogProps {
  project: TrelloCard;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function EditProjectDialog({ project, isOpen, onOpenChange, onSuccess }: EditProjectDialogProps) {
  const [state, formAction] = useActionState(updateProject, updateInitialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [nombre, setNombre] = useState('');
  const [cuencaId, setCuencaId] = useState('');
  const [selectedPartidos, setSelectedPartidos] = useState<string[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);
  
  const getValuesFromDesc = useCallback((desc: string, field: string): string[] => {
      if (!desc) return [];
      const regex = new RegExp(`^${field}:\\s*(.*)$`, 'm');
      const match = desc.match(regex);
      if (match && match[1]) {
          const separator = field === 'PARTIDO' ? ',' : ';';
          return match[1].split(separator).map(s => s.trim()).filter(Boolean);
      }
      return [];
  }, []);

  useEffect(() => {
    if (project) {
        const { nameWithoutCode, code } = getProjectInfo(project.name);
        setNombre(nameWithoutCode);

        const projectCuenca = CUENCAS.find(c => code?.startsWith(c.code));
        setCuencaId(projectCuenca?.id || '');
        
        setSelectedPartidos(getValuesFromDesc(project.desc, 'PARTIDO'));
        setSelectedEquipo(getValuesFromDesc(project.desc, 'Diagnóstico ambiental-socioeconómico'));
        setSelectedSig(getValuesFromDesc(project.desc, 'Información SIG-imágenes'));
    }
  }, [project, getValuesFromDesc]);
  
  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast({
          title: '¡Éxito!',
          description: state.message,
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al actualizar el proyecto',
          description: state.message,
        });
      }
    }
  }, [state, toast, onOpenChange, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Proyecto</DialogTitle>
            <DialogDescription>
              Modificá los datos del proyecto. Si cambiás la cuenca, se generará un nuevo código.
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="flex flex-col h-full min-h-0">
              <ScrollArea className="flex-grow pr-6 -mr-6 max-h-[65vh]">
                <div className="space-y-4">
                  <input type="hidden" name="cardId" value={project.id} />
                  <input type="hidden" name="partido" value={selectedPartidos.join(', ')} />
                  <input type="hidden" name="diagnosticoEquipo" value={selectedEquipo.join('; ')} />
                  <input type="hidden" name="informacionSig" value={selectedSig.join('; ')} />
                  
                  <div className="space-y-2">
                    <Label htmlFor="nombre-edit">Nombre del Proyecto</Label>
                    <Input id="nombre-edit" name="nombre" value={nombre} onChange={e => setNombre(e.target.value)} required />
                    {state.errors?.nombre && <p className="text-sm font-medium text-destructive">{state.errors.nombre[0]}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cuenca-edit">Cuenca</Label>
                    <Select name="cuenca" required value={cuencaId} onValueChange={setCuencaId}>
                      <SelectTrigger id="cuenca-edit"><SelectValue placeholder="Seleccioná una cuenca" /></SelectTrigger>
                      <SelectContent>
                        {CUENCAS.map(cuenca => <SelectItem key={cuenca.id} value={cuenca.id}>{cuenca.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                   <div className="space-y-2">
                    <Label>Partido(s)</Label>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>{selectedPartidos.length > 0 ? `${selectedPartidos.length} partido(s) seleccionado(s)` : 'Seleccioná uno o más partidos'}</span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Municipios</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {MUNICIPIOS.map(partido => (
                          <DropdownMenuCheckboxItem
                            key={partido}
                            checked={selectedPartidos.includes(partido)}
                            onCheckedChange={(checked) => setSelectedPartidos(current => checked ? [...current, partido] : current.filter(p => p !== partido))}
                            onSelect={e => e.preventDefault()}
                          >
                            {partido}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Diagnóstico ambiental-socioeconómico</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>{selectedEquipo.length > 0 ? `${selectedEquipo.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}</span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Equipo del DEA</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {EQUIPO_DEA.map(persona => (
                          <DropdownMenuCheckboxItem
                            key={persona}
                            checked={selectedEquipo.includes(persona)}
                            onCheckedChange={(checked) => setSelectedEquipo(current => checked ? [...current, persona] : current.filter(p => p !== persona))}
                            onSelect={e => e.preventDefault()}
                          >
                            {persona}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                   <div className="space-y-2">
                    <Label>Información SIG-Imágenes</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>{selectedSig.length > 0 ? `${selectedSig.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}</span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Equipo SIG</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {EQUIPO_SIG.map(persona => (
                          <DropdownMenuCheckboxItem
                            key={persona}
                            checked={selectedSig.includes(persona)}
                            onCheckedChange={(checked) => setSelectedSig(current => checked ? [...current, persona] : current.filter(p => p !== persona))}
                            onSelect={e => e.preventDefault()}
                          >
                            {persona}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 flex-shrink-0">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CreateProjectForm({ setOpen }: { setOpen: (open: boolean) => void }) {
  const [createState, createFormAction] = useActionState(createProject, createInitialState);
  const { toast } = useToast();
  const createFormRef = useRef<HTMLFormElement>(null);
  
  const [projects, setProjects] = useState<TrelloCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<TrelloCard | null>(null);
  const [isEditingLoading, setIsEditingLoading] = useState<string | null>(null);

  const [selectedPartidosCreate, setSelectedPartidosCreate] = useState<string[]>([]);
  const [selectedEquipoCreate, setSelectedEquipoCreate] = useState<string[]>([]);
  const [selectedSigCreate, setSelectedSigCreate] = useState<string[]>([]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCards = await getAllCardsFromAllBoards();
      const projectCards = allCards
        .filter(card => getProjectInfo(card.name).code)
        .sort((a, b) => {
          const codeA = getProjectInfo(a.name).code || '';
          const codeB = getProjectInfo(b.name).code || '';
          return codeA.localeCompare(codeB);
        });
      setProjects(projectCards);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar proyectos',
        description: 'No se pudo obtener la lista de proyectos existentes.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (createState.message) {
      if (createState.success) {
        toast({
          title: '¡Éxito!',
          description: createState.message,
          action: createState.cardUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={createState.cardUrl} target="_blank" rel="noopener noreferrer">
                Ver Tarjeta
              </a>
            </Button>
          ) : undefined,
        });
        createFormRef.current?.reset();
        setSelectedPartidosCreate([]);
        setSelectedEquipoCreate([]);
        setSelectedSigCreate([]);
        setCreateDialogOpen(false);
        fetchProjects();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear el proyecto',
          description: createState.message,
        });
      }
    }
  }, [createState, toast, fetchProjects]);
  
  const filteredProjects = useMemo(() => {
      const normalizedQuery = searchQuery.toLowerCase();
      const keywords = normalizedQuery.split(' ').filter(kw => kw.trim() !== '');

      if (keywords.length === 0) {
          return projects;
      }

      return projects.filter(project => {
          const cardNameLower = project.name.toLowerCase();
          const cardDescLower = project.desc ? project.desc.toLowerCase() : '';
          const nameMatch = keywords.every(keyword => cardNameLower.includes(keyword));
          const descMatch = keywords.every(keyword => cardDescLower.includes(keyword));
          return nameMatch || descMatch;
      });
  }, [searchQuery, projects]);

  const handleEditClick = async (project: TrelloCard) => {
      setIsEditingLoading(project.id);
      try {
        const freshProject = await getCardById(project.id);
        setEditingProject(freshProject);
        setEditDialogOpen(true);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar proyecto',
          description: error instanceof Error ? error.message : 'No se pudo obtener la información más reciente.'
        });
      } finally {
        setIsEditingLoading(null);
      }
  }

  return (
    <>
      <Card className="w-full h-full flex flex-col rounded-lg border-0 shadow-none overflow-hidden">
        <CardHeader className="p-4 border-b">
          <div className="flex justify-between items-start">
              <div>
                  <CardTitle className="text-base font-medium">Gestión de Proyectos</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                      Consultá la lista de proyectos o creá uno nuevo.
                  </CardDescription>
              </div>
              <Button size="icon" variant="default" className="bg-primary text-primary-foreground" onClick={() => setCreateDialogOpen(true)}>
                  <Plus />
              </Button>
          </div>
          <div className="pt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-[-4px] h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nombre o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-8 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery('')}
                className="absolute right-0.5 top-1/2 -translate-y-[-4px] h-7 w-7 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-grow p-0 min-h-0">
              <ScrollArea className="h-full">
                {isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Cargando proyectos...</p>
                ) : (
                  <Table className="text-xs">
                    <TableBody>
                      {filteredProjects.length > 0 ? (
                          filteredProjects.map((project, index) => {
                          const { code, nameWithoutCode } = getProjectInfo(project.name);
                          return (
                              <TableRow key={project.id} className={cn('h-8', index % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20', 'hover:bg-white')}>
                              <TableCell className="font-mono py-0 px-2 w-[100px]">{code}</TableCell>
                              <TableCell className="py-0 px-2">{nameWithoutCode}</TableCell>
                              <TableCell className="p-0 px-2 text-right w-[80px]">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(project)} disabled={!!isEditingLoading}>
                                    {isEditingLoading === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                                  <Trash2 className="h-4 w-4" />
                                  </Button>
                              </TableCell>
                              </TableRow>
                          );
                          })
                      ) : (
                          <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
                                  No se encontraron proyectos.
                              </TableCell>
                          </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
                <DialogDescription>
                  Complete el formulario para crear una nueva tarjeta de proyecto en Trello.
                </DialogDescription>
              </DialogHeader>
              <form ref={createFormRef} action={createFormAction} className="flex flex-col h-full min-h-0">
                  <ScrollArea className="flex-grow pr-6 -mr-6 max-h-[65vh]">
                    <div className="space-y-4">
                      <input type="hidden" name="partido" value={selectedPartidosCreate.join(', ')} />
                      <input type="hidden" name="diagnosticoEquipo" value={selectedEquipoCreate.join('; ')} />
                      <input type="hidden" name="informacionSig" value={selectedSigCreate.join('; ')} />
                      <div className="space-y-2">
                        <Label htmlFor="nombre-create">Nombre del Proyecto (obligatorio)</Label>
                        <Input id="nombre-create" name="nombre" placeholder="Ej: Relevamiento ambiental de la obra X" required />
                        {createState.errors?.nombre && <p className="text-sm font-medium text-destructive">{createState.errors.nombre[0]}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cuenca-create">Cuenca (obligatorio)</Label>
                        <Select name="cuenca" required>
                          <SelectTrigger id="cuenca-create"><SelectValue placeholder="Seleccioná una cuenca" /></SelectTrigger>
                          <SelectContent>
                            {CUENCAS.map(cuenca => <SelectItem key={cuenca.id} value={cuenca.id}>{cuenca.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {createState.errors?.cuenca && <p className="text-sm font-medium text-destructive">{createState.errors.cuenca[0]}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Partido(s)</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              <span>
                                {selectedPartidosCreate.length > 0 ? `${selectedPartidosCreate.length} partido(s) seleccionado(s)` : 'Seleccioná uno o más partidos'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                            <DropdownMenuLabel>Municipios</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {MUNICIPIOS.map(partido => (
                              <DropdownMenuCheckboxItem
                                key={partido}
                                checked={selectedPartidosCreate.includes(partido)}
                                onCheckedChange={(checked) => {
                                  setSelectedPartidosCreate(current => checked ? [...current, partido] : current.filter(p => p !== partido));
                                }}
                                onSelect={e => e.preventDefault()}
                              >
                                {partido}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <Label>Diagnóstico ambiental-socioeconómico</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              <span>
                                {selectedEquipoCreate.length > 0 ? `${selectedEquipoCreate.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                            <DropdownMenuLabel>Equipo del DEA</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {EQUIPO_DEA.map(persona => (
                              <DropdownMenuCheckboxItem
                                key={persona}
                                checked={selectedEquipoCreate.includes(persona)}
                                onCheckedChange={(checked) => {
                                  setSelectedEquipoCreate(current => checked ? [...current, persona] : current.filter(p => p !== persona));
                                }}
                                onSelect={e => e.preventDefault()}
                              >
                                {persona}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <Label>Información SIG-Imágenes</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              <span>
                                {selectedSigCreate.length > 0 ? `${selectedSigCreate.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                            <DropdownMenuLabel>Equipo SIG</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {EQUIPO_SIG.map(persona => (
                              <DropdownMenuCheckboxItem
                                key={persona}
                                checked={selectedSigCreate.includes(persona)}
                                onCheckedChange={(checked) => {
                                  setSelectedSigCreate(current => checked ? [...current, persona] : current.filter(p => p !== persona));
                                }}
                                onSelect={e => e.preventDefault()}
                              >
                                {persona}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="pt-4 flex-shrink-0">
                    <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Crear Proyecto</Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
      
      {editingProject && (
        <EditProjectDialog
            project={editingProject}
            isOpen={isEditDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={fetchProjects}
        />
      )}
    </>
  );
}
