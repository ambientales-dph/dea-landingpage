
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
 * Utiliza MERGE para no borrar información vital existente en el portal.
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
    // 1. MIGRAR CATEGORÍAS (Usando merge: true)
    const sourceCatsSnap = await getDocs(collection(sourceDb, 'categories'));
    const catBatch = writeBatch(targetDb);
    sourceCatsSnap.forEach((d) => {
      const targetRef = doc(targetDb, 'categories', d.id);
      catBatch.set(targetRef, d.data(), { merge: true });
    });
    await catBatch.commit();

    // 2. MIGRAR PROYECTOS E HITOS
    const sourceProjectsSnap = await getDocs(collection(sourceDb, 'projects'));
    let projectsCount = 0;
    
    for (const projectDoc of sourceProjectsSnap.docs) {
      const targetProjectRef = doc(targetDb, 'projects', projectDoc.id);
      // Fusionamos los datos, nunca sobrescribimos el documento entero
      await setDoc(targetProjectRef, projectDoc.data(), { merge: true });

      // Migrar hitos de este proyecto
      const sourceMilestonesSnap = await getDocs(collection(sourceDb, 'projects', projectDoc.id, 'milestones'));
      
      const milestones = sourceMilestonesSnap.docs;
      // Lotes para evitar límites de Firestore
      for (let i = 0; i < milestones.length; i += 400) {
        const batch = writeBatch(targetDb);
        const chunk = milestones.slice(i, i + 400);
        
        chunk.forEach((mDoc) => {
          const targetMilestoneRef = doc(targetDb, 'projects', projectDoc.id, 'milestones', mDoc.id);
          batch.set(targetMilestoneRef, mDoc.data(), { merge: true });
        });
        
        await batch.commit();
      }
      projectsCount++;
    }

    await deleteApp(sourceApp);
    
    return { 
      success: true, 
      message: `Migración segura completada: Se fusionaron datos de ${projectsCount} proyectos y sus hitos históricos sin afectar la información actual.` 
    };

  } catch (error: any) {
    console.error('Error durante la migración:', error);
    if (sourceApp) await deleteApp(sourceApp);
    return { success: false, message: `Fallo en la migración: ${error.message}` };
  }
}
