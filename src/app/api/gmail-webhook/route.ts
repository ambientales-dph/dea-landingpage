import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
    try {
        // Pub/Sub envía un mensaje. No necesitamos el contenido exacto,
        // solo saber que "algo cambió" para disparar el Radar.
        const body = await req.json();
        const messageId = body.message?.messageId || 'unknown';
        
        console.log(`\n🚀 [GMAIL WEBHOOK] Notificación Push recibida (ID: ${messageId})`);
        
        // Ejecutamos la sincronización. Al no pasar proyectos, la busca dinámicamente.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`✅ [GMAIL WEBHOOK] Procesado correctamente.`);
        } else {
            console.warn(`⚠️ [GMAIL WEBHOOK] Error en sincronización: ${result.error}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('❌ [GMAIL WEBHOOK] Error crítico:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
