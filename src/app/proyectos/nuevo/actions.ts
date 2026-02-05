'use server';

import { z } from 'zod';
import { CUENCAS, DESCRIPCION_PLANTILLA } from '@/lib/cuencas';
import { createTrelloCard, getListsOnBoard, getNextProjectCode } from '@/services/trello';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

export const CreateProjectSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre del proyecto es obligatorio.' }),
  cuenca: z.string().min(1, { message: 'Debe seleccionar una cuenca.' }),
  // Optional fields
  personasAsignadas: z.string().optional(),
  proyectistas: z.string().optional(),
  financiamiento: z.string().optional(),
});

export type CreateProjectState = {
  message?: string;
  errors?: {
    nombre?: string[];
    cuenca?: string[];
  };
  success: boolean;
  cardUrl?: string;
};

export async function createProject(
  prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const validatedFields = CreateProjectSchema.safeParse({
    nombre: formData.get('nombre'),
    cuenca: formData.get('cuenca'),
    personasAsignadas: formData.get('personasAsignadas'),
    proyectistas: formData.get('proyectistas'),
    financiamiento: formData.get('financiamiento'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos obligatorios. No se pudo crear el proyecto.',
      success: false,
    };
  }

  const { nombre, cuenca: cuencaId } = validatedFields.data;

  try {
    const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
    if (!selectedCuenca) {
      throw new Error('La cuenca seleccionada no es válida.');
    }
    
    // 1. Get the next project code
    const projectCode = await getNextProjectCode(PROYECTOS_BOARD_ID, selectedCuenca.code);
    
    // 2. Find the Trello list ID
    const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
    const targetList = lists.find(list => list.name.toLowerCase() === selectedCuenca.trelloListName.toLowerCase());

    if (!targetList) {
      throw new Error(`No se encontró la lista de Trello "${selectedCuenca.trelloListName}" en el tablero de Proyectos.`);
    }

    // 3. Create the card in Trello
    const cardName = `${nombre} (${projectCode})`;
    const card = await createTrelloCard({
      name: cardName,
      idList: targetList.id,
      desc: DESCRIPCION_PLANTILLA,
      cover: {
        color: 'red',
      },
    });

    return {
      message: `¡Proyecto "${cardName}" creado con éxito!`,
      success: true,
      cardUrl: card.url,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return {
      message: `Error al crear el proyecto: ${errorMessage}`,
      success: false,
    };
  }
}
