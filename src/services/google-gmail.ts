
'use server';

import { google } from 'googleapis';

/**
 * Servicio para interactuar con la API de Gmail.
 * Intenta usar las credenciales de la Línea de Tiempo (_TL) o las estándar.
 */
async function getGmailClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID_TL || process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET_TL || process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN_TL || process.env.GOOGLE_REFRESH_TOKEN || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('CONFIG_MISSING: Faltan credenciales de Google en el archivo .env.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        await oauth2Client.getAccessToken();
    } catch (error: any) {
        console.error('ERROR OAUTH GMAIL:', error.message);
        const detail = error.response?.data?.error_description || error.message;
        
        if (detail.includes('invalid_grant')) {
            throw new Error('AUTH_INVALID_GRANT: El Refresh Token es inválido o expiró. Generá uno nuevo.');
        }
        
        if (detail.includes('insufficient')) {
            throw new Error('AUTH_SCOPE_ERROR: El Refresh Token no tiene permisos suficientes para Gmail.');
        }

        throw new Error(`AUTH_FAILED: ${detail}`);
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
 * Obtiene los últimos correos recibidos (máximo 10 para velocidad).
 */
export async function getLatestEmails(): Promise<GmailMessageSummary[]> {
    try {
        const gmail = await getGmailClient();
        
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: 'label:INBOX'
        });

        const messages = response.data.messages || [];
        const summaries: GmailMessageSummary[] = [];

        const detailPromises = messages.map(msg => 
            gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'full'
            }).catch(err => {
                console.warn(`Error obteniendo detalle de mail ${msg.id}:`, err.message);
                return null;
            })
        );

        const details = await Promise.all(detailPromises);

        for (const detail of details) {
            if (!detail || !detail.data) continue;
            
            const headers = detail.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '(Sin asunto)';
            const from = headers.find(h => h.name === 'From')?.value || '(Desconocido)';
            const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            const snippet = detail.data.snippet || '';

            summaries.push({
                id: detail.data.id!,
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
        throw error;
    }
}

/**
 * Configura el "Watch" de Gmail para recibir notificaciones Push vía Pub/Sub.
 */
export async function setupGmailWatch(topicName: string) {
    try {
        console.log(`Intentando registrar Watch en Gmail para el topic: ${topicName}`);
        const gmail = await getGmailClient();
        
        // Ejecutar el watch
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: topicName,
                labelIds: ['INBOX']
            }
        });
        
        console.log('✅ Gmail Watch registrado con éxito:', response.data);
        return { success: true, data: response.data };
    } catch (error: any) {
        const detail = error.response?.data?.error?.message || error.message;
        console.error('❌ Error registrando Gmail watch:', detail);
        
        if (detail.includes('insufficient')) {
            return { 
                success: false, 
                error: 'Error de Scopes: Tu Refresh Token no tiene permiso para ejecutar "watch". Asegurate de haber marcado "Use your own OAuth credentials" en el Playground y seleccionado el scope gmail.readonly.' 
            };
        }
        
        return { 
            success: false, 
            error: detail.includes('403') 
                ? 'Error 403: El topic no tiene permisos. Verificá el permiso Publisher para gmail-api-push@system.gserviceaccount.com.' 
                : `Error en Gmail Watch: ${detail}` 
        };
    }
}
