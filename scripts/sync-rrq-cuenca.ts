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

// Lista de proyectos de Cuenca RRQ a procesar
const RRQ_PROJECTS = [
  'RRQ004', // D.P. Cuenca Las Cabañas (Ituzaingó)
  'RRQ005', // Limpieza Río Reconquista
  'RRQ006', // Zanjón Madero - San Martín
  'RRQ009', // Refuncionalización Presa Roggero
  'RRQ021', // Puente sobre Arroyo Los Berros y obras accesorias
  'RRQ022', // Saneamiento Hidráulico Cuenca Defensa – San Miguel
  'RRQ023', // Desagües Pluviales San Martín
];

async function runRrqBatch() {
  console.log(`\n===============================================================`);
  console.log(`INICIANDO INGESTA SECUENCIAL: CUENCA RÍO RECONQUISTA (RRQ) - DRIVE B`);
  console.log(`Total proyectos a procesar: ${RRQ_PROJECTS.length}`);
  console.log(`Filtro estricto: SÓLO CAPAS VECTORIALES (RÁSTERES EXCLUIDOS)`);
  console.log(`===============================================================\n`);

  const globalStart = Date.now();
  let totalLayersCreated = 0;
  const successfulProjects: string[] = [];
  const failedProjects: { code: string; error: string }[] = [];

  for (let i = 0; i < RRQ_PROJECTS.length; i++) {
    const code = RRQ_PROJECTS[i];
    const projectInfo = STANDARDIZED_PROJECTS[code];
    if (!projectInfo) {
      console.warn(`[WARN] No se encontró configuración para ${code}`);
      continue;
    }

    console.log(`\n---------------------------------------------------------------`);
    console.log(`[${i + 1}/${RRQ_PROJECTS.length}] Procesando ${code}: "${projectInfo.name}"`);
    console.log(`Folder ID: ${projectInfo.gisFolderId}`);
    console.log(`---------------------------------------------------------------`);

    const pStart = Date.now();
    try {
      const layers = await syncProjectGisLayers(code, projectInfo.gisFolderId, (prog) => {
        const barLength = 20;
        const filled = Math.round((prog.percent / 100) * barLength);
        const bar = '█'.repeat(filled) + '-'.repeat(barLength - filled);
        process.stdout.write(
          `\r  [${bar}] ${prog.percent}% | ${prog.current}/${prog.total}: ${prog.layerName.substring(0, 30).padEnd(30)}`
        );
      });

      const pSec = ((Date.now() - pStart) / 1000).toFixed(1);
      console.log(`\n  -> ÉXITO: ${layers.length} capas vectoriales compiladas en ${pSec}s`);
      totalLayersCreated += layers.length;
      successfulProjects.push(`${code} (${layers.length} capas)`);
    } catch (err: any) {
      console.error(`\n  -> ERROR en ${code}:`, err.message);
      failedProjects.push({ code, error: err.message });
    }
  }

  const totalMin = ((Date.now() - globalStart) / 60000).toFixed(1);
  console.log(`\n\n===============================================================`);
  console.log(`REPORTE FINAL DE INGESTA - CUENCA RÍO RECONQUISTA (RRQ)`);
  console.log(`Tiempo total transcurrido: ${totalMin} minutos`);
  console.log(`Proyectos exitosos (${successfulProjects.length}): ${successfulProjects.join(', ')}`);
  if (failedProjects.length > 0) {
    console.log(`Proyectos con error (${failedProjects.length}):`, failedProjects);
  }
  console.log(`TOTAL DE CAPAS VECTORIALES PROCESADAS: ${totalLayersCreated}`);
  console.log(`===============================================================\n`);
}

runRrqBatch().catch(console.error);
