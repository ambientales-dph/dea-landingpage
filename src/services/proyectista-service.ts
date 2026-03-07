
'use client';

import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

export interface ProyectistaData {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  observations?: string;
  lastUpdated?: any;
}

/**
 * Obtiene la lista de proyectistas desde Firestore.
 */
export async function getProyectistasFromFirestore(db: Firestore): Promise<ProyectistaData[]> {
  const q = query(collection(db, 'proyectistas'), orderBy('name', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ProyectistaData));
}

/**
 * Guarda o actualiza un proyectista en Firestore.
 */
export async function saveProyectista(db: Firestore, data: ProyectistaData) {
  const { id, ...rest } = data;
  const payload = {
    ...rest,
    lastUpdated: serverTimestamp()
  };

  if (id) {
    const docRef = doc(db, 'proyectistas', id);
    await updateDoc(docRef, payload);
    return id;
  } else {
    const docRef = await addDoc(collection(db, 'proyectistas'), payload);
    return docRef.id;
  }
}

/**
 * Elimina un proyectista de Firestore.
 */
export async function deleteProyectista(db: Firestore, id: string) {
  await deleteDoc(doc(db, 'proyectistas', id));
}

/**
 * Suscripción en tiempo real a la lista de proyectistas.
 */
export function subscribeToProyectistas(db: Firestore, callback: (proyectistas: ProyectistaData[]) => void) {
  const q = query(collection(db, 'proyectistas'), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const proyectistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ProyectistaData));
    callback(proyectistas);
  });
}
