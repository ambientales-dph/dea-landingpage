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

const inv = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'inventario_rsa_drive_b.json'), 'utf8'));

const VECTOR_DIRS = ['shp', 'json', 'geojson', 'kml', 'kmz'];

async function estimate() {
  console.log(`Analizando capas VECTORIALES para los ${inv.projectsWithGis.length} proyectos con /GIS en RSA...\n`);
  
  let totalVectorLayers = 0;
  let totalShpCount = 0;
  let totalJsonCount = 0;
  let totalKmlCount = 0;
  let totalRawSizeBytes = 0;

  const validProjects = [];

  for (const p of inv.projectsWithGis) {
    const hasVectorDir = p.categories.some(c => VECTOR_DIRS.includes(c));
    if (!hasVectorDir) continue;

    // Obtener subcarpetas del GIS
    const subRes = await drive.files.list({
      q: `'${p.gisFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const subDirs = subRes.data.files || [];
    
    let pShp = 0;
    let pJson = 0;
    let pKml = 0;
    let pSizeBytes = 0;

    for (const dir of subDirs) {
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

      const pSizeMb = (pSizeBytes / (1024 * 1024)).toFixed(2);
      console.log(`[${p.name.substring(0, 10)}] ${p.name.substring(0, 55)}: ${pTotalLayers} capas (SHP: ${pShp}, JSON: ${pJson}, KML: ${pKml}) ~ ${pSizeMb} MB`);
      validProjects.push({
        name: p.name,
        gisFolderId: p.gisFolderId,
        layers: pTotalLayers,
        sizeMb: pSizeMb,
      });
    }
  }

  const totalMb = (totalRawSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`RESUMEN ESTIMADO PARA CUENCA RÍO SALADO (DRIVE B):`);
  console.log(`- Proyectos con capas vectoriales: ${validProjects.length}`);
  console.log(`- Total de capas a subir: ${totalVectorLayers}`);
  console.log(`  * Shapefiles: ${totalShpCount}`);
  console.log(`  * GeoJSONs: ${totalJsonCount}`);
  console.log(`  * KML / KMZ: ${totalKmlCount}`);
  console.log(`- Tamaño total bruto en Drive: ${totalMb} MB`);
  console.log(`- Impacto estimado en Firebase Storage (GeoJSONs optimizados): ~${(totalMb * 0.45).toFixed(1)} a ${(totalMb * 0.7).toFixed(1)} MB`);
  console.log(`======================================================\n`);
}

estimate();
