import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const messageId = body.message?.messageId || 'unknown';
        
        console.log(`\n-------------------------------------------`);
        console.log(`🚀 [GMAIL WEBHOOK] Mensaje Push recibido (ID: ${messageId})`);
        console.log(`   - Timestamp: ${new Date().toISOString()}`);
        
        // Ejecutamos la sincronización.
        // Importante: No pasamos proyectos para que los busque frescos de Trello.
        const result = await syncGmailAlerts();
        
        if (result.success) {
            console.log(`✅ [GMAIL WEBHOOK] Sincronización finalizada. Nuevas alertas: ${result.newAlerts}`);
        } else {
            console.error(`⚠️ [GMAIL WEBHOOK] Error detectado: ${result.error}`);
        }
        console.log(`-------------------------------------------\n`);

        // Siempre respondemos 200 a Google para que no reintente el envío infinitamente.
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('❌ [GMAIL WEBHOOK] Error crítico procesando el request:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
