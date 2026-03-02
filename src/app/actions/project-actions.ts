'use server';

import { z } from 'zod';
import { CUENCAS, DESCRIPCION_PLANTILLA } from '@/lib/cuencas';
import { createTrelloCard, getNextProjectCode, updateTrelloCard, addAttachmentToTrelloCard, addCommentToCard, getListsOnBoard } from '@/services/trello';
import { createProjectFolder, shareFolderWithEmails } from '@/services/google-drive';
import { WHITELIST } from '@/lib/auth-data';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

const ProjectSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre del proyecto es obligatorio.' }),
  cuenca: z.string().min(1, { message: 'Debe seleccionar una cuenca.' }),
  partido: z.string().optional(),
  proyectista: z.string().optional(),
  financiamiento: z.string().optional(),
  diagnosticoEquipo: z.string().optional(),
  informacionSig: z.string().optional(),
  informacionDron: z.string().optional(),
  userEmail: z.string().optional(),
});

export type ProjectState = {
  message?: string;
  errors?: {
    nombre?: string[];
    cuenca?: string[];
  };
  success: boolean;
  cardUrl?: string;
  projectName?: string;
};

function updateDescriptionField(description: string, field: string, value: string): string {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^(${escapedField}:\\s*).*$`, 'm');
    const boldedValue = value ? `**${value}**` : '****';
    const replacement = `$1${boldedValue}`;

    if (regex.test(description)) {
        return description.replace(regex, replacement);
    } else if (field === '- Información SIG-imágenes:') {
        return description.replace(/^(- Diagnóstico ambiental-socioeconómico:.*)$/m, `$1\n- Información SIG-imágenes: ${boldedValue}`);
    } else if (field === '- Información LIDAR/vuelos Dron:') {
        return description.replace(/^(- Información SIG-imágenes:.*)$/m, `$1\n- Información LIDAR/vuelos Dron: ${boldedValue}`);
    }
    return description;
}

function getEmailsFromSelection(selection: string): string[] {
    if (!selection) return [];
    // Dividimos por ; o ; seguido de espacio
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

  const { nombre, cuenca: cuencaId, partido, proyectista, financiamiento, diagnosticoEquipo, informacionSig, informacionDron, userEmail } = validatedFields.data;

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
    if (partido) finalDescription = updateDescriptionField(finalDescription, 'PARTIDO', partido);
    if (proyectista) finalDescription = updateDescriptionField(finalDescription, 'PROYECTISTA', proyectista);
    if (financiamiento) finalDescription = updateDescriptionField(finalDescription, 'FINANCIAMIENTO', financiamiento);
    if (diagnosticoEquipo) finalDescription = updateDescriptionField(finalDescription, '- Diagnóstico ambiental-socioeconómico', diagnosticoEquipo);
    if (informacionSig) finalDescription = updateDescriptionField(finalDescription, '- Información SIG-imágenes', informacionSig);
    if (informacionDron) finalDescription = updateDescriptionField(finalDescription, '- Información LIDAR/vuelos Dron', informacionDron);
    
    // 1. Crear Tarjeta
    const card = await createTrelloCard({
      name: cardName,
      idList: targetList.id,
      desc: finalDescription,
    });

    // 2. Portada Roja
    await updateTrelloCard({ cardId: card.id, cover: { color: 'red' } });

    // 3. Gestión de Drive
    try {
      // 3.1 Crear carpeta
      const folderData = await createProjectFolder(folderName, cuencaId);
      
      // 3.2 Adjuntar a Trello
      await addAttachmentToTrelloCard({ cardId: card.id, url: folderData.url, name: folderName });
      
      // 4. Compartir Carpeta automáticamente con el equipo
      const emailsToShare = new Set<string>();
      
      // Añadir al creador
      if (userEmail && userEmail.includes('@')) {
        emailsToShare.add(userEmail.trim().toLowerCase());
      }
      
      // Añadir a los integrantes seleccionados
      getEmailsFromSelection(diagnosticoEquipo || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      getEmailsFromSelection(informacionSig || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      getEmailsFromSelection(informacionDron || '').forEach(e => emailsToShare.add(e.toLowerCase()));
      
      const emailList = Array.from(emailsToShare);
      if (emailList.length > 0) {
          // Esperamos a que termine el proceso de compartir
          await shareFolderWithEmails(folderData.id, emailList);
      }
    } catch (e: any) {
      console.error('Error en gestión de Drive:', e);
      // Si falla algo de Drive, dejamos un comentario detallado en la tarjeta
      await addCommentToCard({ 
        cardId: card.id, 
        text: `ATENCIÓN: No se pudo gestionar Drive automáticamente. Detalle: ${e.message || 'Error desconocido'}` 
      });
    }

    return {
      message: `¡Proyecto "${cardName}" creado con éxito!`,
      success: true,
      cardUrl: card.url,
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
    return { success: true, message: "Proyecto actualizado" };
}
