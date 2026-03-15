'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Escanea Gmail con un enfoque en palabras clave y nombres de lugares.
 */
export async function syncGmailAlerts(providedProjects: { id: string, code: string, name: string }[] | null = null) {
    const { db } = initializeFirebase();
    
    try {
        console.log(`   [RADAR] Iniciando escaneo por palabras clave...`);
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
        const mailAlertsRef = collection(db, 'mail_alerts');
        const notificacionesRef = collection(db, 'notificaciones_obras');
        let newAlertsCount = 0;

        const processPromises = emails.map(async (email) => {
            try {
                const q = query(mailAlertsRef, where('mailId', '==', email.id));
                const existing = await getDocs(q);
                
                if (existing.empty) {
                    const analysis = await matchMailToProject({
                        subject: email.subject,
                        snippet: email.snippet,
                        availableProjects: projects!
                    });

                    if (analysis.matchedProjectCode && analysis.confidence > 0.4) {
                        const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                        const placeName = analysis.matchedProjectName || project?.name || 'un proyecto';

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
                            processedAt: serverTimestamp()
                        });

                        // 2. Notificación simplificada para el frontend (Lo que verá el usuario)
                        await addDoc(notificacionesRef, {
                            obra_relacionada: placeName,
                            fecha_recepcion: serverTimestamp(),
                            leido: false,
                            mailSubject: email.subject
                        });

                        console.log(`     ✅ DETECTADO: "${placeName}" en mail "${email.subject}"`);
                        return true;
                    }
                }
            } catch (err: any) {
                console.error(`   [ERROR] Procesando mail:`, err.message);
            }
            return false;
        });

        const results = await Promise.all(processPromises);
        newAlertsCount = results.filter(r => r === true).length;

        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('❌ [RADAR ERROR]:', error.message);
        return { success: false, error: error.message };
    }
}

export async function activateRealTimeRadar() {
    const topic = process.env.GMAIL_PUB_SUB_TOPIC;
    if (!topic) return { success: false, error: 'Falta GMAIL_PUB_SUB_TOPIC' };
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
