
'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Escanea Gmail con un enfoque en palabras clave y nombres de lugares.
 * Imprime logs detallados en la terminal para monitoreo.
 */
export async function syncGmailAlerts(providedProjects: { id: string, code: string, name: string }[] | null = null) {
    const { db } = initializeFirebase();
    
    try {
        console.log(`\n🔍 [RADAR] Iniciando escaneo profundo...`);
        let projects = providedProjects;
        
        if (!projects) {
            console.log(`   - Obteniendo lista de obras desde Trello...`);
            const allCards = await getAllCardsFromAllBoards();
            projects = allCards.map(c => {
                const codeMatch = c.name.match(/\(([^)]+)\)$/);
                return {
                    id: c.id,
                    code: codeMatch ? codeMatch[1] : 'S/C',
                    name: c.name.replace(/\([^)]+\)$/, '').trim()
                };
            }).filter(p => p.code !== 'S/C');
            console.log(`   - ${projects.length} obras identificadas.`);
        }

        if (projects.length === 0) {
            console.log(`   ⚠️ No hay proyectos activos para comparar.`);
            return { success: true, newAlerts: 0 };
        }

        console.log(`   - Consultando últimos mensajes en Gmail...`);
        const emails = await getLatestEmails();
        console.log(`   - ${emails.length} correos encontrados en el INBOX.`);

        const mailAlertsRef = collection(db, 'mail_alerts');
        const notificacionesRef = collection(db, 'notificaciones_obras');
        let newAlertsCount = 0;

        const processPromises = emails.map(async (email) => {
            try {
                // Verificar si ya procesamos este mailId antes
                const q = query(mailAlertsRef, where('mailId', '==', email.id));
                const existing = await getDocs(q);
                
                if (!existing.empty) {
                    console.log(`   [SKIP] Mail ID ${email.id} ya procesado anteriormente.`);
                    return false;
                }

                console.log(`   [IA] Analizando: "${email.subject}"...`);
                
                const analysis = await matchMailToProject({
                    subject: email.subject,
                    snippet: email.snippet,
                    availableProjects: projects!
                });

                // Umbral de confianza más bajo para facilitar detección de lugares
                if (analysis.matchedProjectCode && (analysis.confidence > 0.4 || analysis.reasoning.toLowerCase().includes('lugar'))) {
                    const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                    const placeName = analysis.matchedProjectName || project?.name || 'un proyecto';

                    console.log(`     ✅ COINCIDENCIA DETECTADA: "${placeName}"`);
                    console.log(`     📝 Motivo: ${analysis.reasoning}`);

                    // 1. Guardamos alerta técnica
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

                    // 2. Notificación simplificada para el frontend
                    await addDoc(notificacionesRef, {
                        obra_relacionada: placeName,
                        fecha_recepcion: serverTimestamp(),
                        leido: false,
                        mailSubject: email.subject
                    });

                    return true;
                } else {
                    console.log(`     ❌ IGNORADO: No se detectó relación geográfica clara.`);
                    return false;
                }
            } catch (err: any) {
                console.error(`   [ERROR] Falló procesamiento de: "${email.subject}":`, err.message);
            }
            return false;
        });

        const results = await Promise.all(processPromises);
        newAlertsCount = results.filter(r => r === true).length;

        console.log(`🏁 [RADAR] Finalizado. Alertas nuevas: ${newAlertsCount}\n`);
        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('❌ [RADAR ERROR CRÍTICO]:', error.message);
        return { success: false, error: error.message };
    }
}

export async function activateRealTimeRadar() {
    const topic = process.env.GMAIL_PUB_SUB_TOPIC;
    if (!topic) return { success: false, error: 'Falta GMAIL_PUB_SUB_TOPIC en .env' };
    console.log(`🚀 [RADAR] Activando Watch de Gmail en el Topic: ${topic}`);
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
