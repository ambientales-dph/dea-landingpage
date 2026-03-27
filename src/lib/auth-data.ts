/**
 * Datos de personal y proyectistas del Departamento de Estudios Ambientales.
 * Se separa el personal interno (con acceso al sistema) de los proyectistas externos (solo contacto).
 */
export interface AuthorizedUser {
  email: string;
  phone?: string;
  name?: string;
}

// --- PERSONAL INTERNO DEA (SÍ tienen permiso de acceso al sistema) ---
const INTERNAL_STAFF: AuthorizedUser[] = [
  { name: 'Nancy Neschuk', email: 'nancyneschuk@gmail.com', phone: '+549 221 465-1214' },
  { name: 'Luis Bree', email: 'luisbree@gmail.com', phone: '+549 221 318-3040' },
  { name: 'Norma Bordón', email: 'no68si40@gmail.com', phone: '+549 221 575-5057' },
  { name: 'Gonzalo Castro', email: 'gacastrocp@gmail.com', phone: '+549 223 592-7135' },
  { name: 'Eugenia Agabios', email: 'eugeniaagabios@gmail.com', phone: '+549 221 590-9901' },
  { name: 'Alan Santamarina', email: 'alansantamarina@gmail.com', phone: '+549 11 4047-6695' },
  { name: 'Canela Castro', email: 'canelamdq@gmail.com', phone: '+549 221 643-7878' },
  { name: 'Cintia Di Grazia', email: 'cintiadigrazia@gmail.com', phone: '+549 221 614-2863' },
  { name: 'Mariano Mediavilla', email: 'marianomediavilla.pba@gmail.com', phone: '+549 11 6210-8377' },
  { name: 'Marina Raggio', email: 'marinaraggioambientales@gmail.com', phone: '+549 221 418-4274' },
  { name: 'Luciana Lugones', email: 'lucianalugones@gsuite.fcnym.unlp.edu.ar', phone: '+549 221 543-5150' },
  { name: 'Pablo Giner', email: 'pabloginer76@gmail.com', phone: '+549 221 418-7203' },
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

// --- PROYECTISTAS EXTERNOS (NO tienen permiso de acceso, solo para contacto técnico) ---
const EXTERNAL_PROYECTISTAS: AuthorizedUser[] = [
  { name: 'Andrea Ferro', email: 'mariandrea_ferro@yahoo.com.ar' },
  { name: 'Constanza Alí', email: 'constanzaali.dph@gmail.com' },
  { name: 'Fabricio Pesch', email: 'fabriciopesch@yahoo.com.ar' },
  { name: 'Fermín Garath', email: '' },
  { name: 'Francisco Espil Nosa', email: 'fespil@serman.com.ar' },
  { name: 'Gustavo Bollini', email: 'gustavobollini@yahoo.com.ar' },
  { name: 'Iván Brielfritsch', email: 'ivangabrielfritsch@gmail.com' },
  { name: 'Javier Bodega', email: 'Javierbodega@gmail.com' },
  { name: 'Joaquín Bonoldi', email: 'joaquin.bonoldi@gmail.com' },
  { name: 'Jorge Bidegorry', email: 'jorgebidegorry@gmail.com' },
  { name: 'José Luis Donantueno', email: 'donantueno@gmail.com' },
  { name: 'Laura Agabios', email: 'lagabios@hotmail.com' },
  { name: 'Leandro Mugetti', email: 'dpoh.proyectos@gmail.com' },
  { name: 'Lucas Acha', email: 'achalucas94@gmail.com' },
  { name: 'Luciano Almirón', email: 'lucianosixtoalmiron@gmail.com' },
  { name: 'Luciano Rossi', email: 'rossilucianodph@gmail.com' },
  { name: 'Marcela Busquets', email: 'marcelabusquets@yahoo.com.ar' },
  { name: 'Marcelo Sarubi', email: 'mmsarub@hotmail.com' },
  { name: 'Mariana Palma', email: '' },
  { name: 'Natalia Bormape', email: 'nataliabormape@hotmail.com' },
  { name: 'Roberto Sciarrone', email: 'rsciarrone@gmail.com' },
  { name: 'Romina Barán', email: 'rominabaran@hotmail.com' },
  { name: 'Tadeo Turdo', email: 'tadeo.turdo@gmail.com' },
  { name: 'Víctor Barros', email: 'vhbarros07@gmail.com' },
  { name: 'Víctor Suárez', email: 'suarezvictorh@gmail.com' },
  { name: 'Yuliano Donantueno', email: 'yulianod@gmail.com' },
];

/**
 * Lista unificada para el reconocimiento de nombres en las descripciones de Trello.
 * Permite que ParticipantBadge encuentre emails para enviar correos.
 */
export const WHITELIST: AuthorizedUser[] = [...INTERNAL_STAFF, ...EXTERNAL_PROYECTISTAS];

/**
 * Valida si un email pertenece al personal interno con permiso de logueo.
 */
export function isUserAuthorized(email: string | null): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  
  // IMPORTANTE: Solo el personal interno (INTERNAL_STAFF) puede entrar al portal.
  return INTERNAL_STAFF.some(
    (authorized) => authorized.email.trim().toLowerCase() === normalizedEmail
  );
}
