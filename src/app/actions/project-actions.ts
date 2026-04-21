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
import { createProjectFolder, shareFolderWithEmails, extractIdFromUrl } from '@/services/google-drive';
import { WHITELIST } from '@/lib/auth-data';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

const ProjectSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre del proyecto es obligatorio.' }),
  cuenca: z.string().min(1, { message: 'Debe seleccionar una cuenca.' }),
  estado: z.string().optional(),
  partido: z.string().optional(),
  referencia: z.string().optional(),
  extension: z.string().optional(),
  poblacion: z.string().optional(),
  presupuesto: z.string().optional(),
  financiamiento: z.string().optional(),
  diagnostico: z.string().optional(),
  sig: z.string().optional(),
  dron: z.string().optional(),
  seguimiento: z.string().optional(),
  proyectista: z.string().optional(),
  expediente: z.string().optional(),
  providencia: z.string().optional(),
  resolucion: z.string().optional(),
  fechaDia: z.string().optional(),
  contratista: z.string().optional(),
  respAmbiental: z.string().optional(),
  otroDrive: z.string().optional(),
  driveProyectista: z.string().optional(),
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
 * asegurando que se respecte el orden de los campos y se preserven los datos existentes.
 */
function reconcileDescription(currentDesc: string, updates: Record<string, string>): string {
    const template = DESCRIPCION_PLANTILLA;
    const templateLines = template.split('\n');
    const currentLines = (currentDesc || '').split('\n');
    
    const fieldValues: Record<string, string> = {};

    templateLines.forEach(tLine => {
        const fieldMatch = tLine.match(/^([- ]?·?.*?:)/);
        if (fieldMatch) {
            const fieldKey = fieldMatch[1];
            const cleanKey = fieldKey.replace(/:\s*$/, '').trim();
            const existingLine = currentLines.find(cl => cl.trim().startsWith(fieldKey));
            if (existingLine) {
                const val = existingLine.substring(existingLine.indexOf(':') + 1).trim().replace(/\*\*/g, '');
                fieldValues[cleanKey] = val;
            }
        }
    });

    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fieldValues[key] = updates[key];
        }
    });

    const resultLines: string[] = [];
    templateLines.forEach(tLine => {
        const fieldMatch = tLine.match(/^([- ]?·?.*?:)/);
        if (fieldMatch) {
            const fieldKey = fieldMatch[1];
            const cleanKey = fieldKey.replace(/:\s*$/, '').trim();
            const val = fieldValues[cleanKey];
            resultLines.push(`${fieldKey}${val ? ` **${val}**` : ''}`);
        } else {
            resultLines.push(tLine);
        }
    });

    const extraLines = currentLines.filter(cl => {
        const trimmed = cl.trim();
        if (!trimmed || trimmed === '#' || trimmed.startsWith('Drive ')) return false;
        const isTemplateField = templateLines.some(tl => {
            const fm = tl.match(/^([- ]?·?.*?:)/);
            return fm && trimmed.startsWith(fm[1]);
        });
        return !isTemplateField;
    });

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
    const names = selection.split(/[,;]/).map(n => n.trim()).filter(Boolean);
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
    referencia: formData.get('referencia'),
    extension: formData.get('extension'),
    poblacion: formData.get('poblacion'),
    presupuesto: formData.get('presupuesto'),
    financiamiento: formData.get('financiamiento'),
    diagnostico: formData.get('diagnostico'),
    sig: formData.get('sig'),
    dron: formData.get('dron'),
    seguimiento: formData.get('seguimiento'),
    proyectista: formData.get('proyectista'),
    expediente: formData.get('expediente'),
    providencia: formData.get('providencia'),
    resolucion: formData.get('resolucion'),
    fechaDia: formData.get('fechaDia'),
    contratista: formData.get('contratista'),
    respAmbiental: formData.get('respAmbiental'),
    otroDrive: formData.get('otroDrive'),
    driveProyectista: formData.get('driveProyectista'),
    userEmail: formData.get('userEmail'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos obligatorios.',
      success: false,
      timestamp: Date.now()
    };
  }

  const { 
    nombre, cuenca: cuencaId, estado, partido, referencia, extension, poblacion, presupuesto, 
    financiamiento, diagnostico, sig, dron, seguimiento, proyectista, expediente, providencia, 
    resolucion, fechaDia, contratista, respAmbiental, otroDrive, driveProyectista, userEmail 
  } = validatedFields.data;

  try {
    const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
    if (!selectedCuenca) throw new Error('Cuenca no válida.');
    
    const projectCode = await getNextProjectCode(selectedCuenca.code);
    const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
    const targetList = lists.find(list => list.name.toLowerCase().trim() === selectedCuenca.trelloListName.toLowerCase().trim());

    if (!targetList) throw new Error(`No se encontró la lista de Trello "${selectedCuenca.trelloListName}".`);

    const cardName = `${nombre} (${projectCode})`;
    const folderName = `${projectCode} - ${nombre}`;
    
    const updates = {
        '·ESTADO': estado || 'Sin iniciar',
        '·PARTIDO': partido || '',
        '·REFERENCIA GEOGRÁFICA': referencia || '',
        '·EXTENSIÓN (Ha o Km)': extension || '',
        '·POBLACIÓN BENEFICIADA': poblacion || '',
        '·PRESUPUESTO': presupuesto || '',
        '·FINANCIAMIENTO': financiamiento || '',
        '·Diagnóstico ambiental-socioeconómico': diagnostico || '',
        '·Información SIG-imágenes': sig || '',
        '·Información LIDAR/vuelos Dron': dron || '',
        '·Seguimiento de obra': seguimiento || '',
        '·Proyectista': proyectista || '',
        '·EXPEDIENTE': expediente || '',
        '·PROVIDENCIA': providencia || '',
        '·RESOLUCIÓN': resolucion || '',
        '·FECHA DIA': fechaDia || '',
        '·CONTRATISRA': contratista || '',
        '·RESPONSABLE AMBIENTAL': respAmbiental || '',
        '·Otro Drive de trabajo': otroDrive || '',
        '·Drive del proyectista': driveProyectista || ''
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
      if (selectedCuenca.driveFolderId) {
        const folderData = await createProjectFolder(folderName, cuencaId);
        await addAttachmentToTrelloCard({ cardId: card.id, url: folderData.url, name: folderName });
        
        const emailsToShare = new Set<string>();
        if (userEmail && userEmail.includes('@')) emailsToShare.add(userEmail.trim().toLowerCase());
        getEmailsFromSelection(diagnostico || '').forEach(e => emailsToShare.add(e.toLowerCase()));
        getEmailsFromSelection(sig || '').forEach(e => emailsToShare.add(e.toLowerCase()));
        getEmailsFromSelection(dron || '').forEach(e => emailsToShare.add(e.toLowerCase()));
        
        const emailList = Array.from(emailsToShare);
        if (emailList.length > 0) await shareFolderWithEmails(folderData.id, emailList);
      }
    } catch (e: any) {
      console.error('Error en gestión de Drive:', e);
    }

    return {
      message: `¡Proyecto "${cardName}" creado con éxito!`,
      success: true,
      cardUrl: card.url,
      cardId: card.id,
      projectName: cardName,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    return {
      message: `Error al crear: ${error.message || 'Error desconocido'}`,
      success: false,
      timestamp: Date.now()
    };
  }
}

export async function updateProject(prevState: ProjectState, formData: FormData): Promise<ProjectState> {
    const validatedFields = ProjectSchema.safeParse({
        nombre: formData.get('nombre'),
        cuenca: formData.get('cuenca'),
        estado: formData.get('estado'),
        partido: formData.get('partido'),
        referencia: formData.get('referencia'),
        extension: formData.get('extension'),
        poblacion: formData.get('poblacion'),
        presupuesto: formData.get('presupuesto'),
        financiamiento: formData.get('financiamiento'),
        diagnostico: formData.get('diagnostico'),
        sig: formData.get('sig'),
        dron: formData.get('dron'),
        seguimiento: formData.get('seguimiento'),
        proyectista: formData.get('proyectista'),
        expediente: formData.get('expediente'),
        providencia: formData.get('providencia'),
        resolucion: formData.get('resolucion'),
        fechaDia: formData.get('fechaDia'),
        contratista: formData.get('contratista'),
        respAmbiental: formData.get('respAmbiental'),
        otroDrive: formData.get('otroDrive'),
        driveProyectista: formData.get('driveProyectista'),
        cardId: formData.get('cardId'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Faltan campos obligatorios.',
            success: false,
            timestamp: Date.now()
        };
    }

    const { 
        nombre, cuenca: cuencaId, estado, partido, referencia, extension, poblacion, presupuesto,
        financiamiento, diagnostico, sig, dron, seguimiento, proyectista, expediente, providencia,
        resolucion, fechaDia, contratista, respAmbiental, otroDrive, driveProyectista, cardId 
    } = validatedFields.data;
    
    if (!cardId) return { success: false, message: 'ID de tarjeta no encontrado.', timestamp: Date.now() };

    try {
        const currentCard = await getCardById(cardId);
        const selectedCuenca = CUENCAS.find(c => c.id === cuencaId);
        if (!selectedCuenca) throw new Error('Cuenca no válida.');

        const oldDesc = currentCard.desc || '';
        
        const updates: Record<string, string> = {
            '·ESTADO': estado || '',
            '·PARTIDO': partido || '',
            '·REFERENCIA GEOGRÁFICA': referencia || '',
            '·EXTENSIÓN (Ha o Km)': extension || '',
            '·POBLACIÓN BENEFICIADA': poblacion || '',
            '·PRESUPUESTO': presupuesto || '',
            '·FINANCIAMIENTO': financiamiento || '',
            '·Diagnóstico ambiental-socioeconómico': diagnostico || '',
            '·Información SIG-imágenes': sig || '',
            '·Información LIDAR/vuelos Dron': dron || '',
            '·Seguimiento de obra': seguimiento || '',
            '·Proyectista': proyectista || '',
            '·EXPEDIENTE': expediente || '',
            '·PROVIDENCIA': providencia || '',
            '·RESOLUCIÓN': resolucion || '',
            '·FECHA DIA': fechaDia || '',
            '·CONTRATISRA': contratista || '',
            '·RESPONSABLE AMBIENTAL': respAmbiental || '',
            '·Otro Drive de trabajo': otroDrive || '',
            '·Drive del proyectista': driveProyectista || ''
        };

        const finalDescription = reconcileDescription(oldDesc, updates);

        const isStatusChange = estado !== undefined && !oldDesc.includes(`·ESTADO: **${estado}**`);

        let cardName = currentCard.name;
        let idList = currentCard.idList;

        const codeRegex = /\(([A-Z]{2,4}\d{3})\)$/;
        const codeMatch = currentCard.name.match(codeRegex);
        const currentCode = codeMatch ? codeMatch[1] : null;

        if (currentCode && !currentCode.startsWith(selectedCuenca.code)) {
            const newCode = await getNextProjectCode(selectedCuenca.code);
            cardName = `${nombre} (${newCode})`;
            const lists = await getListsOnBoard(PROYECTOS_BOARD_ID);
            const targetList = lists.find(list => list.name.toLowerCase().trim() === selectedCuenca.trelloListName.toLowerCase().trim());
            if (targetList) idList = targetList.id;
        } else {
            cardName = `${nombre} (${currentCode || 'XXX000'})`;
        }

        const updatePayload: any = {
            cardId,
            name: cardName,
            desc: finalDescription,
            idList
        };

        if (isStatusChange && estado) {
            updatePayload.cover = { color: getTrelloColorForStatus(estado) };
            const timestampStr = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            await addCommentToCard({
                cardId,
                text: `📍 HITO DE PROYECTO: El estado ha cambiado a "${estado}". Fecha: ${timestampStr}.`
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

    } catch (error: any) {
        return {
            success: false,
            message: `Error al actualizar: ${error.message || 'Error desconocido'}`,
            timestamp: Date.now()
        };
    }
}
