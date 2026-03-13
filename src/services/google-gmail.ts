
'use server';

import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client,
});

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
        throw new Error('No se pudieron obtener los correos de Gmail.');
    }
}
