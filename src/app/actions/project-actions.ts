'use server';

import { z } from 'zod';
import { CUENCAS, DESCRIPCION_PLANTILLA } from '@/lib/cuencas';
import { createTrelloCard, getCardById, getListsOnBoard, getNextProjectCode, updateTrelloCard } from '@/services/trello';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

const ProjectSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre del proyecto es obligatorio.' }),
  cuenca: z.string().min(1, { message: 'Debe seleccionar una cuenca.' }),
  partido: z.string().optional(),
  diagnosticoEquipo: z.string().optional(),
  informacionSig: z.string().optional(),
});

export type ProjectState = {
  message?: string;
  errors?: {
    nombre?: string[];
    cuenca?: string[];
  };
  success: boolean;
  cardUrl?: string;
};

function updateDescriptionField(description: string, field: string, value: string): string {
    const regex = new RegExp(`^(${field}:\\s*).*$`, 'm');
    const replacement = `$1${value}`;

    if (regex.test(description)) {
        return description.replace(regex, replacement);
    }
    
    if (field === 'Información SIG-imágenes') {
        const diagField = 'Diagnóstico ambiental-socioeconómico:';
        const diagRegex = new RegExp(`^(${diagField}\\s*.*)$`, 'm');
        if (diagRegex.test(description)) {
            return description.replace(diagRegex, `$1\n${field}: ${value}`);
        }
    }

    const separator = description.trim() ? '\n' : '';
    return `${description}${separator}${field}: ${value}`;
}


export async function createProject(
  prevState: ProjectState,
  formData: FormData
): Promise<ProjectState> {
  const validatedFields = ProjectSchema.safeParse({
    nombre: formData.get('nombre'),
    cuenca: formData.get('cuenca'),
    partido: formData.get('partido'),
    diagnosticoEquipo: formData.get('diagnosticoEquipo'),
    informacionSig: formData.get('informacionSig'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos obligatorios. No se pudo crear el proyecto.',
      success: false,
    };
  }

  const { nombre, cuenca: cuencaId, partido, diagnosticoEquipo, informacionSig } = validatedFields.data;

  try {
    const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
    if (!selectedCuenca) {
      throw new Error('La cuenca seleccionada no es válida.');
    }
    
    const projectCode = await getNextProjectCode(PROYECTOS_BOARD_ID, selectedCuenca.code);
    
    const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
    const targetList = lists.find(list => list.name.toLowerCase() === selectedCuenca.trelloListName.toLowerCase());

    if (!targetList) {
      throw new Error(`No se encontró la lista de Trello "${selectedCuenca.trelloListName}" en el tablero de Proyectos.`);
    }

    const cardName = `${nombre} (${projectCode})`;
    
    let finalDescription = DESCRIPCION_PLANTILLA;
    if (partido) {
      finalDescription = updateDescriptionField(finalDescription, 'PARTIDO', partido);
    }
    if (diagnosticoEquipo) {
      finalDescription = updateDescriptionField(finalDescription, 'Diagnóstico ambiental-socioeconómico', diagnosticoEquipo);
    }
    if (informacionSig) {
      finalDescription = updateDescriptionField(finalDescription, 'Información SIG-imágenes', informacionSig);
    }
    
    const card = await createTrelloCard({
      name: cardName,
      idList: targetList.id,
      desc: finalDescription,
    });

    await updateTrelloCard({
      cardId: card.id,
      cover: { color: 'red' },
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

const UpdateProjectSchema = ProjectSchema.extend({
  cardId: z.string().min(1),
});

export async function updateProject(
  prevState: ProjectState,
  formData: FormData
): Promise<ProjectState> {
   const validatedFields = UpdateProjectSchema.safeParse({
    cardId: formData.get('cardId'),
    nombre: formData.get('nombre'),
    cuenca: formData.get('cuenca'),
    partido: formData.get('partido') || '',
    diagnosticoEquipo: formData.get('diagnosticoEquipo') || '',
    informacionSig: formData.get('informacionSig') || '',
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos obligatorios. No se pudo actualizar el proyecto.',
      success: false,
    };
  }
  
  const { cardId, nombre, cuenca: newCuencaId, partido, diagnosticoEquipo, informacionSig } = validatedFields.data;

  try {
    const originalCard = await getCardById(cardId);
    
    const projectCodeMatch = originalCard.name.match(/\(([^)]+)\)$/);
    const originalProjectCode = projectCodeMatch ? projectCodeMatch[1] : '';
    
    const nameWithOldCode = originalProjectCode ? `${nombre} (${originalProjectCode})` : nombre;
    
    let newDesc = originalCard.desc || '';
    newDesc = updateDescriptionField(newDesc, 'PARTIDO', partido);
    newDesc = updateDescriptionField(newDesc, 'Diagnóstico ambiental-socioeconómico', diagnosticoEquipo);
    newDesc = updateDescriptionField(newDesc, 'Información SIG-imágenes', informacionSig);
    
    const cardAfterTextUpdate = await updateTrelloCard({
        cardId: cardId,
        name: nameWithOldCode,
        desc: newDesc,
    });

    const originalCuenca = CUENCAS.find(c => originalProjectCode?.startsWith(c.code));

    if (originalCuenca && originalCuenca.id !== newCuencaId) {
        const newSelectedCuenca = CUENCAS.find(c => c.id === newCuencaId);
        if (!newSelectedCuenca) {
            throw new Error('La nueva cuenca seleccionada no es válida.');
        }

        const newProjectCode = await getNextProjectCode(PROYECTOS_BOARD_ID, newSelectedCuenca.code);
        const finalNewName = `${nombre} (${newProjectCode})`;

        const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
        const newTargetList = lists.find(list => list.name.toLowerCase() === newSelectedCuenca.trelloListName.toLowerCase());

        if (!newTargetList) {
            throw new Error(`No se encontró la lista de Trello "${newSelectedCuenca.trelloListName}" en el tablero de Proyectos.`);
        }

        const finalUpdatedCard = await updateTrelloCard({
            cardId: cardId,
            name: finalNewName,
            idList: newTargetList.id,
        });
        
        return {
            message: `¡Proyecto actualizado y movido a la cuenca ${newSelectedCuenca.name} con éxito!`,
            success: true,
            cardUrl: finalUpdatedCard.url,
        };
    }

    return {
        message: `¡Proyecto "${cardAfterTextUpdate.name}" actualizado con éxito!`,
        success: true,
        cardUrl: cardAfterTextUpdate.url,
    };

  } catch(error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return {
      message: `Error al actualizar el proyecto: ${errorMessage}`,
      success: false,
    };
  }
}
