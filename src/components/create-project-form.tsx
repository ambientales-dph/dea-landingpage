'use client';

import { useActionState, useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, type CreateProjectState } from '@/app/actions/project-actions';
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
import { getAllCardsFromAllBoards, TrelloCard } from '@/services/trello';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Search, X, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EQUIPO_DEA, EQUIPO_SIG } from '@/lib/equipo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const initialState: CreateProjectState = {
  message: undefined,
  errors: undefined,
  success: false,
};

interface CreateProjectFormProps {
  setOpen: (open: boolean) => void;
}

const removeAccents = (str: string): string => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function CreateProjectForm({ setOpen }: CreateProjectFormProps) {
  const [state, formAction] = useActionState(createProject, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [projects, setProjects] = useState<TrelloCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<TrelloCard[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<string[]>([]);
  const [selectedSig, setSelectedSig] = useState<string[]>([]);

  const getProjectInfo = useCallback((name: string): { code: string | null; nameWithoutCode: string } => {
    const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
    const match = name.match(projectRegex);
    if (match && match[1]) {
      return {
        code: match[1],
        nameWithoutCode: name.replace(projectRegex, '').trim()
      };
    }
    return { code: null, nameWithoutCode: name };
  }, []);

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
  }, [toast, getProjectInfo]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast({
          title: '¡Éxito!',
          description: state.message,
          action: state.cardUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={state.cardUrl} target="_blank" rel="noopener noreferrer">
                Ver Tarjeta
              </a>
            </Button>
          ) : undefined,
        });
        formRef.current?.reset();
        setSelectedEquipo([]);
        setSelectedSig([]);
        setCreateDialogOpen(false);
        fetchProjects(); // Refresh the list
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear el proyecto',
          description: state.message,
        });
      }
    }
  }, [state, toast, fetchProjects]);
  
  useEffect(() => {
      const normalizedQuery = removeAccents(searchQuery.toLowerCase());
      const keywords = normalizedQuery.split(' ').filter(kw => kw.trim() !== '');

      if (keywords.length === 0) {
          setFilteredProjects(projects);
          return;
      }

      const filtered = projects.filter(project => {
          const cardNameLower = removeAccents(project.name.toLowerCase());
          const cardDescLower = removeAccents(project.desc ? project.desc.toLowerCase() : '');

          const nameMatch = keywords.every(keyword => cardNameLower.includes(keyword));
          const descMatch = keywords.every(keyword => cardDescLower.includes(keyword));
          
          return nameMatch || descMatch;
      });

      setFilteredProjects(filtered);
  }, [searchQuery, projects]);

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
      <Card className="w-full h-full flex flex-col rounded-lg border-0 shadow-none overflow-hidden">
        <CardHeader className="p-4 border-b">
          <div className="flex justify-between items-start">
              <div>
                  <CardTitle className="text-base font-medium">Gestión de Proyectos</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                      Consultá la lista de proyectos o creá uno nuevo.
                  </CardDescription>
              </div>
              <DialogTrigger asChild>
                  <Button size="icon" variant="default" className="bg-primary text-primary-foreground">
                      <Plus />
                  </Button>
              </DialogTrigger>
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
        <CardContent className="flex-grow p-0 min-h-0 overflow-y-auto">
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
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                                <Pencil className="h-4 w-4" />
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
        </CardContent>
      </Card>

      <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            <DialogDescription>
              Complete el formulario para crear una nueva tarjeta de proyecto en Trello.
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="space-y-4 pt-2">
              <ScrollArea className="max-h-[60vh] -mr-6 pr-6">
                <div className="space-y-4">
                  <input type="hidden" name="diagnosticoEquipo" value={selectedEquipo.join('; ')} />
                  <input type="hidden" name="informacionSig" value={selectedSig.join('; ')} />
                  <div className="space-y-2">
                    <Label htmlFor="nombre-create">Nombre del Proyecto (obligatorio)</Label>
                    <Input id="nombre-create" name="nombre" placeholder="Ej: Relevamiento ambiental de la obra X" required />
                    {state.errors?.nombre && <p className="text-sm font-medium text-destructive">{state.errors.nombre[0]}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cuenca-create">Cuenca (obligatorio)</Label>
                    <Select name="cuenca" required>
                      <SelectTrigger id="cuenca-create"><SelectValue placeholder="Seleccioná una cuenca" /></SelectTrigger>
                      <SelectContent>
                        {CUENCAS.map(cuenca => <SelectItem key={cuenca.id} value={cuenca.id}>{cuenca.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {state.errors?.cuenca && <p className="text-sm font-medium text-destructive">{state.errors.cuenca[0]}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Diagnóstico ambiental-socioeconómico</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>
                            {selectedEquipo.length > 0 ? `${selectedEquipo.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}
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
                            checked={selectedEquipo.includes(persona)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEquipo([...selectedEquipo, persona]);
                              } else {
                                setSelectedEquipo(selectedEquipo.filter(p => p !== persona));
                              }
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
                            {selectedSig.length > 0 ? `${selectedSig.length} persona(s) seleccionada(s)` : 'Seleccioná el equipo'}
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
                            checked={selectedSig.includes(persona)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSig([...selectedSig, persona]);
                              } else {
                                setSelectedSig(selectedSig.filter(p => p !== persona));
                              }
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
                    <Label htmlFor="proyectistas-create">Proyectistas</Label>
                    <Input id="proyectistas-create" name="proyectistas" placeholder="Nombres de los proyectistas" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financiamiento-create">Financiamiento</Label>
                    <Input id="financiamiento-create" name="financiamiento" placeholder="Fuente de financiamiento del proyecto" />
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Crear Proyecto</Button>
              </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
