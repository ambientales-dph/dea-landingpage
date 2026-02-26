'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  Auth 
} from 'firebase/auth';

/**
 * Whitelist de correos electrónicos autorizados para acceder a la aplicación.
 * Solo los usuarios en esta lista podrán mantener una sesión activa.
 */
const WHITELIST_EMAILS = [
  'ambientales.dph@gmail.com',
  'nancy.neschuk@gmail.com',
  'luis.bree@gmail.com',
  'mariano.mediavilla@gmail.com',
  // Agregá aquí los correos reales de los integrantes del departamento
];

/**
 * Inicia el proceso de autenticación con Google.
 * Verifica si el correo electrónico del usuario está en la lista blanca.
 */
export async function loginConGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  // Forzamos la selección de cuenta para facilitar pruebas
  provider.setCustomParameters({ prompt: 'select_account' });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (user.email && !WHITELIST_EMAILS.includes(user.email.toLowerCase())) {
      // Si el correo no está autorizado, cerramos la sesión inmediatamente
      await firebaseSignOut(auth);
      throw new Error('Tu correo no está en la lista de personal autorizado del Departamento de Estudios Ambientales.');
    }

    return user;
  } catch (error: any) {
    console.error('Error durante el inicio de sesión:', error);
    throw error;
  }
}

/**
 * Cierra la sesión activa del usuario.
 */
export async function cerrarSesion(auth: Auth) {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw error;
  }
}
