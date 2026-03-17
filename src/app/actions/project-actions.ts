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
  timestamp?: number;
};

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

/**
 * Reconcilia la descripción actual de una tarjeta con la plantilla maestra,
 * asegurando que se respete el orden de los campos y se preserven los datos existentes.
 */
function reconcileDescription(currentDesc: string, updates: Record<string, string>): string {
    const template = DESCRIPCION_PLANTILLA;
    const templateLines = template.split('\n');
    const currentLines = (currentDesc || '').split('\n');
    
    // Almacén de valores finales para cada campo identificado en la plantilla
    const fieldValues: Record<string, string> = {};

    // 1. Identificar todos los campos en la plantilla y extraer sus valores actuales si existen
    templateLines.forEach(tLine => {
        const fieldMatch = tLine.match(/^([- ]?.*?:)/);
        if (fieldMatch) {
            const fieldKey = fieldMatch[1]; // ej: "ESTADO:" o "- Proyectista:"
            const cleanKey = fieldKey.replace(/:\s*$/, '').trim();
            
            // Buscar este campo en la descripción actual (ignorando espacios iniciales)
            const existingLine = currentLines.find(cl => cl.trim().startsWith(fieldKey));
            if (existingLine) {
                const val = existingLine.substring(existingLine.indexOf(':') + 1).trim().replace(/\*\*/g, '');
                fieldValues[cleanKey] = val;
            }
        }
    });

    // 2. Sobrescribir con las nuevas actualizaciones del formulario
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fieldValues[key] = updates[key];
        }
    });

    // 3. Reconstruir la descripción usando la plantilla como esqueleto
    const resultLines: string[] = [];
    templateLines.forEach(tLine => {
        const fieldMatch = tLine.match(/^([- ]?.*?:)/);
        if (fieldMatch) {
            const fieldKey = fieldMatch[1];
            const cleanKey = fieldKey.replace(/:\s*$/, '').trim();
            const val = fieldValues[cleanKey];
            // Aseguramos el formato: "CAMPO: **VALOR**" o "CAMPO: " si está vacío
            resultLines.push(`${fieldKey}${val ? ` **${val}**` : ''}`);
        } else {
            // Es una línea en blanco, un encabezado, info de Drive o el marcador #
            resultLines.push(tLine);
        }
    });

    // 4. Preservar líneas de la descripción actual que NO son campos de la plantilla
    // Esto evita perder información manual (ej. comentarios extras, links manuales)
    const extraLines = currentLines.filter(cl => {
        const trimmed = cl.trim();
        if (!trimmed) return false;
        if (trimmed === '#') return false;
        if (trimmed.startsWith('Drive ')) return false;
        
        // ¿Es un campo de la plantilla?
        const isTemplateField = templateLines.some(tl => {
            const fm = tl.match(/^([- ]?.*?:)/);
            return fm && trimmed.startsWith(fm[1]);
        });
        
        return !isTemplateField;
    });

    // Insertar líneas extra antes del hashtag si es posible, para mantener el orden visual
    if (extraLines.length > 0) {
        const hashtagIndex = resultLines.findIndex(rl => rl.trim() === '#');
        if (hashtagIndex !== -1) {
            resultLines.splice(hashtagIndex, 0, ...extraLines, '');
        } else {
            resultLines.push('', ...extraLines);
        }
    }

    return resultLines.join('\n').trim();
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
    
    // Usar la nueva lógica de reconciliación para generar la descripción inicial
    const updates = {
        'ESTADO': estado || 'Sin iniciar',
        'PARTIDO': partido || '',
        '- Proyectista': proyectista || '',
        'FINANCIAMIENTO': financiamiento || '',
        '- Diagnóstico ambiental-socioeconómico': diagnosticoEquipo || '',
        '- Información SIG-imágenes': informacionSig || '',
        '- Información LIDAR/vuelos Dron': informacionDron || ''
    };
    const finalDescription = reconcileDescription('', updates);
    
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
      timestamp: Date.now(),
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

        // Extraer estado anterior de la descripción usando la lógica por línea
        const lines = (currentCard.desc || '').split('\n');
        let oldStatus = null;
        for (const line of lines) {
            if (line.trim().startsWith('ESTADO:')) {
                oldStatus = line.split(':')[1].trim().replace(/\*\*/g, '');
                if (oldStatus === '') oldStatus = null;
                break;
            }
        }
        
        const isStatusChange = estado !== undefined && estado !== oldStatus;

        // Extraer código actual (Soporta de 2 a 4 letras seguidas de dígitos)
        const codeRegex = /\(([A-Z]{2,4}\d{3})\)$/;
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
            cardName = `${nombre} (${currentCode || 'XXX000'})`;
        }

        // Aplicar la lógica de reconciliación para mantener el orden estricto de la plantilla
        const updates: Record<string, string> = {};
        if (estado !== undefined) updates['ESTADO'] = estado;
        if (partido !== undefined) updates['PARTIDO'] = partido;
        if (proyectista !== undefined) updates['- Proyectista'] = proyectista;
        if (financiamiento !== undefined) updates['FINANCIAMIENTO'] = financiamiento;
        if (diagnosticoEquipo !== undefined) updates['- Diagnóstico ambiental-socioeconómico'] = diagnosticoEquipo;
        if (informacionSig !== undefined) updates['- Información SIG-imágenes'] = informacionSig;
        if (informacionDron !== undefined) updates['- Información LIDAR/vuelos Dron'] = informacionDron;

        const finalDescription = reconcileDescription(currentCard.desc || '', updates);

        const updatePayload: any = {
            cardId,
            name: cardName,
            desc: finalDescription,
            idList
        };

        if (isStatusChange && estado) {
            updatePayload.cover = { color: getTrelloColorForStatus(estado) };
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
            newStatus: estado,
            timestamp: Date.now(),
        };

    } catch (error) {
        return {
            success: false,
            message: `Error al actualizar: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
    }
}
