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
 * Whitelist de personal autorizado del Departamento de Estudios Ambientales.
 * Incluye nombre, correo y celular para futuras integraciones.
 */
const WHITELIST: AuthorizedUser[] = [
  { name: 'Nancy Neschuk', email: 'nancyneschuk@gmail.com', phone: '+549 221 465-1214' },
  { name: 'Luis Bree', email: 'luisbree@gmail.com', phone: '+549 221 318-3040' },
  { name: 'Norma Bordón', email: 'normabordon@hotmail.com', phone: '+549 221 575-5057' },
  { name: 'Gonzalo Castro', email: 'gacastrocp@gmail.com', phone: '+549 223 592-7135' },
  { name: 'Eugenia Agabios', email: 'eugeniaagabios@gmail.com', phone: '+549 221 590-9901' },
  { name: 'Alan Santamarina', email: 'alansantamarina@gmail.com', phone: '+549 11 4047-6695' },
  { name: 'Canela Castro', email: 'canelamdq@gmail.com', phone: '+549 221 643-7878' },
  { name: 'Cintia Di Grazia', email: 'cintiadigrazia@gmail.com', phone: '+549 221 614-2863' },
  { name: 'Mariano Mediavilla', email: 'marianomediavilla.pba@gmail.com', phone: '+549 11 6210-8377' },
  { name: 'Marina Raggio', email: 'marinaandrearaggio@gmail.com', phone: '+549 221 418-4274' },
  { name: 'Luciana Lugones', email: 'lucianalugones@gsuite.fcnym.unlp.edu.ar', phone: '+549 221 543-5150' },
  { name: 'Pablo Giner', email: 'pabloginer@yahoo.com.ar', phone: '+549 221 418-7203' },
  { name: 'Vanina Kapeika', email: 'vaninakapeika@gmail.com', phone: '+549 221 507-3851' },
  { name: 'Virginia Martínez Alcántara', email: 'vmalcan@gmail.com', phone: '+549 221 440-7004' },
  { name: 'Luciana Landa', email: 'luuciana.landa@gmail.com', phone: '+549 221 590-1887' },
  { name: 'María Ángeles González', email: 'mdlangeles.dph@gmail.com', phone: '+549 221 671-3634' },
  { name: 'Celina Bertoni', email: 'chechechelina@gmail.com', phone: '+549 221 566-6827' },
  { name: 'Ariel Menescardi', email: 'arielmenescardi@hotmail.com', phone: '+549 221 440-0870' },
  { name: 'Sandra Lafalce', email: 'sandru_18neta@hotmail.com', phone: '+549 221 643-6451' },
  { name: 'Andrea D´Emilio', email: 'avdemilio@gmail.com', phone: '+549 221 555-6058' },
  { name: 'Carolina Silva', email: 'karitosilva@gmail.com', phone: '+549 221 542-6189' },
  { name: 'Joaquín Montorsi', email: 'joaquinmontorsi@gmail.com', phone: '+549 221 654-5669' },
  { email: 'ambientales.dph@gmail.com', name: 'DEA Genérico' },
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
