
import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Pub/Sub envía los datos base64 en body.message.data
        // No necesitamos decodificarlo obligatoriamente, ya que el ping nos indica
        // que hay cambios. Disparamos una sincronización de los últimos correos.
        
        console.log('--- GMAIL WEBHOOK RECEIVED ---');
        
        // Ejecutamos el sync. Al no pasarle proyectos, el action los buscará de Trello.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`Webhook processed: ${result.newAlerts} new alerts found.`);
        } else {
            console.warn(`Webhook sync failed: ${result.error}`);
        }

        // Respondemos 200 OK para que Pub/Sub no reintente
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Webhook processing error:', error.message);
        // Respondemos 200 de todas formas para evitar bucles de reintento si es un error de lógica
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
