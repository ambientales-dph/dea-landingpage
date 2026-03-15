import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const messageId = body.message?.messageId || 'unknown';
        
        console.log(`\n🔔 [GMAIL WEBHOOK] Mensaje Push detectado (ID: ${messageId})`);
        
        // Ejecutamos la sincronización.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`✅ [GMAIL WEBHOOK] Proceso completado.`);
        } else {
            console.error(`⚠️ [GMAIL WEBHOOK] Falló la sincronización: ${result.error}`);
        }

        // Siempre respondemos 200 a Google para evitar reintentos infinitos
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('❌ [GMAIL WEBHOOK] Error crítico:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
