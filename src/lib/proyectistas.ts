
/**
 * Lista estática de proyectistas (Legacy).
 * Esta lista se mantendrá hasta que se complete la migración a Firestore.
 */
export const PROYECTISTAS = [
  'Romina Barán',
  'Javier Bodega',
  'Luciano Almirón',
  'Marcelo Sarubi',
  'Andrea Ferro',
  'Leandro Mugetti',
  'Marcela Busquets',
  'Laura Agabios',
  'Joaquín Bonoldi',
  'Iván Brielfritsch',
  'Yuliano Donantueno',
  'José Luis Donantueno',
  'Jorge Bidegorry',
  'Constanza Alí',
  'Lucas Acha',
  'Luciano Rossi',
  'Mariana Palma',
  'Fabricio Pesch',
  'Víctor Suárez',
  'Roberto Sciarrone',
  'Francisco Espil Nosa',
  'Fermín Garath',
  'Gustavo Bollini',
  'Víctor Barros',
  'Natalia Bormape',
  'Tadeo Turdo',
].sort((a, b) => a.localeCompare(b));

export interface ProyectistaConfig {
  name: string;
  email?: string;
  phone?: string;
}
