'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Sincroniza alertas de Gmail analizando solo correos no leídos.
 * Usa acceso directo por ID de documento para evitar errores de permisos.
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

        const results = await Promise.all(emails.map(async (email) => {
            try {
                // ACCESO DIRECTO: Usamos el ID del mail como ID del documento
                const alertDocRef = doc(db, 'mail_alerts', email.id);
                const existingSnap = await getDoc(alertDocRef);
                
                if (existingSnap.exists()) {
                    return false;
                }

                console.log(`   [IA] Analizando: "${email.subject.substring(0, 30)}..."`);
                
                const analysis = await matchMailToProject({
                    subject: email.subject,
                    snippet: email.snippet,
                    availableProjects: projects!
                });

                if (analysis.matchedProjectCode) {
                    const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                    const placeName = analysis.matchedProjectName || project?.name || 'Obra Detectada';

                    console.log(`     ✅ VINCULADO: "${placeName}"`);

                    // Guardamos la alerta técnica usando setDoc (ID explícito)
                    await setDoc(alertDocRef, {
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

                    // Guardamos la notificación simplificada usando setDoc (ID explícito)
                    const notifDocRef = doc(db, 'notificaciones_obras', `notif_${email.id}`);
                    await setDoc(notifDocRef, {
                        obra_relacionada: placeName,
                        fecha_recepcion: serverTimestamp(),
                        leido: false,
                        mailSubject: email.subject,
                        resumen_ia: analysis.reasoning
                    });

                    return true;
                }
                
                return false;
            } catch (err: any) {
                console.error(`   [ERROR FIRESTORE/IA EN MAIL ${email.id}]:`, err.message);
                return false;
            }
        }));

        const newAlertsCount = results.filter(r => r === true).length;
        console.log(`🏁 [RADAR] Finalizado. Alertas nuevas guardadas: ${newAlertsCount}\n`);
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
