
'use server';

import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

// Configuración del proyecto de ORIGEN (el viejo) extraída del .env
const sourceConfig = {
  apiKey: process.env.SOURCE_FIREBASE_API_KEY,
  authDomain: process.env.SOURCE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.SOURCE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.SOURCE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.SOURCE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.SOURCE_FIREBASE_APP_ID,
};

/**
 * Ejecuta la migración masiva de datos desde el Firestore original al nuevo.
 * Esta función está diseñada para ejecutarse una sola vez.
 * ES UNA OPERACIÓN DE COPIA: No altera ni borra nada en el proyecto original.
 */
export async function migrateFirestoreData() {
  if (!sourceConfig.apiKey || !sourceConfig.projectId) {
    return { success: false, message: 'Faltan las credenciales del proyecto de origen en el archivo .env' };
  }

  // 1. Inicializar conexión al proyecto viejo
  const sourceAppName = 'migrationSource';
  let sourceApp;
  try {
    sourceApp = initializeApp(sourceConfig, sourceAppName);
  } catch (e) {
    return { success: false, message: 'Error al conectar con el proyecto de origen. Revisá las credenciales.' };
  }

  const sourceDb = getFirestore(sourceApp);
  
  // 2. Conexión al proyecto ACTUAL (destino)
  // Nota: Importamos el inicializador local para usar la instancia ya configurada
  const { db: targetDb } = require('@/firebase').initializeFirebase();

  try {
    console.log('Iniciando migración de Categorías...');
    // --- MIGRAR CATEGORÍAS ---
    const sourceCatsSnap = await getDocs(collection(sourceDb, 'categories'));
    const catBatch = writeBatch(targetDb);
    sourceCatsSnap.forEach((d) => {
      const targetRef = doc(targetDb, 'timeline_categories', d.id);
      catBatch.set(targetRef, d.data());
    });
    await catBatch.commit();

    console.log('Iniciando migración de Proyectos e Hitos...');
    // --- MIGRAR PROYECTOS E HITOS (SUBCOLECCIONES) ---
    const sourceProjectsSnap = await getDocs(collection(sourceDb, 'projects'));
    
    for (const projectDoc of sourceProjectsSnap.docs) {
      // Guardar el proyecto en el destino
      const targetProjectRef = doc(targetDb, 'timeline_projects', projectDoc.id);
      await setDoc(targetProjectRef, projectDoc.data());

      // Migrar hitos de este proyecto
      const sourceMilestonesSnap = await getDocs(collection(sourceDb, 'projects', projectDoc.id, 'milestones'));
      const milestoneBatch = writeBatch(targetDb);
      
      sourceMilestonesSnap.forEach((mDoc) => {
        // Corregido: Usamos projectDoc.id para la ruta del destino
        const targetMilestoneRef = doc(targetDb, 'timeline_projects', projectDoc.id, 'milestones', mDoc.id);
        milestoneBatch.set(targetMilestoneRef, mDoc.data());
      });
      
      if (sourceMilestonesSnap.size > 0) {
        await milestoneBatch.commit();
      }
    }

    // Limpieza de la conexión temporal
    await deleteApp(sourceApp);
    
    return { 
      success: true, 
      message: `Migración completada con éxito: ${sourceCatsSnap.size} categorías y ${sourceProjectsSnap.size} proyectos con sus respectivos hitos copiados.` 
    };

  } catch (error: any) {
    console.error('Error durante la migración:', error);
    if (sourceApp) await deleteApp(sourceApp);
    return { success: false, message: `Fallo en la migración: ${error.message}` };
  }
}
