import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env
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

// Proyecto Piloto: RSA041 (Mechita - Alberti)
const PILOT_PROJECT = {
  code: 'RSA041',
  name: 'Desagües pluviales Mechita (Alberti)',
  gisFolderId: '1B1QDb6Nh05VxUjfk1fnn3ZvVXq31TBUJ',
};

async function runPilotSync() {
  console.log(`\n===============================================================`);
  console.log(`INICIANDO INGESTA PILOTO DRIVE B: [${PILOT_PROJECT.code}] ${PILOT_PROJECT.name}`);
  console.log(`Carpeta GIS en Drive: ${PILOT_PROJECT.gisFolderId}`);
  console.log(`Filtro estricto: SÓLO CAPAS VECTORIALES (SHP, JSON, KML) - RÁSTERES EXCLUIDOS`);
  console.log(`===============================================================\n`);

  const startTime = Date.now();

  try {
    const layers = await syncProjectGisLayers(
      PILOT_PROJECT.code,
      PILOT_PROJECT.gisFolderId,
      (progress) => {
        const barLength = 25;
        const filled = Math.round((progress.percent / 100) * barLength);
        const bar = '█'.repeat(filled) + '-'.repeat(barLength - filled);
        process.stdout.write(
          `\r[${bar}] ${progress.percent}% | Capa ${progress.current}/${progress.total}: ${progress.layerName.padEnd(35).substring(0, 35)}`
        );
      }
    );

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n===============================================================`);
    console.log(`¡ÉXITO TOTAL! Sincronización finalizada en ${elapsedSec}s`);
    console.log(`Total de capas vectoriales procesadas: ${layers.length}`);
    console.log(`===============================================================`);

    console.log('\nDETALLE DE CAPAS REGISTRADAS EN FIREBASE STORAGE Y FIRESTORE:');
    layers.forEach((l, idx) => {
      console.log(
        ` ${idx + 1}. [${l.category.toUpperCase()}] ${l.title.padEnd(35)} | Geometría: ${l.geometryType.padEnd(14)} | Features: ${String(l.featureCount).padStart(5)} | BBOX: [${l.bbox.map(n => n.toFixed(3)).join(', ')}]`
      );
    });

    console.log(`\nProyecto "${PILOT_PROJECT.code}" listo para visualizarse en CartoDEA.`);
  } catch (err: any) {
    console.error(`\nError en la sincronización piloto:`, err);
  }
}

runPilotSync().catch(console.error);
