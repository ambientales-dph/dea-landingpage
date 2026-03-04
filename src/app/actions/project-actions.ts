'use server';

import { z } from 'zod';
import { CUENCAS, DESCRIPCION_PLANTILLA } from '@/lib/cuencas';
import { 
    createTrelloCard, 
    getNextProjectCode, 
    updateTrelloCard, 
    addAttachmentToTrelloCard, 
    addCommentToCard, 
    getListsOnBoard,
    getCardById
} from '@/services/trello';
import { createProjectFolder, shareFolderWithEmails } from '@/services/google-drive';
import { WHITELIST } from '@/lib/auth-data';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

const ProjectSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre del proyecto es obligatorio.' }),
  cuenca: z.string().min(1, { message: 'Debe seleccionar una cuenca.' }),
  estado: z.string().optional(),
  partido: z.string().optional(),
  proyectista: z.string().optional(),
  financiamiento: z.string().optional(),
  diagnosticoEquipo: z.string().optional(),
  informacionSig: z.string().optional(),
  informacionDron: z.string().optional(),
  userEmail: z.string().optional(),
  cardId: z.string().optional(),
});

export type ProjectState = {
  message?: string;
  errors?: {
    nombre?: string[];
    cuenca?: string[];
  };
  success: boolean;
  cardUrl?: string;
  cardId?: string;
  projectName?: string;
  isStatusChange?: boolean;
  newStatus?: string;
};

// Mapeo de estados a colores de Trello
const STATUS_COLORS: Record<string, string | null> = {
    'Sin iniciar': 'red',
    'Iniciado': 'orange',
    'Neutralizado': 'pink',
    'Terminado': 'yellow',
    'Con DIA': 'green',
    'Rescindido': 'black',
    'En seguimiento': 'sky',
};

function getTrelloColorForStatus(status: string): string | null {
    return STATUS_COLORS[status] || 'red';
}

function updateDescriptionField(description: string, field: string, value: string): string {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^(${escapedField}:\\s*).*$`, 'm');
    const boldedValue = value ? `**${value}**` : '****';
    const replacement = `${field}: ${boldedValue}`;

    if (regex.test(description)) {
        return description.replace(regex, replacement);
    } else {
        // Si el campo no existe, lo insertamos en lugares estratégicos
        if (field === 'PROYECTISTA') {
            if (description.includes('EXPEDIENTE:')) {
                return description.replace(/^(EXPEDIENTE:.*)$/m, `${field}: ${boldedValue}\n$1`);
            } else if (description.includes('#')) {
                return description.replace(/^(\s*#.*)$/m, `${field}: ${boldedValue}\n\n$1`);
            }
            return `${description}\n${field}: ${boldedValue}`;
        }
        
        if (field === 'ESTADO' && !description.includes('ESTADO:')) {
            return `ESTADO: ${boldedValue}\n${description}`;
        }
        
        if (field === '- Información SIG-imágenes:') {
            return description.replace(/^(- Diagnóstico ambiental-socioeconómico:.*)$/m, `$1\n- Información SIG-imágenes: ${boldedValue}`);
        } else if (field === '- Información LIDAR/vuelos Dron:') {
            return description.replace(/^(- Información SIG-imágenes:.*)$/m, `$1\n- Información LIDAR/vuelos Dron: ${boldedValue}`);
        }
    }
    return description;
}

function getEmailsFromSelection(selection: string): string[] {
    if (!selection) return [];
    const names = selection.split(';').map(n => n.trim()).filter(Boolean);
    return names.map(name => {
        const person = WHITELIST.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
        return person?.email;
    }).filter((email): email is string => !!email);
}

export async function createProject(
  prevState: ProjectState,
  formData: FormData
): Promise<ProjectState> {
  const validatedFields = ProjectSchema.safeParse({
    nombre: formData.get('nombre'),
    cuenca: formData.get('cuenca'),
    estado: formData.get('estado') || 'Sin iniciar',
    partido: formData.get('partido'),
    proyectista: formData.get('proyectista'),
    financiamiento: formData.get('financiamiento'),
    diagnosticoEquipo: formData.get('diagnosticoEquipo'),
    informacionSig: formData.get('informacionSig'),
    informacionDron: formData.get('informacionDron'),
    userEmail: formData.get('userEmail'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos obligatorios.',
      success: false,
    };
  }

  const { nombre, cuenca: cuencaId, estado, partido, proyectista, financiamiento, diagnosticoEquipo, informacionSig, informacionDron, userEmail } = validatedFields.data;

  try {
    const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
    if (!selectedCuenca) throw new Error('Cuenca no válida.');
    
    const projectCode = await getNextProjectCode(selectedCuenca.code);
    const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
    const targetList = lists.find(list => list.name.toLowerCase() === selectedCuenca.trelloListName.toLowerCase());

    if (!targetList) throw new Error(`No se encontró la lista "${selectedCuenca.trelloListName}".`);

    const cardName = `${nombre} (${projectCode})`;
    const folderName = `${projectCode} - ${nombre}`;
    
    let finalDescription = DESCRIPCION_PLANTILLA;
    finalDescription = updateDescriptionField(finalDescription, 'ESTADO', estado || 'Sin iniciar');
    if (partido) finalDescription = updateDescriptionField(finalDescription, 'PARTIDO', partido);
    if (proyectista) finalDescription = updateDescriptionField(finalDescription, 'PROYECTISTA', proyectista);
    if (financiamiento) finalDescription = updateDescriptionField(finalDescription, 'FINANCIAMIENTO', financiamiento);
    if (diagnosticoEquipo) finalDescription = updateDescriptionField(finalDescription, '- Diagnóstico ambiental-socioeconómico', diagnosticoEquipo);
    if (informacionSig) finalDescription = updateDescriptionField(finalDescription, '- Información SIG-imágenes', informacionSig);
    if (informacionDron) finalDescription = updateDescriptionField(finalDescription, '- Información LIDAR/vuelos Dron', informacionDron);
    
    const card = await createTrelloCard({
      name: cardName,
      idList: targetList.id,
      desc: finalDescription,
    });

    const initialColor = getTrelloColorForStatus(estado || 'Sin iniciar');
    await updateTrelloCard({ cardId: card.id, cover: { color: initialColor } });

    try {
      const folderData = await createProjectFolder(folderName, cuencaId);
      await addAttachmentToTrelloCard({ cardId: card.id, url: folderData.url, name: folderName });
      
      const emailsToShare = new Set<string>();
      if (userEmail && userEmail.includes('@')) {
        emailsToShare.add(userEmail.trim().toLowerCase());
      }
      getEmailsFromSelection(diagnosticoEquipo || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      getEmailsFromSelection(informacionSig || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      getEmailsFromSelection(informacionDron || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      
      const emailList = Array.from(emailsToShare);
      if (emailList.length > 0) {
          await shareFolderWithEmails(folderData.id, emailList);
      }
    } catch (e: any) {
      console.error('Error en gestión de Drive:', e);
      await addCommentToCard({ 
        cardId: card.id, 
        text: `ATENCIÓN: No se pudo gestionar Drive automáticamente. Detalle: ${e.message || 'Error desconocido'}` 
      });
    }

    return {
      message: `¡Proyecto "${cardName}" creado con éxito!`,
      success: true,
      cardUrl: card.url,
      cardId: card.id,
      projectName: cardName,
    };
  } catch (error) {
    return {
      message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      success: false,
    };
  }
}

export async function updateProject(prevState: ProjectState, formData: FormData): Promise<ProjectState> {
    const validatedFields = ProjectSchema.safeParse({
        nombre: formData.get('nombre'),
        cuenca: formData.get('cuenca'),
        estado: formData.get('estado'),
        partido: formData.get('partido'),
        proyectista: formData.get('proyectista'),
        financiamiento: formData.get('financiamiento'),
        diagnosticoEquipo: formData.get('diagnosticoEquipo'),
        informacionSig: formData.get('informacionSig'),
        informacionDron: formData.get('informacionDron'),
        cardId: formData.get('cardId'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Faltan campos obligatorios.',
            success: false,
        };
    }

    const { nombre, cuenca: cuencaId, estado, partido, proyectista, financiamiento, diagnosticoEquipo, informacionSig, informacionDron, cardId } = validatedFields.data;
    if (!cardId) return { success: false, message: 'ID de tarjeta no encontrado.' };

    try {
        const currentCard = await getCardById(cardId);
        const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
        if (!selectedCuenca) throw new Error('Cuenca no válida.');

        let cardName = currentCard.name;
        let idList = currentCard.idList;
        let finalDescription = currentCard.desc || DESCRIPCION_PLANTILLA;

        // Extraer estado anterior de la descripción
        const estadoRegex = /^ESTADO:\s*(?:\*\*)?(.*?)(?:\*\*)?$/m;
        const estadoMatch = finalDescription.match(estadoRegex);
        const oldStatus = estadoMatch ? estadoMatch[1].trim() : null;
        const isStatusChange = estado !== undefined && estado !== oldStatus;

        // Extraer código actual
        const codeRegex = /\(([A-Z]{3}\d{3})\)$/;
        const codeMatch = currentCard.name.match(codeRegex);
        const currentCode = codeMatch ? codeMatch[1] : null;

        // Si cambió la cuenca, generar nuevo código y mover de lista
        if (currentCode && !currentCode.startsWith(selectedCuenca.code)) {
            const newCode = await getNextProjectCode(selectedCuenca.code);
            cardName = `${nombre} (${newCode})`;
            
            const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
            const targetList = lists.find(list => list.name.toLowerCase() === selectedCuenca.trelloListName.toLowerCase());
            if (targetList) idList = targetList.id;
        } else {
            // Solo actualizar nombre, manteniendo código actual
            cardName = `${nombre} (${currentCode || 'XXX000'})`;
        }

        // Actualizar campos en la descripción
        if (estado !== undefined) finalDescription = updateDescriptionField(finalDescription, 'ESTADO', estado);
        if (partido !== undefined) finalDescription = updateDescriptionField(finalDescription, 'PARTIDO', partido);
        if (proyectista !== undefined) finalDescription = updateDescriptionField(finalDescription, 'PROYECTISTA', proyectista);
        if (financiamiento !== undefined) finalDescription = updateDescriptionField(finalDescription, 'FINANCIAMIENTO', financiamiento);
        if (diagnosticoEquipo !== undefined) finalDescription = updateDescriptionField(finalDescription, '- Diagnóstico ambiental-socioeconómico', diagnosticoEquipo);
        if (informacionSig !== undefined) finalDescription = updateDescriptionField(finalDescription, '- Información SIG-imágenes', informacionSig);
        if (informacionDron !== undefined) finalDescription = updateDescriptionField(finalDescription, '- Información LIDAR/vuelos Dron', informacionDron);

        const updatePayload: any = {
            cardId,
            name: cardName,
            desc: finalDescription,
            idList
        };

        // Si cambió el estado, actualizar el color de la portada
        if (isStatusChange && estado) {
            updatePayload.cover = { color: getTrelloColorForStatus(estado) };
            
            // Publicar hito en Trello
            const timestamp = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            await addCommentToCard({
                cardId,
                text: `📍 HITO DE PROYECTO: El estado ha cambiado de "${oldStatus || '---'}" a "${estado}". Fecha: ${timestamp}.`
            });
        }

        await updateTrelloCard(updatePayload);

        return {
            success: true,
            message: 'Proyecto actualizado con éxito.',
            cardId: cardId,
            projectName: cardName,
            isStatusChange: isStatusChange,
            newStatus: estado
        };

    } catch (error) {
        return {
            success: false,
            message: `Error al actualizar: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
    }
}
