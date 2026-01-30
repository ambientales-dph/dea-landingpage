
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
        ...(options.body && typeof options.body === 'string' && { 'Content-Type': 'application/json' }),
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

  // For DELETE requests, Trello might return an empty body with 200 OK
  if (response.status === 200) {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
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

export async function getCardById(cardId: string): Promise<TrelloCard> {
    try {
        const cardData = await trelloFetch(`/cards/${cardId}?fields=name,url,desc,cover,labels,idBoard&attachments=true`) as any;

        if (!cardData || !cardData.idBoard) {
            throw new Error('Datos de tarjeta incompletos.');
        }

        const boardData = await trelloFetch(`/boards/${cardData.idBoard}?fields=name`) as { name: string };

        return {
            ...cardData,
            boardId: cardData.idBoard,
            boardName: boardData.name
        };

    } catch (error) {
        if (error instanceof Error) {
            console.error(`Failed to get Trello card ${cardId}:`, error.message);
            throw new Error(`No pudimos obtener los datos de la tarjeta de Trello: ${error.message}`);
        }
        throw new Error('Hubo un error desconocido al obtener la tarjeta.');
    }
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

async function getCardsFromBoard(boardId: string): Promise<any[]> {
    return (await trelloFetch(`/boards/${boardId}/cards?fields=name,url,desc,cover,labels,idBoard&attachments=true`)) as any[];
}

export async function getAllCardsFromAllBoards(): Promise<TrelloCard[]> {
    try {
        const boards = await getTrelloBoards();
        const allCardsPromises = boards.map(async (board) => {
            const cardsFromApi = await getCardsFromBoard(board.id);
            return cardsFromApi.map((card: any) => ({
                ...card,
                boardId: card.idBoard,
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
    const actions = (await trelloFetch(`/cards/${cardId}/actions?filter=commentCard&member_creator=true`)) as TrelloAction[];
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

export async function addAttachmentToCard({ cardId, formData }: { cardId: string; formData: FormData }): Promise<TrelloAttachment> {
  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
    throw new Error('Faltan la API Key y el Token de Trello en el archivo .env');
  }
  const fetch = (await import('node-fetch')).default;
  const url = `${BASE_URL}/cards/${cardId}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;

  try {
    // @ts-ignore
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Las credenciales de Trello son inválidas. ¡Revisá tu API Key y Token!');
      }
      const errorText = await response.text();
      console.error(`Trello API error on attachment: ${response.status} ${errorText}`);
      throw new Error(`Error de la API de Trello al adjuntar: ${response.status}`);
    }

    return response.json() as Promise<TrelloAttachment>;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to add attachment to Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos adjuntar el archivo a la tarjeta: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al adjuntar el archivo.');
  }
}

export async function deleteAttachmentFromCard({ cardId, attachmentId }: { cardId: string; attachmentId: string }): Promise<void> {
  try {
    await trelloFetch(`/cards/${cardId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to delete attachment ${attachmentId} from Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos eliminar el adjunto de la tarjeta: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al eliminar el adjunto.');
  }
}

export async function getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
  try {
    const labels = (await trelloFetch(`/boards/${boardId}/labels?fields=name,color,id`)) as TrelloLabel[];
    return labels;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to get labels for Trello board ${boardId}:`, error.message);
      throw new Error(`No pudimos obtener las etiquetas del tablero: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al obtener las etiquetas.');
  }
}

export async function addLabelToCard({ cardId, labelId }: { cardId: string; labelId: string }): Promise<void> {
  try {
    await trelloFetch(`/cards/${cardId}/idLabels`, {
      method: 'POST',
      body: JSON.stringify({ value: labelId }),
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to add label ${labelId} to Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos añadir la etiqueta a la tarjeta: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al añadir la etiqueta.');
  }
}

export async function removeLabelFromCard({ cardId, labelId }: { cardId: string; labelId: string }): Promise<void> {
  try {
    await trelloFetch(`/cards/${cardId}/idLabels/${labelId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to remove label ${labelId} from Trello card ${cardId}:`, error.message);
      throw new Error(`No pudimos quitar la etiqueta de la tarjeta: ${error.message}`);
    }
    throw new Error('Hubo un error desconocido al quitar la etiqueta.');
  }
}
