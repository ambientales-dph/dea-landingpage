
'use server';

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
        listBefore?: { id: string, name: string };
        listAfter?: { id: string, name: string };
        board: { id: string, name: string};
        card: { id: string, name: string};
    };
    type: 'commentCard' | 'updateCard';
    date: string;
    memberCreator: { id: string; fullName: string; };
}

function getTrelloAuthParams(): string | null {
    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_API_TOKEN;
    if (!apiKey || !apiToken) return null;
    return `key=${apiKey}&token=${apiToken}`;
}

export async function getBoardSummary(boardId: string): Promise<TrelloBoardSummary | null> {
  const auth = getTrelloAuthParams();
  if (!auth) return null;
  const url = `https://api.trello.com/1/boards/${boardId}?lists=open&cards=open&card_fields=name,due&list_fields=name&fields=name&${auth}`;
  const res = await fetch(url);
  return res.ok ? await res.json() : null;
}

export async function getMemberBoards(): Promise<{ boards: TrelloBoard[]; isConfigured: boolean }> {
  const auth = getTrelloAuthParams();
  if (!auth) return { boards: [], isConfigured: false };
  const url = `https://api.trello.com/1/members/me/boards?fields=name&${auth}`;
  const res = await fetch(url);
  return { boards: res.ok ? await res.json() : [], isConfigured: true };
}

export async function getBoardLists(boardId: string): Promise<TrelloListBasic[]> {
  const auth = getTrelloAuthParams();
  if (!auth) return [];
  const url = `https://api.trello.com/1/boards/${boardId}/lists?fields=name&${auth}`;
  const res = await fetch(url);
  return res.ok ? await res.json() : [];
}

export async function getCardsInList(listId: string): Promise<TrelloCardBasic[]> {
  const auth = getTrelloAuthParams();
  if (!auth) return [];
  const url = `https://api.trello.com/1/lists/${listId}/cards?fields=name,id,url,desc&${auth}`;
  const res = await fetch(url);
  return res.ok ? await res.json() : [];
}

export async function getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
  const auth = getTrelloAuthParams();
  if (!auth) return [];
  const url = `https://api.trello.com/1/cards/${cardId}/attachments?fields=id,name,url,bytes,mimeType,date&${auth}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((att: any) => ({...att, fileName: att.name}));
}

export async function getCardActions(cardId: string): Promise<TrelloAction[]> {
    const auth = getTrelloAuthParams();
    if (!auth) return [];
    // Limitamos a 150 para evitar timeouts
    const url = `https://api.trello.com/1/cards/${cardId}/actions?filter=commentCard,updateCard&fields=data,date,type,memberCreator&memberCreator_fields=fullName&limit=150&${auth}`;
    const res = await fetch(url);
    return res.ok ? await res.json() : [];
}

export async function searchTrelloCards(query: string): Promise<TrelloCardBasic[]> {
    const auth = getTrelloAuthParams();
    if (!auth) return [];
    const url = `https://api.trello.com/1/search?query=${encodeURIComponent(query)}&idBoards=mine&modelTypes=cards&card_fields=name,id,url,idBoard,idList,desc&cards_limit=50&${auth}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.cards || [];
}

export async function getCardById(cardId: string): Promise<TrelloCardBasic | null> {
  const auth = getTrelloAuthParams();
  if (!auth) return null;
  const url = `https://api.trello.com/1/cards/${cardId}?fields=name,id,url,idBoard,idList,desc&${auth}`;
  const res = await fetch(url);
  return res.ok ? await res.json() : null;
}

export async function attachUrlToCard(cardId: string, name: string, attachmentUrl: string): Promise<TrelloAttachment | null> {
    const auth = getTrelloAuthParams();
    if (!auth) return null;
    const url = `https://api.trello.com/1/cards/${cardId}/attachments?url=${encodeURIComponent(attachmentUrl)}&name=${encodeURIComponent(name)}&${auth}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...data, fileName: data.name };
}

export async function deleteAttachmentFromCard(cardId: string, attachmentId: string): Promise<boolean> {
    const auth = getTrelloAuthParams();
    if (!auth) return false;
    const url = `https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}?${auth}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
}

export async function deleteAction(actionId: string): Promise<boolean> {
    const auth = getTrelloAuthParams();
    if (!auth) return false;
    const url = `https://api.trello.com/1/actions/${actionId}?${auth}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
}
