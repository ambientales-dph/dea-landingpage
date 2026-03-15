'use server';

import { getLatestEmails, setupGmailWatch } from '@/services/google-gmail';
import { matchMailToProject } from '@/ai/flows/match-mail-project';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Escanea Gmail, analiza con IA y guarda alertas en Firestore.
 * Ahora también alimenta la colección 'notificaciones_obras' para tiempo real.
 */
export async function syncGmailAlerts(providedProjects: { id: string, code: string, name: string }[] | null = null) {
    const { db } = initializeFirebase();
    
    try {
        console.log(`   [RADAR] Iniciando proceso de análisis...`);
        let projects = providedProjects;
        
        if (!projects) {
            console.log(`   [RADAR] Obteniendo proyectos desde Trello...`);
            const allCards = await getAllCardsFromAllBoards();
            projects = allCards.map(c => {
                const codeMatch = c.name.match(/\(([^)]+)\)$/);
                return {
                    id: c.id,
                    code: codeMatch ? codeMatch[1] : 'S/C',
                    name: c.name.replace(/\([^)]+\)$/, '').trim()
                };
            }).filter(p => p.code !== 'S/C');
            console.log(`   [RADAR] OK: ${projects.length} proyectos con código encontrados.`);
        }

        if (projects.length === 0) {
            console.warn(`   [RADAR] No hay proyectos con códigos válidos (ej: ARG001) para comparar.`);
            return { success: true, newAlerts: 0 };
        }

        console.log(`   [RADAR] Consultando últimos emails de la API de Gmail...`);
        const emails = await getLatestEmails();
        console.log(`   [RADAR] OK: ${emails.length} correos recibidos para analizar.`);
        
        const mailAlertsRef = collection(db, 'mail_alerts');
        const notificacionesRef = collection(db, 'notificaciones_obras');
        let newAlertsCount = 0;

        const processPromises = emails.map(async (email) => {
            try {
                // Verificar si este mail ya fue procesado antes para no duplicar notificaciones
                const q = query(mailAlertsRef, where('mailId', '==', email.id));
                const existing = await getDocs(q);
                
                if (existing.empty) {
                    console.log(`   [ANALIZANDO] "${email.subject}" (Remitente: ${email.from})`);
                    
                    const analysis = await matchMailToProject({
                        subject: email.subject,
                        snippet: email.snippet,
                        availableProjects: projects!
                    });

                    if (analysis.matchedProjectCode) {
                        console.log(`     ✅ VÍNCULO DETECTADO: ${analysis.matchedProjectCode} (Confianza: ${analysis.confidence})`);
                        const project = projects!.find(p => p.code === analysis.matchedProjectCode);
                        
                        // 1. Guardamos la alerta técnica completa
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

                        // 2. Guardamos la notificación simplificada para el listener de tiempo real del frontend
                        await addDoc(notificacionesRef, {
                            obra_relacionada: `${analysis.matchedProjectCode} - ${project?.name || 'Obra detectada'}`,
                            resumen_ia: analysis.reasoning,
                            fecha_recepcion: serverTimestamp(),
                            leido: false,
                            mailSubject: email.subject
                        });

                        return true;
                    } else {
                        console.log(`     ❌ Sin relación clara.`);
                    }
                } else {
                    // console.log(`     - Mail ${email.id} ya procesado anteriormente.`);
                }
            } catch (err: any) {
                console.error(`   [ERROR INDIVIDUAL] Procesando mail ${email.id}:`, err.message);
            }
            return false;
        });

        const results = await Promise.all(processPromises);
        newAlertsCount = results.filter(r => r === true).length;

        return { success: true, newAlerts: newAlertsCount };
    } catch (error: any) {
        console.error('❌ [RADAR ERROR CRÍTICO]:', error.message);
        return { 
            success: false, 
            error: error.message || 'Error desconocido al sincronizar Gmail.' 
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
