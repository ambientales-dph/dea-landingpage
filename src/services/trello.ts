
'use server';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
const BASE_URL = 'https://api.trello.com/1';

async function trelloFetch(url: string, options: RequestInit = {}) {
  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
    throw new Error('Faltan la API Key y el Token de Trello en el archivo .env');
  }
  const fetch = (await import('node-fetch')).default;
  const fullUrl = `${BASE_URL}${url}${url.includes('?') ? '&' : '?'}key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
  
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
        'Accept': 'application/json',
        ...(options.body && { 'Content-Type': 'application/json' }),
        ...options.headers,
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Las credenciales de Trello son inválidas. ¡Revisá tu API Key y Token!');
    }
    const errorText = await response.text();
    console.error(`Trello API error: ${response.status} ${errorText}`);
    throw new Error(`Error de la API de Trello: ${response.status}`);
  }

  return response.json();
}

export async function verifyTrelloConnection(): Promise<string> {
  try {
    const memberData = (await trelloFetch('/members/me')) as { fullName: string };
    return memberData.fullName;
  } catch (error) {
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('Hubo un problema de red al intentar conectar con Trello.');
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

export interface TrelloCard {
  id: string;
  name: string;
  url: string;
  desc: string;
  boardName: string;
  cover: {
    color: string | null;
  } | null;
  labels: TrelloLabel[];
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

export async function getTrelloBoards(): Promise<TrelloBoard[]> {
  try {
    const boards = (await trelloFetch('/members/me/boards?fields=name,id')) as TrelloBoard[];
    return boards;
  } catch (error) {
     if (error instanceof Error) {
        console.error('Failed to get Trello boards:', error.message);
        throw new Error(`No pudimos obtener los tableros de Trello: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al obtener los tableros.');
  }
}

async function getCardsFromBoard(boardId: string): Promise<Omit<TrelloCard, 'boardName'>[]> {
    return (await trelloFetch(`/boards/${boardId}/cards?fields=name,url,desc,cover,labels`)) as Omit<TrelloCard, 'boardName'>[];
}

export async function getAllCardsFromAllBoards(): Promise<TrelloCard[]> {
    try {
        const boards = await getTrelloBoards();
        const allCardsPromises = boards.map(async (board) => {
            const cards = await getCardsFromBoard(board.id);
            return cards.map(card => ({
                ...card,
                boardName: board.name
            }));
        });
        
        const cardsPerBoard = await Promise.all(allCardsPromises);
        
        const allCards = cardsPerBoard.flat();

        allCards.sort((a, b) => a.name.localeCompare(b.name));
        
        return allCards;

    } catch (error) {
        if (error instanceof Error) {
            console.error('Failed to get all Trello cards:', error.message);
            throw new Error(`No pudimos obtener las tarjetas de Trello: ${error.message}`);
        }
        throw new Error('Hubo un error desconocido al obtener las tarjetas.');
    }
}

export async function updateTrelloCard({ cardId, name, desc }: { cardId: string; name?: string; desc?: string }): Promise<TrelloCard> {
  try {
    const updatedCard = (await trelloFetch(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, desc }),
    })) as TrelloCard;
    return updatedCard;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to update Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos actualizar la tarjeta de Trello: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al actualizar la tarjeta.');
  }
}

export async function getCardActivity(cardId: string): Promise<TrelloAction[]> {
  try {
    const actions = (await trelloFetch(`/cards/${cardId}/actions?filter=all&member_creator=true`)) as TrelloAction[];
    return actions;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to get activity for Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos obtener la actividad de la tarjeta de Trello: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al obtener la actividad de la tarjeta.');
  }
}

export async function addCommentToCard({ cardId, text }: { cardId: string; text: string }): Promise<TrelloAction> {
  try {
    const newAction = (await trelloFetch(`/cards/${cardId}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })) as TrelloAction;
    return newAction;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to add comment to Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos añadir el comentario a la tarjeta: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al añadir el comentario.');
  }
}
