'use server';

import { google } from 'googleapis';

/**
 * Servicio para interactuar con la API de Gmail.
 */
async function getGmailClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID_TL || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET_TL || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN_TL || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan credenciales de Google (Client ID, Secret o Refresh Token).');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        await oauth2Client.getAccessToken();
    } catch (error: any) {
        const detail = error.response?.data?.error_description || error.message;
        throw new Error(`Fallo de autenticación Google: ${detail}`);
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
}

export interface GmailMessageSummary {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    date: string;
    snippet: string;
    body?: string;
}

/**
 * Obtiene los últimos correos NO LEÍDOS recibidos.
 */
export async function getLatestEmails(): Promise<GmailMessageSummary[]> {
    try {
        const gmail = await getGmailClient();
        
        // Ampliamos la búsqueda quitando label:INBOX por si hay filtros, pero mantenemos is:unread
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: 'is:unread'
        });

        const messages = response.data.messages || [];
        const summaries: GmailMessageSummary[] = [];

        const detailResults = await Promise.allSettled(
            messages.map(msg => 
                gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id!,
                    format: 'full'
                })
            )
        );

        for (const result of detailResults) {
            if (result.status === 'fulfilled' && result.value.data) {
                const detail = result.value.data;
                const headers = detail.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(Sin asunto)';
                const from = headers.find(h => h.name === 'From')?.value || '(Desconocido)';
                const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
                const snippet = detail.snippet || '';

                summaries.push({
                    id: detail.id!,
                    threadId: detail.threadId || '',
                    subject,
                    from,
                    date,
                    snippet
                });
            }
        }

        return summaries;
    } catch (error: any) {
        console.error('Error detallado de Gmail API:', error);
        throw new Error(`Gmail API: ${error.message || 'Error desconocido al listar correos'}`);
    }
}

/**
 * Obtiene todo el contenido de texto de un hilo de conversación.
 */
export async function getThreadContext(threadId: string): Promise<string> {
    try {
        const gmail = await getGmailClient();
        const response = await gmail.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'minimal' // Solo necesitamos snippets de mensajes anteriores para contexto
        });

        const messages = response.data.messages || [];
        // Concatenamos los fragmentos de toda la cadena
        return messages.map(m => m.snippet).join(' | ');
    } catch (error) {
        console.error('Error al obtener hilo:', error);
        return '';
    }
}

/**
 * Configura el "Watch" de Gmail.
 */
export async function setupGmailWatch(topicName: string) {
    try {
        const gmail = await getGmailClient();
        
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: topicName,
                labelIds: ['INBOX']
            }
        });
        
        return { success: true, data: response.data };
    } catch (error: any) {
        const detail = error.response?.data?.error?.message || error.message;
        return { success: false, error: `Error en Gmail Watch: ${detail}` };
    }
}
