'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  Auth 
} from 'firebase/auth';
import { WHITELIST, isUserAuthorized } from '@/lib/auth-data';

export { WHITELIST, isUserAuthorized };

/**
 * Inicia el proceso de autenticación con Google.
 */
export async function loginConGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userEmail = (user.email || '').trim().toLowerCase();

    if (!isUserAuthorized(userEmail)) {
      throw new Error(`El correo "${userEmail}" no está en la lista de personal autorizado.`);
    }

    return user;
  } catch (error: any) {
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Dominio no autorizado. Agregá esta URL en la consola de Firebase.');
    }
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
