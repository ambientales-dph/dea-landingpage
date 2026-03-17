
'use server';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
const BASE_URL = 'https://api.trello.com/1';
const PROYECTOS_BOARD_ID = 'CgG4b3B0';

async function trelloFetch(url: string, options: RequestInit = {}) {
  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
    throw new Error('Faltan la API Key y el Token de Trello en el archivo .env');
  }

  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${BASE_URL}${url}${separator}key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
  
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
        'Accept': 'application/json',
        ...(options.body && typeof options.body === 'string' && { 'Content-Type': 'application/json' }),
        ...options.headers,
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Las credenciales de Trello son inválidas.');
    }
    const errorText = await response.text();
    console.error(`Trello API error: ${response.status} ${errorText}`);
    throw new Error(`Error de la API de Trello: ${response.status}`);
  }

  if (response.status === 204) return {};
  
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function verifyTrelloConnection(): Promise<string> {
  try {
    const memberData = (await trelloFetch('/members/me?fields=fullName')) as { fullName: string };
    return memberData.fullName;
  } catch (error) {
    throw new Error('Hubo un problema al conectar con Trello.');
  }
}

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
    listBefore?: { name: string };
    listAfter?: { name: string };
    old?: {
        name?: string;
        desc?: string;
    }
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
    card: { id: string; name: string; idShort: number; };
    board: { id: string; name: string; };
    list?: { id: string; name: string; };
    listBefore?: { name: string };
    listAfter?: { name: string };
    old?: {
        name?: string;
        desc?: string;
        idList?: string;
    }
  };
  type: string;
  date: string;
  memberCreator: {
    id:string;
    avatarUrl: string | null;
    fullName: string;
    username: string;
  };
}

/**
 * Obtiene las IDs de los tableros relevantes para evitar escanear toda la cuenta del usuario.
 */
function getRelevantBoardIds(): string[] {
    const ids = [
        PROYECTOS_BOARD_ID,
        process.env.NEXT_PUBLIC_TRELLO_BOARD_ID_1,
        process.env.NEXT_PUBLIC_TRELLO_BOARD_ID_2
    ].filter((id): id is string => !!id);
    return Array.from(new Set(ids));
}

export async function getAllRecentActions(hours: number = 8): Promise<TrelloBoardAction[]> {
    try {
        const boardIds = getRelevantBoardIds();
        const sinceDate = new Date();
        sinceDate.setHours(sinceDate.getHours() - hours);
        const sinceIso = sinceDate.toISOString();

        const filter = 'commentCard,updateCard,addAttachmentToCard,createCard,moveCardToBoard';

        const allActionsPromises = boardIds.map(async (boardId) => {
            try {
                const actions = await trelloFetch(
                    `/boards/${boardId}/actions?filter=${filter}&limit=50&since=${sinceIso}&member_creator=true`
                ) as TrelloBoardAction[];
                return actions.filter(a => a.data.card && a.memberCreator);
            } catch (e) {
                return [];
            }
        });
        
        const actionsPerBoard = await Promise.all(allActionsPromises);
        const combined = actionsPerBoard.flat();

        // DEDUPLICACIÓN POR ID: Crucial para evitar errores de llaves duplicadas en React
        const uniqueActionsMap = new Map<string, TrelloBoardAction>();
        combined.forEach(a => uniqueActionsMap.set(a.id, a));
        
        return Array.from(uniqueActionsMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    } catch (error) {
        return [];
    }
}

export async function getCardById(cardId: string): Promise<TrelloCard> {
    const cardData = await trelloFetch(`/cards/${cardId}?fields=name,url,desc,cover,labels,idBoard,idList&attachments=true`) as any;
    const boardData = await trelloFetch(`/boards/${cardData.idBoard}?fields=name`) as { name: string };

    return {
        ...cardData,
        boardId: cardData.idBoard,
        boardName: boardData.name
    };
}

export async function getTrelloBoards(): Promise<TrelloBoard[]> {
    return (await trelloFetch('/members/me/boards?fields=name,id')) as TrelloBoard[];
}

export async function getCardsFromBoard(boardId: string): Promise<any[]> {
    return (await trelloFetch(`/boards/${boardId}/cards?fields=name,url,desc,cover,labels,idBoard,idList&attachments=true`)) as any[];
}

export async function getAllCardsFromAllBoards(): Promise<TrelloCard[]> {
    try {
        const boardIds = getRelevantBoardIds();
        
        const allCardsPromises = boardIds.map(async (boardId) => {
            try {
                const [board, cardsFromApi] = await Promise.all([
                    trelloFetch(`/boards/${boardId}?fields=name`) as Promise<{name: string}>,
                    getCardsFromBoard(boardId)
                ]);
                return cardsFromApi.map((card: any) => ({
                    ...card,
                    boardId: card.idBoard,
                    boardName: board.name
                }));
            } catch (e) {
                console.error(`Error en tablero ${boardId}:`, e);
                return [];
            }
        });
        
        const cardsPerBoard = await Promise.all(allCardsPromises);
        const combinedCards = cardsPerBoard.flat();

        // DEDUPLICACIÓN POR ID: Evita errores de llaves duplicadas en React
        const uniqueCardsMap = new Map<string, TrelloCard>();
        combinedCards.forEach(card => {
            uniqueCardsMap.set(card.id, card);
        });
        
        return Array.from(uniqueCardsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error('Failed to get cards:', error);
        throw new Error('Error al sincronizar con Trello. Reintentá en unos momentos.');
    }
}

export async function updateTrelloCard({ cardId, name, desc, cover, idBoard, idList }: { cardId: string; name?: string; desc?: string; cover?: { color: string | null }, idBoard?: string, idList?: string }): Promise<TrelloCard> {
    const body: { [key: string]: any } = {};
    if (name !== undefined) body.name = name;
    if (desc !== undefined) body.desc = desc;
    if (cover !== undefined) body.cover = cover;
    if (idBoard !== undefined) body.idBoard = idBoard;
    if (idList !== undefined) body.idList = idList;

    return (await trelloFetch(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })) as TrelloCard;
}

export async function getCardActivity(cardId: string): Promise<TrelloAction[]> {
    return (await trelloFetch(`/cards/${cardId}/actions?filter=all&limit=100&member_creator=true`)) as TrelloAction[];
}

export async function addCommentToCard({ cardId, text }: { cardId: string; text: string }): Promise<TrelloAction> {
    return (await trelloFetch(`/cards/${cardId}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })) as TrelloAction;
}

export interface AddAttachmentPayload {
  cardId: string;
  url: string;
  name?: string;
}

export async function addAttachmentToTrelloCard(payload: AddAttachmentPayload): Promise<TrelloAttachment> {
    const body = { url: payload.url, name: payload.name || payload.url };
    return (await trelloFetch(`/cards/${payload.cardId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(body),
    })) as TrelloAttachment;
}

export async function removeAttachmentFromTrelloCard({ cardId, attachmentId }: { cardId: string; attachmentId: string }): Promise<void> {
    await trelloFetch(`/cards/${cardId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export async function getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
    return (await trelloFetch(`/boards/${boardId}/labels?fields=name,color,id`)) as TrelloLabel[];
}

export async function addLabelToCard({ cardId, labelId }: { cardId: string; labelId: string }): Promise<void> {
    await trelloFetch(`/cards/${cardId}/idLabels`, {
      method: 'POST',
      body: JSON.stringify({ value: labelId }),
    });
}

export async function removeLabelFromCard({ cardId, labelId }: { cardId: string; labelId: string }): Promise<void> {
    await trelloFetch(`/cards/${cardId}/idLabels/${labelId}`, { method: 'DELETE' });
}

export async function getListsOnBoard(boardId: string): Promise<{ id: string, name: string }[]> {
    return (await trelloFetch(`/boards/${boardId}/lists?fields=name,id`)) as { id: string, name: string }[];
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

export async function createTrelloCard(cardInfo: { name: string; idList: string; desc: string }): Promise<TrelloCard> {
    return (await trelloFetch('/cards', {
      method: 'POST',
      body: JSON.stringify(cardInfo),
    })) as TrelloCard;
}
