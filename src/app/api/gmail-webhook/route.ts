
import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 * Es el corazón del flujo "Push" que permite tiempo real.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Pub/Sub envía un mensaje codificado en base64. 
        // Solo nos interesa saber que el evento ocurrió.
        const messageId = body.message?.messageId || 'unknown';
        
        console.log(`--- GMAIL WEBHOOK RECEIVED [ID: ${messageId}] ---`);
        
        // Ejecutamos la sincronización. Al no pasar proyectos, la acción los busca de Trello.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`Webhook procesado correctamente: ${result.newAlerts} alertas nuevas.`);
        } else {
            console.warn(`Sincronización fallida tras Webhook: ${result.error}`);
        }

        // Siempre respondemos 200 OK para que Pub/Sub no reintente infinitamente
        return NextResponse.json({ success: true, messageId });
    } catch (error: any) {
        console.error('Error procesando Webhook de Gmail:', error.message);
        // Respondemos 200 igual para evitar bucles de reintento de Google si el error es de parseo
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
