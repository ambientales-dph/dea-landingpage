import { NextResponse } from 'next/server';
import { syncGmailAlerts } from '@/app/actions/gmail-actions';

// Almacén temporal para evitar procesar el mismo mensaje de Pub/Sub dos veces en el mismo segundo
const processedMessages = new Set<string>();

/**
 * Endpoint para recibir notificaciones Push de Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const messageId = body.message?.messageId;
        
        if (!messageId || processedMessages.has(messageId)) {
            return NextResponse.json({ success: true, note: 'Duplicate or empty' });
        }

        // Marcamos como procesado y limpiamos después de 10 segundos
        processedMessages.add(messageId);
        setTimeout(() => processedMessages.delete(messageId), 10000);
        
        console.log(`\n🔔 [GMAIL WEBHOOK] Notificación Push recibida (ID: ${messageId})`);
        
        // Ejecutamos la sincronización.
        // No usamos 'await' aquí para responder rápido a Google y evitar reintentos duplicados,
        // pero Next.js a veces corta la ejecución si no hay await. Usamos syncGmailAlerts directamente.
        await syncGmailAlerts();
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('❌ [GMAIL WEBHOOK] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
