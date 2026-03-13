
import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 * Es el corazón del flujo "Push" que permite tiempo real.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Pub/Sub envía un ping. El simple hecho de recibirlo nos dice que hay actividad.
        // No procesamos el contenido del body por seguridad (está codificado), 
        // disparamos directamente la sincronización de los últimos mensajes.
        
        console.log('--- GMAIL WEBHOOK RECEIVED ---');
        
        // Ejecutamos la sincronización. Al no pasar proyectos, la acción los busca de Trello.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`Webhook procesado: ${result.newAlerts} alertas nuevas detectadas.`);
        } else {
            console.warn(`Sincronización fallida tras Webhook: ${result.error}`);
        }

        // Siempre respondemos 200 OK para que Pub/Sub no reintente infinitamente
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error procesando Webhook de Gmail:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
