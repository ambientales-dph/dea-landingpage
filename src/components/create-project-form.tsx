'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Pencil, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    async function fetchProjects() {
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
        setFilteredProjects(projectCards);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar proyectos',
          description: 'No se pudo obtener la lista de proyectos existentes.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, [toast]);

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
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear el proyecto',
          description: state.message,
        });
      }
    }
  }, [state, toast, setOpen]);
  
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
    <div className="flex h-full w-full items-center justify-center bg-muted/40 p-4 font-body">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Gestión de Proyectos</CardTitle>
          <CardDescription>
            Creá un nuevo proyecto o consultá la lista de proyectos existentes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[70vh]">
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="flex h-full flex-col p-1">
                  <div className="border rounded-md flex-grow min-h-0 flex flex-col">
                    <div className="p-2 border-b relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por código, nombre o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <ScrollArea className="flex-grow">
                      {isLoading ? (
                        <p className="p-4 text-sm text-muted-foreground">Cargando proyectos...</p>
                      ) : (
                        <Table>
                          <TableBody>
                            {filteredProjects.length > 0 ? (
                                filteredProjects.map((project, index) => {
                                const { code, nameWithoutCode } = getProjectInfo(project.name);
                                return (
                                    <TableRow key={project.id} className={cn(index % 2 === 0 ? 'bg-muted/20' : 'bg-[#cceeff]/40')}>
                                    <TableCell className="font-mono text-xs py-1 w-[120px]">{code}</TableCell>
                                    <TableCell className="text-xs py-1">{nameWithoutCode}</TableCell>
                                    <TableCell className="p-1 text-right w-[100px]">
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
                    </ScrollArea>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={60} minSize={30}>
                <form ref={formRef} action={formAction} className="flex flex-col h-full p-1">
                  <h3 className="text-lg font-semibold mb-4 flex-shrink-0">Crear Nuevo Proyecto</h3>
                  <ScrollArea className="flex-grow pr-4 min-h-0">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre del Proyecto (obligatorio)</Label>
                        <Input id="nombre" name="nombre" placeholder="Ej: Relevamiento ambiental de la obra X" required />
                        {state.errors?.nombre && <p className="text-sm font-medium text-destructive">{state.errors.nombre[0]}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cuenca">Cuenca (obligatorio)</Label>
                        <Select name="cuenca" required>
                          <SelectTrigger id="cuenca"><SelectValue placeholder="Seleccioná una cuenca" /></SelectTrigger>
                          <SelectContent>
                            {CUENCAS.map(cuenca => <SelectItem key={cuenca.id} value={cuenca.id}>{cuenca.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {state.errors?.cuenca && <p className="text-sm font-medium text-destructive">{state.errors.cuenca[0]}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="proyectistas">Proyectistas</Label>
                        <Input id="proyectistas" name="proyectistas" placeholder="Nombres de los proyectistas" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="personasAsignadas">Personas Asignadas</Label>
                        <Textarea id="personasAsignadas" name="personasAsignadas" placeholder="Equipo de trabajo nominado" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="financiamiento">Financiamiento</Label>
                        <Input id="financiamiento" name="financiamiento" placeholder="Fuente de financiamiento del proyecto" />
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end gap-2 pt-4 flex-shrink-0">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Volver</Button>
                    <Button type="submit">Crear Proyecto</Button>
                  </div>
                </form>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
