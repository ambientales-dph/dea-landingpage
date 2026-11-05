'use server';

import { getAdminFirestore } from '@/firebase/admin';
import { CUENCAS, extractFieldFromDesc } from '@/lib/cuencas';

const PROYECTOS_BOARD_ID = 'CgG4b3B0';

export interface TrelloBoard {
  id: string;
  name: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  bytes?: number;
  date?: string;
  fileName?: string;
  mimeType?: string;
  previews: {
    id: string;
    url: string;
    width: number;
    height: number;
  }[];
}

export interface TrelloCard {
  id: string;
  name: string;
  url: string;
  desc: string;
  boardId: string;
  boardName: string;
  idList: string;
  listName?: string;
  closed?: boolean;
  cover: {
    color: string | null;
  } | null;
  labels: TrelloLabel[];
  attachments: TrelloAttachment[];
}

export interface TrelloAction {
  id: string;
  data: {
    text?: string;
    listBefore?: { id?: string; name: string };
    listAfter?: { id?: string; name: string };
    old?: {
      name?: string;
      desc?: string;
    };
  };
  type: string;
  date: string;
  memberCreator: {
    id: string;
    avatarUrl: string | null;
    fullName: string;
    username: string;
  };
}

export interface TrelloBoardAction {
  id: string;
  data: {
    text?: string;
    card: { id: string; name: string; idShort: number };
    board: { id: string; name: string };
    list?: { id: string; name: string };
    listBefore?: { name: string };
    listAfter?: { name: string };
    old?: {
      name?: string;
      desc?: string;
      idList?: string;
    };
  };
  type: string;
  date: string;
  memberCreator: {
    id: string;
    avatarUrl: string | null;
    fullName: string;
    username: string;
  };
}

function generateObjectIdWithTimestamp(): string {
  const tsHex = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  let randHex = '';
  for (let i = 0; i < 16; i++) {
    randHex += Math.floor(Math.random() * 16).toString(16);
  }
  return `${tsHex}${randHex}`;
}

function parseStructuredFields(desc: string) {
  return {
    estado: extractFieldFromDesc(desc, '·ESTADO') || extractFieldFromDesc(desc, 'ESTADO') || 'Sin iniciar',
    partido: extractFieldFromDesc(desc, '·PARTIDO') || extractFieldFromDesc(desc, 'PARTIDO') || '',
    referencia:
      extractFieldFromDesc(desc, '·REFERENCIA GEOGRÁFICA') ||
      extractFieldFromDesc(desc, 'REFERENCIA GEOGRÁFICA') ||
      '',
    extension:
      extractFieldFromDesc(desc, '·EXTENSIÓN (Ha o Km)') ||
      extractFieldFromDesc(desc, 'EXTENSIÓN (Ha o Km)') ||
      '',
    poblacion:
      extractFieldFromDesc(desc, '·POBLACIÓN BENEFICIADA') ||
      extractFieldFromDesc(desc, 'POBLACION BENEFICIADA') ||
      '',
    presupuesto:
      extractFieldFromDesc(desc, '·PRESUPUESTO') || extractFieldFromDesc(desc, 'MONTO OBRA') || '',
    financiamiento:
      extractFieldFromDesc(desc, '·FINANCIAMIENTO') || extractFieldFromDesc(desc, 'Financiamiento') || '',
    diagnostico:
      extractFieldFromDesc(desc, '·Diagnóstico ambiental-socioeconómico') ||
      extractFieldFromDesc(desc, 'Diagnóstico ambiental-socioeconómico') ||
      '',
    sig:
      extractFieldFromDesc(desc, '·Información SIG-imágenes') ||
      extractFieldFromDesc(desc, 'Información SIG-imágenes') ||
      '',
    dron:
      extractFieldFromDesc(desc, '·Información LIDAR/vuelos Dron') ||
      extractFieldFromDesc(desc, 'Información LIDAR/vuelos Dron') ||
      '',
    seguimiento: extractFieldFromDesc(desc, '·Seguimiento de obra') || '',
    proyectista:
      extractFieldFromDesc(desc, '·Proyectista') || extractFieldFromDesc(desc, 'PROYECTISTA') || '',
    expediente: extractFieldFromDesc(desc, '·EXPEDIENTE') || extractFieldFromDesc(desc, 'EXPTE') || '',
    providencia: extractFieldFromDesc(desc, '·PROVIDENCIA') || '',
    resolucion:
      extractFieldFromDesc(desc, '·RESOLUCIÓN') || extractFieldFromDesc(desc, 'RESOL. DIA') || '',
    fechaDia: extractFieldFromDesc(desc, '·FECHA DIA') || extractFieldFromDesc(desc, 'FECHA DIA') || '',
    contratista:
      extractFieldFromDesc(desc, '·CONTRATISRA') || extractFieldFromDesc(desc, 'CONTRATISTA') || '',
    respAmbiental: extractFieldFromDesc(desc, '·RESPONSABLE AMBIENTAL') || '',
    otroDrive:
      extractFieldFromDesc(desc, '·Otro Drive de trabajo') ||
      extractFieldFromDesc(desc, 'Drive de trabajo') ||
      '',
    driveProyectista: extractFieldFromDesc(desc, '·Drive del proyectista') || '',
    coordinadas: extractFieldFromDesc(desc, '·COORDINADAS') || '',
  };
}

function mapDocToCard(id: string, data: FirebaseFirestore.DocumentData): TrelloCard {
  return {
    id,
    name: data.name || '',
    url: data.url || data.trelloUrl || '',
    desc: data.desc || '',
    boardId: data.boardId || '',
    boardName: data.boardName || 'PROYECTOS DEAS',
    idList: data.idList || '',
    listName: data.listName || '',
    closed: Boolean(data.closed),
    cover: data.cover || { color: null },
    labels: Array.isArray(data.labels) ? data.labels : [],
    attachments: Array.isArray(data.attachments)
      ? data.attachments.map((a: any) => ({
          id: a.id,
          name: a.name || a.fileName || 'Adjunto',
          fileName: a.fileName || a.name || 'Adjunto',
          url: a.url || '',
          bytes: a.bytes || 0,
          date: a.date || '',
          mimeType: a.mimeType || '',
          previews: Array.isArray(a.previews) ? a.previews : [],
        }))
      : [],
  };
}

async function resolveBoardDoc(boardIdOrShortLink: string) {
  const db = getAdminFirestore();
  const directSnap = await db.collection('project_boards').doc(boardIdOrShortLink).get();
  if (directSnap.exists) return directSnap;

  const byShortLink = await db
    .collection('project_boards')
    .where('shortLink', '==', boardIdOrShortLink)
    .limit(1)
    .get();
  if (!byShortLink.empty) return byShortLink.docs[0];

  const allBoards = await db.collection('project_boards').limit(1).get();
  if (!allBoards.empty) return allBoards.docs[0];
  return null;
}

export async function verifyTrelloConnection(): Promise<string> {
  try {
    const db = getAdminFirestore();
    await db.collection('projects').limit(1).get();
    return 'Base de Datos Firestore DEA';
  } catch (error) {
    throw new Error('Hubo un problema al conectar con la base de datos de proyectos.');
  }
}

export async function getAllRecentActions(hours: number = 8): Promise<TrelloBoardAction[]> {
  try {
    const db = getAdminFirestore();
    const sinceTime = Date.now() - hours * 60 * 60 * 1000;
    const snap = await db.collection('projects').get();
    const result: TrelloBoardAction[] = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const actions: any[] = Array.isArray(data.actions) ? data.actions : [];
      for (const act of actions) {
        const actTime = new Date(act.date || 0).getTime();
        if (actTime >= sinceTime) {
          result.push({
            id: act.id,
            type: act.type,
            date: act.date,
            data: {
              ...act.data,
              card: act.data?.card || { id: docSnap.id, name: data.name, idShort: 0 },
              board: act.data?.board || { id: data.boardId, name: data.boardName },
            },
            memberCreator: act.memberCreator || {
              id: 'portal',
              avatarUrl: null,
              fullName: 'Usuario DEA',
              username: 'dea',
            },
          });
        }
      }
    });

    const uniqueMap = new Map<string, TrelloBoardAction>();
    result.forEach(a => uniqueMap.set(a.id, a));
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (error) {
    return [];
  }
}

export async function getCardById(cardId: string): Promise<TrelloCard> {
  const db = getAdminFirestore();
  const docSnap = await db.collection('projects').doc(cardId).get();
  if (!docSnap.exists) {
    throw new Error(`Proyecto ${cardId} no encontrado en Firestore.`);
  }
  return mapDocToCard(docSnap.id, docSnap.data()!);
}

export async function getTrelloBoards(): Promise<TrelloBoard[]> {
  const db = getAdminFirestore();
  const snap = await db.collection('project_boards').get();
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name || d.id,
  }));
}

export async function getCardsFromBoard(boardId: string): Promise<TrelloCard[]> {
  const db = getAdminFirestore();
  const boardDoc = await resolveBoardDoc(boardId);
  const realBoardId = boardDoc ? boardDoc.id : boardId;

  const snap = await db.collection('projects').where('boardId', '==', realBoardId).get();
  return snap.docs
    .map(d => mapDocToCard(d.id, d.data()))
    .filter(c => !c.closed)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllCardsFromAllBoards(): Promise<TrelloCard[]> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('projects').get();
    const cards = snap.docs
      .map(d => mapDocToCard(d.id, d.data()))
      .filter(c => !c.closed);

    return cards.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to get projects from Firestore:', error);
    throw new Error('Error al cargar proyectos desde la base de datos.');
  }
}

export async function updateTrelloCard({
  cardId,
  name,
  desc,
  cover,
  idBoard,
  idList,
}: {
  cardId: string;
  name?: string;
  desc?: string;
  cover?: { color: string | null };
  idBoard?: string;
  idList?: string;
}): Promise<TrelloCard> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(cardId);
  const currentSnap = await docRef.get();
  if (!currentSnap.exists) {
    throw new Error(`Proyecto ${cardId} no encontrado.`);
  }
  const currentData = currentSnap.data()!;
  const updates: Record<string, any> = {
    dateLastActivity: new Date().toISOString(),
  };

  if (name !== undefined) {
    updates.name = name;
    const codeMatch = name.match(/\(([A-Z]{2,4}\d{3})\)$/);
    if (codeMatch) {
      const code = codeMatch[1];
      updates.code = code;
      const prefix = code.match(/^([A-Z]{2,4})\d{3}$/)?.[1] || '';
      updates.cuencaCode = prefix;
      const cuencaObj = CUENCAS.find(c => c.code === prefix);
      if (cuencaObj) updates.cuencaId = cuencaObj.id;
    }
  }

  if (desc !== undefined) {
    updates.desc = desc;
    updates.fields = parseStructuredFields(desc);
  }

  if (cover !== undefined) {
    updates.cover = cover;
  }

  if (idBoard !== undefined) {
    const boardDoc = await resolveBoardDoc(idBoard);
    if (boardDoc) {
      updates.boardId = boardDoc.id;
      updates.boardName = boardDoc.data()?.name || currentData.boardName;
    } else {
      updates.boardId = idBoard;
    }
  }

  if (idList !== undefined && idList !== currentData.idList) {
    updates.idList = idList;
    const targetBoardId = updates.boardId || currentData.boardId;
    const boardDoc = await resolveBoardDoc(targetBoardId);
    const lists: any[] = boardDoc?.data()?.lists || [];
    const matchedList = lists.find(l => l.id === idList);
    if (matchedList) {
      updates.listName = matchedList.name;
      const moveAction: TrelloAction = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'updateCard',
        date: new Date().toISOString(),
        data: {
          listBefore: { id: currentData.idList, name: currentData.listName || 'Lista anterior' },
          listAfter: { id: idList, name: matchedList.name },
        },
        memberCreator: {
          id: 'portal',
          avatarUrl: null,
          fullName: 'Portal DEA',
          username: 'portal_dea',
        },
      };
      updates.actions = [moveAction, ...(Array.isArray(currentData.actions) ? currentData.actions : [])];
    }
  }

  await docRef.set(updates, { merge: true });
  const updatedSnap = await docRef.get();
  return mapDocToCard(updatedSnap.id, updatedSnap.data()!);
}

export async function getCardActivity(cardId: string): Promise<TrelloAction[]> {
  const db = getAdminFirestore();
  const docSnap = await db.collection('projects').doc(cardId).get();
  if (!docSnap.exists) return [];
  const data = docSnap.data()!;
  const actions: TrelloAction[] = Array.isArray(data.actions) ? data.actions : [];
  return [...actions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function addCommentToCard({
  cardId,
  text,
  authorName,
}: {
  cardId: string;
  text: string;
  authorName?: string;
}): Promise<TrelloAction> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(cardId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new Error(`Proyecto ${cardId} no encontrado.`);
  }
  const data = docSnap.data()!;
  const newAction: TrelloAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'commentCard',
    date: new Date().toISOString(),
    data: { text },
    memberCreator: {
      id: 'portal-user',
      avatarUrl: null,
      fullName: authorName || 'Usuario DEA',
      username: 'dea',
    },
  };

  const existingActions = Array.isArray(data.actions) ? data.actions : [];
  await docRef.set(
    {
      actions: [newAction, ...existingActions],
      dateLastActivity: newAction.date,
    },
    { merge: true }
  );

  return newAction;
}

export interface AddAttachmentPayload {
  cardId: string;
  url: string;
  name?: string;
}

export async function addAttachmentToTrelloCard(payload: AddAttachmentPayload): Promise<TrelloAttachment> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(payload.cardId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new Error(`Proyecto ${payload.cardId} no encontrado.`);
  }
  const data = docSnap.data()!;
  const newAttachment: TrelloAttachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: payload.name || payload.url,
    fileName: payload.name || payload.url,
    url: payload.url,
    bytes: 0,
    date: new Date().toISOString(),
    mimeType: payload.url.includes('drive.google.com/drive/folders')
      ? 'application/vnd.google-apps.folder'
      : 'text/uri-list',
    previews: [],
  };

  const existingAttachments = Array.isArray(data.attachments) ? data.attachments : [];
  await docRef.set(
    {
      attachments: [...existingAttachments, newAttachment],
      dateLastActivity: new Date().toISOString(),
    },
    { merge: true }
  );

  return newAttachment;
}

export async function removeAttachmentFromTrelloCard({
  cardId,
  attachmentId,
}: {
  cardId: string;
  attachmentId: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(cardId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return;
  const data = docSnap.data()!;
  const existingAttachments: any[] = Array.isArray(data.attachments) ? data.attachments : [];
  await docRef.set(
    {
      attachments: existingAttachments.filter(a => a.id !== attachmentId),
      dateLastActivity: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
  const boardDoc = await resolveBoardDoc(boardId);
  if (!boardDoc) return [];
  const data = boardDoc.data();
  return Array.isArray(data?.labels) ? data.labels : [];
}

export async function addLabelToCard({ cardId, labelId }: { cardId: string; labelId: string }): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(cardId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return;
  const data = docSnap.data()!;
  const labels: TrelloLabel[] = Array.isArray(data.labels) ? data.labels : [];
  if (labels.some(l => l.id === labelId)) return;

  const boardLabels = await getBoardLabels(data.boardId);
  const foundLabel = boardLabels.find(l => l.id === labelId);
  if (foundLabel) {
    await docRef.set({ labels: [...labels, foundLabel] }, { merge: true });
  }
}

export async function removeLabelFromCard({
  cardId,
  labelId,
}: {
  cardId: string;
  labelId: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection('projects').doc(cardId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return;
  const data = docSnap.data()!;
  const labels: TrelloLabel[] = Array.isArray(data.labels) ? data.labels : [];
  await docRef.set({ labels: labels.filter(l => l.id !== labelId) }, { merge: true });
}

export async function getListsOnBoard(boardId: string): Promise<{ id: string; name: string }[]> {
  const boardDoc = await resolveBoardDoc(boardId || PROYECTOS_BOARD_ID);
  if (boardDoc) {
    const lists: any[] = boardDoc.data()?.lists || [];
    return lists.filter(l => !l.closed).map(l => ({ id: l.id, name: l.name }));
  }
  return CUENCAS.map(c => ({ id: c.id, name: c.trelloListName }));
}

export async function getNextProjectCode(cuencaCode: string): Promise<string> {
  const cards = await getAllCardsFromAllBoards();
  const codeRegex = new RegExp(`\\((${cuencaCode}(\\d{3}))\\)`);
  let maxNum = 0;

  for (const card of cards) {
    const match = card.name.match(codeRegex);
    if (match && match[2]) {
      const num = parseInt(match[2], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${cuencaCode}${(maxNum + 1).toString().padStart(3, '0')}`;
}

export async function createTrelloCard(cardInfo: {
  name: string;
  idList: string;
  desc: string;
}): Promise<TrelloCard> {
  const db = getAdminFirestore();
  const newId = generateObjectIdWithTimestamp();

  const boardDoc = await resolveBoardDoc(PROYECTOS_BOARD_ID);
  const boardId = boardDoc ? boardDoc.id : PROYECTOS_BOARD_ID;
  const boardName = boardDoc ? boardDoc.data()?.name || 'PROYECTOS DEAS' : 'PROYECTOS DEAS';
  const lists: any[] = boardDoc?.data()?.lists || [];
  const matchedList = lists.find(l => l.id === cardInfo.idList);

  const codeMatch = cardInfo.name.match(/\(([A-Z]{2,4}\d{3})\)$/);
  const projectCode = codeMatch ? codeMatch[1] : '';
  const cuencaPrefix = projectCode.match(/^([A-Z]{2,4})\d{3}$/)?.[1] || '';
  const cuencaObj = CUENCAS.find(c => c.code === cuencaPrefix);

  const nowIso = new Date().toISOString();
  const projectDoc = {
    id: newId,
    code: projectCode,
    cuencaId: cuencaObj?.id || '',
    cuencaCode: cuencaPrefix,
    name: cardInfo.name,
    url: '',
    trelloUrl: '',
    desc: cardInfo.desc || '',
    boardId,
    boardName,
    idList: cardInfo.idList,
    listName: matchedList?.name || cuencaObj?.trelloListName || '',
    closed: false,
    cover: { color: 'red' },
    labels: [],
    attachments: [],
    actions: [],
    fields: parseStructuredFields(cardInfo.desc || ''),
    createdAt: nowIso,
    dateLastActivity: nowIso,
  };

  await db.collection('projects').doc(newId).set(projectDoc);
  return mapDocToCard(newId, projectDoc);
}
