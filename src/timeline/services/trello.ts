'use server';

import { getAdminFirestore } from '@/firebase/admin';
import { extractFieldFromDesc } from '@/lib/cuencas';

export interface TrelloBoardSummary {
  name: string;
  lists: { id: string; name: string; cards: { id: string; name: string; due: string | null }[] }[];
}

export interface TrelloBoard {
  id: string;
  name: string;
}

export interface TrelloListBasic {
  id: string;
  name: string;
}

export interface TrelloCardBasic {
  id: string;
  name: string;
  url: string;
  desc?: string;
  idBoard?: string;
  idList?: string;
}

export interface TrelloAttachment {
  id: string;
  bytes: number;
  date: string;
  fileName: string;
  mimeType: string;
  url: string;
}

export interface TrelloAction {
  id: string;
  data: {
    text?: string;
    listBefore?: { id: string; name: string };
    listAfter?: { id: string; name: string };
    board: { id: string; name: string };
    card: { id: string; name: string };
  };
  type: 'commentCard' | 'updateCard';
  date: string;
  memberCreator: { id: string; fullName: string };
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
  return null;
}

export async function getBoardSummary(boardId: string): Promise<TrelloBoardSummary | null> {
  try {
    const db = getAdminFirestore();
    const boardDoc = await resolveBoardDoc(boardId);
    if (!boardDoc) return null;
    const bData = boardDoc.data()!;
    const lists: any[] = (bData.lists || []).filter((l: any) => !l.closed);

    const cardsSnap = await db.collection('projects').where('boardId', '==', boardDoc.id).get();
    const cardsByList = new Map<string, { id: string; name: string; due: string | null }[]>();
    cardsSnap.forEach(docSnap => {
      const c = docSnap.data();
      if (c.closed) return;
      if (!cardsByList.has(c.idList)) cardsByList.set(c.idList, []);
      cardsByList.get(c.idList)!.push({
        id: docSnap.id,
        name: c.name || '',
        due: null,
      });
    });

    return {
      name: bData.name || boardId,
      lists: lists.map(l => ({
        id: l.id,
        name: l.name,
        cards: cardsByList.get(l.id) || [],
      })),
    };
  } catch (error) {
    console.error('Error getting board summary from Firestore:', error);
    return null;
  }
}

export async function getMemberBoards(): Promise<{ boards: TrelloBoard[]; isConfigured: boolean }> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('project_boards').get();
    const boards = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name || d.id,
    }));
    return { boards, isConfigured: true };
  } catch (error) {
    console.error('Error loading boards from Firestore:', error);
    return { boards: [], isConfigured: false };
  }
}

export async function getBoardLists(boardId: string): Promise<TrelloListBasic[]> {
  try {
    const boardDoc = await resolveBoardDoc(boardId);
    if (!boardDoc) return [];
    const lists: any[] = boardDoc.data()?.lists || [];
    return lists
      .filter(l => !l.closed)
      .map(l => ({ id: l.id, name: l.name }));
  } catch (error) {
    return [];
  }
}

export async function getCardsInList(listId: string): Promise<TrelloCardBasic[]> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('projects').where('idList', '==', listId).get();
    return snap.docs
      .filter(d => !d.data().closed)
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          url: data.url || data.trelloUrl || '',
          desc: data.desc || '',
          idBoard: data.boardId || '',
          idList: data.idList || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    return [];
  }
}

export async function getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
  try {
    const db = getAdminFirestore();
    const docSnap = await db.collection('projects').doc(cardId).get();
    if (!docSnap.exists) return [];
    const attachments: any[] = docSnap.data()?.attachments || [];
    return attachments.map(att => ({
      id: att.id,
      bytes: Number(att.bytes || 0),
      date: att.date || new Date().toISOString(),
      fileName: att.fileName || att.name || 'Adjunto',
      mimeType: att.mimeType || 'application/octet-stream',
      url: att.url || '',
    }));
  } catch (error) {
    return [];
  }
}

export async function getCardActions(cardId: string): Promise<TrelloAction[]> {
  try {
    const db = getAdminFirestore();
    const docSnap = await db.collection('projects').doc(cardId).get();
    if (!docSnap.exists) return [];
    const data = docSnap.data()!;
    const actions: any[] = Array.isArray(data.actions) ? data.actions : [];
    return actions
      .filter(a => a.type === 'commentCard' || a.type === 'updateCard')
      .slice(0, 150)
      .map(a => ({
        id: a.id,
        type: a.type,
        date: a.date,
        data: {
          ...a.data,
          board: a.data?.board || { id: data.boardId || '', name: data.boardName || '' },
          card: a.data?.card || { id: cardId, name: data.name || '' },
        },
        memberCreator: {
          id: a.memberCreator?.id || 'portal',
          fullName: a.memberCreator?.fullName || 'Usuario DEA',
        },
      }));
  } catch (error) {
    return [];
  }
}

export async function searchTrelloCards(query: string): Promise<TrelloCardBasic[]> {
  try {
    const db = getAdminFirestore();
    const norm = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!norm) return [];

    const snap = await db.collection('projects').get();
    const matches: TrelloCardBasic[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.closed) return;
      const hay = `${data.name || ''} ${data.code || ''} ${data.desc || ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (hay.includes(norm)) {
        matches.push({
          id: docSnap.id,
          name: data.name || '',
          url: data.url || data.trelloUrl || '',
          desc: data.desc || '',
          idBoard: data.boardId || '',
          idList: data.idList || '',
        });
      }
    });
    return matches.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  } catch (error) {
    return [];
  }
}

export async function getCardById(cardId: string): Promise<TrelloCardBasic | null> {
  try {
    const db = getAdminFirestore();
    const docSnap = await db.collection('projects').doc(cardId).get();
    if (!docSnap.exists) return null;
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      name: data.name || '',
      url: data.url || data.trelloUrl || '',
      desc: data.desc || '',
      idBoard: data.boardId || '',
      idList: data.idList || '',
    };
  } catch (error) {
    return null;
  }
}

export async function updateTrelloCard(
  cardId: string,
  data: { name?: string; desc?: string }
): Promise<TrelloCardBasic | null> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('projects').doc(cardId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;

    const updates: Record<string, any> = {
      dateLastActivity: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.desc !== undefined) {
      updates.desc = data.desc;
      updates.fields = {
        ...(docSnap.data()?.fields || {}),
        estado:
          extractFieldFromDesc(data.desc, '·ESTADO') ||
          extractFieldFromDesc(data.desc, 'ESTADO') ||
          'Sin iniciar',
      };
    }

    await docRef.set(updates, { merge: true });
    return await getCardById(cardId);
  } catch (error) {
    return null;
  }
}

export async function attachUrlToCard(
  cardId: string,
  name: string,
  attachmentUrl: string
): Promise<TrelloAttachment | null> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('projects').doc(cardId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    const data = docSnap.data()!;

    const newAtt: TrelloAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bytes: 0,
      date: new Date().toISOString(),
      fileName: name,
      mimeType: 'text/uri-list',
      url: attachmentUrl,
    };

    const existing = Array.isArray(data.attachments) ? data.attachments : [];
    await docRef.set(
      {
        attachments: [...existing, { ...newAtt, name, previews: [] }],
        dateLastActivity: newAtt.date,
      },
      { merge: true }
    );
    return newAtt;
  } catch (error) {
    return null;
  }
}

export async function deleteAttachmentFromCard(
  cardId: string,
  attachmentId: string
): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('projects').doc(cardId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return false;
    const existing: any[] = docSnap.data()?.attachments || [];
    await docRef.set(
      {
        attachments: existing.filter(a => a.id !== attachmentId),
        dateLastActivity: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    return false;
  }
}

export async function deleteAction(actionId: string): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('projects').get();
    for (const docSnap of snap.docs) {
      const actions: any[] = docSnap.data()?.actions || [];
      if (actions.some(a => a.id === actionId)) {
        await docSnap.ref.set(
          {
            actions: actions.filter(a => a.id !== actionId),
          },
          { merge: true }
        );
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}
