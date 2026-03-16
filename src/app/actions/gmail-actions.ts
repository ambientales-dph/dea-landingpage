'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Sincroniza alertas de Gmail analizando solo correos no leídos.
 */
export async function syncGmailAlerts(providedProjects: { id: string, code: string, name: string }[] | null = null) {
    const { db } = initializeFirebase();
    
    try {
        console.log(`\n🔍 [RADAR] Iniciando escaneo...`);
        let projects = providedProjects;
        
        if (!projects) {
            const allCards = await getAllCardsFromAllBoards();
            projects = allCards.map(c => {
                const codeMatch = c.name.match(/\(([^)]+)\)$/);
                return {
                    id: c.id,
                    code: codeMatch ? codeMatch[1] : 'S/C',
                    name: c.name.replace(/\([^)]+\)$/, '').trim()
                };
            }).filter(p => p.code !== 'S/C');
        }

        if (projects.length === 0) return { success: true, newAlerts: 0 };

        const emails = await getLatestEmails();
        console.log(`   - ${emails.length} correos nuevos detectados.`);

        if (emails.length === 0) return { success: true, newAlerts: 0 };

        const mailAlertsRef = collection(db, 'mail_alerts');
        const notificacionesRef = collection(db, 'notificaciones_obras');
        
        const results = await Promise.all(emails.map(async (email) => {
            try {
                // Verificación ultra-rápida de duplicados
                const q = query(mailAlertsRef, where('mailId', '==', email.id));
                const existing = await getDocs(q);
                if (!existing.empty) return false;

                console.log(`   [IA] Analizando: "${email.subject}"...`);
                
                const analysis = await matchMailToProject({
                    subject: email.subject,
                    snippet: email.snippet,
                    availableProjects: projects!
                });

                // Prioridad absoluta a nombres de lugares o ríos
                const hasGeographicMatch = analysis.reasoning.toLowerCase().includes('lugar') || 
                                         analysis.reasoning.toLowerCase().includes('rio') || 
                                         analysis.reasoning.toLowerCase().includes('municipio');

                if (analysis.matchedProjectCode && (analysis.confidence > 0.3 || hasGeographicMatch)) {
                    const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                    const placeName = analysis.matchedProjectName || project?.name || 'un proyecto';

                    console.log(`     ✅ VINCULADO: "${placeName}"`);

                    // Guardamos ambos documentos en Firestore
                    await addDoc(mailAlertsRef, {
                        mailId: email.id,
                        subject: email.subject,
                        from: email.from,
                        date: email.date,
                        snippet: email.snippet,
                        detectedProjectCode: analysis.matchedProjectCode,
                        detectedProjectName: project?.name || placeName,
                        cardId: project?.id,
                        status: 'new',
                        processedAt: serverTimestamp(),
                        reasoning: analysis.reasoning
                    });

                    await addDoc(notificacionesRef, {
                        obra_relacionada: placeName,
                        fecha_recepcion: serverTimestamp(),
                        leido: false,
                        mailSubject: email.subject,
                        resumen_ia: analysis.reasoning
                    });

                    return true;
                }
                
                console.log(`     ❌ IGNORADO: Sin relación geográfica clara.`);
                return false;
            } catch (err: any) {
                console.error(`   [ERROR FIRESTORE/IA]:`, err.message);
                return false;
            }
        }));

        const newAlertsCount = results.filter(r => r === true).length;
        console.log(`🏁 [RADAR] Finalizado. Alertas: ${newAlertsCount}\n`);
        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('❌ [RADAR ERROR CRÍTICO]:', error.message);
        return { success: false, error: error.message };
    }
}

export async function activateRealTimeRadar() {
    const topic = process.env.GMAIL_PUB_SUB_TOPIC;
    if (!topic) return { success: false, error: 'Falta GMAIL_PUB_SUB_TOPIC en .env' };
    return await setupGmailWatch(topic);
}

export async function updateAlertStatus(alertId: string, status: 'read' | 'dismissed') {
    const { db } = initializeFirebase();
    try {
        const alertRef = doc(db, 'mail_alerts', alertId);
        await updateDoc(alertRef, { status });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
