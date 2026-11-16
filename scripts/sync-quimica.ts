import fs from 'fs';
import path from 'path';

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

import { getAdminFirestore } from '../src/firebase/admin';
import { syncProjectGisLayers } from '../src/services/gis-service';

async function main() {
  const projectCode = 'RSA_QUIMICA';
  const gisFolderId = '118dEk9ynbXV45OBuxJhV9pa5XnhEbr3u';
  const projectName = 'Monitoreo Químico Río Salado (RSA Química)';

  console.log(`[1] Registrando proyecto ${projectCode} en Firestore...`);
  const db = getAdminFirestore();
  if (db) {
    await db.collection('projects').doc(projectCode).set({
      code: projectCode,
      cuencaId: 'rsa',
      name: projectName,
      cuenca: 'rsa',
      title: projectName,
      trelloListName: 'Cuenca del Río Salado',
      gisFolderId: gisFolderId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`  -> Documento projects/${projectCode} guardado correctamente.`);
  }

  console.log(`\n[2] Iniciando sincronización GIS para ${projectCode} (${gisFolderId})...`);
  const startTime = Date.now();
  const layers = await syncProjectGisLayers(projectCode, gisFolderId, (prog) => {
    const barLength = 20;
    const filled = Math.round((prog.percent / 100) * barLength);
    const bar = '█'.repeat(filled) + '-'.repeat(barLength - filled);
    process.stdout.write(
      `\r  [${bar}] ${prog.percent}% | ${prog.current}/${prog.total}: ${prog.layerName.substring(0, 30).padEnd(30)}`
    );
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n[3] Sincronización exitosa! ${layers.length} capas compiladas en ${durationSec}s.`);
  layers.forEach((l, idx) => {
    console.log(`  ${idx + 1}. [${l.category.toUpperCase()}] ${l.name} (${l.geometryType}, ${l.featureCount} features, ${l.sourceProjection})`);
  });
}

main().catch(err => {
  console.error('\n[ERROR] Falló la sincronización:', err);
  process.exit(1);
});

