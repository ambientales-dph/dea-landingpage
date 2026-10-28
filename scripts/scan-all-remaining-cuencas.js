const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Cargar .env de portal_dea
const envPath = path.resolve(__dirname, '..', '.env');
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

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const REMAINING_CUENCAS = [
  { code: 'ARR', id: '1-UDl3ZniJ-NrT51vlzJfOtmV7rhqD7Yf', name: 'Cuenca Ríos Arrecifes y Baradero' },
  { code: 'RPS', id: '1hqm7heYAkMvYaNk4YuHs-KJZMT9rdPUS', name: 'Vertiente Río de la Plata Superior' },
  { code: 'RPM', id: '1kBYm5ruW7teNZUMPyfMwQX8T5a1hatrk', name: 'Vertiente Río de la Plata Intermedia' },
  { code: 'RCO', id: '1VXaGIK7ZuWVkvW6HTq6tfSEzkzKp4k3o', name: 'Cuenca Río Colorado' },
  { code: 'VAS', id: '1i2Q5qplrU-7vUiSR3kvQMH5jghcZuc4Z', name: 'Vertiente Atlántica Sur' },
  { code: 'RAR', id: '13cYT3lU8gN93Gpm9JcQiG0JdrPzvKsUI', name: 'Cuenca Río Areco' },
  { code: 'VAE', id: '1CiJKQtMlDTzqw1Q1-nRyNvfWm1DoIDVU', name: 'Vertiente Atlántica Este' },
  { code: 'CM', id: '1zeLLFl6hAHwScpVJF3RxTx8APCET-5JX', name: 'Canales de Marea' },
  { code: 'RNG', id: '1MpL_UkMcEZv5RkmoeAMSysJhrfzLQ3aa', name: 'Cuenca del Río Negro' },
  { code: 'QQG', id: '1KdfS4brvjQ4vXsxgOBeOAf7-PebIE4w2', name: 'Cuenca Quequén Grande' },
  { code: 'RSB', id: '1D_L7UfEX_tnXHYnClCp_8puEZP5v7U9P', name: 'Cuenca Samborombón' },
  { code: 'CRZ', id: '1BajMJY_NXMcUaNVeaT-gG5sAEnISvtOF', name: 'Cuenca Arroyo de la Cruz' },
  { code: 'RPI', id: '1pxweZIAC0XNpa5hK8FPryRUXy6phFTnE', name: 'Vertiente Río de la Plata Inferior' },
  { code: 'SN', id: '13LPuGoTl2TvtWCdltrKryV1bc0fq-Byt', name: 'Cuenca Sin Nombre' },
];

const VECTOR_DIRS = ['shp', 'json', 'geojson', 'kml', 'kmz'];

async function scanAllRemaining() {
  console.log(`\n===============================================================`);
  console.log(`ESCANEANDO PROYECTOS CON /GIS EN TODAS LAS CUENCAS PENDIENTES`);
  console.log(`Total cuencas a evaluar: ${REMAINING_CUENCAS.length}`);
  console.log(`===============================================================\n`);

  const allValidProjects = [];
  let globalTotalLayers = 0;
  let globalTotalBytes = 0;

  for (const c of REMAINING_CUENCAS) {
    console.log(`\n--- Evaluando ${c.code}: ${c.name} ---`);
    const pRes = await drive.files.list({
      q: `'${c.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const projs = pRes.data.files || [];

    for (const p of projs) {
      const subRes = await drive.files.list({
        q: `'${p.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const subFolders = subRes.data.files || [];
      const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');
      if (!gisFolder) continue;

      // Inspeccionar subcarpetas de GIS
      const gisSubRes = await drive.files.list({
        q: `'${gisFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const gisDirs = gisSubRes.data.files || [];

      let pShp = 0;
      let pJson = 0;
      let pKml = 0;
      let pSizeBytes = 0;

      for (const dir of gisDirs) {
        const dirName = dir.name.trim().toLowerCase();
        if (!VECTOR_DIRS.includes(dirName)) continue;

        const fRes = await drive.files.list({
          q: `'${dir.id}' in parents and trashed = false`,
          fields: 'files(id, name, size)',
          pageSize: 200,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const files = fRes.data.files || [];

        if (dirName === 'shp') {
          pShp += files.filter(f => f.name.toLowerCase().endsWith('.shp')).length;
          files.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
        } else if (dirName === 'json' || dirName === 'geojson') {
          const jf = files.filter(f => f.name.toLowerCase().endsWith('.json') || f.name.toLowerCase().endsWith('.geojson'));
          pJson += jf.length;
          jf.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
        } else if (dirName === 'kml' || dirName === 'kmz') {
          const kf = files.filter(f => f.name.toLowerCase().endsWith('.kml') || f.name.toLowerCase().endsWith('.kmz'));
          pKml += kf.length;
          kf.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
        }
      }

      const pTotalLayers = pShp + pJson + pKml;
      if (pTotalLayers > 0) {
        // Extraer código de proyecto (ej: ARR001, RPS010)
        const match = p.name.match(/^([A-Z0-9]+)\s*[-_]/);
        const code = match ? match[1] : p.name.split(' ')[0].replace(/[^A-Z0-9]/gi, '');
        const cleanName = p.name.replace(/^[A-Z0-9]+\s*[-_]\s*/, '').trim();

        const pData = {
          cuencaCode: c.code,
          code,
          fullName: p.name,
          cleanName,
          gisFolderId: gisFolder.id,
          layers: { shp: pShp, json: pJson, kml: pKml, total: pTotalLayers },
          sizeBytes: pSizeBytes,
          sizeMB: (pSizeBytes / (1024 * 1024)).toFixed(2),
        };

        allValidProjects.push(pData);
        globalTotalLayers += pTotalLayers;
        globalTotalBytes += pSizeBytes;

        console.log(`  [✔ GIS VECTORES] ${code}: "${cleanName}" -> ${pTotalLayers} capas (${pData.sizeMB} MB)`);
      }
    }
  }

  const globalMB = (globalTotalBytes / (1024 * 1024)).toFixed(2);
  const estimatedStorageMB = (globalTotalBytes * 0.75 / (1024 * 1024)).toFixed(2);

  console.log(`\n===============================================================`);
  console.log(`INVENTARIO TOTAL CUENCAS PENDIENTES:`);
  console.log(`- Proyectos con capas vectoriales válidas: ${allValidProjects.length}`);
  console.log(`- Total de capas vectoriales a procesar: ${globalTotalLayers}`);
  console.log(`- Peso crudo total en Drive: ${globalMB} MB`);
  console.log(`- Estimación compilado en Firebase Storage: ~${estimatedStorageMB} MB`);
  console.log(`===============================================================\n`);

  fs.writeFileSync(
    path.resolve(__dirname, 'inventario_resto_cuencas.json'),
    JSON.stringify({
      totalProjects: allValidProjects.length,
      globalTotalLayers,
      globalMB,
      estimatedStorageMB,
      projects: allValidProjects,
    }, null, 2),
    'utf8'
  );
  console.log('Guardado en scripts/inventario_resto_cuencas.json');
}

scanAllRemaining().catch(console.error);
