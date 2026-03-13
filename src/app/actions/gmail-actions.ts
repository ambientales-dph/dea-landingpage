
'use server';

import { getLatestEmails, GmailMessageSummary } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

/**
 * Escanea Gmail, analiza con IA y guarda alertas en Firestore.
 */
export async function syncGmailAlerts(availableProjects: { id: string, code: string, name: string }[]) {
    const { db } = initializeFirebase();
    
    try {
        const emails = await getLatestEmails();
        const mailAlertsRef = collection(db, 'mail_alerts');
        
        let newAlertsCount = 0;

        for (const email of emails) {
            // Verificar si este mail ya fue procesado
            const q = query(mailAlertsRef, where('mailId', '==', email.id));
            const existing = await getDocs(q);
            
            if (existing.empty) {
                // Analizar con IA
                const analysis = await matchMailToProject({
                    subject: email.subject,
                    snippet: email.snippet,
                    availableProjects
                });

                if (analysis.matchedProjectCode && analysis.confidence > 0.6) {
                    const project = availableProjects.find(p => p.code === analysis.matchedProjectCode);
                    
                    await addDoc(mailAlertsRef, {
                        mailId: email.id,
                        subject: email.subject,
                        from: email.from,
                        date: email.date,
                        snippet: email.snippet,
                        detectedProjectCode: analysis.matchedProjectCode,
                        detectedProjectName: project?.name || 'Obra detectada',
                        cardId: analysis.matchedProjectId,
                        status: 'new',
                        processedAt: serverTimestamp(),
                        reasoning: analysis.reasoning
                    });
                    newAlertsCount++;
                }
            }
        }

        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('Error in syncGmailAlerts:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Marca una alerta como leída o descartada.
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
