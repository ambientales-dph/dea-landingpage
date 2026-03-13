
'use server';

import { google } from 'googleapis';

/**
 * Servicio para interactuar con la API de Gmail.
 * Requiere que las variables de entorno de Google (TL) estén configuradas
 * y que el Refresh Token tenga el scope 'https://www.googleapis.com/auth/gmail.readonly'.
 */
async function getGmailClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID_TL || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET_TL || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN_TL || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('CONFIG_MISSING: Faltan credenciales de Google TL en el servidor (.env).');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        // Validar token
        await oauth2Client.getAccessToken();
    } catch (error: any) {
        console.error('ERROR OAUTH GMAIL:', error.message);
        throw new Error('AUTH_FAILED: El token de Google ha expirado o no tiene permisos para Gmail.');
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
}

/**
 * Obtiene los últimos correos recibidos (máximo 20).
 */
export async function getLatestEmails(): Promise<GmailMessageSummary[]> {
    try {
        const gmail = await getGmailClient();
        
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: 'label:INBOX'
        });

        const messages = response.data.messages || [];
        const summaries: GmailMessageSummary[] = [];

        for (const msg of messages) {
            if (!msg.id) continue;
            
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });

            const headers = detail.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '(Sin asunto)';
            const from = headers.find(h => h.name === 'From')?.value || '(Desconocido)';
            const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            const snippet = detail.data.snippet || '';

            summaries.push({
                id: msg.id,
                threadId: detail.data.threadId || '',
                subject,
                from,
                date,
                snippet
            });
        }

        return summaries;
    } catch (error: any) {
        console.error('Error fetching Gmail messages:', error.message);
        if (error.message.includes('CONFIG_MISSING')) throw error;
        if (error.message.includes('AUTH_FAILED')) throw error;
        throw new Error('API_ERROR: Asegurate de que la "Gmail API" esté habilitada en Google Cloud Console.');
    }
}
