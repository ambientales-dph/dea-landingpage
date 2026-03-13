'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Escanea Gmail, analiza con IA y guarda alertas en Firestore.
 * Optimizada para procesamiento en paralelo y manejo de errores detallado.
 */
export async function syncGmailAlerts(providedProjects: { id: string, code: string, name: string }[] | null = null) {
    const { db } = initializeFirebase();
    
    try {
        let projects = providedProjects;
        
        // Si no se proveen proyectos (ej: llamado desde webhook), los buscamos dinámicamente
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

        const emails = await getLatestEmails();
        const mailAlertsRef = collection(db, 'mail_alerts');
        
        let newAlertsCount = 0;

        // Procesamos los correos en paralelo para evitar timeouts del servidor
        const processPromises = emails.map(async (email) => {
            try {
                // Verificamos en Firestore si este mailId ya fue procesado
                const q = query(mailAlertsRef, where('mailId', '==', email.id));
                const existing = await getDocs(q);
                
                if (existing.empty) {
                    // Análisis con Gemini IA
                    const analysis = await matchMailToProject({
                        subject: email.subject,
                        snippet: email.snippet,
                        availableProjects: projects!
                    });

                    // Umbral de confianza ajustado a 0.5 para entorno de pruebas
                    if (analysis.matchedProjectCode && (analysis.confidence || 0) > 0.5) {
                        const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                        
                        await addDoc(mailAlertsRef, {
                            mailId: email.id,
                            subject: email.subject,
                            from: email.from,
                            date: email.date,
                            snippet: email.snippet,
                            detectedProjectCode: analysis.matchedProjectCode,
                            detectedProjectName: project?.name || 'Obra detectada',
                            cardId: project?.id || analysis.matchedProjectId,
                            status: 'new',
                            processedAt: serverTimestamp(),
                            reasoning: analysis.reasoning
                        });
                        return true;
                    }
                }
            } catch (err) {
                console.error(`Error procesando mail individual ${email.id}:`, err);
            }
            return false;
        });

        const results = await Promise.all(processPromises);
        newAlertsCount = results.filter(r => r === true).length;

        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('Error crítico en syncGmailAlerts:', error);
        return { 
            success: false, 
            error: error.message || 'Error desconocido al sincronizar Gmail. Revisa los logs del servidor.' 
        };
    }
}

/**
 * Inicia la suscripción a notificaciones Push de Gmail.
 */
export async function activateRealTimeRadar() {
    const topic = process.env.GMAIL_PUB_SUB_TOPIC;
    if (!topic) {
        return { 
            success: false, 
            error: 'Falta la variable GMAIL_PUB_SUB_TOPIC en el archivo .env' 
        };
    }
    return await setupGmailWatch(topic);
}

/**
 * Marca una alerta como leída o descartada en Firestore.
 */
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
