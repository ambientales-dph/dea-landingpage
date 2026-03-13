
'use server';

import { google } from 'googleapis';

/**
 * Servicio para interactuar con la API de Gmail.
 * Mejora: Informa qué credenciales está usando para evitar confusiones con variables _TL.
 */
async function getGmailClient() {
    // Intentamos obtener las credenciales priorizando las que NO tienen _TL si el usuario está en el Portal
    // o consolidando si solo existe un set.
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID_TL || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET_TL || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN_TL || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        console.error('❌ [GMAIL SERVICE] Error: Faltan credenciales en .env');
        throw new Error('CONFIG_MISSING: Faltan credenciales de Google en el archivo .env.');
    }

    // Log de diagnóstico (seguro)
    console.log(`\n🔍 [GMAIL AUTH] Iniciando cliente...`);
    console.log(`   Client ID: ${clientId.substring(0, 10)}... (Verificá que coincida con tu consola)`);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        const tokenInfo = await oauth2Client.getAccessToken();
        // Si llegamos acá, el token es válido, pero puede que no tenga los scopes correctos para Gmail
    } catch (error: any) {
        console.error('❌ [GMAIL AUTH] El Refresh Token es inválido o el Client Secret no coincide.');
        const detail = error.response?.data?.error_description || error.message;
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
                console.warn(`⚠️ [GMAIL] Error obteniendo detalle de mail ${msg.id}:`, err.message);
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
        console.error('❌ [GMAIL API ERROR]:', error.message);
        throw error;
    }
}

/**
 * Configura el "Watch" de Gmail para recibir notificaciones Push vía Pub/Sub.
 */
export async function setupGmailWatch(topicName: string) {
    try {
        console.log(`\n🚀 [GMAIL WATCH] Intentando registrar suscripción...`);
        console.log(`   Topic: ${topicName}`);
        
        const gmail = await getGmailClient();
        
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: topicName,
                labelIds: ['INBOX']
            }
        });
        
        console.log('✅ [GMAIL WATCH] Suscripción exitosa:', response.data);
        return { success: true, data: response.data };
    } catch (error: any) {
        const detail = error.response?.data?.error?.message || error.message;
        console.error('❌ [GMAIL WATCH ERROR]:', detail);
        
        if (detail.includes('insufficient')) {
            return { 
                success: false, 
                error: 'Error de Scopes: Aunque configuraste el Client ID, el Token generado NO incluye el permiso de lectura de Gmail. Repetí el proceso en el Playground asegurándote de ver "gmail.readonly" en la lista de autorizados del paso 2.' 
            };
        }
        
        return { 
            success: false, 
            error: detail.includes('403') 
                ? 'Error 403: El topic no tiene permisos. Verificá el permiso "Pub/Sub Publisher" para gmail-api-push@system.gserviceaccount.com en la consola de Google Cloud.' 
                : `Error en Gmail Watch: ${detail}` 
        };
    }
}
