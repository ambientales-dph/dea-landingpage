
'use server';

import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

const sourceConfig = {
  apiKey: process.env.SOURCE_FIREBASE_API_KEY,
  authDomain: process.env.SOURCE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.SOURCE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.SOURCE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.SOURCE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.SOURCE_FIREBASE_APP_ID,
};

/**
 * Migra datos desde el proyecto original a este nuevo Firestore de forma segura.
 * Ahora apunta correctamente a 'timeline_projects' y 'timeline_categories' (con guion bajo).
 */
export async function migrateFirestoreData() {
  if (!sourceConfig.apiKey || !sourceConfig.projectId) {
    return { success: false, message: 'Faltan las credenciales del proyecto de origen en el archivo .env' };
  }

  const sourceAppName = 'migrationSource';
  let sourceApp;
  try {
    sourceApp = initializeApp(sourceConfig, sourceAppName);
  } catch (e) {
    return { success: false, message: 'Error al conectar con el proyecto de origen.' };
  }

  const sourceDb = getFirestore(sourceApp);
  const { db: targetDb } = require('@/firebase').initializeFirebase();

  try {
    // 1. MIGRAR CATEGORÍAS (Hacia timeline_categories)
    const sourceCatsSnap = await getDocs(collection(sourceDb, 'categories'));
    const catBatch = writeBatch(targetDb);
    sourceCatsSnap.forEach((d) => {
      const targetRef = doc(targetDb, 'timeline_categories', d.id);
      catBatch.set(targetRef, d.data(), { merge: true });
    });
    await catBatch.commit();

    // 2. MIGRAR PROYECTOS E HITOS (Hacia timeline_projects)
    const sourceProjectsSnap = await getDocs(collection(sourceDb, 'projects'));
    let projectsCount = 0;
    
    for (const projectDoc of sourceProjectsSnap.docs) {
      const targetProjectRef = doc(targetDb, 'timeline_projects', projectDoc.id);
      await setDoc(targetProjectRef, projectDoc.data(), { merge: true });

      // Migrar hitos de este proyecto
      const sourceMilestonesSnap = await getDocs(collection(sourceDb, 'projects', projectDoc.id, 'milestones'));
      
      const milestones = sourceMilestonesSnap.docs;
      for (let i = 0; i < milestones.length; i += 400) {
        const batch = writeBatch(targetDb);
        const chunk = milestones.slice(i, i + 400);
        
        chunk.forEach((mDoc) => {
          const targetMilestoneRef = doc(targetDb, 'timeline_projects', projectDoc.id, 'milestones', mDoc.id);
          batch.set(targetMilestoneRef, mDoc.data(), { merge: true });
        });
        
        await batch.commit();
      }
      projectsCount++;
    }

    await deleteApp(sourceApp);
    
    return { 
      success: true, 
      message: `Migración segura completada: Se fusionaron ${projectsCount} proyectos y sus categorías en 'timeline_projects' y 'timeline_categories'.` 
    };

  } catch (error: any) {
    console.error('Error durante la migración:', error);
    if (sourceApp) await deleteApp(sourceApp);
    return { success: false, message: `Fallo en la migración: ${error.message}` };
  }
}
