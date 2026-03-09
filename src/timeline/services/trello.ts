'use server';

interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
}

interface TrelloList {
  id: string;
  name: string;
  cards: TrelloCard[];
}

export interface TrelloBoardSummary {
  name: string;
  lists: TrelloList[];
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
    memberCreator: {
        id: string;
        fullName: string;
    };
}


function getTrelloAuthParams(): string | null {
    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_API_TOKEN;

    if (!apiKey || !apiToken) {
        return null;
    }
    return `key=${apiKey}&token=${apiToken}`;
}

export async function getBoardSummary(boardId: string): Promise<TrelloBoardSummary | null> {
  const authParams = getTrelloAuthParams();
  if (!authParams) return null;

  const url = `https://api.trello.com/1/boards/${boardId}?lists=open&cards=open&card_fields=name,due&list_fields=name&fields=name&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error:', errorText);
      return null;
    }
    const data = await response.json();
    return data as TrelloBoardSummary;
  } catch (error) {
    console.error('Error fetching from Trello:', error);
    return null;
  }
}

export async function getMemberBoards(): Promise<{ boards: TrelloBoard[]; isConfigured: boolean }> {
  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_API_TOKEN;

  if (!apiKey || !apiToken) {
    return { boards: [], isConfigured: false };
  }

  const authParams = `key=${apiKey}&token=${apiToken}`;
  const url = `https://api.trello.com/1/members/me/boards?fields=name&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error (getMemberBoards):', errorText);
      return { boards: [], isConfigured: true };
    }
    const data = await response.json();
    return { boards: data as TrelloBoard[], isConfigured: true };
  } catch (error) {
    console.error('Error fetching boards from Trello:', error);
    return { boards: [], isConfigured: true };
  }
}


export async function getBoardLists(boardId: string): Promise<TrelloListBasic[]> {
  const authParams = getTrelloAuthParams();
  if (!authParams) return [];

  const url = `https://api.trello.com/1/boards/${boardId}/lists?fields=name&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error (getBoardLists):', errorText);
      return [];
    }
    const data = await response.json();
    return data as TrelloListBasic[];
  } catch (error) {
    console.error('Error fetching lists from Trello:', error);
    return [];
  }
}

export async function getCardsInList(listId: string): Promise<TrelloCardBasic[]> {
  const authParams = getTrelloAuthParams();
  if (!authParams) return [];

  const url = `https://api.trello.com/1/lists/${listId}/cards?fields=name,id,url,desc&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error (getCardsInList):', errorText);
      return [];
    }
    const data = await response.json();
    return data as TrelloCardBasic[];
  } catch (error)
 {
    console.error('Error fetching cards from Trello:', error);
    return [];
  }
}

export async function getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
  const authParams = getTrelloAuthParams();
  if (!authParams) return [];

  const url = `https://api.trello.com/1/cards/${cardId}/attachments?fields=id,name,url,bytes,mimeType,date&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error (getCardAttachments):', errorText);
      return [];
    }
    const data = await response.json();
    return data.map((att: any) => ({...att, fileName: att.name})) as TrelloAttachment[];
  } catch (error) {
    console.error('Error fetching attachments from Trello:', error);
    return [];
  }
}

export async function getCardActions(cardId: string): Promise<TrelloAction[]> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return [];
  
    const url = `https://api.trello.com/1/cards/${cardId}/actions?filter=commentCard,updateCard&fields=data,date,type,memberCreator&memberCreator_fields=fullName&${authParams}`;
  
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trello API Error (getCardActions):', errorText);
        return [];
      }
      const data = await response.json();
      return data as TrelloAction[];
    } catch (error) {
      console.error('Error fetching actions from Trello:', error);
      return [];
    }
}

export async function searchTrelloCards(query: string): Promise<TrelloCardBasic[]> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return [];

    const url = `https://api.trello.com/1/search?query=${encodeURIComponent(query)}&idBoards=mine&modelTypes=cards&card_fields=name,id,url,idBoard,idList,desc&cards_limit=50&${authParams}`;
  
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trello API Error (searchTrelloCards):', errorText);
        return [];
      }
      const data = await response.json();
      return data.cards as TrelloCardBasic[];
    } catch (error) {
      console.error('Error searching cards on Trello:', error);
      return [];
    }
}

export async function getCardById(cardId: string): Promise<TrelloCardBasic | null> {
  const authParams = getTrelloAuthParams();
  if (!authParams) return null;

  const url = `https://api.trello.com/1/cards/${cardId}?fields=name,id,url,idBoard,idList,desc&${authParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API Error (getCardById):', errorText);
      return null;
    }
    const data = await response.json();
    return data as TrelloCardBasic;
  } catch (error) {
    console.error('Error fetching card from Trello:', error);
    return null;
  }
}

/**
 * Uploads a file as an attachment to a Trello card.
 * @param cardId The Trello card ID.
 * @param fileName The name for the attachment.
 * @param base64Data The base64 encoded file content.
 */
export async function uploadAttachmentToCard(cardId: string, fileName: string, base64Data: string): Promise<TrelloAttachment | null> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return null;

    const url = `https://api.trello.com/1/cards/${cardId}/attachments?${authParams}`;
    
    try {
        const binaryData = Buffer.from(base64Data, 'base64');
        const formData = new FormData();
        const blob = new Blob([binaryData]);
        formData.append('file', blob, fileName);
        formData.append('name', fileName);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Trello Upload Error:', errorText);
            throw new Error(`Error de Trello: ${errorText}`);
        }

        const data = await response.json();
        return { ...data, fileName: data.name } as TrelloAttachment;
    } catch (error) {
        console.error('Error uploading to Trello:', error);
        throw error;
    }
}

/**
 * Attaches a URL to a Trello card.
 */
export async function attachUrlToCard(cardId: string, name: string, attachmentUrl: string): Promise<TrelloAttachment | null> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return null;

    const url = `https://api.trello.com/1/cards/${cardId}/attachments?url=${encodeURIComponent(attachmentUrl)}&name=${encodeURIComponent(name)}&${authParams}`;
    
    try {
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Trello URL Attach Error:', errorText);
            throw new Error(`Error de Trello (URL): ${errorText}`);
        }
        const data = await response.json();
        return { ...data, fileName: data.name } as TrelloAttachment;
    } catch (error) {
        console.error('Error attaching URL to Trello:', error);
        throw error;
    }
}

/**
 * Deletes an attachment from a Trello card.
 */
export async function deleteAttachmentFromCard(cardId: string, attachmentId: string): Promise<boolean> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return false;

    const url = `https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}?${authParams}`;
    
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Trello Attachment Delete Error:', errorText);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error deleting attachment from Trello:', error);
        return false;
    }
}

/**
 * Deletes an action (comment) from Trello.
 */
export async function deleteAction(actionId: string): Promise<boolean> {
    const authParams = getTrelloAuthParams();
    if (!authParams) return false;

    const url = `https://api.trello.com/1/actions/${actionId}?${authParams}`;
    
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Trello Action Delete Error:', errorText);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error deleting action from Trello:', error);
        return false;
    }
}
