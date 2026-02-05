'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProject, CreateProjectState } from './actions';
import { CUENCAS } from '@/lib/cuencas';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const initialState: CreateProjectState = {
  message: undefined,
  errors: undefined,
  success: false,
};

export default function NuevoProyectoPage() {
  const [state, formAction] = useFormState(createProject, initialState);
  const { toast } = useToast();

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
        // Ideally, you'd reset the form here.
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear el proyecto',
          description: state.message,
        });
      }
    }
  }, [state, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 font-body">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Crear Nuevo Proyecto</CardTitle>
          <CardDescription>
            Completá los datos para crear una nueva tarjeta de proyecto en Trello.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Proyecto (obligatorio)</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ej: Relevamiento ambiental de la obra X"
                required
              />
              {state.errors?.nombre && (
                <p className="text-sm font-medium text-destructive">
                  {state.errors.nombre[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuenca">Cuenca (obligatorio)</Label>
               <Select name="cuenca" required>
                <SelectTrigger id="cuenca">
                  <SelectValue placeholder="Seleccioná una cuenca" />
                </SelectTrigger>
                <SelectContent>
                  {CUENCAS.map(cuenca => (
                    <SelectItem key={cuenca.id} value={cuenca.id}>
                      {cuenca.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.cuenca && (
                <p className="text-sm font-medium text-destructive">
                  {state.errors.cuenca[0]}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proyectistas">Proyectistas</Label>
              <Input
                id="proyectistas"
                name="proyectistas"
                placeholder="Nombres de los proyectistas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personasAsignadas">Personas Asignadas</Label>
              <Textarea
                id="personasAsignadas"
                name="personasAsignadas"
                placeholder="Equipo de trabajo nominado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="financiamiento">Financiamiento</Label>
              <Input
                id="financiamiento"
                name="financiamiento"
                placeholder="Fuente de financiamiento del proyecto"
              />
            </div>

            <Button type="submit" className="w-full">
              Crear Proyecto
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
