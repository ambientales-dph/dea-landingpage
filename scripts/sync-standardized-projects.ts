import fs from 'fs';
import path from 'path';

// Cargar .env de portal_dea
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

import { syncProjectGisLayers } from '../src/services/gis-service';

const PROJECTS_TO_SYNC = [
  {
    code: 'RSA060',
    name: 'Restitución terraplén de defensa Carhué',
    gisFolderId: '13s8GT_nVCAFAh6OEHZ-Yz_jH3xrxJixY',
  },
  {
    code: 'RSA062',
    name: 'Coronel Suárez',
    gisFolderId: '10_nJgUZfeXro-K-fHZeGZXYMzG6tzQ8Y',
  },
  {
    code: 'RSA069',
    name: 'Entubamiento Canal Llambías - Trenque Lauquen',
    gisFolderId: '1hGeYDRM3KahzS_YWq61W9CD1cE1ipGfn',
  },
  {
    code: 'MAR013',
    name: 'Prueba CC - Cuenca Matanza-Riachuelo',
    gisFolderId: '1zLNmYe1qlMFzZ99G6Le0RUpQ09lBqV9T',
  },
];

async function run() {
  console.log(`\n======================================================`);
  console.log(`INICIANDO SINCRONIZACIÓN DE ${PROJECTS_TO_SYNC.length} PROYECTOS ESTANDARIZADOS`);
  console.log(`======================================================\n`);

  for (const p of PROJECTS_TO_SYNC) {
    console.log(`\n------------------------------------------------------`);
    console.log(`Procesando [${p.code}] ${p.name} (GIS Folder: ${p.gisFolderId})...`);
    console.log(`------------------------------------------------------`);

    try {
      const layers = await syncProjectGisLayers(p.code, p.gisFolderId);
      console.log(` -> ÉXITO: Se compilaron e indexaron ${layers.length} capas para ${p.code}`);
    } catch (err: any) {
      console.error(` -> ERROR sincronizando ${p.code}:`, err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`SINCRONIZACIÓN COMPLETADA CON ÉXITO.`);
  console.log(`======================================================\n`);
}

run().catch(console.error);
