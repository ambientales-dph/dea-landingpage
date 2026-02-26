'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  Auth 
} from 'firebase/auth';

/**
 * Interfaz para los usuarios autorizados.
 */
interface AuthorizedUser {
  email: string;
  phone?: string;
  name?: string;
}

/**
 * Whitelist de personal autorizado.
 * Estructura preparada para incluir email y teléfono.
 */
const WHITELIST: AuthorizedUser[] = [
  { email: 'ambientales.dph@gmail.com', phone: '' },
  { email: 'nancy.neschuk@gmail.com', phone: '' },
  { email: 'luis.bree@gmail.com', phone: '' },
  { email: 'mariano.mediavilla@gmail.com', phone: '' },
  // Aquí pegaremos la lista que me pases
];

/**
 * Inicia el proceso de autenticación con Google.
 * Verifica si el correo electrónico del usuario está en la whitelist.
 */
export async function loginConGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const isAuthorized = WHITELIST.some(
      (authorized) => authorized.email.toLowerCase() === user.email?.toLowerCase()
    );

    if (!isAuthorized) {
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
