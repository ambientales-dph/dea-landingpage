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

import { syncProjectGisLayers, STANDARDIZED_PROJECTS } from '../src/services/gis-service';

async function runSyncRLU019() {
  const code = 'RLU019';
  const projectInfo = STANDARDIZED_PROJECTS[code];
  if (!projectInfo) {
    console.error(`No se encontró configuración para ${code}`);
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`SINCRONIZANDO: ${code} - "${projectInfo.name}"`);
  console.log(`Carpeta GIS: ${projectInfo.gisFolderId}`);
  console.log(`===============================================================\n`);

  const start = Date.now();
  try {
    const layers = await syncProjectGisLayers(code, projectInfo.gisFolderId, (prog) => {
      const barLength = 20;
      const filled = Math.round((prog.percent / 100) * barLength);
      const bar = '█'.repeat(filled) + '-'.repeat(barLength - filled);
      process.stdout.write(
        `\r  [${bar}] ${prog.percent}% | ${prog.current}/${prog.total}: ${prog.layerName.substring(0, 30).padEnd(30)}`
      );
    });

    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n\n-> Sincronización exitosa: ${layers.length} capas procesadas en ${sec}s`);
    layers.forEach(l => {
      console.log(`   * [${l.category}] ${l.name} - Geometría: ${l.geometryType}, Features: ${l.featureCount}`);
    });
  } catch (err: any) {
    console.error(`\n-> Error sincronizando ${code}:`, err);
  }
}

runSyncRLU019().catch(console.error);
