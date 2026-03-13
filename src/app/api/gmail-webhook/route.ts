
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
        // Solo nos interesa saber que el evento ocurrió para disparar el escaneo.
        const messageId = body.message?.messageId || 'unknown';
        const publishTime = body.message?.publishTime || 'unknown';
        
        console.log(`\n🚀 [GMAIL WEBHOOK] Notificación recibida!`);
        console.log(`   ID Mensaje: ${messageId}`);
        console.log(`   Hora: ${publishTime}`);
        console.log(`   Iniciando sincronización con IA...\n`);
        
        // Ejecutamos la sincronización. Al no pasar proyectos, la acción los busca de Trello.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`✅ [GMAIL WEBHOOK] Procesado: ${result.newAlerts} alertas nuevas generadas.`);
        } else {
            console.warn(`⚠️ [GMAIL WEBHOOK] Sincronización fallida: ${result.error}`);
        }

        // Siempre respondemos 200 OK para que Pub/Sub no reintente infinitamente
        return NextResponse.json({ success: true, messageId });
    } catch (error: any) {
        console.error('❌ [GMAIL WEBHOOK] Error crítico procesando la notificación:', error.message);
        // Respondemos 200 igual para evitar bucles de reintento de Google si el error es de parseo
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
