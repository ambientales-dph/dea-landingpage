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

const rrqFolderId = '15zKUw4kgfR4WIpCZZp_IE5bFtV-6kXzZ'; // RRQ - CUENCA RIO RECONQUISTA
const VECTOR_DIRS = ['shp', 'json', 'geojson', 'kml', 'kmz'];

async function scanAndEstimateRrq() {
  console.log(`\n===============================================================`);
  console.log(`ESCANEANDO Y ESTIMANDO PESO VECTORIAL: CUENCA RÍO RECONQUISTA (RRQ)`);
  console.log(`Carpeta Raíz Drive B: ${rrqFolderId}`);
  console.log(`Filtro estricto: SÓLO CAPAS VECTORIALES (Shapefiles, GeoJSON, KML)`);
  console.log(`===============================================================\n`);

  const projRes = await drive.files.list({
    q: `'${rrqFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100,
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const projs = projRes.data.files || [];
  console.log(`Total proyectos encontrados en RRQ: ${projs.length}\n`);

  let totalVectorLayers = 0;
  let totalShpCount = 0;
  let totalJsonCount = 0;
  let totalKmlCount = 0;
  let totalRawSizeBytes = 0;

  const validProjects = [];
  const projectsWithoutGis = [];
  const projectsGisWithoutVectors = [];

  for (let i = 0; i < projs.length; i++) {
    const p = projs[i];
    const subRes = await drive.files.list({
      q: `'${p.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const subFolders = subRes.data.files || [];
    const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');

    if (!gisFolder) {
      projectsWithoutGis.push(p.name);
      continue;
    }

    // Inspeccionar subcarpetas dentro de /GIS
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
    const detectedCategories = [];

    for (const dir of gisDirs) {
      const dirName = dir.name.trim().toLowerCase();
      if (!VECTOR_DIRS.includes(dirName)) continue;
      detectedCategories.push(dirName);

      const fRes = await drive.files.list({
        q: `'${dir.id}' in parents and trashed = false`,
        fields: 'files(id, name, size)',
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files = fRes.data.files || [];

      if (dirName === 'shp') {
        const shpFiles = files.filter(f => f.name.toLowerCase().endsWith('.shp'));
        pShp += shpFiles.length;
        files.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
      } else if (dirName === 'json' || dirName === 'geojson') {
        const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json') || f.name.toLowerCase().endsWith('.geojson'));
        pJson += jsonFiles.length;
        jsonFiles.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
      } else if (dirName === 'kml' || dirName === 'kmz') {
        const kmlFiles = files.filter(f => f.name.toLowerCase().endsWith('.kml') || f.name.toLowerCase().endsWith('.kmz'));
        pKml += kmlFiles.length;
        kmlFiles.forEach(f => { pSizeBytes += parseInt(f.size || '0', 10); });
      }
    }

    const pTotalLayers = pShp + pJson + pKml;
    if (pTotalLayers > 0) {
      totalVectorLayers += pTotalLayers;
      totalShpCount += pShp;
      totalJsonCount += pJson;
      totalKmlCount += pKml;
      totalRawSizeBytes += pSizeBytes;

      const pSizeMB = (pSizeBytes / (1024 * 1024)).toFixed(2);
      validProjects.push({
        id: p.id,
        name: p.name,
        gisFolderId: gisFolder.id,
        layers: { shp: pShp, json: pJson, kml: pKml, total: pTotalLayers },
        rawSizeBytes: pSizeBytes,
        rawSizeMB: pSizeMB,
        categories: detectedCategories,
      });

      console.log(`[✔ CONTIENE VECTORES] ${p.name}`);
      console.log(`    -> Capas: ${pTotalLayers} (${pShp} SHP, ${pJson} JSON, ${pKml} KML) | Peso crudo: ${pSizeMB} MB\n`);
    } else {
      projectsGisWithoutVectors.push(p.name);
    }
  }

  const totalRawMB = (totalRawSizeBytes / (1024 * 1024)).toFixed(2);
  const estimatedCompiledMB = (totalRawSizeBytes * 0.8 / (1024 * 1024)).toFixed(2);

  console.log(`\n===============================================================`);
  console.log(`REPORTE DE ESTIMACIÓN: CUENCA RÍO RECONQUISTA (RRQ)`);
  console.log(`===============================================================`);
  console.log(`- Total proyectos en la carpeta RRQ: ${projs.length}`);
  console.log(`- Proyectos con carpeta /GIS: ${validProjects.length + projectsGisWithoutVectors.length}`);
  console.log(`- Proyectos con capas vectoriales válidas: ${validProjects.length}`);
  console.log(`- Proyectos sin carpeta /GIS: ${projectsWithoutGis.length}`);
  console.log(`- Total capas vectoriales a procesar: ${totalVectorLayers}`);
  console.log(`  * Shapefiles (.shp): ${totalShpCount}`);
  console.log(`  * GeoJSON / JSON: ${totalJsonCount}`);
  console.log(`  * KML / KMZ: ${totalKmlCount}`);
  console.log(`- Peso de archivos crudos en Drive: ${totalRawMB} MB`);
  console.log(`- Estimación GeoJSON reproyectado en Storage: ~${estimatedCompiledMB} MB`);
  console.log(`===============================================================\n`);

  fs.writeFileSync(
    path.resolve(__dirname, 'inventario_rrq_drive_b.json'),
    JSON.stringify({
      rrqFolderId,
      totalProjects: projs.length,
      validProjects,
      projectsWithoutGis,
      projectsGisWithoutVectors,
      summary: {
        totalVectorLayers,
        totalShpCount,
        totalJsonCount,
        totalKmlCount,
        totalRawMB,
        estimatedCompiledMB,
      }
    }, null, 2),
    'utf8'
  );
  console.log(`Inventario detallado guardado en scripts/inventario_rrq_drive_b.json`);
}

scanAndEstimateRrq().catch(console.error);
